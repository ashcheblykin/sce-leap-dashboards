/* Board 3 — KPI Library.

   The original's kpis.html: every indicator in the deliverable as its own card,
   each card offering the two or three ways of reading the same figure. Twenty
   cards, in the same order, with the same view names as the source file.

   Why this board is not on the 24x8 grid. The other three boards are fixed
   arrangements of six or seven panels; this one is a browse surface with a
   fixed count of twenty cards. So it renders its own grid and picks the
   column count from that count, which keeps it exactly full — no half-empty
   last row, no scrolling on a wall.

   The prototype drew its cards with bespoke HTML (`bignum`, `gauge`, conic
   donuts). Here each view is an ordinary chart spec, so a card in the library
   and the same figure on the Big Screen are drawn by one renderer and cannot
   drift apart. The one substitution worth naming: the source's GAUGE is a
   two-slice donut here, which is what Field Verification already uses for the
   same percentages — see [[feedback_color_semantics]]: one concept, one shape,
   one colour, everywhere. */

(function (global) {
  'use strict';

  var T = Kit.T;
  var t = Kit.t;

  /* --- shared derivations, matching the source file's own preamble --- */

  /** `cityTop` in kpis.html: the seven largest cities by regulated workforce. */
  function cityTop() {
    return Data.cities
      .slice()
      .sort(function (a, b) {
        return b[3] - a[3];
      })
      .slice(0, 7)
      .map(function (c) {
        return [c[0], c[3]];
      });
  }

  /** `gm` in the source: engineer memberships rolled up per career grade. */
  function gradeTotals() {
    return Data.gradeOrder.map(function (g) {
      var row = Data.gradeCross[g] || {};
      var total = 0;
      Data.register.statusOrder.forEach(function (s) {
        total += row[s] || 0;
      });
      return { label: t(Kit.GRADE_KEY[g]), value: total, color: Kit.GRADE_TONE[g] };
    });
  }

  /** `tk90(track)` in the source: the whole 90-day window for one class. */
  function track90() {
    return Data.trackOrder.map(function (cls) {
      var row = Data.trackWindows[cls] || {};
      var total = 0;
      Data.windowOrder.forEach(function (w) {
        total += row[w] || 0;
      });
      return { label: t(Kit.CLASS_KEY[cls]), value: total, color: Kit.CLASS_TONE[cls] };
    });
  }

  /* --- view builders ---
     `vNum` is the source's big-number card; the rest are ordinary specs. */

  function vNum(value, format, noteKey, tone, vars) {
    return function (el) {
      Chart.mount(el, {
        chart: 'indicator',
        cols: 1,
        items: [{ value: value, format: format, label: t(noteKey, vars), color: tone }],
      });
    };
  }

  /* Row-based views and the dense grid.

     A progress-bar row caps its own type against its own height
     (`--cap-row-text`), so five rows in the 100-odd pixels a card gets at five
     columns come out at eight-point text — technically drawn, unreadable from
     a metre away, never mind a stand. Rather than let that ship, the dense
     grid shows the leading three rows and drops the note that counts the
     others: the card title claims no total, so nothing on screen is wrong, and
     the moment you pick a family the grid drops to one tall row and every card
     shows its full list with its footnote back. `dense` is passed by paint(),
     not read from the DOM, so a view never has to measure itself. */
  var DENSE_ROWS = 3;

  function vBars(data, noteKey) {
    return function (el, dense) {
      var rows = data();
      Chart.mount(el, {
        chart: 'progress-bars',
        valueFormat: 'grouped',
        data: dense ? rows.slice(0, DENSE_ROWS) : rows,
        note: noteKey && !dense ? t(noteKey) : undefined,
      });
    };
  }

  function vTable(headerKey, rows, format, noteKey) {
    return function (el, dense) {
      var body = rows();
      Chart.mount(el, {
        chart: 'table',
        columns: [
          { field: 'name', header: t(headerKey), label: true },
          { field: 'value', header: t('c.number'), align: 'end', count: true, format: format || 'grouped' },
        ],
        rows: dense ? body.slice(0, DENSE_ROWS) : body,
        note: noteKey && !dense ? t(noteKey) : undefined,
      });
    };
  }

  function vDonut(data, centerKey, centerValue, centerFormat) {
    return function (el) {
      Chart.mount(el, {
        chart: 'pie',
        donut: true,
        gap: 3,
        cornerRadius: 3,
        legendPosition: 'right',
        data: data(),
        centerLabel: t(centerKey),
        centerValue: centerValue(),
        centerFormat: centerFormat,
      });
    };
  }

  /** The source's GAUGE: one share against its remainder. */
  function vShare(pct, labelKey, tone, noteKey, vars) {
    return function (el) {
      Chart.mount(el, {
        chart: 'pie',
        donut: true,
        gap: 3,
        cornerRadius: 3,
        legendPosition: 'right',
        valueFormat: 'pct',
        data: [
          { label: t(labelKey), value: pct(), color: tone },
          { label: t('s.unlicensed'), value: 100 - pct(), color: T.blue },
        ],
        centerLabel: t(labelKey),
        centerValue: pct(),
        centerFormat: 'pct',
        note: t(noteKey, vars),
      });
    };
  }

  function vTrend() {
    return function (el) {
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
        note: t('n.trendNote', { last: Data.monthsSpan[1], cases: Fmt.grouped(Data.head.cases) }),
      });
    };
  }

  /* --- the twenty cards, in the source file's order --- */

  function cards() {
    return [
      /* --- Ecosystem (5) --- */
      {
        id: 'k-ecosize', cat: 'eco', titleKey: 'k.ecosize',
        chipKeys: ['c.number', 'c.bycity'],
        views: [
          vNum(Data.head.eco, 'grouped', 'kn.ecosize', T.cy),
          vBars(function () {
            return cityTop().map(function (r) {
              return { label: r[0], value: r[1], color: T.cy };
            });
          }),
        ],
      },
      {
        id: 'k-registered', cat: 'eco', titleKey: 'k.registered',
        chipKeys: ['c.number', 'c.byclass'],
        views: [
          vNum(Data.head.reg, 'grouped', 'kn.registered', T.green),
          vDonut(
            function () {
              return Data.classes.map(function (r, i) {
                return { label: t(Kit.CLS_KEY[r[0]]), value: r[1], color: [T.cy, T.green, T.gold][i] };
              });
            },
            'm.reg',
            function () {
              return Data.head.reg;
            }
          ),
        ],
      },
      {
        id: 'k-offices', cat: 'eco', titleKey: 'k.offices',
        chipKeys: ['c.number'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 1,
              items: [
                {
                  value: Data.offices,
                  format: 'grouped',
                  label: t('m.offices'),
                  color: T.gold,
                  note: t('n.offnote', {
                    a: Fmt.grouped(Data.officesParts[0]),
                    b: Fmt.grouped(Data.officesParts[1]),
                  }),
                },
              ],
            });
          },
        ],
      },
      {
        id: 'k-saudis', cat: 'eco', titleKey: 'k.saudis',
        chipKeys: ['c.number', 'c.share'],
        views: [
          vNum(Data.head.saudis, 'grouped', 'kn.saudis', T.purple),
          function (el) {
            Chart.mount(el, {
              chart: 'pie',
              donut: true,
              gap: 3,
              cornerRadius: 3,
              legendPosition: 'right',
              data: [
                { label: t('m.saudis'), value: Data.head.saudis, color: T.purple },
                { label: t('m.nonsaudi'), value: Data.nonSaudi, color: T.blue },
              ],
              centerLabel: t('c.saudishare'),
              centerValue: Math.round(Data.saudiShare * 10) / 10,
              centerFormat: 'pct',
              note: t('kn.saudishare'),
            });
          },
        ],
      },
      {
        id: 'k-activemem', cat: 'eco', titleKey: 'k.activemem',
        chipKeys: ['c.number', 'c.registermix'],
        views: [
          vNum(Data.register.active, 'grouped', 'kn.activemem', T.green),
          vDonut(
            function () {
              return [
                { label: t('s.active'), value: Data.register.active, color: Kit.STATUS_TONE.active },
                { label: t('s.near'), value: Data.register.near, color: Kit.STATUS_TONE.near_expiry },
                { label: t('m.lapsed'), value: Data.register.lapsed, color: Kit.STATUS_TONE.expired },
              ];
            },
            'm.reg',
            function () {
              return Data.register.total;
            }
          ),
        ],
      },

      /* --- Profession (5) --- */
      {
        id: 'k-engspec', cat: 'prof', titleKey: 'k.engspec',
        chipKeys: ['c.bars', 'c.table'],
        views: [
          vBars(function () {
            return Kit.barData(Data.eng5, T.cy);
          }, 'n.specNote'),
          vTable('c.engineers', function () {
            return Data.eng5.map(function (r) {
              return { name: r[0], value: r[1] };
            });
          }, 'grouped', 'n.specNote'),
        ],
      },
      {
        id: 'k-techspec', cat: 'prof', titleKey: 'k.techspec',
        chipKeys: ['c.bars', 'c.table'],
        views: [
          vBars(function () {
            return Kit.barData(Data.tech5, T.green);
          }, 'n.specNote'),
          vTable('c.technicians', function () {
            return Data.tech5.map(function (r) {
              return { name: r[0], value: r[1] };
            });
          }, 'grouped', 'n.specNote'),
        ],
      },
      {
        id: 'k-specfields', cat: 'prof', titleKey: 'k.specfields',
        chipKeys: ['c.bars', 'c.table'],
        views: [
          vBars(function () {
            return Kit.barData(Data.spec5, T.gold);
          }, 'n.specNote'),
          vTable('c.specialists', function () {
            return Data.spec5.map(function (r) {
              return { name: r[0], value: r[1] };
            });
          }, 'grouped', 'n.specNote'),
        ],
      },
      {
        id: 'k-grades', cat: 'prof', titleKey: 'k.grades',
        chipKeys: ['c.donut', 'c.bars'],
        views: [
          vDonut(gradeTotals, 's.engineers', function () {
            return Data.gradeTotal;
          }),
          vBars(gradeTotals),
        ],
      },
      {
        id: 'k-nat', cat: 'prof', titleKey: 'k.nat',
        chipKeys: ['c.bars', 'c.table'],
        views: [
          vBars(function () {
            return Kit.barData(Data.nat5, T.purple);
          }, 'n.natNote'),
          vTable('c.nationalities', function () {
            return Data.nat5.map(function (r) {
              return { name: r[0], value: r[1] };
            });
          }, 'grouped', 'n.natNote'),
        ],
      },

      /* --- Monitoring (3) --- */
      {
        id: 'k-proact', cat: 'mon', titleKey: 'k.proact',
        chipKeys: ['c.number'],
        views: [vNum(Data.head.proact, 'grouped', 'kn.proact', T.cy)],
      },
      {
        id: 'k-engage', cat: 'mon', titleKey: 'k.engage',
        chipKeys: ['c.number'],
        views: [vNum(Data.head.renewengage, 'compact', 'kn.engage', T.green)],
      },
      {
        id: 'k-pipeline', cat: 'mon', titleKey: 'k.pipeline',
        chipKeys: ['c.bars', 'c.bytrack'],
        views: [
          vBars(function () {
            return Data.pipeline.map(function (r, i) {
              return { label: t(r[0]), value: r[1], color: [T.cy, T.green, T.gold][i] };
            });
          }, 'n.pipeCumulative'),
          vBars(track90, 'n.pipeCumulative'),
        ],
      },

      /* --- Enforcement (3) --- */
      {
        id: 'k-cases', cat: 'enf', titleKey: 'k.cases',
        chipKeys: ['c.number', 'c.trendshort'],
        views: [vNum(Data.head.cases, 'grouped', 'kn.cases', T.gold), vTrend()],
      },
      {
        id: 'k-money', cat: 'enf', titleKey: 'k.money',
        chipKeys: ['c.number', 'c.split'],
        views: [
          vNum(Data.head.enforced, 'sar', 'kn.money', T.gold, { n: Fmt.sar(Data.head.collected) }),
          vDonut(
            function () {
              return Data.enforcedSplit.map(function (r, i) {
                return { label: t(r[0]), value: r[1], color: [T.green, T.gold, T.blue][i] };
              });
            },
            'm.enforced',
            function () {
              return Data.head.enforced;
            },
            'sar'
          ),
        ],
      },
      {
        id: 'k-regions', cat: 'enf', titleKey: 'k.regions',
        chipKeys: ['c.bars', 'c.table'],
        views: [
          vBars(function () {
            return Data.regionBars.slice(0, 6).map(function (r) {
              return { label: r[0], value: r[1], color: T.gold };
            });
          }, 'n.regionsNote'),
          vTable('s.cases', function () {
            return Data.regionBars.map(function (r) {
              return { name: r[0], value: r[1] };
            });
          }, 'grouped', 'n.regionsNote'),
        ],
      },

      /* --- Field Verification (4) --- */
      {
        id: 'k-surveyed', cat: 'fv', titleKey: 'k.surveyed',
        chipKeys: ['c.number'],
        views: [
          vNum(Data.tuv.surveyed, 'grouped', 'kn.surveyed', T.cy, {
            r: Data.tuv.regions,
            c: Data.tuv.cities,
          }),
        ],
      },
      {
        id: 'k-coverage', cat: 'fv', titleKey: 'k.coverage',
        chipKeys: ['c.gauge', 'c.dual'],
        views: [
          vShare(
            function () {
              return Data.tuv.scecov;
            },
            's.licensed',
            T.green,
            'kn.coverage'
          ),
          vShare(
            function () {
              return Data.tuv.dual;
            },
            'm.dual',
            T.purple,
            'kn.dual'
          ),
        ],
      },
      {
        id: 'k-onsite', cat: 'fv', titleKey: 'k.onsite',
        chipKeys: ['c.number', 'c.topcities'],
        views: [
          vNum(Data.tuv.workers, 'grouped', 'kn.onsite', T.green, { n: Data.tuv.avgw }),
          function (el, dense) {
            var rows = Data.tuvTop.map(function (c) {
              return { city: c[0], offices: c[3], pct: c[5] };
            });
            Chart.mount(el, {
              chart: 'table',
              columns: [
                { field: 'rank', header: '#', rank: true },
                { field: 'city', header: t('s.city'), label: true },
                { field: 'offices', header: t('s.offices'), align: 'end', count: true, format: 'grouped' },
                { field: 'pct', header: t('s.pct'), align: 'end', count: true, format: 'pct' },
              ],
              rows: dense ? rows.slice(0, DENSE_ROWS) : rows,
              note: dense ? undefined : t('n.topcitiesNote'),
            });
          },
        ],
      },
      {
        id: 'k-records', cat: 'fv', titleKey: 'k.records',
        chipKeys: ['c.number', 'c.more'],
        views: [
          vNum(Data.tuv.lic, 'grouped', 'kn.records', T.gold),
          function (el, dense) {
            Chart.mount(el, {
              chart: 'progress-bars',
              max: Data.tuv.surveyed,
              valueFormat: 'grouped',
              data: [
                { label: t('m.contact'), value: Data.tuv.contact, color: T.cy },
                { label: t('m.geo'), value: Data.tuv.geo, color: T.gold },
                { label: t('m.activeoff'), value: Data.tuv.active, color: T.green },
              ],
              note: dense ? undefined : t('n.captureNote', { n: Fmt.grouped(Data.tuv.surveyed) }),
            });
          },
        ],
      },
    ];
  }

  /* --- rendering --- */

  /* Five columns is the widest a card can be and still hold a legible donut
     legend at wall scale; below six cards the filter is a single tall row,
     which fills the stage rather than leaving a ragged one. */
  function columnsFor(count) {
    return count <= 5 ? count : 5;
  }

  function render(surface) {
    var all = cards();

    var root = document.createElement('div');
    root.className = 'lib';
    root.innerHTML = '<div class="lib-grid"></div>';
    surface.appendChild(root);

    var grid = root.querySelector('.lib-grid');

    var mountedBodies = [];

    function paint() {
      for (var m = 0; m < mountedBodies.length; m++) Chart.unmount(mountedBodies[m]);
      mountedBodies = [];
      grid.innerHTML = '';

      var cols = columnsFor(all.length);
      grid.style.setProperty('--lib-cols', cols);

      all.forEach(function (card) {
        var cell = document.createElement('div');
        cell.className = 'lib-cell';
        cell.setAttribute('data-card', card.id);
        cell.innerHTML = Board.widgetMarkup(
          {
            titleKey: card.titleKey,
            chipKeys: card.chipKeys,
            /* Same rule every other board uses (see widget.css): only 3+
               tab labels get their own row below the title. Every KPI Library
               card tops out at 2, so they all float top-right per Figma. */
            stackChips: card.chipKeys.length > 2,
          },
          true
        );
        grid.appendChild(cell);

        var body = cell.querySelector('.widget-body');
        mountedBodies.push(body);
        var dense = cols >= 5;
        card.views[0](body, dense);

        var chipsEl = cell.querySelector('.chips');
        if (chipsEl) {
          chipsEl._tabs = Board.attachChipTabs(chipsEl, function (index) {
            card.views[index](body, dense);
            Motion.animate(body);
            if (LIBRARY.onInteract) LIBRARY.onInteract();
          });
        }
      });

      Motion.animate(grid);
    }

    paint();
  }

  var LIBRARY = {
    id: 'library',
    labelKey: 'nav.library',
    kiosk: true,
    render: render,
  };

  global.BOARD_LIBRARY = LIBRARY;
})(window);
