/* Board 3 — Operations: the renewal pipeline, Efaa enforcement and where it
   lands on the map.

   Two panels here carry the dataset's own caveats in their notes rather than in
   a comment nobody at the stand will read: the regional split is the leading
   ten regions (946 of 2,445 actions), and the 36-month series is plotted
   unitless because its magnitudes cannot be case counts. See
   assets/js/data/derive.js. */

(function (global) {
  'use strict';

  var T = Kit.T;
  var t = Kit.t;

  /** Cumulative outreach windows — presented as a funnel, never summed. */
  function pipelineSpec() {
    return {
      chart: 'cartesian',
      series: Kit.barSeries(
        Data.pipeline.map(function (r) {
          return [t(r[0]), r[1]];
        }),
        T.cy
      ),
      xAxis: { type: 'band' },
      yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 5 },
      showLegend: false,
      note: t('n.pipeCumulative'),
    };
  }

  global.BOARD_OPERATIONS = {
    id: 'operations',
    labelKey: 'nav.operations',
    widgets: [
      {
        id: 'op-kpis',
        x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 2,
        titleKey: 'w.enf',
        chipKeys: ['c.kpis', 'c.pipeline'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 2,
              items: [
                { value: Data.head.cases, format: 'grouped', label: t('m.cases') },
                { value: Data.head.enforced, format: 'sar', label: t('m.enforced') },
                { value: Data.head.collected, format: 'sar', label: t('m.collected') },
                { value: Data.head.enforced - Data.head.collected, format: 'sar', label: t('m.outstanding') },
              ],
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 2,
              items: [
                { value: Data.head.proact, format: 'grouped', label: t('m.proact') },
                { value: Data.head.renewengage, format: 'compact', label: t('m.engage') },
                { value: Data.register.near, format: 'grouped', label: t('m.near') },
                { value: Data.register.active, format: 'grouped', label: t('m.active') },
              ],
            });
          },
        ],
      },

      {
        id: 'op-pipe',
        x: 0, y: 5, w: 6, h: 3, minW: 4, minH: 3,
        titleKey: 'w.pipeline',
        chipKeys: ['c.windows', 'c.bytrack'],
        views: [
          function (el) {
            Chart.mount(el, pipelineSpec());
          },
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
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
              xAxis: {
                type: 'band',
                domain: Data.trackOrder.map(function (c) {
                  return t(Kit.CLASS_KEY[c]);
                }),
              },
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 5 },
            });
          },
        ],
      },

      {
        id: 'op-map',
        x: 6, y: 0, w: 11, h: 5, minW: 6, minH: 3,
        titleKey: 'w.map',
        chipKeys: ['c.actions', 'c.value'],
        /* Same as the Big Screen map (Figma node 5039:94568): the tabs float
           over the imagery, top-right, instead of spending a header row. */
        chipsOverlay: true,
        views: [
          function (el) {
            Kit.mapView(el, {
              points: Data.regions.map(function (r) {
                return [r[1], r[2], r[3], Labels.t(r[0]) + ' · ' + Fmt.grouped(r[3])];
              }),
              tone: T.gold,
              hud: { value: Data.regionActions, format: 'grouped', label: t('s.cases') },
              note: t('n.bubbleRegions', {
                n: Fmt.grouped(Data.regionActions),
                total: Fmt.grouped(Data.head.cases),
              }),
            });
          },
          function (el) {
            Kit.mapView(el, {
              points: Data.regions.map(function (r) {
                return [r[1], r[2], r[4], Labels.t(r[0]) + ' · ' + Fmt.grouped(r[4]) + ' SAR'];
              }),
              tone: T.purple,
              hud: { value: Data.regionFines / 1e6, format: 'sar', label: t('m.enforced') },
              note: t('n.regionsFines', {
                n: Fmt.grouped(Data.regionFines),
                total: Fmt.grouped(Data.head.enforced * 1e6),
              }),
            });
          },
        ],
      },

      {
        id: 'op-trend',
        x: 6, y: 5, w: 11, h: 3, minW: 6, minH: 2,
        titleKey: 'w.trend',
        chipKeys: ['c.trend', 'c.bars'],
        views: [
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
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 4 },
              showLegend: false,
              note: t('n.trendNote', {
                last: Data.monthsSpan[1],
                cases: Fmt.grouped(Data.head.cases),
              }),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              series: Kit.barSeries(Data.months, T.gold),
              xAxis: { type: 'band' },
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 4 },
              showLegend: false,
              barValueLabels: false,
              note: t('n.trendNote', {
                last: Data.monthsSpan[1],
                cases: Fmt.grouped(Data.head.cases),
              }),
            });
          },
        ],
      },

      {
        id: 'op-regions',
        x: 17, y: 0, w: 7, h: 5, minW: 4, minH: 3,
        titleKey: 'w.regions',
        chipKeys: ['c.actions', 'c.value'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              horizontal: true,
              series: Kit.barSeries(Data.regionBars, T.gold),
              xAxis: { type: 'band', tickFormat: Labels.t },
              yAxis: { type: 'linear', tickFormat: 'grouped', numTicks: 4 },
              showLegend: false,
              barValueFormat: 'grouped',
              note: t('n.regionsNote', {
                n: Fmt.grouped(Data.regionActions),
                total: Fmt.grouped(Data.head.cases),
              }),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              horizontal: true,
              series: Kit.barSeries(Data.regionFineBars, T.purple),
              xAxis: { type: 'band', tickFormat: Labels.t },
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 4 },
              showLegend: false,
              note: t('n.regionsFines', {
                n: Fmt.grouped(Data.regionFines),
                total: Fmt.grouped(Data.head.enforced * 1e6),
              }),
            });
          },
        ],
      },

      {
        id: 'op-money',
        x: 17, y: 5, w: 7, h: 3, minW: 4, minH: 2,
        titleKey: 'w.money',
        chipKeys: ['c.money'],
        views: [
          /* Build Book §6: collected 5.32M, in collection 5.857M, under review
             223.4k — the three sum to head.enforced (11.4M SAR). */
          function (el) {
            Chart.mount(el, {
              chart: 'pie',
              donut: true,
              gap: 3,
              cornerRadius: 3,
              legendPosition: 'right',
              valueFormat: 'sar',
              data: Data.enforcedSplit.map(function (r, i) {
                return { label: t(r[0]), value: r[1], color: [T.green, T.gold, T.blue][i] };
              }),
              centerLabel: t('m.enforced'),
              centerValue: Data.head.enforced,
              centerFormat: 'sar',
              note: t('n.moneyNote', {
                total: Fmt.one(Data.head.enforced),
                paid: Fmt.one(Data.head.collected),
                due: Fmt.one(Data.head.enforced - Data.head.collected),
              }),
            });
          },
        ],
      },
    ],
  };
})(window);
