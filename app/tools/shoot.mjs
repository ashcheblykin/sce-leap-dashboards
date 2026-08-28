/* Local verification harness: drives headless Chrome over CDP to screenshot
   every board, capture console output, and prove no request ever leaves the
   machine. Development only — it ships with nothing.

   node tools/shoot.mjs [width] [height] [outDir]
*/

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const WIDTH = Number(process.argv[2] || 2880);
const HEIGHT = Number(process.argv[3] || 1152);
const OUT = resolve(process.argv[4] || 'tools/shots');
const TARGET = resolve(process.env.TARGET || 'index.html');
const PORT = 9333 + (WIDTH % 97);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = join('/tmp', `leap-cdp-${Date.now()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Attach to the page target, not the browser target: the browser endpoint has
   no Runtime or Page domain. */
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
  const listeners = [];

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
      return;
    }
    for (const fn of listeners) fn(msg);
  });

  return {
    send(method, params = {}) {
      const messageId = ++id;
      return new Promise((ok, reject) => {
        pending.set(messageId, { resolve: ok, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    on(fn) {
      listeners.push(fn);
    },
  };
}

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--no-first-run',
  '--user-data-dir=' + PROFILE,
]);
chrome.stderr.on('data', () => {});

await mkdir(OUT, { recursive: true });

const ws = new WebSocket(await endpoint());
await new Promise((ok) => ws.addEventListener('open', ok));
const cdp = client(ws);

const logs = [];
const requests = [];

cdp.on((msg) => {
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(
      `[${msg.params.type}] ` +
        msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '),
    );
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    const frames = (d.stackTrace?.callFrames ?? [])
      .slice(0, 6)
      .map((f) => `      at ${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`)
      .join('\n');
    logs.push(`[error] ${d.text} ${d.exception?.description ?? ''}\n${frames}`);
  }
  if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url);
  if (msg.method === 'Log.entryAdded') logs.push(`[${msg.params.entry.level}] ${msg.params.entry.text}`);
});

await cdp.send('Runtime.enable');
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Log.enable');
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});

// One clean load: any log from before this point belongs to the blank target.
await cdp.send('Page.navigate', { url: `file://${TARGET}` });
await sleep(1200);
logs.length = 0;
requests.length = 0;
await cdp.send('Page.reload', { ignoreCache: true });
await sleep(2200);

/* Headless Chrome only produces frames on demand, so requestAnimationFrame work
   (the counters and the tile stagger) stalls until something asks to draw.
   Capturing repeatedly pumps the compositor until the animations have settled.
   A real window on the wall needs none of this. */
async function pump(frames = 24) {
  for (let i = 0; i < frames; i++) {
    await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 1 });
    await sleep(30);
  }
}

/* Two things on screen advance on wall-clock time rather than on state: the
   ticker marquee (a 90s CSS animation) and the splash's animated ground. Left
   alone they move between runs, and two captures of identical code differ by
   ~0.9% of their pixels — enough to drown any real change in tools/diff-shots.
   Both are pinned to one fixed phase immediately before the shutter. The
   ticker is re-pinned every time because switching locale rebuilds its markup.
   The wall itself is untouched: nothing in the app calls either path. */
async function freezeMotion() {
  await evaluate(`(() => {
    /* Web Animations, not animation-delay: a negative delay only shifts the
       timeline, and the marquee loops forever, so progress stays
       (elapsed - delay) % 90s and still moves between runs. Setting
       currentTime pins one absolute frame. */
    document.querySelectorAll('.ticker-track').forEach((t) => {
      t.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 30000;
      });
    });
    if (window.Splash && Splash.visible() && Splash.freeze) Splash.freeze(4000);

    /* Transient overlays are not the wall. The board walk below clicks every
       .nav-item in turn, and clicking the Big Screen's tab while the Big
       Screen is already up is the gesture that opens its scene picker (see
       shell.js) — so the very first frame of every run had a dropdown parked
       over the map. Same for the settings panel, which a stray click can
       leave open. Dismissed here rather than in the walk because this is the
       function whose whole job is to make the next frame repeatable. */
    document.querySelectorAll('.nav-scene-menu[data-open]').forEach((m) => {
      /* Suppressed, not faded: the menu's own 160ms transition would
         otherwise be caught part-way through and the frame would differ run
         to run depending on how long the capture took to arrive. */
      m.style.transition = 'none';
      m.removeAttribute('data-open');
    });
    document.querySelectorAll('.settings-panel:not([hidden])').forEach((m) => {
      m.hidden = true;
    });
  })()`);
}

async function shot(name) {
  await pump();
  await freezeMotion();
  await sleep(60);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  captured ${name}.png`);
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
  return result.value;
}

/* The attract screen is a state of its own, in both languages — it is what the
   stand shows for most of the day. */
await evaluate(`I18N.set('en')`);
await sleep(400);
await shot('0-splash-en');
await evaluate(`I18N.set('ar')`);
await sleep(600);
await shot('0-splash-ar');
await evaluate(`I18N.set('en')`);
await sleep(400);

await evaluate(`document.getElementById('splashStart').click()`);
await sleep(1600);


const PROBE = `(() => {
  const out = { overflow: [], clipping: [], inventory: [] };
  const cellId = (el) => el.getAttribute('data-grid-item') || el.getAttribute('data-card');
  const stageEl = document.querySelector('.stage');
  const stage = stageEl.getBoundingClientRect();
  /* On a compact screen the stage scrolls by design (see core/viewport.js), so
     a card below the fold is the layout working, not failing. The rule there
     is the horizontal one only: nothing may run off the side, and every card
     must still fill its cell exactly. */
  const compact = document.documentElement.getAttribute('data-view') === 'compact';
  const bottomOf = (r) => (compact ? stageEl.scrollHeight + stage.top : stage.bottom);
  document.querySelectorAll('[data-grid-surface]').forEach((s) => {
    if (s.style.display === 'none') return;
    // The KPI Library lays its cards out itself rather than on the 24x8
    // grid, so both kinds of cell feed the same overflow and clipping probe.
    const items = s.querySelectorAll('[data-grid-item], .lib-cell');
    out.inventory.push(s.getAttribute('data-board') + ' items=' + items.length +
      ' faded=' + Array.from(items).filter(i => +getComputedStyle(i).opacity < 0.99).length);
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      /* Measured against the scroll extent, not the viewport, when the board
         scrolls: a rect's bottom is viewport-relative, so a card the visitor
         has simply not scrolled to yet is not an overflow. */
      const floor = bottomOf(r) + (compact ? stageEl.scrollTop : 0);
      if (r.bottom > floor + 1 || r.right > stage.right + 1 || r.width < 2 || r.height < 2) {
        out.overflow.push(cellId(el) + ' ' + JSON.stringify({
          w: Math.round(r.width), h: Math.round(r.height),
          overBottom: Math.round(r.bottom - floor),
          overRight: Math.round(r.right - stage.right),
        }));
      }
    });
    // A card must exactly fill its cell; anything else means content is
    // driving the size instead of the grid.
    items.forEach((el) => {
      const cell = el.getBoundingClientRect();
      const card = el.querySelector('.widget').getBoundingClientRect();
      if (Math.abs(cell.height - card.height) > 1 || Math.abs(cell.width - card.width) > 1) {
        out.clipping.push(cellId(el) +
          ' card ' + Math.round(card.width) + 'x' + Math.round(card.height) +
          ' in cell ' + Math.round(cell.width) + 'x' + Math.round(cell.height));
      }
    });
    // Every box that hides its own overflow, not just .widget-body. A table
    // has an intrinsic min-content height it will not shrink past, so an
    // over-budget one does not clip itself -- it pushes the footnote out
    // through the bottom of the shell it sits in, and .widget-body never grows
    // because the shell clipped first. Checking only the body missed a card
    // quietly losing its last row and its note.
    //
    // Vertical only: horizontal clipping is what text-overflow is FOR, and
    // every label on the board is meant to ellipsize.
    items.forEach((el) => {
      el.querySelectorAll('*').forEach((b) => {
        const o = getComputedStyle(b);
        // nowrap boxes are the ellipsis case, and an Arabic glyph box is
        // taller than its line box, so every one of them reads as overflowing.
        if (o.whiteSpace === 'nowrap' || o.overflowY === 'visible') return;
        if (b.scrollHeight <= b.clientHeight + 2) return;
        out.clipping.push(cellId(el) + ' ' +
          (b.className || b.tagName) + ' content h' + b.scrollHeight +
          ' vs box h' + b.clientHeight);
      });
    });
  });
  return out;
})()`;

const findings = { overflow: [], clipping: [], inventory: [] };

/* Arabic is a full second locale, not a label swap: RTL moves every chart's
   category axis to the other side and re-flows every panel, so every board is
   walked twice and both passes feed the same overflow/clipping probe. */
async function walk(locale) {
  await evaluate(`I18N.set('${locale}')`);
  await sleep(1000);
  const names = await evaluate(
    `Array.from(document.querySelectorAll('.nav-item')).map(n => n.textContent.trim())`,
  );
  for (let i = 0; i < names.length; i++) {
    await evaluate(`document.querySelectorAll('.nav-item')[${i}].click()`);
    await sleep(900);
    await shot(`${locale}-${i + 1}-${BOARD_IDS[i]}`);

    /* A scene board is three screens wearing one nav pill. Shooting only the
       one that happens to be up leaves two thirds of the wall unrecorded --
       which is exactly how the Big Screen went missing from the mockups in the
       first place. */
    const scenes = await evaluate(
      `Array.from(document.querySelectorAll('#scenes .chip')).map(c => c.textContent.trim())`,
    );
    for (let sc = 1; sc < scenes.length; sc++) {
      await evaluate(
        `(() => { const n = document.querySelectorAll('#scenes .chip')[${sc}]; if (n) n.click(); })()`,
      );
      await sleep(900);
      await pump(10);
      await shot(`${locale}-${i + 1}-${BOARD_IDS[i]}-scene${sc + 1}`);

      const sp = await evaluate(PROBE);
      findings.overflow.push(...sp.overflow.map((r) => `${locale} scene${sc + 1} ${r}`));
      findings.clipping.push(...sp.clipping.map((r) => `${locale} scene${sc + 1} ${r}`));
      findings.inventory.push(`${locale} scene${sc + 1} ${sp.inventory.join(' ')}`);
    }
    if (scenes.length) {
      await evaluate(
        `(() => { const n = document.querySelectorAll('#scenes .chip')[0]; if (n) n.click(); })()`,
      );
      await sleep(700);
    }

    /* Re-queried on every step, never indexed off a stale list: the KPI
       Library's filter chips rebuild the whole card grid underneath them, so
       the chip at index c may not exist by the time it is clicked. */
    const SEL = '[data-grid-surface]:not([style*="none"]) .chip';
    const chipCount = await evaluate(`document.querySelectorAll('${SEL}').length`);
    for (let c = 0; c < chipCount; c++) {
      await evaluate(
        `(() => { const n = document.querySelectorAll('${SEL}')[${c}]; if (n) n.click(); })()`,
      );
    }
    await pump(10);
    const probe = await evaluate(PROBE);
    findings.overflow.push(...probe.overflow.map((r) => `${locale} ${r}`));
    findings.clipping.push(...probe.clipping.map((r) => `${locale} ${r}`));
    findings.inventory.push(`${locale} ${probe.inventory.join(' ')}`);

    await evaluate(
      /* .chip, not firstElementChild: the sliding pill is the track's first
         child, so clicking that reset nothing. */
      `document.querySelectorAll('[data-grid-surface]:not([style*="none"]) .chips').forEach(c => { const f = c.querySelector('.chip'); if (f) f.click(); })`,
    );
  }
}

/* The four surfaces of the original deliverable, in nav order. */
const BOARD_IDS = ['bigscreen', 'ecosystem', 'library', 'field'];

for (const locale of ['en', 'ar']) await walk(locale);

/* Leave the page in English, the way it ships. */
await evaluate(`I18N.set('en')`);

const { overflow, clipping, inventory } = findings;
const external = requests.filter((u) => !u.startsWith('file://') && !u.startsWith('data:'));

console.log('\n=== console ===');
console.log(logs.length ? logs.join('\n') : '(silent)');
console.log('\n=== requests ===');
console.log(`${requests.length} total, ${external.length} off-machine`);
if (external.length) console.log(external.join('\n'));
console.log('\n=== inventory ===');
console.log(inventory.join('\n'));
console.log('\n=== overflow ===');
console.log(overflow.length ? overflow.join('\n') : 'none');
console.log('\n=== clipping ===');
console.log(clipping.length ? clipping.join('\n') : 'none');

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(0);
