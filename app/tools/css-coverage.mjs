/* Which selectors in assets/css never match anything. Development only.

   node tools/css-coverage.mjs

   Drives headless Chrome over CDP the way shoot.mjs does, walks all four
   boards in both locales through every scene and every chip view, and after
   each step asks the live DOM which of the stylesheet's selectors match. A
   selector that never matches across the whole walk is dead.

   Two things this deliberately does NOT do. It does not use CDP's own
   CSS.startRuleUsageTracking: that reports rules the renderer applied, so a
   rule for a state the walk cannot reach (a hover, a keypress) comes back
   indistinguishable from a rule for markup that no longer exists. And it does
   not try to synthesise pseudo-classes — instead it strips them and matches
   the structural remainder, so `.chip:hover` is judged by whether `.chip`
   exists. Both choices err towards calling a selector live.

   States the walk drives by hand, because nothing else reaches them:
   the settings panel, drag/resize attributes, and the tooltip's own classes.
*/

import { spawn } from 'node:child_process';
import { rm, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const WIDTH = Number(process.argv[2] || 2880);
const HEIGHT = Number(process.argv[3] || 1152);
const TARGET = resolve(process.env.TARGET || 'index.html');
const CSS_DIR = 'assets/css';
const PORT = 9611;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = join('/tmp', `leap-css-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- Selectors out of the source, not out of the CSSOM ------------------
   The source is what gets edited, so a finding has to name a line somebody
   can go and delete. Comments are stripped first: a commented-out rule is
   not a rule. */
const owner = new Map();
for (const file of (await readdir(CSS_DIR)).filter((f) => f.endsWith('.css'))) {
  const css = (await readFile(join(CSS_DIR, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, head] of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const rule = head.trim().replace(/\s+/g, ' ');
    /* Skip at-rule preludes and keyframe stops — neither is a selector. */
    if (!rule || rule.startsWith('@') || /^(from|to|[\d.]+%)$/.test(rule)) continue;
    for (const part of rule.split(',')) {
      const sel = part.trim();
      if (sel && !owner.has(sel)) owner.set(sel, file);
    }
  }
}
const SELECTORS = [...owner.keys()];
console.log(`${SELECTORS.length} distinct selectors across ${CSS_DIR}`);

/* --- CDP ---------------------------------------------------------------- */

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
  `--window-size=${WIDTH},${HEIGHT}`,
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
  width: WIDTH,
  height: HEIGHT,
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

/* Headless Chrome only draws on demand, so the stagger and the counters stall
   until something asks for a frame — same reason shoot.mjs pumps. */
async function pump(frames = 8) {
  for (let i = 0; i < frames; i++) {
    await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 1 });
    await sleep(25);
  }
}

await evaluate(`
  window.__hit = {};
  window.__sels = ${JSON.stringify(SELECTORS)};
  window.__probe = function () {
    for (var i = 0; i < window.__sels.length; i++) {
      var sel = window.__sels[i];
      if (window.__hit[sel]) continue;
      /* Judge the structural remainder: a state this walk cannot enter must
         not make its selector look dead. */
      var q = sel.replace(
        /::?(hover|focus-visible|focus|active|selection|placeholder|-webkit-scrollbar(-thumb)?|before|after|first-of-type|first-child|last-child|nth-child\\([^)]*\\)|empty)/g,
        ''
      ).trim();
      if (!q) { window.__hit[sel] = 'pseudo-only'; continue; }
      try { if (document.querySelector(q)) window.__hit[sel] = 'matched'; }
      catch (e) { window.__hit[sel] = 'unparseable'; }
    }
  };
`);
const probe = () => evaluate('window.__probe()');

await probe();
for (const locale of ['en', 'ar']) {
  await evaluate(`I18N.set('${locale}')`);
  await sleep(500);
  await pump(5);
  await probe();
}
await evaluate(`I18N.set('en')`);
await sleep(400);
await evaluate(`document.getElementById('splashStart').click()`);
await sleep(1800);
await probe();

async function walk(locale) {
  await evaluate(`I18N.set('${locale}')`);
  await sleep(900);
  await probe();

  const boards = await evaluate(`document.querySelectorAll('.nav-item').length`);
  for (let i = 0; i < boards; i++) {
    await evaluate(`document.querySelectorAll('.nav-item')[${i}].click()`);
    await sleep(900);
    await pump();
    await probe();

    const scenes = await evaluate(`document.querySelectorAll('#scenes .chip').length`);
    for (let sc = 1; sc < scenes; sc++) {
      await evaluate(`(() => { const n = document.querySelectorAll('#scenes .chip')[${sc}]; if (n) n.click(); })()`);
      await sleep(900);
      await pump();
      await probe();
    }
    if (scenes) {
      await evaluate(`(() => { const n = document.querySelectorAll('#scenes .chip')[0]; if (n) n.click(); })()`);
      await sleep(700);
      await probe();
    }

    /* Re-queried every step: the KPI Library's filter chips rebuild the card
       grid underneath them, so an indexed list goes stale mid-loop. */
    const SEL = '[data-grid-surface]:not([style*="none"]) .chip';
    const chips = await evaluate(`document.querySelectorAll('${SEL}').length`);
    for (let c = 0; c < chips; c++) {
      await evaluate(`(() => { const n = document.querySelectorAll('${SEL}')[${c}]; if (n) n.click(); })()`);
      await sleep(150);
      await probe();
    }
    await pump();
    await probe();
    await evaluate(
      `document.querySelectorAll('[data-grid-surface]:not([style*="none"]) .chips').forEach(c => { const f = c.querySelector('.chip'); if (f) f.click(); })`,
    );
    await sleep(400);
    await probe();
  }
}

for (const locale of ['en', 'ar']) await walk(locale);

/* States nothing above reaches. Driven directly rather than gestured, since
   the question is only whether the markup they select still exists. */
await evaluate(`document.getElementById('settingsBtn').click()`);
await sleep(300);
await probe();
await evaluate(`document.getElementById('settingsBtn').click()`);
await sleep(200);

await evaluate(`document.body.classList.add('grid-dragging')`);
await evaluate(`document.querySelectorAll('[data-grid-item]').forEach(i => i.setAttribute('data-moving', ''))`);
await sleep(150);
await probe();
await evaluate(`document.querySelectorAll('[data-grid-item]').forEach(i => { i.removeAttribute('data-moving'); i.setAttribute('data-resizing', ''); })`);
await sleep(150);
await probe();
await evaluate(`document.body.classList.remove('grid-dragging'); document.querySelectorAll('[data-grid-item]').forEach(i => i.removeAttribute('data-resizing'))`);

/* The tooltip and the scale toast both mount on demand; ask for them. */
await evaluate(`if (window.Tooltip && Tooltip.show) { const m = document.querySelector('[data-tip-label]'); if (m) m.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); }`);
await sleep(300);
await evaluate(`document.querySelectorAll('.ax-tooltip').forEach(t => t.classList.add('is-visible', 'is-pinned', 'is-label-only'))`);
await sleep(100);
await probe();
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ']' }))`);
await sleep(300);
await probe();
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\\\' }))`);
await sleep(300);
await probe();

const hit = await evaluate(`window.__hit`);
const dead = SELECTORS.filter((s) => !hit[s]);
const unparseable = SELECTORS.filter((s) => hit[s] === 'unparseable');

console.log(`\n=== never matched (${dead.length} of ${SELECTORS.length}) ===`);
if (dead.length) {
  const byFile = new Map();
  for (const sel of dead) {
    const file = owner.get(sel);
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(sel);
  }
  for (const [file, list] of [...byFile].sort()) {
    console.log(`\n  ${file}`);
    for (const sel of list) console.log(`    ${sel}`);
  }
} else {
  console.log('  none');
}

if (unparseable.length) {
  console.log(`\n=== not parseable as a querySelector (${unparseable.length}) ===`);
  for (const sel of unparseable) console.log(`  ${owner.get(sel)}  ${sel}`);
}

console.log(
  '\nA selector here is a candidate, not a verdict: check that no JS builds its' +
    '\nclass by string concatenation before deleting the rule.',
);

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(0);
