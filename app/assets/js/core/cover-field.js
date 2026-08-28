/* LEAP '26 cover — the splash's live «code» layer, plus the cap-height trim
   fallback its type needs.

   In Figma the code layer (node 38:368) is three copies of a baked 1400×1400
   raster, «ex8-pattern-02», dropped at these artboard coordinates:

       tile 1   x  970   y -926
       tile 2   x  634   y  282
       tile 3   x -1182  y   54

   This file reproduces the same three tiles as a generated, animated field:
   the same JSON-record language, the same glyph colours sampled from the
   original raster, the same density — but the records are SCE's own subject
   matter (accreditation, CPD, professional exams, university programmes,
   career pathways) instead of the reference's asset telemetry. The tiles are
   seeded differently so the motion does not read as a repeating loop.

   Everything is drawn in artboard pixels; the canvas backing store is sized to
   the real device resolution so the layer stays crisp at any scale.
   ========================================================================= */

(() => {
  'use strict';

  /* ══ 1. cap-height trim fallback ═══════════════════════════════════════
     Figma trims text boxes to cap-height / alphabetic baseline. Modern CSS
     does that natively with `text-box`. Where it is missing, shift each
     trimmed element up by the measured distance from the line box top to the
     cap top, which produces the same result. */

  function applyTrimFallback() {
    const supported =
      CSS.supports('text-box', 'trim-both cap alphabetic') ||
      CSS.supports('text-box-trim', 'trim-both');
    if (supported) return;

    const probe = document.createElement('canvas').getContext('2d');

    document.querySelectorAll('[data-trim]').forEach((el) => {
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const leading = parseFloat(cs.lineHeight) || size;

      probe.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
      const m = probe.measureText('H');
      const ascent = m.fontBoundingBoxAscent;
      const descent = m.fontBoundingBoxDescent;
      const cap = m.actualBoundingBoxAscent;
      if (!ascent || !cap) return;

      const halfLeading = (leading - (ascent + descent)) / 2;
      el.style.translate = `0 ${-(halfLeading + (ascent - cap))}px`;
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(applyTrimFallback);
  } else {
    window.addEventListener('load', applyTrimFallback);
  }

  /* ══ 2. live code field ════════════════════════════════════════════════ */

  const canvas = document.querySelector('.code');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const FRAME_W = 2880;
  const FRAME_H = 1152;
  /* «background 1» is 2880 × 1312 sitting at y −80 inside the frame — that
     rectangle is what .cover__bg paints, so it is also what the code layer
     has to follow. */
  const BG_W = 2880;
  const BG_H = 1312;
  const BG_Y = -80;

  const TILE = 1400;
  const TILES = [
    { x: 970, y: -926, seed: 0x5ce1 },
    { x: 634, y: 282, seed: 0x1eaf },
    { x: -1182, y: 54, seed: 0x26bd },
  ];

  /* Measured off the source raster: the 28-character run
     `"condition_score":87 "last_i` is 236 artboard px wide → 8.43 px per cell
     → 14 px monospace. Stacked lines inside a cluster sit 13.7 px apart. */
  const FONT_SIZE = 14;   // artboard px
  const LINE_H = 13.7;    // artboard px
  const MONO =
    'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code", "Roboto Mono", monospace';

  /* Fragments per tile. In `figma` mode the three tiles hang far outside the
     frame, so only about a third of them ever shows; a grid of tiles is fully
     visible, hence the lower count — both end up at roughly 26–34 fragments on
     screen, which is what the source raster carries. */
  const PER_TILE = 34;
  const PER_TILE_GRID = 26;
  const FPS = 20;
  const MIN_SCALE = 0.5;  // keeps the 14 px type from collapsing on phones

  /* Safe zones. The designer placed the three tiles so that no glyph runs under
     the headlines or the logos; here the same rule is enforced from the live
     layout instead of from coordinates, so it holds at every breakpoint.
     Text blocks are measured by their glyph run (a Range hugs the letters,
     the element box would over-reserve on the right-aligned Arabic), logos by
     their element box. Padding is in artboard px — about three cells wide and
     two lines tall. */
  const SAFE_TEXT = [
    '.en-title__gold', '.en-title__white', '.en-sub', '.powered__label',
    '.ar-title__gold', '.ar-title__white', '.ar-sub',
  ];
  const SAFE_BOX = ['.sce', '.powered__logo'];
  const SAFE_PAD = 24;

  /* Density ramp of the reference field — also the alphabet of the noise
     clusters that sit between the readable tokens. */
  const RAMP =
    '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'.';

  /* The register the Saudi Council of Engineers actually keeps: accredited
     members and their professional grade, CPD, professional exams, classified
     engineering offices, accredited university programmes and the career
     pathways between grades. Figures are illustrative, not real SCE data —
     this is a decorative backdrop. Six schemas, so a random slice almost
     always lands on a recognisable key. */
  const RECORDS = [
    '"member_id":"SCE-ENG-284119" "discipline":"civil" "grade":"professional_engineer" "region":"Riyadh" "accreditation":"valid" "cpd_hours":42 "renewal":"2026-09-30" "cohort":2014',
    '"member_id":"SCE-ENG-317604" "discipline":"electrical" "grade":"consultant_engineer" "region":"Eastern Province" "accreditation":"valid" "cpd_hours":58 "cohort":2009',
    '"member_id":"SCE-ENG-402877" "discipline":"architecture" "grade":"engineer" "region":"Makkah" "accreditation":"under_review" "cpd_hours":11 "renewal":"2026-04-18"',
    '"member_id":"SCE-ENG-190355" "discipline":"chemical" "grade":"engineering_associate" "region":"Jazan" "accreditation":"valid" "cpd_hours":27 "cohort":2021',

    '"programme_id":"SCE-CPD-0471" "title":"Structural Retrofit Practice" "provider":"KFUPM" "cpd_hours":16 "seats":320 "enrolled":297 "delivery":"hybrid" "region":"Eastern Province"',
    '"programme_id":"SCE-CPD-0912" "title":"Grid Integration of Renewables" "provider":"KAUST" "cpd_hours":24 "seats":180 "enrolled":180 "delivery":"onsite" "waitlist":64',
    '"programme_id":"SCE-CPD-1338" "title":"Geotechnical Risk in Arid Soils" "provider":"King Saud University" "cpd_hours":12 "seats":240 "enrolled":186 "delivery":"remote"',

    '"exam_id":"SCE-PE-2026-03" "discipline":"mechanical" "centre":"Riyadh" "candidates":1840 "pass_rate":0.71 "session":"spring" "avg_score":74.6',
    '"exam_id":"SCE-PE-2026-04" "discipline":"architecture" "centre":"Jeddah" "candidates":962 "pass_rate":0.64 "session":"spring" "avg_score":69.2',
    '"exam_id":"SCE-PE-2026-07" "discipline":"industrial" "centre":"Dammam" "candidates":1105 "pass_rate":0.78 "session":"summer" "avg_score":80.1',

    '"office_id":"SCE-OFF-01188" "classification":"grade_1" "disciplines":7 "registered_staff":214 "audit":"passed" "city":"Jeddah" "valid_until":"2027-01-31"',
    '"office_id":"SCE-OFF-04530" "classification":"grade_3" "disciplines":2 "registered_staff":19 "audit":"review" "city":"Abha" "valid_until":"2026-06-30"',

    '"accreditation_id":"SCE-ACC-0088" "programme":"BSc Civil Engineering" "university":"King Saud University" "cycle":"2024-2029" "status":"accredited" "criteria_met":21',
    '"accreditation_id":"SCE-ACC-0142" "programme":"BSc Mechatronics" "university":"Umm Al-Qura University" "cycle":"2025-2030" "status":"conditional" "criteria_met":17',
    '"accreditation_id":"SCE-ACC-0219" "programme":"MSc Petroleum Engineering" "university":"KFUPM" "cycle":"2026-2031" "status":"accredited" "criteria_met":23',

    '"pathway_id":"SCE-CAR-0207" "from":"engineering_associate" "to":"engineer" "median_months":34 "cpd_required":30 "assessment":"portfolio+exam" "region":"Qassim"',
    '"pathway_id":"SCE-CAR-0311" "from":"engineer" "to":"professional_engineer" "median_months":61 "cpd_required":60 "assessment":"interview" "region":"Riyadh"',

    '"branch":"civil_engineering" "members":112480 "new_registrations":2136 "female_share":0.184 "avg_experience_yrs":9.4 "region":"Makkah" "quarter":"Q1"',
    '"branch":"industrial_engineering" "members":38105 "new_registrations":874 "female_share":0.271 "avg_experience_yrs":7.1 "region":"Qassim" "quarter":"Q1"',
    '"branch":"computer_engineering" "members":54962 "new_registrations":3410 "female_share":0.336 "avg_experience_yrs":5.8 "region":"Riyadh" "quarter":"Q1"',
  ];

  /* Loose single tokens — the short debris scattered between the long slices. */
  const CHIPS = [
    'SCE-ENG-', 'cpd_h', 'grade:', 'valid', 'KFUPM', 'PE', 'accred', 'renew',
    'Q1', '0.71', 'civil', 'reg_', 'yrs', 'seats', 'audit', 'KSU', 'cohort',
    '&', ';', 'e', 'N', 'k', '3"', '89%', 'w_', 'me', 'nts":1',
  ];

  const COLORS = [
    'var(--code-amber)',
    'var(--code-bright)',
    'var(--code-neutral)',
  ];

  /* ── deterministic RNG so each tile keeps a stable composition ───────── */

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ── fragment factory ───────────────────────────────────────────────── */

  function makeFragment(rand, cols, rows, now) {
    const roll = rand();
    let lines;
    let kind;

    if (roll < 0.46) {
      // a clipped slice of one telemetry record
      kind = 'slice';
      const rec = RECORDS[(rand() * RECORDS.length) | 0];
      const len = 5 + ((rand() * 28) | 0);
      const start = (rand() * Math.max(1, rec.length - len)) | 0;
      lines = [rec.slice(start, start + len)];
    } else if (roll < 0.74) {
      // a short loose token
      kind = 'chip';
      lines = [CHIPS[(rand() * CHIPS.length) | 0]];
    } else {
      // a dense cluster of ramp characters
      kind = 'noise';
      const n = 2 + ((rand() * 3) | 0);
      lines = [];
      for (let i = 0; i < n; i++) {
        const w = 4 + ((rand() * 14) | 0);
        let s = '';
        for (let j = 0; j < w; j++) {
          s += rand() < 0.14 ? ' ' : RAMP[(rand() * RAMP.length) | 0];
        }
        lines.push(s);
      }
    }

    const width = Math.max(...lines.map((l) => l.length));

    return {
      kind,
      lines,
      col: (rand() * Math.max(1, cols - width)) | 0,
      row: (rand() * Math.max(1, rows - lines.length)) | 0,
      color: COLORS[kind === 'noise' ? (rand() < 0.5 ? 0 : 2)
        : rand() < 0.34 ? 1 : rand() < 0.62 ? 0 : 2],
      alpha: 0.42 + rand() * 0.58,
      born: now,
      life: 4200 + rand() * 9000,
      fadeIn: 400 + rand() * 500,
      fadeOut: 600 + rand() * 700,
      nextMutate: now + 90 + rand() * 400,
    };
  }

  function mutate(f, rand, now) {
    if (f.kind === 'noise') {
      const li = (rand() * f.lines.length) | 0;
      const line = f.lines[li];
      const ci = (rand() * line.length) | 0;
      f.lines[li] =
        line.slice(0, ci) + RAMP[(rand() * RAMP.length) | 0] + line.slice(ci + 1);
      f.nextMutate = now + 60 + rand() * 260;
    } else if (f.kind === 'slice') {
      // slide the reading window one character along the record
      const line = f.lines[0];
      f.lines[0] = line.slice(1) + RAMP[(rand() * RAMP.length) | 0];
      f.nextMutate = now + 160 + rand() * 900;
    } else {
      f.nextMutate = now + 500 + rand() * 1500;
    }
  }

  /* ── state ──────────────────────────────────────────────────────────── */

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bgEl = document.querySelector('.cover__bg');
  let advance = FONT_SIZE * 0.6;
  let cols = 1;
  let rows = 1;
  let field = [];
  let resolved = COLORS.slice();
  let scale = 1;
  let originX = 0;
  let originY = 0;
  let fillMode = 'figma';
  let perTile = PER_TILE;
  let tileKey = '';
  let visX0 = 0;
  let visX1 = 0;
  let visY0 = 0;
  let visY1 = 0;
  let safeRects = [];
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  /* Non-null only while frozen: see freeze() at the end of the file. */
  let seedBase = null;

  function resolveColors() {
    const cs = getComputedStyle(canvas);
    resolved = [
      cs.getPropertyValue('--code-amber').trim() || '#f0a833',
      cs.getPropertyValue('--code-bright').trim() || '#fcd268',
      cs.getPropertyValue('--code-neutral').trim() || '#dcd6d0',
    ];
  }

  /* Bounding box of a fragment in artboard coordinates. */
  function fragBox(tile, f) {
    let longest = 0;
    for (const l of f.lines) if (l.length > longest) longest = l.length;
    const x = tile.x + f.col * advance;
    const y = tile.y + f.row * LINE_H;
    return {
      x0: x,
      y0: y,
      x1: x + longest * advance,
      y1: y + (f.lines.length + 0.3) * LINE_H,
    };
  }

  function blocked(b) {
    for (let i = 0; i < safeRects.length; i++) {
      const s = safeRects[i];
      if (b.x0 < s.x1 && b.x1 > s.x0 && b.y0 < s.y1 && b.y1 > s.y0) return true;
    }
    return false;
  }

  /* Re-roll a fragment until it lands clear of the safe zones. After a few
     misses give up and hand it back anyway — draw() skips it, and the slot is
     retried on the next respawn rather than blocking the frame. */
  function placeFragment(rand, tile, now) {
    let f = makeFragment(rand, cols, rows, now);
    for (let i = 0; i < 8 && blocked(fragBox(tile, f)); i++) {
      f = makeFragment(rand, cols, rows, now);
    }
    return f;
  }

  function seed(tiles, base) {
    const now = base == null ? performance.now() : base;
    const count = perTile;
    field = tiles.map((tile) => {
      const rand = rng(tile.seed);
      const frags = [];
      for (let i = 0; i < count; i++) {
        frags.push(placeFragment(rand, tile, now - rand() * 6000));
      }
      return { tile, rand, frags };
    });
  }

  /* Text and logo boxes, converted from viewport pixels into the artboard
     space the field is drawn in. */
  function computeSafeRects() {
    const rects = [];
    const push = (r) => {
      if (!r || r.width < 1 || r.height < 1) return;
      rects.push({
        x0: (r.left - originX) / scale - SAFE_PAD,
        y0: (r.top - originY) / scale - SAFE_PAD,
        x1: (r.right - originX) / scale + SAFE_PAD,
        y1: (r.bottom - originY) / scale + SAFE_PAD,
      });
    };

    for (const sel of SAFE_TEXT) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      push(range.getBoundingClientRect());
    }
    for (const sel of SAFE_BOX) {
      const el = document.querySelector(sel);
      if (el) push(el.getBoundingClientRect());
    }

    safeRects = rects;
  }

  /* `figma` — три тайла ровно там, где их положил дизайнер в 38:368.
     `grid`  — та же плитка, но разложенная по всей видимой области: на узких
               макетах исходная тройка уезжает за кадр и поле редеет. */
  function computeTiles() {
    if (fillMode !== 'grid') return TILES;

    const i0 = Math.floor((0 - originX) / scale / TILE);
    const i1 = Math.floor((cssW - originX) / scale / TILE);
    const j0 = Math.floor((0 - originY) / scale / TILE);
    const j1 = Math.floor((cssH - originY) / scale / TILE);

    const list = [];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        list.push({
          x: i * TILE,
          y: j * TILE,
          seed: (0x9e37 ^ Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0,
        });
      }
    }
    return list;
  }

  /* Where .cover__bg is painting its image right now, in CSS pixels. Reads the
     used background-size / background-position instead of duplicating the
     breakpoints, so restyling the backdrop needs no change here. */
  function backdropRect() {
    const ratio = BG_W / BG_H;
    let w = null;
    let h = null;

    if (bgEl) {
      const cs = getComputedStyle(bgEl);
      const size = cs.backgroundSize.split(' ');
      const val = (v, base) =>
        !v || v === 'auto' ? null
          : v.endsWith('%') ? (parseFloat(v) / 100) * base
            : parseFloat(v);

      if (size[0] === 'cover' || size[0] === 'contain') {
        const byWidth = size[0] === 'cover'
          ? cssW / cssH > ratio
          : cssW / cssH < ratio;
        w = byWidth ? cssW : cssH * ratio;
      } else {
        w = val(size[0], cssW);
        h = val(size[1], cssH);
      }
    }

    if (w == null && h == null) w = cssW;
    if (w == null) w = h * ratio;
    h = w / ratio;

    let x = (cssW - w) / 2;
    let y = (cssH - h) / 2;
    if (bgEl) {
      const cs = getComputedStyle(bgEl);
      const raw = cs.backgroundPosition;
      /* Ключевые слова и простые значения разбираем, calc() — нет: он приходит
         неразвёрнутым. Для него есть --bg-shift ниже. */
      if (!raw.includes('calc')) {
        const pos = raw.split(' ');
        const place = (v, free) =>
          !v ? null
            : v.endsWith('%') ? (parseFloat(v) / 100) * free
              : v.endsWith('px') ? parseFloat(v) : null;
        const px = place(pos[0], cssW - w);
        const py = place(pos[1], cssH - h);
        if (px != null) x = px;
        if (py != null) y = py;
      }
      /* доля ширины картинки — тот же сдвиг, что задан фону в CSS */
      x += (parseFloat(cs.getPropertyValue('--bg-shift')) || 0) * w;
    }

    return { x, y, w, h };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    cssW = rect.width;
    cssH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    /* Mirror whatever crop the background is currently painting, so the two
       layers stay locked together at every breakpoint. */
    const own = getComputedStyle(canvas);
    fillMode = (own.getPropertyValue('--code-fill') || 'figma').trim();
    const gain = parseFloat(own.getPropertyValue('--code-gain')) || 1;
    perTile = parseInt(own.getPropertyValue('--code-count'), 10) ||
      (fillMode === 'grid' ? PER_TILE_GRID : PER_TILE);

    const bg = backdropRect();
    /* On a phone the backdrop is cropped so hard that following it literally
       would shrink the glyphs to ~4 px of mush; hold a floor and keep the
       field centred on the backdrop instead. */
    scale = Math.max((bg.w / BG_W) * gain, MIN_SCALE);
    originX = bg.x + bg.w / 2 - (BG_W * scale) / 2;
    originY = bg.y + bg.h / 2 - (BG_H * scale) / 2 - BG_Y * scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${FONT_SIZE}px ${MONO}`;
    advance = ctx.measureText('M').width || FONT_SIZE * 0.6;
    cols = Math.max(1, Math.floor(TILE / advance));
    rows = Math.max(1, Math.floor(TILE / LINE_H));

    /* видимая область в координатах артборда — для отбраковки фрагментов */
    visX0 = (0 - originX) / scale;
    visX1 = (cssW - originX) / scale;
    visY0 = (0 - originY) / scale;
    visY1 = (cssH - originY) / scale;
    if (fillMode !== 'grid') {
      visX0 = Math.max(visX0, 0);
      visY0 = Math.max(visY0, 0);
      visX1 = Math.min(visX1, FRAME_W);
      visY1 = Math.min(visY1, FRAME_H);
    }

    computeSafeRects();

    const tiles = computeTiles();
    const safeKey = safeRects.map((s) => `${s.x0 | 0},${s.y0 | 0}`).join('/');
    const key = `${fillMode}|${perTile}|${cols}x${rows}|${tiles
      .map((t) => `${t.x},${t.y}`)
      .join(';')}|${safeKey}`;
    if (key !== tileKey) {
      tileKey = key;
      seed(tiles, seedBase);
    }
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.save();
    if (fillMode !== 'grid') {
      /* в режиме figma поле обрезано рамкой артборда — как кадрирует Figma */
      ctx.beginPath();
      ctx.rect(originX, originY, FRAME_W * scale, FRAME_H * scale);
      ctx.clip();
    }
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);

    ctx.font = `${FONT_SIZE}px ${MONO}`;
    ctx.textBaseline = 'alphabetic';

    for (const group of field) {
      const { tile, rand, frags } = group;

      for (let i = 0; i < frags.length; i++) {
        const f = frags[i];
        const age = now - f.born;

        if (age > f.life) {
          frags[i] = placeFragment(rand, tile, now);
          continue;
        }
        if (now >= f.nextMutate) mutate(f, rand, now);

        let a = f.alpha;
        if (age < f.fadeIn) a *= age / f.fadeIn;
        const left = f.life - age;
        if (left < f.fadeOut) a *= left / f.fadeOut;
        if (a <= 0.01) continue;

        const box = fragBox(tile, f);
        if (box.x0 > visX1 || box.y0 > visY1 + LINE_H) continue;
        if (box.y1 < visY0 || box.x1 < visX0) continue;
        /* safe zone under the type and the logos */
        if (blocked(box)) continue;

        const x = box.x0;
        const y = box.y0;

        ctx.globalAlpha = a;
        ctx.fillStyle = resolved[COLORS.indexOf(f.color)] || resolved[2];

        for (let l = 0; l < f.lines.length; l++) {
          ctx.fillText(f.lines[l], x, y + (l + 1) * LINE_H);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS) return;
    last = now;
    draw(now);
  }

  function start() {
    cancelAnimationFrame(raf);
    raf = 0;
    seedBase = null;
    resolveColors();
    resize();
    if (reduced.matches) {
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* Harness only (tools/shoot.mjs): stop the loop and paint one fixed phase,
     so a captured cover is the same image on every run. Both the fragment
     birth times and the draw clock are pinned to `t`, and the tile key is
     cleared so the re-seed actually happens. */
  function freeze(t) {
    stop();
    const at = t || 0;
    seedBase = at;
    resolveColors();
    tileKey = '';
    resize();
    draw(at);
    seedBase = null;
  }

  const ro = new ResizeObserver(() => {
    if (!raf && !reduced.matches) return;   // idle while the splash is down
    resize();
    if (reduced.matches) draw(performance.now());
  });
  ro.observe(canvas);

  reduced.addEventListener('change', () => {
    if (raf || reduced.matches) start();
  });

  /* Nothing starts on its own: core/splash.js owns the lifecycle, and the
     fonts have to be in before the safe zones under the type can be measured. */
  window.CoverField = {
    start: () => {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
      else start();
    },
    stop: stop,
    freeze: freeze,
  };
})();
