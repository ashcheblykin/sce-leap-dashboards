/* Pixel diff between two screenshot directories. Development only.

   node tools/diff-shots.mjs <baselineDir> [currentDir]

   Exits 0 when every shared frame is identical, 1 otherwise. This is the
   acceptance gate for any change that claims not to touch the picture: run
   shoot.mjs into a baseline directory, make the change, shoot again, diff.

   PNG decoding is done here rather than through a library because the whole
   toolchain is deliberately dependency-free — Node and Chrome, nothing else.
   Chrome's Page.captureScreenshot always writes 8-bit non-interlaced truecolor
   (with or without alpha), so only those two forms are handled; anything else
   is reported rather than guessed at.
*/

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateSync, deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const BASE = resolve(process.argv[2] || 'tools/shots-baseline');
const CURR = resolve(process.argv[3] || 'tools/shots');
const OUT = process.env.DIFF_OUT ? resolve(process.env.DIFF_OUT) : null;

/* --- PNG ---------------------------------------------------------------- */

function chunks(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  const out = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    out.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return out;
}

/** Decode to { width, height, rgba } with 4 bytes per pixel. */
function decode(buf) {
  const cs = chunks(buf);
  const ihdr = cs.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('no IHDR');

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const color = ihdr.data[9];
  const interlace = ihdr.data[12];

  if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) {
    throw new Error(`unsupported PNG: depth=${depth} colorType=${color} interlace=${interlace}`);
  }

  const channels = color === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(
    Buffer.concat(cs.filter((c) => c.type === 'IDAT').map((c) => c.data)),
  );

  /* Undo the per-scanline filters in place, walking the raw buffer rather than
     copying each line out: a 2880x1152 frame is 13 MB of samples and this runs
     once per frame per side. */
  const out = Buffer.allocUnsafe(width * height * channels);
  let prev = Buffer.alloc(stride);
  for (let y = 0, p = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    line.copy(cur);

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          cur[i] = (cur[i] + a) & 0xff;
          break;
        case 2:
          cur[i] = (cur[i] + b) & 0xff;
          break;
        case 3:
          cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          throw new Error(`unknown filter ${filter} on row ${y}`);
      }
    }
    prev = cur;
  }

  if (channels === 4) return { width, height, rgba: out };

  const rgba = Buffer.allocUnsafe(width * height * 4);
  for (let i = 0, j = 0; i < out.length; i += 3, j += 4) {
    rgba[j] = out[i];
    rgba[j + 1] = out[i + 1];
    rgba[j + 2] = out[i + 2];
    rgba[j + 3] = 255;
  }
  return { width, height, rgba };
}

/* Minimal encoder for the optional difference map — one IDAT, filter 0. */
function encode(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.allocUnsafe((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (b) => {
    let c = 0xffffffff;
    for (const byte of b) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --- Compare ------------------------------------------------------------ */

const png = (d) => d.filter((f) => f.endsWith('.png')).sort();
let baseFiles, currFiles;
try {
  baseFiles = png(await readdir(BASE));
  currFiles = png(await readdir(CURR));
} catch (err) {
  console.error(`cannot read a shot directory: ${err.message}`);
  process.exit(2);
}

const shared = baseFiles.filter((f) => currFiles.includes(f));
const onlyBase = baseFiles.filter((f) => !currFiles.includes(f));
const onlyCurr = currFiles.filter((f) => !baseFiles.includes(f));

if (OUT) await mkdir(OUT, { recursive: true });

let failed = 0;
console.log(`comparing ${shared.length} frames\n  baseline ${BASE}\n  current  ${CURR}\n`);

for (const name of shared) {
  let a, b;
  try {
    a = decode(await readFile(join(BASE, name)));
    b = decode(await readFile(join(CURR, name)));
  } catch (err) {
    console.log(`  ${name.padEnd(34)} DECODE FAILED — ${err.message}`);
    failed++;
    continue;
  }

  if (a.width !== b.width || a.height !== b.height) {
    console.log(`  ${name.padEnd(34)} SIZE ${a.width}x${a.height} -> ${b.width}x${b.height}`);
    failed++;
    continue;
  }

  let differing = 0;
  let maxDelta = 0;
  const map = OUT ? Buffer.alloc(a.width * a.height * 4) : null;
  for (let i = 0; i < a.rgba.length; i += 4) {
    const d = Math.max(
      Math.abs(a.rgba[i] - b.rgba[i]),
      Math.abs(a.rgba[i + 1] - b.rgba[i + 1]),
      Math.abs(a.rgba[i + 2] - b.rgba[i + 2]),
      Math.abs(a.rgba[i + 3] - b.rgba[i + 3]),
    );
    if (d) {
      differing++;
      if (d > maxDelta) maxDelta = d;
    }
    if (map) {
      /* Unchanged pixels darkened to a grey ghost, changed ones flagged red at
         the delta's own strength, so a diff map reads at a glance. */
      if (d) {
        map[i] = 255;
        map[i + 1] = 255 - Math.min(255, d * 2);
        map[i + 2] = 255 - Math.min(255, d * 2);
      } else {
        const grey = (a.rgba[i] + a.rgba[i + 1] + a.rgba[i + 2]) / 12;
        map[i] = map[i + 1] = map[i + 2] = grey;
      }
      map[i + 3] = 255;
    }
  }

  const total = a.width * a.height;
  if (differing) {
    failed++;
    const pct = ((differing / total) * 100).toFixed(4);
    console.log(
      `  ${name.padEnd(34)} ${String(differing).padStart(9)} px (${pct}%)  maxΔ ${maxDelta}`,
    );
    if (OUT) await writeFile(join(OUT, name), encode(a.width, a.height, map));
  } else {
    console.log(`  ${name.padEnd(34)} identical`);
  }
}

if (onlyBase.length) console.log(`\nonly in baseline: ${onlyBase.join(', ')}`);
if (onlyCurr.length) console.log(`only in current:  ${onlyCurr.join(', ')}`);

console.log(
  `\n${failed ? `${failed} of ${shared.length} frames differ` : `all ${shared.length} frames identical`}`,
);
if (OUT && failed) console.log(`difference maps written to ${OUT}`);
process.exit(failed || onlyBase.length || onlyCurr.length ? 1 : 0);
