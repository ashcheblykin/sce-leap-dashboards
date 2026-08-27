/* Board 1 — Big Screen.

   The original deliverable's main screen (bigscreen.html): two wings of three
   panels flanking one large map, a ticker underneath, and three scenes the
   wall cycles on its own — OVERVIEW / PROFESSION / OPERATIONS. It is the only
   screen in the set that puts the ecosystem, enforcement and the field survey
   side by side, and the only one whose map carries all six modes at once.

   Two things are inherited literally from it and are easy to undo by accident:

   - The panel set of the OVERVIEW scene, in the original's own order. `pL1`
     National Ecosystem, `pL2` Top Specialties, `pL3` Profession Structure on
     the left; `pR1` Proactive Monitoring, `pR2` Enforcement Delivery, `pR3`
     Field Verification on the right. Drop `pR3` and the wall loses the only
     place where a visitor sees the door-to-door survey next to the register.

   - No drag, no resize (`kiosk: true`). The prototype fixed its panels because
     a wall runs unattended; ours ships without the handles for the same
     reason. The other three boards keep them.

   Scenes 2 and 3 are the Profession and Operations widget sets verbatim, which
   is where the sankey, sunburst, radar and the enforcement money donut live —
   in the original those were scenes here too, not separate pages. */

(function (global) {
  'use strict';

  var T = Kit.T;
  var t = Kit.t;

  /* ------------------------------------------------------------ scene one */

  var overview = [
    /* --- left wing ------------------------------------------------------ */
    {
      /* Figma's three left-wing panels are equal thirds (336px each on the
         2880x1152 canvas), not a 2:3:3 split — h is 8/3 so three of them
         tile the same 8 rows the map spans on its other side. */
      id: 'bs-eco',
      x: 0, y: 0, w: 6, h: 8 / 3, minW: 4, minH: 2,
      titleKey: 'w.eco',
      chipKeys: ['c.totals', 'c.register'],
      views: [
        function (el) {
          Chart.mount(el, {
            chart: 'indicator',
            cols: 2,
            items: [
              { value: Data.head.eco, format: 'compact', label: t('m.eco') },
              { value: Data.head.reg, format: 'compact', label: t('m.reg') },
              { value: Data.offices, format: 'compact', label: t('m.offices') },
              { value: Data.head.saudis, format: 'compact', label: t('m.saudis') },
            ],
          });
        },
        function (el) {
          Chart.mount(el, {
            chart: 'indicator',
            cols: 2,
            items: [
              { value: Data.register.active, format: 'compact', label: t('m.active') },
              { value: Data.register.near, format: 'compact', label: t('m.near') },
              { value: Data.register.expired, format: 'compact', label: t('m.expired') },
              { value: Data.register.frozen, format: 'compact', label: t('m.frozen') },
            ],
          });
        },
      ],
    },

    {
      id: 'bs-spec',
      x: 0, y: 8 / 3, w: 6, h: 8 / 3, minW: 4, minH: 2,
      titleKey: 'w.spec',
      chipKeys: ['c.engineers', 'c.technicians', 'c.specialists'],
      views: [
        function (el) {
          Chart.mount(el, { chart: 'progress-bars', data: Kit.barData(Data.eng5, Kit.CLASS_TONE.Engineer), note: t('n.specNote') });
        },
        function (el) {
          Chart.mount(el, { chart: 'progress-bars', data: Kit.barData(Data.tech5, Kit.CLASS_TONE.Technician), note: t('n.specNote') });
        },
        function (el) {
          Chart.mount(el, {
            chart: 'progress-bars',
            data: Kit.barData(Data.spec5, Kit.CLASS_TONE.Specialist),
            note: t('n.specNote'),
          });
        },
      ],
    },

    /* The original's third left panel, and the only place GRADES is offered
       beside CLASSES and NATIONALITIES the way the prototype had it. */
    {
      id: 'bs-struct',
      x: 0, y: 16 / 3, w: 6, h: 8 / 3, minW: 4, minH: 2,
      titleKey: 'w.struct',
      chipKeys: ['c.grades', 'c.classes', 'c.nationalities'],
      views: [
        function (el) {
          Chart.mount(el, {
            chart: 'pie',
            donut: true,
            gap: 3,
            cornerRadius: 3,
            legendPosition: 'right',
            data: Data.gradeOrder.map(function (g) {
              var row = Data.gradeCross[g] || {};
              var total = 0;
              Data.register.statusOrder.forEach(function (s) {
                total += row[s] || 0;
              });
              return { label: t(Kit.GRADE_KEY[g]), value: total, color: Kit.GRADE_TONE[g] };
            }),
            centerLabel: t('s.engineers'),
            centerValue: Data.gradeTotal,
            note: t('n.gradesNote', { n: Fmt.grouped(Data.gradeTotal) }),
          });
        },
        function (el) {
          Chart.mount(el, {
            chart: 'pie',
            donut: true,
            gap: 3,
            cornerRadius: 3,
            legendPosition: 'right',
            data: Data.classes.map(function (r, i) {
              return { label: t(Kit.CLS_KEY[r[0]]), value: r[1], color: [T.cy, T.green, T.gold][i] };
            }),
            centerLabel: t('m.reg'),
            centerValue: Data.head.reg,
          });
        },
        function (el) {
          Chart.mount(el, {
            chart: 'progress-bars',
            data: Kit.barData(Data.nat5, T.purple),
            note: t('n.natNote'),
          });
        },
      ],
    },

    /* --- centre ---------------------------------------------------------
       All six modes of the original's map on one widget. Four of them also
       appear on the Ecosystem board and two on Field Verification; nowhere
       else can you step through the whole set without changing board. */
    {
      /* w10 (not 11) — Figma's three columns are 704/1184/944px on the
         2880-wide canvas, i.e. 6/10/8 of the 24-col grid, not 6/11/7. */
      id: 'bs-map',
      x: 6, y: 0, w: 10, h: 8, minW: 6, minH: 4,
      titleKey: 'w.map',
      chipKeys: [
        'c.workforce',
        'c.registered',
        'c.reach',
        'c.enforcement',
        'c.fieldsurvey',
        'c.surveycov',
      ],
      chipsOverlay: true,
      views: [
        function (el) {
          Kit.mapView(el, {
            points: Kit.cityPoints(3),
            tone: T.cy,
            hud: { value: Data.head.eco, format: 'grouped', label: t('m.eco') },
            note: t('n.bubbleWorkforce', { n: Data.cities.length }),
          });
        },
        function (el) {
          Kit.mapView(el, {
            points: Kit.cityPoints(4),
            tone: T.green,
            hud: { value: Data.cityRegistered, format: 'grouped', label: t('m.reg') },
            note: t('n.bubbleRegistered'),
          });
        },
        function (el) {
          Kit.mapView(el, {
            points: Data.cities.map(function (c) {
              var pct = (c[4] / c[3]) * 100;
              return [c[1], c[2], pct, Labels.t(c[0]) + ' · ' + Fmt.pct(pct)];
            }),
            tone: T.gold,
            maxRadius: 0.9,
            hud: { value: Math.round(Data.nationalReach * 10) / 10, format: 'pct', label: t('m.natreach') },
            note: t('n.bubbleReach'),
          });
        },
        function (el) {
          Kit.mapView(el, {
            points: Data.regions.map(function (r) {
              return [r[1], r[2], r[3], Labels.t(r[0]) + ' · ' + Fmt.grouped(r[3]) + ' · ' + Fmt.grouped(r[4]) + ' SAR'];
            }),
            tone: T.purple,
            hud: { value: Data.regionActions, format: 'grouped', label: t('s.cases') },
            note: t('n.bubbleRegions', {
              n: Fmt.grouped(Data.regionActions),
              total: Fmt.grouped(Data.head.cases),
            }),
          });
        },
        function (el) {
          Kit.mapView(el, {
            points: Data.tuvPoints.map(function (p) {
              return [p[0], p[1], p[2], null, p[3] ? 'ok' : 'warn'];
            }),
            tone: T.green,
            maxRadius: 0.5,
            hud: { value: Data.tuv.surveyed, format: 'grouped', label: t('m.surveyed') },
            note: t('n.bubbleOffices', {
              n: Fmt.grouped(Data.tuvPoints.length),
              geo: Fmt.grouped(Data.tuv.geo),
            }),
          });
        },
        function (el) {
          Kit.mapView(el, {
            points: Data.tuvCities.map(function (c) {
              return [
                c[1],
                c[2],
                c[3],
                Labels.t(c[0]) + ' · ' + Fmt.grouped(c[3]) + ' · ' + Fmt.pct(c[5]),
                c[5] >= 90 ? 'ok' : c[5] >= 75 ? 'mid' : 'warn',
              ];
            }),
            tone: T.green,
            hud: { value: Data.tuv.scecov, format: 'pct', label: t('m.scecov') },
            note: t('n.bubbleCoverage', { n: Data.tuvCities.length }),
          });
        },
      ],
    },

    /* --- right wing ----------------------------------------------------- */
    {
      id: 'bs-mon',
      x: 16, y: 0, w: 8, h: 8 / 3, minW: 4, minH: 2,
      titleKey: 'w.mon',
      chipKeys: ['c.pipeline', 'c.bytrack'],
      views: [
        function (el) {
          Chart.mount(el, {
            chart: 'indicator',
            cols: 3,
            items: [
              { value: Data.head.proact, format: 'grouped', label: t('m.proact'), labelFirst: true },
              { value: Data.head.renewengage, format: 'compact', label: t('m.engage'), labelFirst: true },
              { value: Data.register.near, format: 'compact', label: t('m.near'), labelFirst: true },
            ],
          });
        },
        /* The 90-day window per class — the original's BY TRACK bars. */
        function (el) {
          Chart.mount(el, {
            chart: 'progress-bars',
            valueFormat: 'grouped',
            data: Data.trackOrder.map(function (cls) {
              var row = Data.trackWindows[cls] || {};
              var total = 0;
              Data.windowOrder.forEach(function (w) {
                total += row[w] || 0;
              });
              return { label: t(Kit.CLASS_KEY[cls]), value: total, color: Kit.CLASS_TONE[cls] };
            }),
            note: t('n.pipeCumulative'),
          });
        },
      ],
    },

    {
      id: 'bs-enf',
      x: 16, y: 8 / 3, w: 8, h: 8 / 3, minW: 4, minH: 2,
      titleKey: 'w.enf',
      chipKeys: ['c.headline', 'c.trend'],
      views: [
        function (el) {
          Chart.mount(el, {
            chart: 'indicator',
            cols: 2,
            items: [
              { value: Data.head.cases, format: 'grouped', label: t('m.cases') },
              { value: Data.head.enforced, format: 'sar', label: t('m.enforced') },
              { value: Data.head.collected, format: 'sar', label: t('m.collected') },
              { value: Data.register.active, format: 'compact', label: t('m.active') },
            ],
          });
        },
        function (el) {
          Chart.mount(el, {
            chart: 'cartesian',
            series: [
              {
                key: 'act',
                type: 'area',
                color: T.gold,
                curve: 'monotoneX',
                showDots: false,
                data: Data.months.map(function (mo) {
                  return { x: mo[0], y: mo[1] };
                }),
              },
            ],
            xAxis: { type: 'band' },
            yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 3 },
            showLegend: false,
            note: t('n.trendNote', {
              last: Data.monthsSpan[1],
              cases: Fmt.grouped(Data.head.cases),
            }),
          });
        },
      ],
    },

    /* `pR3` — the panel that makes this screen the overview: the door-to-door
       survey standing next to the register and the enforcement figures. */
    {
      id: 'bs-field',
      x: 16, y: 16 / 3, w: 8, h: 8 / 3, minW: 4, minH: 2,
      titleKey: 'w.field',
      chipKeys: ['c.kpis', 'c.topcities'],
      views: [
        function (el) {
          Chart.mount(el, {
            chart: 'indicator',
            cols: 2,
            items: [
              { value: Data.tuv.surveyed, format: 'grouped', label: t('m.surveyed') },
              { value: Data.tuv.scecov, format: 'pct', label: t('m.scecov') },
              { value: Data.tuv.geo, format: 'grouped', label: t('m.geo') },
              { value: Data.tuv.workers, format: 'grouped', label: t('m.workers') },
            ],
          });
        },
        function (el) {
          Chart.mount(el, {
            chart: 'table',
            columns: [
              { field: 'rank', header: '#', rank: true },
              { field: 'city', header: t('s.city'), label: true },
              { field: 'offices', header: t('s.offices'), align: 'end', count: true, format: 'grouped' },
              { field: 'pct', header: t('s.pct'), align: 'end', count: true, format: 'pct' },
            ],
            rows: Data.tuvTop.map(function (c) {
              return { city: c[0], offices: c[3], pct: c[5] };
            }),
          });
        },
      ],
    },
  ];

  global.BOARD_BIGSCREEN = {
    id: 'bigscreen',
    labelKey: 'nav.bigscreen',
    kiosk: true,
    /* Three scenes at 25s each — the original's cadence — so the wall's slot
       for this board is long enough to show all three before the shell moves
       on to the Ecosystem dashboard. */
    sceneMs: 25000,
    slideMs: 75000,
    scenes: [
      { key: 'overview', labelKey: 'sc.overview', widgets: overview },
      {
        key: 'profession',
        labelKey: 'sc.profession',
        widgets: global.BOARD_PROFESSION.widgets,
      },
      {
        key: 'operations',
        labelKey: 'sc.operations',
        widgets: global.BOARD_OPERATIONS.widgets,
      },
    ],
  };
})(window);
