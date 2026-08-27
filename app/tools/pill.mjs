/* Traces the sliding-pill state machine. Development only.

   node tools/pill.mjs [outFile]

   The pill is the one piece of the UI a screenshot cannot check: every frame
   tools/shoot.mjs captures has it at rest. So this records the decisions it
   makes on the way — which durations it picks for the leading and trailing
   edge, the fill/shadow it wears while travelling and after it lands, and
   where it comes to rest — for both the widgets' `.chips` track and the dock's
   nav, in both directions.

   Written to be diffed: run it, change the code, run it again, compare. The
   trace records states and geometry, never wall-clock timings, so two runs of
   the same code produce the same file.
*/

import { spawn } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const OUT = resolve(process.argv[2] || 'tools/pill-trace.txt');
const TARGET = resolve(process.env.TARGET || 'index.html');
const PORT = 9633;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = join('/tmp', `leap-pill-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* still booting */
    }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a page debugging endpoint');
}

function client(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
    }
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      return new Promise((ok, reject) => {
        pending.set(messageId, { resolve: ok, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
  };
}

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--window-size=2880,1152',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--no-first-run',
  '--user-data-dir=' + PROFILE,
]);
chrome.stderr.on('data', () => {});

const ws = new WebSocket(await endpoint());
await new Promise((ok) => ws.addEventListener('open', ok));
const cdp = client(ws);
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 2880,
  height: 1152,
  deviceScaleFactor: 1,
  mobile: false,
});
await cdp.send('Page.navigate', { url: `file://${TARGET}` });
await sleep(2500);

async function evaluate(expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
  }
  return result.value;
}
async function pump(n = 10) {
  for (let i = 0; i < n; i++) {
    await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 1 });
    await sleep(25);
  }
}

/* A recorder that samples the pill's own inline style — which is exactly what
   the state machine writes — and keeps one entry per distinct state, so the
   trace is the sequence of decisions rather than a frame dump. */
await evaluate(`
  window.__trace = [];
  window.__gen = 0;
  window.__watch = function (pillSel, label) {
    var pill = document.querySelector(pillSel);
    if (!pill) { window.__trace.push(label + ': NO PILL'); return; }
    var seen = '';
    /* Generation, not a shared flag: a previous take's loop would otherwise
       wake up again the moment the next one cleared the flag, and interleave
       its samples into the new label. */
    var mine = ++window.__gen;
    (function tick() {
      if (mine !== window.__gen) return;
      var s = pill.style;
      var state = [
        'fill=' + (s.backgroundColor || '-'),
        'shadow=' + (s.boxShadow || '-'),
        'pl=' + (s.getPropertyValue('--pl') || '-'),
        'pr=' + (s.getPropertyValue('--pr') || '-'),
        'pt=' + (s.getPropertyValue('--pt') || '-'),
        'pe=' + (s.getPropertyValue('--pe') || '-'),
        'transform=' + (s.transform || '-'),
      ].join(' ');
      if (state !== seen) { seen = state; window.__trace.push(label + ' | ' + state); }
      setTimeout(tick, 8);
    })();
  };
  window.__rest = function (pillSel, label) {
    var pill = document.querySelector(pillSel);
    if (!pill) return label + ': NO PILL';
    /* Rounded: sub-pixel layout differs by a hair between runs and says
       nothing about the state machine. */
    return label + ' rest | left=' + Math.round(parseFloat(pill.style.left || 0)) +
      ' right=' + Math.round(parseFloat(pill.style.right || 0));
  };
`);

const lines = [];
async function record(label, pillSel, action) {
  await evaluate(`window.__trace = []; window.__watch('${pillSel}', '${label}')`);
  await evaluate(action);
  await pump(28);
  await sleep(400);
  await evaluate(`window.__gen++`);
  lines.push(...(await evaluate(`window.__trace`)));
  lines.push(await evaluate(`window.__rest('${pillSel}', '${label}')`));
  lines.push('');
}

await evaluate(`document.getElementById('splashStart').click()`);
await sleep(1800);
await pump(10);

/* The dock's nav, both directions. */
await record('nav forward  (0 -> 2)', '.nav-pill', `document.querySelectorAll('.nav-item')[2].click()`);
await record('nav backward (2 -> 1)', '.nav-pill', `document.querySelectorAll('.nav-item')[1].click()`);

/* A widget's own view switcher, both directions. Board 1 (Ecosystem) so the
   track sits on a normal card rather than the map's floating overlay. */
await evaluate(`document.querySelectorAll('.nav-item')[1].click()`);
await sleep(1000);
await pump(10);
const CHIPS = '[data-grid-surface]:not([style*="none"]) .chips';
await record(
  'chip forward  (0 -> 1)',
  `${CHIPS} .chip-pill`,
  `document.querySelectorAll('${CHIPS}')[0].querySelectorAll('.chip')[1].click()`,
);
await record(
  'chip backward (1 -> 0)',
  `${CHIPS} .chip-pill`,
  `document.querySelectorAll('${CHIPS}')[0].querySelectorAll('.chip')[0].click()`,
);

/* Programmatic selection: the Big Screen's 25s scene cycle drives the pill
   through the same travel a tap would, via the handle board.js hangs on the
   track. Traced separately because it must not diverge from a tap. */
await record(
  'chip select(1) api',
  `${CHIPS} .chip-pill`,
  `document.querySelectorAll('${CHIPS}')[0]._tabs.select(1)`,
);
lines.push(
  'chips handle: ' +
    (await evaluate(`(() => {
      const t = document.querySelectorAll('${CHIPS}')[0]._tabs;
      return t ? Object.keys(t).sort().join(',') : 'none';
    })()`)),
);
lines.push(
  'active index after select: ' +
    (await evaluate(`document.querySelectorAll('${CHIPS}')[0]._tabs.index()`)),
);
lines.push('');

const text = lines.join('\n') + '\n';
await writeFile(OUT, text);
console.log(text);
console.log(`written to ${OUT}`);

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(0);
