# SCE Smart Monitoring Center — LEAP 2026

Offline wall dashboards for the Saudi Council of Engineers, built on Axion Gen's
chart DSL, grid, widget anatomy and motion, styled in SCE's navy-and-cyan brand,
in English and Arabic.

Target panel: **2880 × 1152**. The layout scales to any other size from the same
source.

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

| Board | What it answers |
| --- | --- |
| National Ecosystem | How big is the profession, and where is it? |
| Profession | Who is on the register — class, status, grade, specialty, nationality |
| Operations | Renewal pipeline, Efaa enforcement, where it lands |
| Field Verification | What the field teams found at 6,371 offices |

Each fills all 24 × 8 cells: no empty space on the wall.

## Controls

| Input | Effect |
| --- | --- |
| Board pills | Jump to a board |
| `EN` / `ع` | Switch language (also on the splash) |
| Play/pause | Stop or resume the 45-second rotation |
| `←` `→` | Previous / next board |
| `Space` | Play/pause |
| `L` | Toggle language |
| `[` `]` | Type scale down / up · `\` resets it |
| `R`, or Reset layout (hover the header) | Restore the original arrangement |
| Chips on a widget | Switch that widget's view |
| Drag a widget header | Move it; on a full board it trades places with the widget underneath |
| Drag a widget edge | Resize it |

Layout changes, the language and the type scale are saved in `localStorage` and
survive a reload — including a relaunch on the stand, which is the point: set
them once during setup. To start clean, clear the site data for the file, or
press `R` and `\` and switch back to `EN`.

## Timing

- Boards rotate every **45 s**; the active pill fills to show the time left.
- Touching anything holds the rotation for **90 s**.
- **5 min** with no interaction returns to the SCE splash.
- The splash hands back to the boards after **40 s** if nobody presses Start,
  so an unattended wall never sits on a static screen.

## How it is put together

```
index.html            markup and load order
assets/css/           tokens -> base -> grid -> widget -> chart-dsl -> map
                      -> motion -> shell -> splash
assets/js/core/       i18n, format, counter, chart-dsl, map, grid, motion,
                      board, shell, splash
assets/js/boards/     kit.js plus one file per board: layout and view specs only
assets/js/data/       leap_data.js (verbatim), derive.js (aggregations),
                      labels.js (Latin glosses for the Arabic data labels),
                      ksa-geo.js (country outlines), ksa-basemap.js (the basemap)
```

Six decisions worth knowing about.

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

**Sizes scale from one unit.** `--u` is `min(100vw/2880, 100vh/1152) × --u-scale`,
and every font size, radius, gap and chart constant is expressed in it. The
wall's real viewing distance is not knowable from a laptop, so `[` and `]` retune
`--u-scale` live and the choice is remembered — one keypress rescales type,
padding and chart geometry together.

**Panels cap their own type.** A unit-derived size alone is not enough: the same
KPI markup runs one-up in a tall panel and four-up in a short one, and the same
bar list renders three deep or eight deep. So each tile, bar row and table is a
CSS container and the headline sizes are `min(token, N cqh)`. A card that is
short also tightens its own header and chips, because at this scale a two-row
panel was spending a quarter of its height on chrome.

## The scales

Every size in the app is a multiple of **4 design units**. Not a convention —
a rule, and `DESIGN-AUDIT.md` records the pass that made it true.

```
spacing   --sp-1..--sp-11    4 8 12 16 20 24 32 40 48 56 64
type      --fs-2xs           12u   credits, attribution, the hidden reset
          --fs-xs            16u   notes, labels, chips, legends
          --fs-sm            20u   body, bar labels, table, ticker
          --fs-md            24u   card titles, nav, header, splash CTA
          --fs-kpi-sm        40u   --fs-kpi 56u   --fs-display 72u
radii     --radius-xs/sm/md/card    4 8 12 16
```

Three things follow from it that are easy to undo by accident:

**Radii scale too.** They were the one piece of geometry left in absolute px,
so `]` grew the type and the padding while the corners stayed put and the same
card read differently on a laptop and on the wall. A radius in px is a bug now.

**Two names for one size is a bug.** `--fs-title` and `--fs-body` were both 20u,
so a card title had no size hierarchy over its own content; `--fs-kpi-lg` and
`--fs-hud` were 70u and 74u, which is 5px on a 90px number. Where two pieces of
text share a rung today they are told apart by weight, colour and case.

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
the dataset cannot account for. It currently reconciles 696 values against 417
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
node tools/audit-data.mjs          # reconcile every figure on screen with leap_data.js
node tools/resize.mjs              # chart-tracks-container, transitions, counters
node tools/timing.mjs              # slideshow, idle and attract behaviour
node tools/drag.mjs                # drag, resize and layout persistence
node tools/probe.mjs "<expr>" [n]  # one-off DOM probe (LOCALE=ar for the RTL board)
python3 tools/subset-fonts.py      # rebuild assets/fonts/ (needs fonttools)
python3 tools/bake-geo.py          # regenerate the country outlines (needs network)
python3 tools/bake-basemap.py      # regenerate the basemap raster (needs network)
```

`DESIGN-AUDIT.md` is the design pass over all of this: what was measured, what
changed, and the five questions it deliberately left open.

`shoot.mjs` and `audit-data.mjs` both honour `TARGET=../SCE_LEAP_2026.html` to
check the bundle rather than the source. Headless Chrome only draws on demand,
so both pump frames before each capture; that is a harness concern, not
something the app needs.
