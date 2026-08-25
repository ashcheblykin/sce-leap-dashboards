/* Behavioural test for the timed shell: does the slideshow advance on its own
   every 45 seconds, does interacting hold it, and does the wall fall back to
   the splash when it is left alone? Development only. */

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const PORT = 9822;
const PROFILE = join('/tmp', `leap-timing-${Date.now()}`);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--window-size=2880,1152',
  '--hide-scrollbars',
  '--no-first-run',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
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
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};

/* Time is compressed so the test finishes in about a minute rather than six:
   the page sees a clock running 15x, which exercises the same code paths. */
const SPEED = 15;
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const origin = Date.now();
    const RealDate = Date;
    const now = () => origin + (RealDate.now() - origin) * ${SPEED};
    Date = class extends RealDate {
      constructor(...a) { super(...(a.length ? a : [now()])); }
      static now() { return now(); }
    };
  })()`,
});

await send('Page.navigate', { url: `file://${ROOT}/index.html` });
await sleep(1500);
await evaluate(`document.getElementById('splash').click()`);
await sleep(1000);

const active = () =>
  evaluate(`(() => {
    if (!document.getElementById('splash').hidden) return 'SPLASH';
    const on = document.querySelector('.nav-item[data-on]');
    return on ? on.textContent.trim() : '(none)';
  })()`);

const log = [];
const started = Date.now();
let previous = await active();
log.push(`t=0s  ${previous}`);

// 45s of page time is 3s of real time at this speed.
for (let i = 0; i < 150; i++) {
  await sleep(400);
  const current = await active();
  if (current !== previous) {
    log.push(`t=${(((Date.now() - started) * SPEED) / 1000).toFixed(0)}s  -> ${current}`);
    previous = current;
  }
  if (log.length > 12) break;
}

console.log(log.join('\n'));

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(0);
