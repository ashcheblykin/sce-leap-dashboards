/* One-off DOM probe against the running boards. Development only.
   node tools/probe.mjs "<expression>" [boardIndex]
   LOCALE=ar node tools/probe.mjs ...   probes the RTL board */

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPR = process.argv[2];
const BOARD = Number(process.argv[3] || 0);
const ROOT = resolve('.');
const PORT = 9721;
const PROFILE = join('/tmp', `leap-probe-${Date.now()}`);
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
    /* Same predicate as shoot.mjs: a page target without a debugger URL is
       not attachable, and picking it leaves every evaluate running nowhere. */
    wsUrl = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
  } catch {
    /* booting */
  }
  if (!wsUrl) await sleep(250);
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
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', {
  width: 2880,
  height: 1152,
  deviceScaleFactor: 1,
  mobile: false,
});
/* pathToFileURL, not string concatenation: the checkout path may contain
   a space, and a raw one makes Chrome silently load nothing. */
await send('Page.navigate', { url: pathToFileURL(join(ROOT, 'index.html')).href });
/* Blocking webfonts plus the dataset: two seconds was enough before the
   font swap and is not now, and a short wait fails as a null #splashStart. */
await sleep(1200);
/* One clean load, as shoot.mjs does: the first navigate on a freshly spawned
   headless target regularly lands on nothing at all. */
await send('Page.reload', { ignoreCache: true });
await sleep(2600);

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description ?? ''));
  return result.value;
}

/* Guarded: if the page has not settled the failure should read as an
   empty probe, not as a null dereference three frames deep. */
await evaluate(
  `(() => { const b = document.getElementById('splashStart'); if (b) b.click(); })()`,
);
await sleep(1200);
/* LOCALE=ar probes the RTL board, which is a different layout, not a
   translation of the same one. Pass it explicitly either way: the locale is
   remembered in localStorage, and Chrome shares that store across file://
   profiles, so a previous run's choice carries over. */
if (process.env.LOCALE) {
  await evaluate(`I18N.set('${process.env.LOCALE}')`);
  await sleep(1200);
}
await evaluate(`document.querySelectorAll('.nav-item')[${BOARD}].click()`);
await sleep(1200);
for (let i = 0; i < 20; i++) {
  await send('Page.captureScreenshot', { format: 'jpeg', quality: 1 });
  await sleep(25);
}

console.log(JSON.stringify(await evaluate(EXPR), null, 2));

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(0);
