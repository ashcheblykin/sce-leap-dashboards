/* Board 1 — National Ecosystem.

   Wings of panels flanking one large central map, the arrangement the team
   settled on in the kick-off: "по центру карта, слева-справа уши — дашборды".

   Every figure comes from Data (i.e. from leap_data.js). Where the dataset and
   the documentation disagree the panel note says which is on screen — see the
   header of assets/js/data/derive.js for the three cases. */

(function (global) {
  'use strict';

  var T = Kit.T;
  var t = Kit.t;

  global.BOARD_ECOSYSTEM = {
    id: 'ecosystem',
    labelKey: 'nav.ecosystem',
    widgets: [
      /* ---------------------------------------------------------- left wing */
      {
        id: 'eco-kpis',
        x: 0, y: 0, w: 6, h: 3, minW: 4, minH: 2,
        titleKey: 'w.eco',
        chipKeys: ['c.totals', 'c.register'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 2,
              items: [
                { value: Data.head.eco, format: 'grouped', label: t('m.eco') },
                { value: Data.head.reg, format: 'grouped', label: t('m.reg') },
                {
                  value: Data.offices,
                  format: 'grouped',
                  label: t('m.offices'),
                  note: t('n.offnote', {
                    a: Fmt.grouped(Data.officesParts[0]),
                    b: Fmt.grouped(Data.officesParts[1]),
                  }),
                },
                { value: Data.head.saudis, format: 'grouped', label: t('m.saudis') },
              ],
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 2,
              items: [
                { value: Data.register.active, format: 'grouped', label: t('m.active') },
                { value: Data.register.near, format: 'grouped', label: t('m.near') },
                { value: Data.register.expired, format: 'grouped', label: t('m.expired') },
                { value: Data.register.frozen, format: 'grouped', label: t('m.frozen') },
              ],
            });
          },
        ],
      },

      {
        id: 'eco-spec',
        x: 0, y: 3, w: 6, h: 3, minW: 4, minH: 2,
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
            Chart.mount(el, { chart: 'progress-bars', data: Kit.barData(Data.spec5, Kit.CLASS_TONE.Specialist), note: t('n.specNote') });
          },
        ],
      },

      {
        id: 'eco-reach',
        x: 0, y: 6, w: 6, h: 2, minW: 4, minH: 2,
        titleKey: 'w.reach',
        chipKeys: ['c.coverage', 'c.saudishare'],
        views: [
          /* A share on a two-row panel is an indicator, not a donut: 84px of
             chart makes a ring the size of a coin, and the number is what the
             room reads from across a stand. The two slices are stated as
             counts beside it, so nothing is lost.

             Registered ÷ workforce over the 38 mapped cities, which between
             them cover the whole in-scope workforce (Σ = head.eco), so the
             split is the ecosystem's exactly. */
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 3,
              items: [
                { value: Math.round(Data.nationalReach * 10) / 10, format: 'pct', label: t('m.natreach') },
                { value: Data.cityRegistered, format: 'compact', label: t('m.reg') },
                { value: Data.cityWorkforce - Data.cityRegistered, format: 'compact', label: t('s.notreg') },
              ],
              note: t('n.reachNote'),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 3,
              items: [
                { value: Math.round(Data.saudiShare * 10) / 10, format: 'pct', label: t('c.saudishare') },
                { value: Data.head.saudis, format: 'compact', label: t('m.saudis') },
                { value: Data.nonSaudi, format: 'compact', label: t('m.nonsaudi') },
              ],
              note: t('n.saudiNote'),
            });
          },
        ],
      },

      /* ------------------------------------------------------------- centre */
      {
        id: 'eco-map',
        x: 6, y: 0, w: 11, h: 8, minW: 6, minH: 4,
        titleKey: 'w.map',
        chipKeys: ['c.workforce', 'c.registered', 'c.reach', 'c.enforcement'],
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
              /* Matches eco-reach's own cy for the same metric (nationalReach) —
                 a bubble tab and a KPI tile for one figure must read as one
                 colour, not two. */
              tone: T.cy,
              maxRadius: 0.9,
              hud: { value: Math.round(Data.nationalReach * 10) / 10, format: 'pct', label: t('m.natreach') },
              note: t('n.bubbleReach'),
            });
          },
          /* Ten regions, not the national breakdown — the note says so. */
          function (el) {
            Kit.mapView(el, {
              points: Data.regions.map(function (r) {
                return [r[1], r[2], r[3], Labels.t(r[0]) + ' · ' + Fmt.grouped(r[3]) + ' · ' + Fmt.grouped(r[4]) + ' SAR'];
              }),
              /* Not purple: eco-kpis/eco-reach already spend purple on Saudi
                 talent, and this bubble layer is enforcement cases — an
                 unrelated figure that happens to sit right next to those
                 tiles on the same board. */
              tone: T.pink,
              hud: { value: Data.regionActions, format: 'grouped', label: t('s.cases') },
              note: t('n.bubbleRegions', {
                n: Fmt.grouped(Data.regionActions),
                total: Fmt.grouped(Data.head.cases),
              }),
            });
          },
        ],
      },

      /* --------------------------------------------------------- right wing */
      {
        id: 'eco-struct',
        x: 17, y: 0, w: 7, h: 3, minW: 4, minH: 2,
        titleKey: 'w.struct',
        chipKeys: ['c.classes', 'c.nationalities'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'pie',
              donut: true,
              gap: 3,
              cornerRadius: 3,
              legendPosition: 'right',
              data: Data.classes.map(function (r, i) {
                return {
                  label: t(Kit.CLS_KEY[r[0]]),
                  value: r[1],
                  color: [T.cy, T.green, T.gold][i],
                };
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

      {
        id: 'eco-mon',
        x: 17, y: 3, w: 7, h: 3, minW: 4, minH: 2,
        titleKey: 'w.mon',
        // Both views are lists that already start with their own row of
        // labels, so the header hairline sat directly above a second line.
        chipKeys: ['c.pipeline', 'c.bytrack'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              series: Kit.barSeries(
                Data.pipeline.map(function (r) {
                  return [t(r[0]), r[1]];
                }),
                T.cy
              ),
              xAxis: { type: 'band' },
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 4 },
              showLegend: false,
              note: t('n.pipeCumulative'),
            });
          },
          /* The 90-day window split by class and sub-window. Per-class sums are
             80,630 / 33,777 / 9,701; the stack totals 124,108 = pipe.d90. */
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              horizontal: true,
              stack: 'bar',
              series: Data.windowOrder.map(function (w, i) {
                return {
                  key: w,
                  label: t(Kit.WINDOW_KEY[w]),
                  type: 'bar',
                  color: [T.cy, T.green, T.gold][i],
                  data: Data.trackOrder.map(function (cls) {
                    return { x: t(Kit.CLASS_KEY[cls]), y: Data.trackWindows[cls][w] };
                  }),
                };
              }),
              xAxis: { type: 'band', domain: Data.trackOrder.map(function (c) { return t(Kit.CLASS_KEY[c]); }) },
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 4 },
              legendPosition: 'bottom',
            });
          },
        ],
      },

      {
        id: 'eco-enf',
        x: 17, y: 6, w: 7, h: 2, minW: 4, minH: 2,
        titleKey: 'w.enf',
        chipKeys: ['c.headline', 'c.trend'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 3,
              items: [
                { value: Data.head.cases, format: 'grouped', label: t('m.cases') },
                { value: Data.head.enforced, format: 'sar', label: t('m.enforced') },
                { value: Data.head.collected, format: 'sar', label: t('m.collected') },
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
    ],
  };
})(window);
