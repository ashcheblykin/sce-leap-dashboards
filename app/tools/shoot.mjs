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

async function shot(name) {
  await pump();
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

await evaluate(`document.getElementById('splash').click()`);
await sleep(1600);


const PROBE = `(() => {
  const out = { overflow: [], clipping: [], inventory: [] };
  const stage = document.querySelector('.stage').getBoundingClientRect();
  document.querySelectorAll('[data-grid-surface]').forEach((s) => {
    if (s.style.display === 'none') return;
    const items = s.querySelectorAll('[data-grid-item]');
    out.inventory.push(s.getAttribute('data-board') + ' items=' + items.length +
      ' faded=' + Array.from(items).filter(i => +getComputedStyle(i).opacity < 0.99).length);
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom > stage.bottom + 1 || r.right > stage.right + 1 || r.width < 2 || r.height < 2) {
        out.overflow.push(el.getAttribute('data-grid-item') + ' ' + JSON.stringify({
          w: Math.round(r.width), h: Math.round(r.height),
          overBottom: Math.round(r.bottom - stage.bottom),
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
        out.clipping.push(el.getAttribute('data-grid-item') +
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
        out.clipping.push(el.getAttribute('data-grid-item') + ' ' +
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

    const chipCount = await evaluate(
      `document.querySelectorAll('[data-grid-surface]:not([style*="none"]) .chip').length`,
    );
    for (let c = 0; c < chipCount; c++) {
      await evaluate(
        `document.querySelectorAll('[data-grid-surface]:not([style*="none"]) .chip')[${c}].click()`,
      );
    }
    await pump(10);
    const probe = await evaluate(PROBE);
    findings.overflow.push(...probe.overflow.map((r) => `${locale} ${r}`));
    findings.clipping.push(...probe.clipping.map((r) => `${locale} ${r}`));
    findings.inventory.push(`${locale} ${probe.inventory.join(' ')}`);

    await evaluate(
      `document.querySelectorAll('[data-grid-surface]:not([style*="none"]) .chips').forEach(c => c.firstElementChild.click())`,
    );
  }
}

const BOARD_IDS = ['ecosystem', 'profession', 'operations', 'field'];

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
