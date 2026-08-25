/* Rebuild i18n-source/GLOSSARY.md from the professionally translated
   dashboards and their English originals.

   The four Arabic files are translations of the four source dashboards in
   `Dashboards/`, made outside this repo and verified by SCE's translators.
   They are the authority for every Arabic string in `assets/js/core/i18n.js`,
   so they are archived verbatim next to this script and the pairing is
   derived, never typed: each file is tokenised into HTML text nodes and JS
   string literals in document order, and the two token streams are compared
   index for index. All four pairs align exactly — 606, 670, 587 and 520
   tokens — which is what makes "this Arabic belongs to that English" a fact
   rather than a judgement.

   One pre-pass earns that alignment: the English KPI Library writes its view
   keys bare (`{NUMBER:` ...) where the Arabic file quotes them, so the English
   is normalised to quoted keys before tokenising. Without it the two streams
   drift by thirty tokens and every pairing after the first card is wrong.

       node tools/i18n-glossary.mjs

   Run from `app/`. Writes `i18n-source/GLOSSARY.md`. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const repo = path.resolve(app, '..');
const src = path.join(app, 'i18n-source');

const PAIRS = [
  ['Ecosystem', 'SCE_LEAP_Ecosystem.html', 'SCE_LEAP_Ecosystem_AR.html'],
  ['Field Verification', 'SCE_LEAP_Field_Verification.html', 'SCE_LEAP_Field_Verification_AR.html'],
  ['KPI Library', 'SCE_LEAP_KPI_Library.html', 'SCE_LEAP_KPI_Library_AR.html'],
  ['Big Screen', 'SCE_LEAP_BigScreen.html', 'SCE_LEAP_BigScreen_AR.html'],
];

/* The KPI Library's view keys, bare on the English side only. */
const VIEW_KEYS = /([{,])(NUMBER|BARS|TABLE|DONUT|TREND|SPLIT|GAUGE|MORE|SHARE):/g;

function tokens(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('<script', i)) {
      const open = text.indexOf('>', i);
      const close = text.indexOf('</script>', open);
      scanJs(text.slice(open + 1, close < 0 ? text.length : close), out);
      i = close < 0 ? text.length : close + 9;
    } else if (text.startsWith('<style', i)) {
      const close = text.indexOf('</style>', i);
      i = close < 0 ? text.length : close + 8;
    } else if (text[i] === '<') {
      const close = text.indexOf('>', i);
      i = close < 0 ? text.length : close + 1;
    } else {
      let j = text.indexOf('<', i);
      if (j < 0) j = text.length;
      const run = text.slice(i, j).trim();
      if (run) out.push(run);
      i = j;
    }
  }
  return out;
}

function scanJs(body, out) {
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === '/' && body[i + 1] === '/') {
      const e = body.indexOf('\n', i);
      i = e < 0 ? body.length : e + 1;
    } else if (c === '/' && body[i + 1] === '*') {
      const e = body.indexOf('*/', i);
      i = e < 0 ? body.length : e + 2;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < body.length && body[j] !== c) j += body[j] === '\\' ? 2 : 1;
      out.push(body.slice(i + 1, j));
      i = j + 1;
    } else {
      i++;
    }
  }
}

const cell = (s) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

const lines = [
  '# Professional Arabic glossary — every string, verbatim',
  '',
  'Extracted from the four professionally translated dashboards in this folder,',
  'paired one for one against the English originals in `Dashboards/`. Both sides',
  'are verbatim, and the pairing is derived rather than typed: each file is',
  'tokenised into HTML text nodes and JS string literals in document order and',
  'the two streams are compared index for index. All four pairs align exactly,',
  'so no row here is a guess about which English string a translation belongs to.',
  '',
  'Regenerate with `node tools/i18n-glossary.mjs`.',
  '',
  '> The two big-screen files arrived with their names swapped: the one',
  '> delivered as `SCE_LEAP_BigScreen_AR.html` is the KPI Library, and',
  '> `SCE_LEAP_Big Screen_AR.html` is the LED wall. They are archived here under',
  '> the names that match their content.',
  '',
];

let total = 0;
for (const [name, enName, arName] of PAIRS) {
  const en = fs.readFileSync(path.join(repo, 'Dashboards', enName), 'utf8');
  const ar = fs.readFileSync(path.join(src, arName), 'utf8');
  const te = tokens(en.replace(VIEW_KEYS, "$1'$2':"));
  const ta = tokens(ar);
  if (te.length !== ta.length) {
    throw new Error(`${name}: ${te.length} English tokens vs ${ta.length} Arabic — the files no longer align, so no pairing can be trusted`);
  }
  lines.push('', `## ${name}`, '', `\`${arName}\` ← \`Dashboards/${enName}\``, '', '| English | العربية |', '| --- | --- |');
  for (let i = 0; i < te.length; i++) {
    if (te[i] === ta[i]) continue;
    lines.push(`| ${cell(te[i])} | ${cell(ta[i])} |`);
    total++;
  }
}

fs.writeFileSync(path.join(src, 'GLOSSARY.md'), lines.join('\n') + '\n');
console.log(`GLOSSARY.md — ${total} translated strings across ${PAIRS.length} dashboards`);
