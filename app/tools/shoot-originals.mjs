/* Screenshot the 4 original prototype dashboards (Dashboards/*.html) for visual
   comparison against the rebuilt app boards. Ad-hoc, not part of the deliverable.

   node tools/shoot-originals.mjs
*/

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const OUT = resolve('tools/shots-original');
const PACK = resolve('..');
const PORT = 9611;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = join('/tmp', `leap-orig-${Date.now()}`);
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
  '--window-size=1600,1000',
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

await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});

async function evaluate(expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
  return result.value;
}

async function pump(n = 20) {
  for (let i = 0; i < n; i++) {
    await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 1 });
    await sleep(30);
  }
}

async function shotViewport(name) {
  await pump();
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  captured ${name}.png`);
}

async function shotFullPage(name) {
  await pump();
  const { contentSize } = await cdp.send('Page.getLayoutMetrics');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: Math.ceil(contentSize.height),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(200);
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1600, height: Math.ceil(contentSize.height), scale: 1 },
  });
  await writeFile(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  captured ${name}.png (${Math.ceil(contentSize.height)}px tall)`);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

/* BigScreen: fixed 2400x960 #stage, scaled to fit the window; three internal
   scenes (Overview / Profession / Operations) toggled by #sceneBar. */
console.log('== SCE_LEAP_BigScreen.html ==');
await cdp.send('Page.navigate', { url: `file://${join(PACK, 'Dashboards/SCE_LEAP_BigScreen.html')}` });
await sleep(1800);
const SCENE_NAMES = ['overview', 'profession', 'operations'];
for (let s = 0; s < 3; s++) {
  await evaluate(`setScene(${s})`);
  await sleep(900);
  await shotViewport(`bigscreen-${s}-${SCENE_NAMES[s]}`);
}

/* The other three are regular scrolling pages (1420px canvas). Full-page
   capture so nothing below the fold is missed. */
const PAGES = [
  ['SCE_LEAP_Ecosystem.html', 'ecosystem'],
  ['SCE_LEAP_KPI_Library.html', 'kpi-library'],
  ['SCE_LEAP_Field_Verification.html', 'field-verification'],
];
for (const [file, name] of PAGES) {
  console.log(`== ${file} ==`);
  await cdp.send('Page.navigate', { url: `file://${join(PACK, 'Dashboards', file)}` });
  await sleep(1800);
  await shotFullPage(name);
}

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(0);
