/* Board 4 — Field Verification: what the survey teams found at 6,371 offices.

   The three percentages on this board (93.1% SCE-licensed, 76.9% dual-licensed)
   are measured against the 3,141 offices found ACTIVE at the door, not against
   all 6,371 surveyed — so the coverage donut carries that denominator in its
   note, and the survey-output bars carry theirs. The map plots the 2,840
   bounds-valid points, which is a subset of the 4,854 geo-located offices; the
   note says so rather than letting the dot count read as a total. */

(function (global) {
  'use strict';

  var T = Kit.T;
  var t = Kit.t;

  global.BOARD_FIELD = {
    id: 'field',
    labelKey: 'nav.field',
    widgets: [
      {
        id: 'fv-kpis',
        x: 0, y: 0, w: 6, h: 3, minW: 4, minH: 2,
        titleKey: 'w.field',
        chipKeys: ['c.kpis', 'c.staff'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 2,
              items: [
                { value: Data.tuv.surveyed, format: 'grouped', label: t('m.surveyed') },
                { value: Data.tuv.active, format: 'grouped', label: t('m.activeoff') },
                /* Green, not gold: the coverage donut below and the Field
                   Verification panel on the Big Screen both draw this same
                   93.1% in green, and one figure in two colours on one wall
                   reads as two different figures. */
                { value: Data.tuv.scecov, format: 'pct', label: t('m.scecov') },
                { value: Data.tuv.dual, format: 'pct', label: t('m.dual') },
              ],
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 2,
              items: [
                { value: Data.tuv.workers, format: 'grouped', label: t('m.workers') },
                { value: Data.tuv.avgw, format: 'one', label: t('m.avgw') },
                { value: Data.tuv.regions, format: 'grouped', label: t('m.regions') },
                { value: Data.tuv.cities, format: 'grouped', label: t('m.tuvcities') },
              ],
            });
          },
        ],
      },

      {
        id: 'fv-cov',
        x: 0, y: 3, w: 6, h: 3, minW: 4, minH: 2,
        titleKey: 'w.coverage',
        chipKeys: ['c.licensing', 'c.dual'],
        views: [
          /* Shares, not counts: scecov is a percentage in the dataset, and
             turning it back into offices would be a number nobody published. */
          function (el) {
            Chart.mount(el, {
              chart: 'pie',
              donut: true,
              gap: 3,
              cornerRadius: 3,
              legendPosition: 'right',
              valueFormat: 'pct',
              data: [
                { label: t('s.licensed'), value: Data.tuv.scecov, color: T.green },
                /* Neutral, not gold: fv-kpis already uses gold for scecov
                   itself (the licensed share), so a gold "unlicensed" slice
                   here would read as the opposite of what it means there. */
                { label: t('s.unlicensed'), value: 100 - Data.tuv.scecov, color: '#7fa8c2' },
              ],
              centerLabel: t('m.scecov'),
              centerValue: Data.tuv.scecov,
              centerFormat: 'pct',
              note: t('n.coverageNote', { n: Fmt.grouped(Data.tuv.active) }),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'pie',
              donut: true,
              gap: 3,
              cornerRadius: 3,
              legendPosition: 'right',
              valueFormat: 'pct',
              data: [
                { label: t('m.dual'), value: Data.tuv.dual, color: T.cy },
                { label: t('s.unlicensed'), value: 100 - Data.tuv.dual, color: '#7fa8c2' },
              ],
              centerLabel: t('m.dual'),
              centerValue: Data.tuv.dual,
              centerFormat: 'pct',
              note: t('n.coverageNote', { n: Fmt.grouped(Data.tuv.active) }),
            });
          },
        ],
      },

      {
        id: 'fv-capture',
        x: 0, y: 6, w: 6, h: 2, minW: 4, minH: 2,
        titleKey: 'w.capture',
        chipKeys: ['c.capture'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'progress-bars',
              max: Data.tuv.surveyed,
              valueFormat: 'grouped',
              data: [
                { label: t('m.contact'), value: Data.tuv.contact, color: T.purple },
                { label: t('m.lic'), value: Data.tuv.lic, color: T.green },
                { label: t('m.geo'), value: Data.tuv.geo, color: T.gold },
              ],
              note: t('n.captureNote', { n: Fmt.grouped(Data.tuv.surveyed) }),
            });
          },
        ],
      },

      {
        id: 'fv-map',
        x: 6, y: 0, w: 11, h: 8, minW: 6, minH: 4,
        titleKey: 'w.fieldmap',
        chipKeys: ['c.offices', 'c.cities'],
        /* Same as the Big Screen map (Figma node 5039:94568): the tabs float
           over the imagery, top-right, instead of spending a header row. */
        chipsOverlay: true,
        views: [
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

      {
        id: 'fv-top',
        x: 17, y: 0, w: 7, h: 4, minW: 4, minH: 2,
        titleKey: 'w.topcities',
        chipKeys: ['c.table'],
        views: [
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
              note: t('n.topcitiesNote'),
            });
          },
        ],
      },

      {
        id: 'fv-staff',
        x: 17, y: 4, w: 7, h: 4, minW: 4, minH: 2,
        titleKey: 'w.staffcities',
        chipKeys: ['c.staff', 'c.offices'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              horizontal: true,
              series: Kit.barSeries(
                Data.tuvTop
                  .slice()
                  .sort(function (a, b) {
                    return b[4] - a[4];
                  })
                  .map(function (c) {
                    return [c[0], c[4]];
                  }),
                T.cy
              ),
              xAxis: { type: 'band', tickFormat: Labels.t },
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 4 },
              showLegend: false,
              note: t('n.staffNote'),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              horizontal: true,
              series: Kit.barSeries(
                Data.tuvTop.map(function (c) {
                  return [c[0], c[3]];
                }),
                T.green
              ),
              xAxis: { type: 'band', tickFormat: Labels.t },
              yAxis: { type: 'linear', tickFormat: 'grouped', numTicks: 4 },
              showLegend: false,
              barValueFormat: 'grouped',
              note: t('n.topcitiesNote'),
            });
          },
        ],
      },
    ],
  };
})(window);
