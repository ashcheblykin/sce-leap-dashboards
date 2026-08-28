# SCE Smart Monitoring Center — LEAP 2026

Offline wall dashboards for the Saudi Council of Engineers, built on Axion Gen's
chart DSL, grid, widget anatomy and motion, styled in SCE's navy-and-cyan brand,
in English and Arabic.

Target panel: **2880 × 1152**. The layout scales to any other size from the
same source, and on a screen too narrow or too upright for a 2.5 : 1
composition it reflows and scrolls instead — see
[Two layouts, one design](#two-layouts-one-design).

## Running it

Open `SCE_LEAP_2026.html` (in the parent folder) in Chrome. That is the whole
deliverable — one file, no server, no install, no network.

For the conference machine:

```bash
open -a "Google Chrome" --args --kiosk --start-fullscreen \
  "file:///path/to/SCE_LEAP_2026.html"
```

Working on the source instead? Open `app/index.html` directly; it behaves
identically, just split across files.

**There are no network requests at all.** Fonts, the logo, the basemap and the
dataset are all local. Verified with the browser's own request log on every
`tools/shoot.mjs` run: every request is `file://`, and in the bundled file there
are five (the document itself and its data URIs).

## The four boards

The four surfaces of the source deliverable, in its own order and under its own
names — `bigscreen.html`, `index.html`, `kpis.html`, `field-survey.html`:

| Board | What it answers |
| --- | --- |
| Overview | The wall's main screen: ecosystem, enforcement and the field survey at once, over three self-cycling scenes |
| Ecosystem | How big is the profession, and where is it? |
| KPI Library | Every indicator in the set as its own card, filterable by family |
| Field Verification | What the field teams found at 6,371 offices |

**Profession and Operations are not missing.** In the source they were never
boards — they were scenes two and three of the Overview screen, and that is where
they live here, with the sankey, the sunburst, the class radar and the
enforcement money donut intact. Reading the nav as "two boards were dropped"
gets the structure backwards.

The first tab is called **Overview**, not "Big Screen". The source file's name
described the hardware the page ran on, which says nothing to a visitor reading
a tab, and read as a fourth board rather than as the wall's own front page. Its
board id is still `bigscreen`: that id is the localStorage layout key, and
renaming it would silently discard every arrangement already saved on a stand.

Each of the three panel boards fills all 24 × 8 cells: no empty space on the
wall. The KPI Library is the exception, and deliberately — see below.

### Overview

Seven panels: `National Ecosystem`, `Top Specialties`, `Profession Structure`
in the left wing, one map in the centre, `Proactive Monitoring`,
`Enforcement Delivery`, `Field Verification` in the right. The panel set and
its order are the prototype's, and two of the seven exist nowhere else in the
app:

- the **map with all six modes** on one widget — workforce, SCE-registered,
  reach %, enforcement, field survey, survey coverage. Four of those also sit
  on the Ecosystem board and two on Field Verification, but only here can you
  step through the whole set without changing board;
- the **Field Verification panel**, which is the only place a visitor sees the
  door-to-door survey standing next to the register and the fines.

It **cannot be dragged or resized**. The prototype fixed its panels because a
wall runs unattended, and this board ships without the handles at all rather
than with the gestures merely ignored. The other three boards keep them.

Scenes advance on their own every **25 s**, so the board's slot in the rotation
is **75 s** — three scenes — before the wall moves on. The scene switcher lives
in the dock, as Figma has it: the active tab carries its own page number, and
clicking that badge (or the tab itself, which is otherwise a no-op) opens a
list of the three. The header host the prototype used is still there and still
drives the same `board.setScene` and the same auto-cycle — it is hidden, not
replaced, so there is one implementation with two faces rather than two
implementations.

### KPI Library

Twenty cards, five families plus **All**, each card offering the two or three
readings of its figure that the source file offered. It is the one board that
is not on the 24 × 8 grid: its card count changes with the filter (20 / 5 / 5 /
3 / 3 / 4), so the column count is derived from the count instead and every
filter lands on a grid that is exactly full — no ragged last row, and nothing
scrolls on a wall that has no scrollbar.

The filter row itself had gone missing at some point during the rebuild onto
the grid: the cards kept their `cat` tags, this section kept describing it, and
six translated strings sat in `i18n.js` with no caller. It is back, and it is
the same `.chips` segmented control as a card's own view switcher rather than a
third control style — one track, one sliding pill, one implementation.

On a tablet the Library follows the viewport's column count (1 or 2) and
scrolls with everything else, which also means `dense` is off there and every
card shows its full list.

Two departures from the prototype, both deliberate:

- **The views are chart specs, not bespoke HTML.** The source drew its own
  `bignum`, conic `gauge` and `donut`; here a library card and the same figure
  on Overview go through one renderer and cannot drift apart. The GAUGE
  becomes the two-slice donut Field Verification already uses for those same
  percentages.
- **Row-based views show their leading three rows in the All grid.** A
  progress-bar row caps its type against its own height, and five rows in the
  ~100px a card gets at five columns come out at eight-point text — drawn, but
  not readable at a stand. The All grid therefore shows three rows and drops
  the footnote that counts the rest; pick a family and the grid becomes one
  tall row where every card shows its full list with its footnote back. No
  card title claims a total, so nothing on screen is ever wrong — but if you
  are checking a figure, check it filtered.

## Controls

| Input | Effect |
| --- | --- |
| Dock tabs | Jump to a board |
| The page badge on the Overview tab | Open Overview / Profession / Operations |
| The globe in the dock | Switch language (the splash needs none: it is bilingual) |
| Play/pause | Stop or resume the 45-second rotation |
| `←` `→` | Previous / next board |
| `Space` | Play/pause |
| `L` | Toggle language |
| `[` `]` | Type scale down / up · `\` resets it |
| `R`, or Reset layout (in the settings button, board corner) | Restore the original arrangement |
| Chips on a widget | Switch that widget's view |
| Drag a widget header | Move it; on a full board it trades places with the widget underneath |
| Drag a widget edge | Resize it |

Layout changes, the language and the type scale are saved in `localStorage` and
survive a reload — including a relaunch on the stand, which is the point: set
them once during setup. To start clean, clear the site data for the file, or
press `R` and `\` and switch back to `EN`.

## The attract screen

The splash is the LEAP '26 cover, reproduced 1:1 from Figma node 38:357 of
«Sce Dashboards for LEAP '26», with three sibling artboards for the narrower
windows (38:261, 38:938, 38:1084). It is the one part of the app that is not
built from `--u` / `--fu`: each artboard is scaled as a whole, so every number
in `css/splash.css` is a design pixel of its own frame, and those four
breakpoints are the only media queries in the app that do not come from
`core/viewport.js`.

Both languages are on screen at once, so the cover carries no language switch
and no translated strings. Behind the type, `core/cover-field.js` regenerates
the design's baked «code» layer as a live field of JSON fragments in SCE's own
subject matter, keeping clear of the headlines and the logos. `core/splash.js`
owns nothing but the lifecycle: show, hide, and stopping the field with it.

## Timing

- Boards rotate every **45 s**, except Overview, which holds **75 s** to
  play its three 25-second scenes; the active pill fills to show the time left.
- Touching anything holds the rotation for **90 s**.
- **5 min** with no interaction returns to the SCE splash.
- The splash hands back to the boards after **40 s** if nobody touches it
  (anywhere on the cover starts the wall), so an unattended wall never sits on
  a static screen.

## How it is put together

```
index.html            markup and load order
assets/css/           tokens -> base -> grid -> widget -> chart-dsl -> map
                      -> library -> tooltip -> motion -> shell -> splash
                      -> responsive (last: every rule in it is an override,
                      and every one is behind an attribute viewport.js writes)
assets/js/core/       viewport (first: it stamps the layout mode on <html>),
                      i18n, format, counter, tooltip, pill, chart-dsl, map,
                      grid, motion, board, shell, cover-field, splash
assets/js/boards/     kit.js plus one file per board: layout and view specs
                      only. profession.js and operations.js define the widget
                      sets bigscreen.js mounts as its scenes, so both load
                      before it.
assets/js/data/       leap_data.js (verbatim), derive.js (aggregations),
                      labels.js (Latin glosses for the Arabic data labels),
                      ksa-geo.js (country outlines), ksa-basemap.js (the basemap)
```

Seven decisions worth knowing about.

**The charts are Axion Gen's, ported.** `assets/js/core/chart-dsl.js` is a
vanilla-SVG port of `frontend/src/shared/ui/charts` — not an approximation of
how it looks. Every constant is lifted from the file it came from and named
there: the 16px inter-group gap and the band-padding solve from `layout.ts`, the
0.36 → 0.05 bar gradient and ±25 lightness step from `ChartGradients`, the 2px
value-end stripe and 30px label gate from `GradientBars`, the 8/24/4/0.15
progress-bar geometry from `ProgressBarsChart`, the leader-line elbow from
`PieChart`, the 16/10/0.4 node and link geometry from `SankeyChart`, the 0.16
depth fade from `SunburstChart`. Eight kinds are ported: cartesian (bars, lines,
areas, stacks, horizontal), pie/donut, radar, sankey, sunburst, progress-bars,
table and indicator.

Two departures, both deliberate and both commented at the site:

- **Sizes scale.** Axion's chart type is a fixed 11px because it renders in a
  product window. Here every px constant is multiplied by `--chart-u`, derived
  from the board's own `--u`, so the *ratios* are Axion's and only the unit
  changes.
- **Margins cap against the box.** Axion's 16px chart margin scaled to the wall
  becomes ~30px, which on a two-row panel is 45% of the height and leaves a
  donut the size of a coin. And its band-padding solve saturates at 0.9 on a
  short category axis, which turned ten regions into ten hairlines. Both now
  degrade in proportion instead of taking over the layout.

**Resize is Axion's, too.** One shared `ResizeObserver` covers every chart on
the board and re-renders synchronously in its callback. RO delivers after layout
and before paint, so the new geometry lands in the *same frame* as the new
container size — the point of `SyncParentSize`'s `flushSync`. Widgets have **no
geometry transition at rest**, so a continuous drag tracks `100cqw` exactly and
the gaps never breathe; during a gesture they ease between snap steps over 160ms
on `cubic-bezier(0.2, 0.8, 0.2, 1)`, straight from Axion's `grid.css`.
`tools/resize.mjs` asserts all of it.

**Marks arrive once.** A first render grows bars from the zero line, draws lines
on, and fades arcs in, over the same 600ms a single `requestAnimationFrame` loop
uses to count every number on the board — so 6,371 and 1,116,186 finish on the
same frame. A re-render caused by a resize paints the final state immediately:
replaying the growth every time an operator drags a panel edge would be
seasickness.

**Arabic is a locale, not a label swap.** `assets/js/core/i18n.js` holds one
table with both languages side by side, so a missing translation shows up in the
diff rather than in a second file. Switching flips `<html dir>`, which moves
every chart's category axis to the reading-start side, mirrors every panel, and
rebuilds the boards from the message table. Charts stay pinned to LTR coordinate
space and mirror explicitly, exactly as `ChartText.tsx` prescribes: logical text
anchors, `unicode-bidi: plaintext` for labels, `isolate` for numeric runs.
Numbers stay in Western digits in both locales, as Axion Gen does.

The Arabic itself is not ours. SCE's translators localised the four source
dashboards, and those files are archived verbatim in `i18n-source/` — they are
the authority for every Arabic string in the table. `tools/i18n-glossary.mjs`
pairs each one against its English original token for token (all four align
exactly, so no row is a guess) and writes `i18n-source/GLOSSARY.md`, which is
where to look before wording anything in Arabic by hand. Where the four files
translate the same English differently, `i18n-source/DECISIONS.md` records which
one the board uses and why.

**Sizes scale from one unit.** `--u` is `--u-base × --u-scale`, and every font
size, radius, gap and chart constant is expressed in it. On the wall `--u-base`
is `min(100vw/2880, 100vh/1152)` — the fraction of the design the screen
actually is. The wall's real viewing distance is not knowable from a laptop, so
`[` and `]` retune `--u-scale` live and the choice is remembered: one keypress
rescales type, padding and chart geometry together. (On a tablet `--u-base` is
a different formula; see [Two layouts, one design](#two-layouts-one-design).)

**Figma's numbers are a second unit off the same knob.** The dashboard in Figma
is drawn at exactly the target panel size in plain px, so one Figma px is one
CSS px there — but the board still has to shrink to a laptop and still has to
follow `[`/`]`. `--fu` is `--u` divided by the default scale: exactly `1px` at
2880×1152 on the default setting, and proportional to everything else away from
it. Every figure a Figma *component* states is `calc(N * var(--fu))`, so the
card's 12px padding, the 14px control type and the 6px progress rail land on
Figma's own number where it matters and scale where it has to. The alternative
— holding them as literal px, which is what the file did — meant the chrome
stood still while the type moved: `]` straightened the corners and detuned the
chips.

**Panels cap their own type.** A unit-derived size alone is not enough: the same
KPI markup runs one-up in a tall panel and four-up in a short one, and the same
bar list renders three deep or eight deep. So each tile, bar row and table is a
CSS container and the headline sizes are `min(token, N cqh)`. A card that is
short also tightens its own header and chips, because at this scale a two-row
panel was spending a quarter of its height on chrome.

## Two layouts, one design

The board is composed once, at 2880 × 1152, and that ratio is 2.5 : 1. Scaling
it works for as long as the screen is still wide — 24 columns of a 1280px
laptop window are 53px each, narrow but legible. It stops working the moment
the screen is not wide: an iPad held upright is 820px across, the same 24
columns are 34px each, and a card title reads "National ecosys…".

So there are two layouts, and exactly one place decides which — `core/viewport.js`.
Every breakpoint in the app lives in that file and nowhere else; it publishes
the decision as `data-view`, `data-cols` and `data-narrow` on `<html>`, and
`assets/css/responsive.css` keys off those attributes rather than repeating a
media query. Two copies of a breakpoint always eventually disagree.

| | wall | compact |
| --- | --- | --- |
| When | width > 1000px **and** aspect > 5 : 4 | anything narrower or squarer |
| Covers | the LED panel, every MacBook, an iPad on its side | an iPad upright, a phone, a narrow window |
| Layout | 24 × 8 absolute grid, fills the stage exactly | one or two columns, flowed |
| Scrolling | never | vertically, and every block stays reachable |
| `--u-base` | `min(100vw/2880, 100vh/1152)` | `0.58px + 0.046vw` |

Three things change and nothing else does. No colour, no radius, no chart, no
figure, and not one widget added or dropped.

1. **`--u` stops being a fit ratio and becomes a device ratio.** On the wall the
   question "what fraction of 2880 × 1152 is this screen" is the right one,
   because the whole design has to land inside the panel at once. On a tablet it
   has no useful answer — 820px is 28% of the wall, and 28% of a 16px title is
   4.5px. A tablet is read at arm's length, not from across a stand, so its type
   sits near Figma's own pixel sizes whatever the width: ~1.23 at an iPad's 820,
   ~1.36 at 1024, floored at 0.95 on a phone. The single exception is the
   headline factoid rung, which drops 72 → 56: 72 design px is 10% of the width
   of the card it sits in on the wall and 18% of the same card reflowed, so
   holding the number constant would have changed its share of the panel.

2. **The 24 × 8 grid becomes a flow, in the wall's own reading order.**
   `AxGrid.applyGeometry` writes an `order` from the same x/y that positions the
   wall, so the sequence down the tablet is the sequence across the wall — not
   the order the board definition happens to list, which is column by column and
   would stack all three left-wing panels above the map. A widget spanning 9 or
   more of the wall's 24 columns (the map, the register sankey, the specialty
   list) takes the full width here; everything else pairs up. The grid packs
   `dense`, which only ever pulls a later narrow panel into an earlier half-row
   and never reorders two panels of the same width.

3. **The stage scrolls** — the one thing the wall must never do and the one
   thing the tablet must.

Two smaller adjustments follow from the narrower card: a tab track drops one
Figma rung (`control_M` → `control_S`) so a three-segment switcher stops eating
its own card title, and the map's six-mode track — the only one in the app that
does not fit an 820px card in Arabic — wraps, standing its sliding pill down in
favour of painting the active segment, since the pill's whole mechanic is two
edges on one line each with its own clock.

Verified with `tools/shoot.mjs` at 2880 × 1152, 1728 × 1117, 1440 × 900,
1024 × 768 and 820 × 1180, in both locales: no overflow, no clipped text.

## Live, without moving a number

The customer asked for the wall to read as something being watched rather than
printed. **No value moves** — the dataset is theirs and reconciled, and
`tools/audit-data.mjs` proves every figure on screen still comes out of it. The
liveness is arrival and rhythm only:

- **Bubbles grow into place.** Below 80 points each dot has its own delay and
  the map seeds itself city by city. Above it — the field-survey mode plots
  2,840 offices — the marker layer fades in as one, because the line is drawn
  at the number of animated elements, not at anything a viewer can see.
- **Three rings pulse**, on the three largest points of whatever mode is
  showing. Three, whatever the mode plots, because that is the whole cost.
- **A LIVE dot** in the board's far corner, beside the settings button.
- The ticker, which was always there.

All of it is transform and opacity, and all of it stands down under
`prefers-reduced-motion`. The rings are HTML in a layer over the plate rather
than SVG circles beside the bubbles, and that is not a preference: Chrome does
not composite a transform animation on an SVG child, it relays out the SVG. As
SVG, three rings took an idle board from **0 layout passes in six seconds to
684**; as HTML, back to 0. `tools/perf.mjs` is where that is measured, and the
note above the ping layer in `core/map.js` is where it is recorded.

## The scales

Every size in the app is a multiple of **4 design units**. Not a convention —
a rule, and `DESIGN-AUDIT.md` records the pass that made it true.

```
board     --sp-1..--sp-11    4 8 12 16 20 24 32 40 48 56 64   × --u
component --fsp-0-5..--fsp-16   2 4 6 8 12 16 20 24 32 64     × --fu
radii     --radius-xs/sm/track/md/card/dock   4 8 10 12 16 24 × --fu
```

The type scale is Figma's own text styles, verbatim — a `(size, line-height)`
pair per rung, in design pixels, not a ladder invented here:

```
--fs-control-s      12 / 10   legend entries
--fs-control-m      14 / 10   chips, bar rows, table cells, card footnotes
--fs-control-l      16 / 10   card titles, factoid labels, map HUD caption
--fs-caption-m      12 / 14   credits, attribution, the hidden reset
--fs-body-l         20 / 24   the dock's scene badge
--fs-subheading-l   24 / 24   dock tabs, scene menu, ticker
--fs-hero-l         72 / 100  every factoid on the wall, and the map HUD
```

Note the control rungs' 10px leading on 12/14/16px type. That is a cap-height
box, not a paragraph: Figma uses it to *position* a one-line label in
auto-layout and draws the glyphs outside it, which is what lets a 32px bar row
hold a 14px label, a 16px gap and a 6px rail and still add up. CSS has no such
box — a 10px line box works for layout, but the `overflow: hidden` that
`text-overflow: ellipsis` requires then shears the descenders off. The clip box
is padded out and the padding given back as a negative margin (one rule, in
`base.css`); the element keeps its 10px, still ellipsizes, and keeps its
letters.

Three things follow from it that are easy to undo by accident:

**Radii scale too.** They were the one piece of geometry left in absolute px,
so `]` grew the type and the padding while the corners stayed put and the same
card read differently on a laptop and on the wall. A radius in px is a bug now.

**Two names for one size is a bug.** `--fs-title` and `--fs-body` were both 20u,
so a card title had no size hierarchy over its own content; `--fs-kpi-lg` and
`--fs-hud` were 70u and 74u, which is 5px on a 90px number. Where two pieces of
text share a rung today they are told apart by weight, colour and case.

**A cap is a floor under a bad hand, not the design.** At the target panel size
every `--cap-*` sits clear of the rung it guards, so the rung is what draws and
the cap only bites when a board asks for more rows than a panel has room for.
That was not true before: a five-row bar panel capped its rows down to 11.8px
against a 14px rung while its own footnote drew at 20.8px, so the card's
provenance line came out louder than the data it annotated. If a cap is setting
the size at 2880×1152, the layout above it is wrong, not the cap.

**Colour has one home.** The six chart tones are declared in `tokens.css` and
`Chart.TONE` reads them back out of the cascade, the same way `refreshUnit()`
reads `--chart-u`. There are no colour literals in the boards.

Caps work the same way. Anything that can dominate a panel is
`min(token, --cap-*)`, and a cap names the fraction of **its own** box that
piece may take. There are two bases, because there are two kinds of box: a
panel or tile (`--cap-note`, `--cap-label`, `--cap-gap`, `--cap-kpi*`) and a
single row inside a list (`--cap-row-note`, `--cap-row-text`).

One warning, learned the hard way. A `<table>` has an intrinsic min-content
height it will not shrink past, so a table over its budget does not clip
itself — it pushes the footnote out through the bottom of the card, and
`.widget-body` never reports overflow because the shell around the table
clipped first. That is why the row budget reserves the note's cap (46cqh, not
52) and why `shoot.mjs` now walks every box that hides its own overflow rather
than only the body.

## Fonts

Two faces, subsetted to what is actually on screen: **342 KB → 51 KB.**

```bash
PATH="<venv>/bin:$PATH" python3 tools/subset-fonts.py
```

`tools/subset-fonts.py` derives the character set by scanning `assets/js`,
`assets/css` and `index.html` — including `leap_data.js`, which carries the
Arabic city and profession names — so "the text changed" and "the subset is
stale" cannot drift apart. **Re-run it after editing any user-facing string.**
Basic Latin is kept whole regardless (95 glyphs, and a missing digit on a wall
is not worth 2 KB), and the Arabic face keeps every layout feature so
`init`/`medi`/`fina`/`rlig` shaping survives. Needs `fonttools` + `brotli`.

## The map

The prototypes drew a real Carto basemap through Leaflet, which the conference
machine cannot do. Rather than fall back to a bare country outline, the tiles are
baked: `tools/bake-basemap.py` pulls the raster once, stitches it, grades it into
the SCE palette and writes `assets/js/data/ksa-basemap.js` as a single 220 KB
WebP data URI. The map keeps its coastlines, borders, roads and city labels, and
still never opens a socket.

Two details make it work:

- **Voyager, not the dark style.** Carto's dark tiles put water and motorways at
  the same luminance (both 38/255), so they cannot be told apart by brightness.
  Voyager blue-shifts water, so the grade classifies by hue instead and land,
  sea, sand and infrastructure each get their own stop.
- **The plate is placed by its bbox, not by tile maths.** The renderer's screen
  space is longitude by projected latitude, and the tile pyramid is Web Mercator,
  so both axes are linear and the baked pixels line up with the bubbles drawn
  over them. The extent is baked wider than any shape the panel can be dragged
  to, so a wide panel never runs off the edge of the image.

Saudi Arabia is separated from its neighbours by a scrim over everything except a
mask of the country, rather than by filling the neighbours in. The Natural Earth
outlines are simplified, and filling them directly showed a ragged seam along
every coast; this way the only edge that must line up is Saudi's own, and the
border stroke covers it.

Attribution for the tiles (`© OpenStreetMap · © CARTO`) is required and sits with
the Axion mark in the map's top corner, opposite the HUD, so the whole bottom
edge stays free for the panel's note.

## Data

`leap_data.js` is used exactly as supplied, byte-identical to
`Data Files/leap_data.js` and to the copy inside all four source dashboards.
`derive.js` aggregates it and runs twenty cross-checks from the calculation
guide and build book on every load; they report to the console.

**Nothing is calculated for display that the documents do not authorise, and
`tools/audit-data.mjs` proves it** — it builds the set of accountable values in
Node from `leap_data.js`, drives all four boards through both locales and every
chip view, collects every number the chart DSL was handed, and reports anything
the dataset cannot account for. It currently reconciles 1,204 values against 417
distinct accountable ones with nothing left over.

Four places where the shipped data and the documentation disagree. In each the
data wins and the panel says so in its own footnote, rather than the discrepancy
being smoothed over:

| What | The data | The document |
| --- | --- | --- |
| Regional enforcement | `LEAP.regions` totals **946** actions and 7.20M SAR | Calculation guide §6 cross-check expects Σ regions = 2,445 |
| 36-month trend | 36 monthly points of 10k–963k, one month (2023-11) absent | Guide §4 calls them Efaa cases, which total 2,445 all-years — so they are plotted **unitless** |
| Associate / Consultant grades | **26,919** / **26,718** (grades.csv and `leap_data.js` agree) | Build Book §4 lists 27,049 / 26,772 |
| Renewal windows past 90 days | `LEAP.pipetrack` totals 492,152 across all six windows | Reconciles with neither the active register (485,948) nor the renewal window (64,784), so only the three documented windows are shown — their per-class sums reproduce `renewal_pipeline.csv` exactly |

One thing to note when reading the boards: grade rollups break down the
**engineer memberships only** — the four grades sum to 596,606, not to the whole
register — and the field-verification percentages are measured against the
**3,141 offices found active at the door**, not against all 6,371 surveyed. Both
are stated on the panels that show them.

`assets/js/data/labels.js` adds no data: it is the Latin gloss for the Arabic
place names and profession titles in `leap_data.js`, so the English board is
readable to a visitor who does not read Arabic. All 101 labels the dataset uses
are covered; anything uncovered would fall back to the Arabic verbatim, which is
what all four source dashboards show in both languages.

## Development tools

`tools/` is for building and checking this app and is not part of the
deliverable. Each needs only Node and Chrome.

```bash
node tools/bundle.mjs              # rebuild SCE_LEAP_2026.html
node tools/shoot.mjs 2880 1152     # screenshot every board in both locales;
                                   # report console errors, off-machine
                                   # requests, overflow and clipping
node tools/shoot.mjs 820 1180      # ...and any other size. The overflow rule
                                   # follows the layout mode: on the wall a
                                   # card below the fold is a failure, on a
                                   # compact screen it is the scroll working,
                                   # so there the check is horizontal only.
                                   # tools/shots/<WxH>/ holds a set each for
                                   # 3840x1080, 2560x1440, 1920x1080,
                                   # 1440x900, 1180x820, 820x1180 and 390x844
node tools/audit-data.mjs          # reconcile every figure on screen with leap_data.js
node tools/resize.mjs              # chart-tracks-container, transitions, counters
node tools/timing.mjs              # slideshow, idle and attract behaviour
node tools/drag.mjs                # drag, resize and layout persistence
node tools/pill.mjs [out]          # trace the sliding pill's state machine
                                   #   (tools/pill-trace.txt is the expected trace)
node tools/css-coverage.mjs        # selectors in assets/css that never match
node tools/perf.mjs                # main-thread cost of the dock, the chips
                                   #   and the wall at rest, plus a count of
                                   #   live backdrop-filter layers per board
node tools/diff-shots.mjs a b      # pixel-diff two shoot.mjs output directories
node tools/probe.mjs "<expr>" [n]  # one-off DOM probe (LOCALE=ar for the RTL board)
python3 tools/subset-fonts.py      # rebuild assets/fonts/ (needs fonttools)
python3 tools/bake-geo.py          # regenerate the country outlines (needs network)
python3 tools/bake-basemap.py      # regenerate the basemap raster (needs network)
```

`DESIGN-AUDIT.md` is the design pass over all of this: what was measured, what
changed, and the five questions it deliberately left open.
`CSS-OPTIMIZATION-PLAN.md` is the cleanup pass over the markup and stylesheets.
`FIGMA-ALIGNMENT.md` is the pass that put every component on Figma's own
numbers and took the layout animations off the main thread.

### Proving a change did not touch the picture

Refactoring a wall dashboard has an obvious acceptance test — the pixels — and
until recently no way to run it. `diff-shots.mjs` is that test:

```bash
node tools/shoot.mjs 2880 1152 tools/shots-baseline   # before
#   ... make the change ...
node tools/shoot.mjs 2880 1152 tools/shots-after
node tools/diff-shots.mjs tools/shots-baseline tools/shots-after
```

It exits non-zero on any differing pixel and prints how many and how far apart;
`DIFF_OUT=<dir>` also writes a difference map per frame, unchanged pixels
ghosted grey and changed ones flagged red.

For that to mean anything the app has to render the same twice, so `shoot.mjs`
pins the two things that move on wall-clock time — the ticker marquee and the
splash's code field — to one fixed phase before each capture (see
`freezeMotion`, and `Splash.freeze`, which exists for it and for nothing else).
Fourteen frames then come back byte-identical across runs.

Two caveats worth knowing before trusting a red result.

**One card flakes, rarely.** Roughly one run in five, a field-board frame comes
back with a 10px-wide, ~305px-tall strip of differing pixels down the
reading-start edge of the Top-cities card — `en-4-field` at x 2051, `ar-4-field`
mirrored at x 2842. It is the first glyph column of the row labels rendering a
shade differently: 261 px at maxΔ 2 in English, 513 px at maxΔ 57 in Arabic,
where the glyphs carry more contrast at that edge.

This predates the harness — six runs of the pre-cleanup code reproduce it — and
nobody has ever seen it on a wall. Treat a diff of that shape on that card as
noise; anything larger, anywhere else, or on any other frame is real.

**A screenshot cannot see motion.** Every frame catches the sliding pill at
rest, so `pill.mjs` covers what the pixels cannot: it records the state machine's
own decisions — the durations each edge gets, the fill and shadow it wears while
travelling and after it lands, where it comes to rest — for both the widgets'
chips and the dock's nav, and writes them to a file made to be diffed against
the checked-in `tools/pill-trace.txt`.

`shoot.mjs` and `audit-data.mjs` both honour `TARGET=../SCE_LEAP_2026.html` to
check the bundle rather than the source. Headless Chrome only draws on demand,
so both pump frames before each capture; that is a harness concern, not
something the app needs.
