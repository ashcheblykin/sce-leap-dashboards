/* Resize verification. Development only.

   Axion Gen's charts track their container at screen refresh rate: one shared
   ResizeObserver delivers after layout and before paint, and the chart is
   re-rendered synchronously in that callback (`SyncParentSize`'s flushSync), so
   the new geometry lands in the SAME frame as the new container size. rAF, a
   debounce or a plain setState all trail by a frame or two, and that lag is
   exactly what makes a resized panel look like it is chasing the pointer.

   This checks the vanilla port keeps that property, in three ways:

     1. after a viewport change, every chart SVG matches its own container
        exactly — measured in the first frame after the resize, with no waiting;
     2. no widget has a geometry transition at rest (a transition would make the
        gaps between panels breathe during a continuous drag) but every widget
        has one while a gesture is running;
     3. counted numbers survive a resize — a rebuilt SVG must not leave its
        centre readout at zero.

   node tools/resize.mjs
*/

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const PORT = 9744;
const PROFILE = join('/tmp', `leap-resize-${Date.now()}`);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--window-size=2880,1152',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--no-first-run',
  `--user-data-dir=${PROFILE}`,
]);
chrome.stderr.on('data', () => {});

let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {
    /* booting */
  }
  if (!wsUrl) await sleep(250);
}

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener('open', ok));

let id = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((ok, reject) => {
    const messageId = ++id;
    pending.set(messageId, { ok, reject });
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
}

async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

/* Headless Chrome only lays out and paints on demand, so a resize is not
   processed until something asks for a frame. One screenshot is that ask; the
   measurement below then reads the state of the very frame the resize produced,
   which is the property under test. */
async function frame() {
  await send('Page.captureScreenshot', { format: 'jpeg', quality: 1 });
}

const MEASURE = `(() => {
  const bad = [];
  let charts = 0;
  document.querySelectorAll('[data-grid-surface]:not([style*="none"]) .ax-chart-area').forEach((area) => {
    const svg = area.querySelector('.ax-svg');
    if (!svg) return;
    charts += 1;
    const w = Math.round(area.clientWidth);
    const h = Math.round(area.clientHeight);
    const sw = Math.round(parseFloat(svg.getAttribute('width')));
    const sh = Math.round(parseFloat(svg.getAttribute('height')));
    if (Math.abs(sw - w) > 1 || Math.abs(sh - h) > 1) {
      bad.push(area.closest('[data-grid-item]').getAttribute('data-grid-item') +
        ' svg ' + sw + 'x' + sh + ' vs area ' + w + 'x' + h);
    }
  });
  const zeros = [];
  document.querySelectorAll('[data-grid-surface]:not([style*="none"]) [data-count]').forEach((n) => {
    const target = parseFloat(n.getAttribute('data-count'));
    if (target !== 0 && /^0$|^0\\.0/.test(n.textContent.trim())) {
      zeros.push(n.closest('[data-grid-item]').getAttribute('data-grid-item') + ' "' + n.textContent + '"');
    }
  });
  return { charts, bad, zeros };
})()`;

const TRANSITIONS = `(() => {
  const item = document.querySelector('[data-grid-surface]:not([style*="none"]) [data-grid-item]');
  const read = () => {
    const s = getComputedStyle(item);
    return (s.transitionProperty + ' ' + s.transitionDuration).trim();
  };
  const rest = read();
  document.body.classList.add('grid-dragging');
  const dragging = read();
  document.body.classList.remove('grid-dragging');
  return { rest, dragging };
})()`;

await metrics(2880, 1152);
await send('Page.navigate', { url: `file://${ROOT}/index.html` });
await sleep(2200);
await evaluate(`document.getElementById('splashStart').click()`);
await sleep(1500);
for (let i = 0; i < 20; i++) {
  await frame();
  await sleep(25);
}

/* Mount every board once so all four are measured, then come back to the
   first: only the visible surface is probed, but a mounted board keeps its
   charts and its observers. */
async function goto(index) {
  await evaluate(`document.querySelectorAll('.nav-item')[${index}].click()`);
  await sleep(900);
  for (let i = 0; i < 8; i++) {
    await frame();
    await sleep(20);
  }
}

const t = await evaluate(TRANSITIONS);
console.log('=== geometry transition ===');
console.log(`  at rest   : ${t.rest}`);
console.log(`  dragging  : ${t.dragging}`);
/* What must be absent at rest is a GEOMETRY transition. The stagger's
   opacity/translate easing is fine and is what makes tiles arrive in sequence;
   transform / width / height are the ones that would make the gaps between
   panels breathe during a continuous drag. */
const GEOMETRY = ['transform', 'width', 'height'];
const restGeometry = GEOMETRY.filter((prop) =>
  new RegExp(`(^|[\\s,])${prop}([\\s,]|$)`).test(t.rest),
);
console.log(
  `  ${restGeometry.length === 0 ? 'OK' : 'FAIL'} — at rest no geometry transition, so a continuous resize tracks the container${
    restGeometry.length ? ` (found: ${restGeometry.join(', ')})` : ''
  }`,
);
console.log(
  `  ${t.dragging.includes('0.16s') ? 'OK' : 'FAIL'} — a gesture eases between snap steps (160ms, Axion grid.css)`,
);

/* Every step is measured in the first frame the new size produces. */
const STEPS = [
  [2880, 1152],
  [2400, 1000],
  [1920, 1080],
  [1600, 900],
  [1440, 900],
  [2880, 1152],
];

console.log('\n=== charts track their container, same frame ===');
let failures = 0;
/* Nav order, matching the original deliverable's four surfaces. */
const BOARDS = ['bigscreen', 'ecosystem', 'library', 'field'];
for (let b = 0; b < BOARDS.length; b++) {
  await goto(b);
  for (const [w, h] of STEPS) {
    await metrics(w, h);
    await frame();
    const r = await evaluate(MEASURE);
    const status = r.bad.length === 0 ? 'OK  ' : 'FAIL';
    console.log(
      `  ${status} ${BOARDS[b].padEnd(10)} ${String(w).padStart(4)}x${String(h).padStart(4)}  ${r.charts} charts`,
    );
    for (const line of r.bad) console.log(`         ${line}`);
    if (r.zeros.length) {
      console.log(`         counters left at zero: ${r.zeros.join(', ')}`);
    }
    failures += r.bad.length + r.zeros.length;
  }
}

/* A locale change is a full rebuild, so it is the other path that can leave a
   chart at the wrong size. */
console.log('\n=== after a locale change ===');
await evaluate(`I18N.set('ar')`);
await sleep(900);
await frame();
let r = await evaluate(MEASURE);
console.log(`  ${r.bad.length === 0 ? 'OK  ' : 'FAIL'} ar  ${r.charts} charts measured`);
for (const line of r.bad) console.log(`       ${line}`);
failures += r.bad.length;

await metrics(2000, 1400);
await frame();
r = await evaluate(MEASURE);
console.log(`  ${r.bad.length === 0 ? 'OK  ' : 'FAIL'} ar 2000x1400 (portrait-ish)  ${r.charts} charts`);
for (const line of r.bad) console.log(`       ${line}`);
if (r.zeros.length) console.log(`       counters left at zero: ${r.zeros.join(', ')}`);
failures += r.bad.length + r.zeros.length;

console.log(`\n${failures === 0 ? 'all good' : failures + ' problem(s)'}`);

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(failures === 0 ? 0 : 1);
