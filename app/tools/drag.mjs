/* Exercises the canvas gestures: drag a widget by its header, resize it by an
   edge handle, and confirm the layout survives a reload. Development only. */

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const PORT = 9911;
const PROFILE = join('/tmp', `leap-drag-${Date.now()}`);
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
  if (!wsUrl) await sleep(200);
}

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener('open', ok));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve: ok, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : ok(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((ok, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve: ok, reject });
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 2880,
  height: 1152,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: `file://${ROOT}/index.html` });
await sleep(1800);

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};

await evaluate(`document.getElementById('splashStart').click()`);
await sleep(900);
/* Board 0 is the Big Screen, which ships without drag or resize handles on
   purpose (kiosk). Move to the Ecosystem dashboard, which is what this harness
   is here to exercise. */
await evaluate(`document.querySelectorAll('.nav-item')[1].click()`);
await sleep(1200);

const geometry = () =>
  evaluate(`Object.fromEntries(Array.from(
    document.querySelectorAll('[data-grid-surface]:not([style*="none"]) [data-grid-item]'),
    el => [el.getAttribute('data-grid-item'), [
      el.style.getPropertyValue('--grid-item-x'), el.style.getPropertyValue('--grid-item-y'),
      el.style.getPropertyValue('--grid-item-w'), el.style.getPropertyValue('--grid-item-h')].join(',')]
  ))`);

async function gesture(from, to, steps = 14) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y, buttons: 0 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1, buttons: 1 });
  await sleep(60);
  console.log('  after press, body class:', await evaluate('document.body.className || "(none)"'));
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
      button: 'left',
      buttons: 1,
    });
    await sleep(18);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0 });
  await sleep(400);
}

const before = await geometry();
console.log('start layout:', JSON.stringify(before, null, 1));

/* Pick two same-sized widgets and drag one onto the other: on a fully packed
   board that is the move the engine has to satisfy by swapping. */
const pair = await evaluate(`(() => {
  const items = Array.from(document.querySelectorAll('[data-grid-surface]:not([style*="none"]) [data-grid-item]'));
  const size = (el) => el.style.getPropertyValue('--grid-item-w') + 'x' + el.style.getPropertyValue('--grid-item-h');
  for (const a of items) for (const b of items) {
    if (a !== b && size(a) === size(b)) {
      const handle = a.querySelector('[data-drag-handle]').getBoundingClientRect();
      const target = b.getBoundingClientRect();
      return {
        from: { x: Math.round(handle.left + 40), y: Math.round(handle.top + handle.height / 2) },
        to: { x: Math.round(target.left + target.width / 2), y: Math.round(target.top + target.height / 2) },
        a: a.getAttribute('data-grid-item'), b: b.getAttribute('data-grid-item'), size: size(a),
      };
    }
  }
  return null;
})()`);
if (!pair) throw new Error('no two widgets of equal size to swap');
console.log(`swapping ${pair.a} with ${pair.b} (${pair.size})`);
await gesture(pair.from, pair.to);
const afterDrag = await geometry();

// Shrinking must always be allowed, even when the board has no free cells.
const edge = await evaluate(`(() => {
  const el = document.querySelector('[data-grid-surface]:not([style*="none"]) [data-resize-handle="e"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`);
if (edge) await gesture(edge, { x: edge.x - 240, y: edge.y });
const afterResize = await geometry();

await send('Page.reload', {});
await sleep(2500);
await evaluate(`document.getElementById('splashStart').click()`);
await sleep(900);
/* Board 0 is the Big Screen, which ships without drag or resize handles on
   purpose (kiosk). Move to the Ecosystem dashboard, which is what this harness
   is here to exercise. */
await evaluate(`document.querySelectorAll('.nav-item')[1].click()`);
await sleep(1200);
const afterReload = await geometry();

const changed = Object.keys(before).filter((k) => before[k] !== afterResize[k]);
console.log('moved or resized:', changed.length ? changed.join(', ') : 'nothing');
for (const k of changed) {
  console.log(`  ${k}: ${before[k]}  ->  ${afterResize[k]}   reloaded: ${afterReload[k]}`);
}
console.log('drag alone changed:', Object.keys(before).filter((k) => before[k] !== afterDrag[k]).join(', ') || 'nothing');
console.log(
  'layout persisted:',
  JSON.stringify(afterResize) === JSON.stringify(afterReload),
);
console.log('rows in use:', await evaluate(`(() => {
  let max = 0;
  document.querySelectorAll('[data-grid-surface]:not([style*="none"]) [data-grid-item]').forEach(el => {
    max = Math.max(max, +el.style.getPropertyValue('--grid-item-y') + +el.style.getPropertyValue('--grid-item-h'));
  });
  return max;
})()`));

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(0);
