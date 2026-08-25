/* Folds the app into one self-contained HTML file for the conference machine:
   stylesheets, scripts, fonts and the logo all become inline or data URIs, so
   the deliverable is a single file that can be opened from a USB stick.

   node tools/bundle.mjs [outputPath]
*/

import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const OUT = resolve(process.argv[2] || '../SCE_LEAP_2026.html');
const ROOT = resolve('.');

const MIME = {
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

async function dataUri(path) {
  const ext = path.slice(path.lastIndexOf('.'));
  const mime = MIME[ext];
  if (!mime) throw new Error(`No MIME type registered for ${path}`);
  return `data:${mime};base64,${(await readFile(path)).toString('base64')}`;
}

/* Inline every url() a stylesheet points at, resolved from that sheet's own
   directory the way the browser would. */
async function inlineCss(path) {
  const css = await readFile(path, 'utf8');
  const base = dirname(path);
  const refs = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)];

  let out = css;
  for (const [match, ref] of refs) {
    if (ref.startsWith('data:')) continue;
    out = out.replace(match, `url('${await dataUri(resolve(base, ref))}')`);
  }
  return out;
}

let html = await readFile(join(ROOT, 'index.html'), 'utf8');

const styles = [...html.matchAll(/[ \t]*<link rel="stylesheet" href="([^"]+)" \/>\n/g)];
for (const [match, href] of styles) {
  const css = await inlineCss(join(ROOT, href));
  html = html.replace(match, `    <style>\n${css}\n    </style>\n`);
}

const scripts = [...html.matchAll(/[ \t]*<script src="([^"]+)"><\/script>\n/g)];
for (const [match, src] of scripts) {
  const js = await readFile(join(ROOT, src), 'utf8');
  // A literal </script> inside a string would close the tag early.
  html = html.replace(match, `    <script>\n${js.replace(/<\/script/gi, '<\\/script')}\n    </script>\n`);
}

const images = [...html.matchAll(/src="(assets\/img\/[^"]+)"/g)];
for (const [, src] of images) {
  html = html.split(`src="${src}"`).join(`src="${await dataUri(join(ROOT, src))}"`);
}

const leftovers = [...html.matchAll(/(?:src|href)="(?!data:|#)([^"]+)"/g)].map((m) => m[1]);
if (leftovers.length) throw new Error(`Still referencing external files: ${leftovers.join(', ')}`);

await writeFile(OUT, html);
const { size } = await stat(OUT);
console.log(`${OUT}\n${(size / 1024 / 1024).toFixed(2)} MB, ${styles.length} stylesheets, ${scripts.length} scripts inlined`);
