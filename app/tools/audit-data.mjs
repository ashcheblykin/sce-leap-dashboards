/* Data audit. Development only, but it is the check the deliverable rests on.

   The claim this app makes is the one the calculation guide makes: the boards
   DISPLAY the dataset and never calculate a headline of their own. This tool
   proves it, from the outside:

     1. it reads leap_data.js and builds, in Node, the set of every value the
        dataset states plus every value the two source documents say may be
        derived from it (sums, shares, complements, cumulative windows);
     2. it drives the running boards through all four boards, both locales and
        every chip view, collecting every number the chart DSL was handed
        (Chart.audit — see chart-dsl.js);
     3. it reconciles the two, and reports anything on screen that the dataset
        cannot account for.

   Anything the second list contains and the first does not is, by definition,
   a figure that came from somewhere other than the data.

   It also confirms the dataset inside the app is byte-identical to
   Data Files/leap_data.js and to the copy inside all four source dashboards,
   so "same numbers" is not resting on the audit alone.

   node tools/audit-data.mjs                     # audits app/index.html
   TARGET=../SCE_LEAP_2026.html node tools/audit-data.mjs
*/

import { spawn } from 'node:child_process';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const TARGET = resolve(process.env.TARGET || 'index.html');
const PACK = resolve('..');
const PORT = 9755;
const PROFILE = join('/tmp', `leap-audit-${Date.now()}`);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 1. the dataset, and what may legitimately be derived from it ────────── */

/** Pull the `var LEAP = {…}` object out of any file that carries one. */
function extractLeap(text) {
  const at = text.indexOf('var LEAP=');
  if (at < 0) return null;
  let depth = 0;
  let start = -1;
  for (let i = at; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const leapSource = extractLeap(await readFile(join(ROOT, 'assets/js/data/leap_data.js'), 'utf8'));
const LEAP = JSON.parse(leapSource);

const allowed = new Map();

/** Register a value as accountable, with the reason it is. */
function allow(value, why) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  const key = round(value);
  if (!allowed.has(key)) allowed.set(key, why);
}

/* Values are compared at 3 decimal places: shares and SAR millions are
   rounded for display, raw counts are integers either way. */
const round = (n) => Math.round(n * 1000) / 1000;

/* --- stated by the dataset --------------------------------------------- */
for (const [key, value] of Object.entries(LEAP.head)) {
  if (typeof value === 'number') allow(value, `head.${key}`);
}
/* head.offices ships as a formatted string, and the guide states its two
   components in head.off_note. */
allow(Number(String(LEAP.head.offices).replace(/,/g, '')), 'head.offices');
for (const part of String(LEAP.head.off_note).match(/[\d,]+/g) ?? []) {
  allow(Number(part.replace(/,/g, '')), 'head.off_note component');
}
for (const [key, value] of Object.entries(LEAP.tuv.head)) allow(value, `tuv.head.${key}`);

for (const row of LEAP.cls) allow(row[1], `cls ${row[0]}`);
for (const row of LEAP.register) allow(row[2], `register ${row[0]}/${row[1]}`);
for (const row of LEAP.grades) allow(row[2], `grades ${row[0]}/${row[1]}`);
for (const row of LEAP.pipetrack) allow(row[2], `pipetrack ${row[0]}/${row[1]}`);
for (const [key, value] of Object.entries(LEAP.pipe)) allow(value, `pipe.${key}`);
for (const row of LEAP.months) allow(row[1], `months ${row[0]}`);
for (const key of ['eng5', 'tech5', 'spec5', 'nat5']) {
  for (const row of LEAP[key]) allow(row[1], `${key} ${row[0]}`);
}
for (const row of LEAP.city) {
  allow(row[3], `city ${row[0]} workforce`);
  allow(row[4], `city ${row[0]} registered`);
  allow((row[4] / row[3]) * 100, `city ${row[0]} reach %`);
}
for (const row of LEAP.regions) {
  allow(row[3], `regions ${row[0]} actions`);
  allow(row[4], `regions ${row[0]} fines`);
}
for (const row of LEAP.tuvtop) {
  allow(row[3], `tuvtop ${row[0]} offices`);
  allow(row[4], `tuvtop ${row[0]} staff`);
  allow(row[5], `tuvtop ${row[0]} % licensed`);
}
for (const row of LEAP.tuv.city) {
  allow(row[3], `tuv.city ${row[0]} offices`);
  allow(row[5], `tuv.city ${row[0]} % licensed`);
}
for (const point of LEAP.tuv.pts) allow(point[2], 'tuv.pts staff');

/* --- derived, each with the document that authorises it ----------------- */
const sum = (rows, pick) => rows.reduce((t, r) => t + pick(r), 0);

const byStatus = {};
const byClass = {};
for (const [cls, status, n] of LEAP.register) {
  byStatus[status] = (byStatus[status] ?? 0) + n;
  byClass[cls] = (byClass[cls] ?? 0) + n;
}
for (const [status, n] of Object.entries(byStatus)) allow(n, `Σ register ${status} (guide §3)`);
for (const [cls, n] of Object.entries(byClass)) allow(n, `Σ register ${cls} (guide §3)`);
allow(byStatus.expired + byStatus.frozen, 'historic/lapsed (guide §3)');
allow(sum(LEAP.register, (r) => r[2]), 'Σ register (guide §6)');

const byGrade = {};
for (const [grade, , n] of LEAP.grades) byGrade[grade] = (byGrade[grade] ?? 0) + n;
for (const [grade, n] of Object.entries(byGrade)) allow(n, `Σ grades ${grade} (build book §4)`);
allow(sum(LEAP.grades, (r) => r[2]), 'Σ grades = Engineers class');

const W90 = new Set(['0-30', '31-60', '61-90']);
const byTrack90 = {};
for (const [cls, win, n] of LEAP.pipetrack) {
  if (W90.has(win)) byTrack90[cls] = (byTrack90[cls] ?? 0) + n;
}
for (const [cls, n] of Object.entries(byTrack90)) allow(n, `Σ 90-day window ${cls} (guide §4)`);

const cityWorkforce = sum(LEAP.city, (r) => r[3]);
const cityRegistered = sum(LEAP.city, (r) => r[4]);
allow(cityWorkforce, 'Σ city workforce');
allow(cityRegistered, 'Σ city registered');
allow(cityWorkforce - cityRegistered, 'Σ city workforce − registered');
allow((cityRegistered / cityWorkforce) * 100, 'national reach % (guide §3)');
allow(Math.round((cityRegistered / cityWorkforce) * 1000) / 10, 'national reach %, 1dp');

allow(LEAP.head.eco - LEAP.head.saudis, 'non-Saudi (guide §2)');
allow((LEAP.head.saudis / LEAP.head.eco) * 100, 'Saudi share (guide §2)');
allow(Math.round((LEAP.head.saudis / LEAP.head.eco) * 1000) / 10, 'Saudi share, 1dp');

allow(sum(LEAP.regions, (r) => r[3]), 'Σ regions actions');
allow(sum(LEAP.regions, (r) => r[4]), 'Σ regions fines');
allow(sum(LEAP.regions, (r) => r[4]) / 1e6, 'Σ regions fines, SAR millions');
allow(LEAP.head.enforced * 1e6, 'head.enforced in SAR');

/* Build Book §6 states the payment split explicitly. */
allow(5.857, 'in collection, 5.857M SAR (build book §6)');
allow(0.2234, 'under review, 223.4k SAR (build book §6)');
allow(LEAP.head.enforced - LEAP.head.collected, 'enforced − collected');

allow(100 - LEAP.tuv.head.scecov, 'not SCE-licensed, share');
allow(100 - LEAP.tuv.head.dual, 'not dual-licensed, share');

/* Cardinalities the boards state as counts. */
allow(LEAP.city.length, 'cities on the map');
allow(LEAP.regions.length, 'regions');
allow(LEAP.tuv.city.length, 'field-survey cities');
allow(LEAP.tuv.pts.length, 'mappable verified offices');
allow(LEAP.tuvtop.length, 'top cities');
allow(LEAP.months.length, 'months in the series');

/* The radar is normalised per status, so its values are percentages of the
   largest class on that axis — the panel note says exactly that. */
for (const status of ['active', 'near_expiry', 'expired', 'frozen']) {
  const values = Object.keys(byClass).map(
    (cls) => LEAP.register.find((r) => r[0] === cls && r[1] === status)?.[2] ?? 0,
  );
  const max = Math.max(...values);
  for (const v of values) allow(max ? (v / max) * 100 : 0, `radar ${status} normalised`);
}

/* Structural constants a spec carries that are not data: a progress-bar's
   axis maximum when it is the surveyed total, and 0/100 endpoints. */
allow(0, 'zero');
allow(100, 'percent scale');

/* ── 2. the dataset inside the app and the source dashboards ─────────────── */

console.log('=== dataset provenance ===');
const packLeap = extractLeap(await readFile(join(PACK, 'Data Files/leap_data.js'), 'utf8'));
console.log(
  `  ${packLeap === leapSource ? 'OK  ' : 'FAIL'} app copy is byte-identical to Data Files/leap_data.js`,
);
let provenanceFailures = packLeap === leapSource ? 0 : 1;

const dashboards = (await readdir(join(PACK, 'Dashboards'))).filter((f) => f.endsWith('.html'));
for (const file of dashboards.sort()) {
  const inDash = extractLeap(await readFile(join(PACK, 'Dashboards', file), 'utf8'));
  const same = inDash === leapSource;
  if (!same) provenanceFailures += 1;
  console.log(`  ${same ? 'OK  ' : 'FAIL'} identical to Dashboards/${file}`);
}

/* ── 3. what the boards actually put on screen ───────────────────────────── */

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

await send('Emulation.setDeviceMetricsOverride', {
  width: 2880,
  height: 1152,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: `file://${TARGET}` });
await sleep(2200);
await evaluate(`document.getElementById('splashStart').click()`);
await sleep(1400);

/* Every board, every locale, every chip view — a view that is never opened is
   a view that was never audited. */
for (const locale of ['en', 'ar']) {
  await evaluate(`I18N.set('${locale}')`);
  await sleep(800);
  const boards = await evaluate(`document.querySelectorAll('.nav-item').length`);
  const SEL = '[data-grid-surface]:not([style*="none"]) .chip';

  /* Re-queried per click, never indexed off a stale list: the KPI Library's
     filter chips rebuild the card grid beneath them, so the chip at index c
     may be gone by the time it is clicked. */
  async function walkChips() {
    const chips = await evaluate(`document.querySelectorAll('${SEL}').length`);
    for (let c = 0; c < chips; c++) {
      await evaluate(
        `(() => { const n = document.querySelectorAll('${SEL}')[${c}]; if (n) n.click(); })()`,
      );
      await sleep(60);
    }
  }

  for (let b = 0; b < boards; b++) {
    await evaluate(`document.querySelectorAll('.nav-item')[${b}].click()`);
    await sleep(700);
    await walkChips();

    /* A scene board hides two thirds of its views behind its own switcher, and
       a view that is never opened is a view that was never audited. */
    const scenes = await evaluate(`document.querySelectorAll('#scenes .chip').length`);
    for (let sc = 1; sc < scenes; sc++) {
      await evaluate(
        `(() => { const n = document.querySelectorAll('#scenes .chip')[${sc}]; if (n) n.click(); })()`,
      );
      await sleep(700);
      await walkChips();
    }
    if (scenes) {
      await evaluate(
        `(() => { const n = document.querySelectorAll('#scenes .chip')[0]; if (n) n.click(); })()`,
      );
      await sleep(500);
    }
  }
}

const shown = await evaluate(`Chart.audit`);
await evaluate(`I18N.set('en')`);

const unaccounted = new Map();
for (const entry of shown) {
  const key = round(entry.value);
  if (allowed.has(key)) continue;
  const id = `${key}`;
  if (!unaccounted.has(id)) unaccounted.set(id, { value: entry.value, where: [] });
  const where = unaccounted.get(id).where;
  const tag = `${entry.chart}${entry.label ? ' ' + entry.label : ''}`;
  if (where.length < 4 && !where.includes(tag)) where.push(tag);
}

console.log('\n=== values on screen ===');
console.log(`  ${shown.length} values collected across 4 boards x 2 locales x every chip view`);
console.log(`  ${allowed.size} distinct values the dataset accounts for`);
console.log(
  `  ${unaccounted.size === 0 ? 'OK  ' : 'FAIL'} ${unaccounted.size} value(s) the dataset cannot account for`,
);
for (const [, entry] of unaccounted) {
  console.log(`         ${entry.value}  (${entry.where.join(', ')})`);
}

const total = provenanceFailures + unaccounted.size;
console.log(`\n${total === 0 ? 'every figure on screen reconciles with leap_data.js' : total + ' problem(s)'}`);

ws.close();
chrome.kill();
await rm(PROFILE, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
process.exit(total === 0 ? 0 : 1);
