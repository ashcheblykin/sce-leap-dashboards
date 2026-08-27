/* Main-thread cost of the wall's interactions. Development only.

   node tools/perf.mjs

   The wall runs unattended for a day at a time on a conference PC, and the two
   things it does constantly are glide the dock's pill between boards and tick
   the dwell fill under the active tab. Both were animating layout properties,
   both sat under a backdrop-filter, and "it feels laggy" is not something you
   can act on — so this counts the work instead of guessing at it.

   Three numbers per scenario, read straight out of Chrome's own counters
   (Performance.getMetrics):

     recalc   style recalculations
     layout   layout passes
     ms       LayoutDuration + RecalcStyleDuration + ScriptDuration, in ms

   plus a rAF sampler over the same window, reporting how many frames ran long
   (>20ms, i.e. a dropped frame at 60Hz) and the worst one.

   Counters are deltas across the scenario, so they are comparable run to run
   on the same machine. They are NOT comparable across machines, and headless
   Chrome does not composite the way the stand's GPU will — the point is the
   before/after on one machine, not an absolute budget.

   A static count worth watching alongside them is printed first: how many
   elements on each board carry a real (non-zero) backdrop-filter. Every one of
   those is a Gaussian the compositor re-runs whenever anything behind it
   moves, and they are the reason the counters below used to climb.
*/

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.');
const TARGET = resolve(process.env.TARGET || 'index.html');
const PORT = 9911;
const PROFILE = join('/tmp', `leap-perf-${Date.now()}`);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--window-size=2880,1152',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--no-first-run',
  /* The scenarios below are driven from Node with sleeps in between, so the
     renderer must not be throttled for looking idle. */
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
    wsUrl = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
  } catch {
    /* booting */
  }
  if (!wsUrl) await sleep(250);
}

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener('open', ok));

let msgId = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (!m.id || !pending.has(m.id)) return;
  const { resolve: ok, reject } = pending.get(m.id);
  pending.delete(m.id);
  m.error ? reject(new Error(m.error.message)) : ok(m.result);
});

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((ok, reject) => {
    pending.set(id, { resolve: ok, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(
      exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''),
    );
  }
  return result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Performance.enable');

await send('Page.navigate', { url: pathToFileURL(TARGET).href });
await sleep(2500);
await evaluate(`document.getElementById('splashStart').click()`);
await sleep(1800);

/* --- static: how many real Gaussians is each board carrying? ------------- */

const BLUR_PROBE = `(() => {
  let real = 0, zeroed = 0;
  const sites = [];
  document.querySelectorAll('*').forEach((el) => {
    const f = getComputedStyle(el).backdropFilter;
    if (!f || f === 'none') return;
    const m = /blur\\(([\\d.]+)px\\)/.exec(f);
    const r = m ? parseFloat(m[1]) : -1;
    if (r > 0.5) { real++; sites.push((el.className || el.tagName) + ' ' + r.toFixed(0) + 'px'); }
    else zeroed++;
  });
  const counts = {};
  sites.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
  return { real, zeroed, sites: counts };
})()`;

console.log('=== backdrop-filter layers (real Gaussian vs zeroed) ===');
const boardNames = await evaluate(
  `Array.from(document.querySelectorAll('.nav-item')).map(n => n.textContent.trim())`,
);
for (let i = 0; i < boardNames.length; i++) {
  await evaluate(`document.querySelectorAll('.nav-item')[${i}].click()`);
  await sleep(900);
  /* Clicking the active Big Screen tab opens its scene menu — not part of the
     resting board, and its three options carry blur of their own. */
  await evaluate(
    `document.querySelectorAll('.nav-scene-menu[data-open]').forEach(m => m.removeAttribute('data-open'))`,
  );
  await sleep(250);
  const b = await evaluate(BLUR_PROBE);
  const detail = Object.entries(b.sites)
    .map(([k, n]) => `${n}x ${k}`)
    .join(', ');
  console.log(
    `  ${boardNames[i].padEnd(18)} real=${String(b.real).padStart(3)}  zeroed=${String(b.zeroed).padStart(3)}${detail ? '  [' + detail + ']' : ''}`,
  );
}

/* --- scenarios ---------------------------------------------------------- */

async function metrics() {
  const { metrics: m } = await send('Performance.getMetrics');
  const at = (n) => m.find((x) => x.name === n)?.value ?? 0;
  return {
    recalc: at('RecalcStyleCount'),
    layout: at('LayoutCount'),
    ms: (at('LayoutDuration') + at('RecalcStyleDuration') + at('ScriptDuration')) * 1000,
  };
}

/* rAF sampler: installed for the length of one scenario, then read back. */
const SAMPLER_ON = `(() => {
  window.__frames = [];
  let last = performance.now();
  window.__samplerOn = true;
  const step = (now) => {
    if (!window.__samplerOn) return;
    window.__frames.push(now - last);
    last = now;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})()`;

const SAMPLER_OFF = `(() => {
  window.__samplerOn = false;
  const f = window.__frames.slice(1);
  f.sort((a, b) => a - b);
  return {
    n: f.length,
    p50: f.length ? +f[Math.floor(f.length * 0.5)].toFixed(1) : 0,
    p95: f.length ? +f[Math.floor(f.length * 0.95)].toFixed(1) : 0,
    max: f.length ? +f[f.length - 1].toFixed(1) : 0,
    long: f.filter((d) => d > 20).length,
  };
})()`;

async function scenario(name, steps) {
  await sleep(600);
  await evaluate(SAMPLER_ON);
  const before = await metrics();
  await steps();
  const after = await metrics();
  const frames = await evaluate(SAMPLER_OFF);
  console.log(
    `  ${name.padEnd(30)} recalc=${String(after.recalc - before.recalc).padStart(5)}` +
      `  layout=${String(after.layout - before.layout).padStart(5)}` +
      `  ms=${(after.ms - before.ms).toFixed(0).padStart(5)}` +
      `  frames p50=${frames.p50} p95=${frames.p95} max=${frames.max} long=${frames.long}/${frames.n}`,
  );
}

console.log('\n=== scenarios ===');

/* 1. Dock tabs: the pill glides, the outgoing board exits, the incoming one
      staggers in and every counter on it runs. This is the interaction the
      room actually sees, and the one the brief called out. */
await evaluate(`document.querySelectorAll('.nav-item')[0].click()`);
await sleep(1200);
await evaluate(
  `document.querySelectorAll('.nav-scene-menu[data-open]').forEach(m => m.removeAttribute('data-open'))`,
);
await scenario('dock: 4 board changes', async () => {
  for (const i of [1, 2, 3, 0]) {
    await evaluate(`document.querySelectorAll('.nav-item')[${i}].click()`);
    await sleep(1100);
  }
});

/* 2. The same gesture at the rate a bored visitor produces it: taps arriving
      before the previous transition has settled, which is when the pill, the
      exit stagger, the enter stagger and a fresh set of counters are all in
      flight together. There is no way to glide the pill *without* a board
      change — that is what the pill is for — so this is the glide under load
      rather than the glide alone. */
await evaluate(`document.querySelectorAll('.nav-item')[1].click()`);
await sleep(1200);
await scenario('dock: rapid taps (x6, 420ms)', async () => {
  for (let k = 0; k < 6; k++) {
    await evaluate(`document.querySelectorAll('.nav-item')[${k % 2 === 0 ? 2 : 1}].click()`);
    await sleep(420);
  }
});

/* 3. A widget's own view tabs on the KPI Library, which is the board with the
      most chip tracks on screen at once (twenty) and the one where the tracks'
      blur used to cost the most. */
await evaluate(`document.querySelectorAll('.nav-item')[2].click()`);
await sleep(1400);
await evaluate(
  `document.querySelectorAll('.nav-scene-menu[data-open]').forEach(m => m.removeAttribute('data-open'))`,
);
await scenario('library: chip switch (x8)', async () => {
  for (let k = 0; k < 8; k++) {
    /* Re-queried every step: a Library chip rebuilds the card grid under it,
       so an index taken from a stale list may no longer exist. */
    await evaluate(
      `(() => { const c = document.querySelectorAll('[data-grid-surface] .chip');` +
        ` const n = c[${k} % c.length]; if (n) n.click(); })()`,
    );
    await sleep(380);
  }
});

/* 4. The wall at rest. Nothing is being touched: the ticker scrolls and
      slideshowTick writes the dwell fill five times a second, forever. This is
      the number that matters most, because it is the one the stand pays all
      day. */
await evaluate(`document.querySelectorAll('.nav-item')[0].click()`);
await sleep(1400);
await evaluate(
  `document.querySelectorAll('.nav-scene-menu[data-open]').forEach(m => m.removeAttribute('data-open'))`,
);
await scenario('idle: 6s, untouched', async () => {
  await sleep(6000);
});

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
