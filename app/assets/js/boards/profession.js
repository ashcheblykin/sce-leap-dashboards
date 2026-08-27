/* Board 2 — Profession.

   No map: this board is the register itself, so it gets the two chart kinds
   Axion has and the SCE prototypes did not — a sankey for the whole 1,116,186
   memberships flowing from class to status, and a sunburst for the engineer
   grade rollups. Both totals reconcile exactly (register total = head.reg;
   grade total = the Engineers class), which is what makes them safe to show
   large. */

(function (global) {
  'use strict';

  var T = Kit.T;
  var t = Kit.t;

  /** Sankey: three class nodes on the left, four status nodes on the right. */
  function registerFlow() {
    var nodes = [];
    var index = {};
    Data.register.classOrder.forEach(function (cls) {
      index['c:' + cls] = nodes.length;
      nodes.push({ label: t(Kit.CLASS_KEY[cls]), color: Kit.CLASS_TONE[cls], layer: 0 });
    });
    Data.register.statusOrder.forEach(function (status) {
      index['s:' + status] = nodes.length;
      nodes.push({ label: t(Kit.STATUS_KEY[status]), color: Kit.STATUS_TONE[status], layer: 1 });
    });

    var links = [];
    Data.register.classOrder.forEach(function (cls) {
      Data.register.statusOrder.forEach(function (status) {
        var v = Data.register.cross[cls][status];
        if (!v) return;
        links.push({
          source: index['c:' + cls],
          target: index['s:' + status],
          value: v,
          color: Kit.CLASS_TONE[cls],
        });
      });
    });
    return { nodes: nodes, links: links };
  }

  /** Sunburst: engineer grade in the inner ring, its statuses outside it. */
  function gradeRings() {
    return Data.gradeOrder.map(function (grade) {
      var row = Data.gradeCross[grade] || {};
      var total = 0;
      Data.register.statusOrder.forEach(function (s) {
        total += row[s] || 0;
      });
      return {
        label: t(Kit.GRADE_KEY[grade]),
        value: total,
        color: Kit.GRADE_TONE[grade],
        children: Data.register.statusOrder
          .filter(function (s) {
            return row[s];
          })
          .map(function (s) {
            return { label: t(Kit.STATUS_KEY[s]), value: row[s], color: Kit.STATUS_TONE[s] };
          }),
      };
    });
  }

  global.BOARD_PROFESSION = {
    id: 'profession',
    labelKey: 'nav.profession',
    widgets: [
      {
        id: 'pr-flow',
        x: 0, y: 0, w: 10, h: 5, minW: 6, minH: 3,
        titleKey: 'w.flow',
        chipKeys: ['c.flow', 'c.status'],
        views: [
          function (el) {
            var flow = registerFlow();
            Chart.mount(el, {
              chart: 'sankey',
              nodes: flow.nodes,
              links: flow.links,
              legendItems: Data.register.statusOrder.map(function (s) {
                return { label: t(Kit.STATUS_KEY[s]), color: Kit.STATUS_TONE[s] };
              }),
              note: t('n.flowNote', { n: Fmt.grouped(Data.register.total) }),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'cartesian',
              stack: 'bar',
              series: Data.register.statusOrder.map(function (status) {
                return {
                  key: status,
                  label: t(Kit.STATUS_KEY[status]),
                  type: 'bar',
                  color: Kit.STATUS_TONE[status],
                  data: Data.register.classOrder.map(function (cls) {
                    return { x: t(Kit.CLASS_KEY[cls]), y: Data.register.cross[cls][status] };
                  }),
                };
              }),
              xAxis: {
                type: 'band',
                domain: Data.register.classOrder.map(function (c) {
                  return t(Kit.CLASS_KEY[c]);
                }),
              },
              yAxis: { type: 'linear', tickFormat: 'compact', numTicks: 5 },
              note: t('n.flowNote', { n: Fmt.grouped(Data.register.total) }),
            });
          },
        ],
      },

      {
        id: 'pr-grades',
        x: 10, y: 0, w: 7, h: 5, minW: 5, minH: 3,
        titleKey: 'w.grades',
        chipKeys: ['c.rings', 'c.bars'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'sunburst',
              roots: gradeRings(),
              innerRadiusFraction: 0.3,
              gap: 0.7,
              legendItems: Data.gradeOrder.map(function (g) {
                return { label: t(Kit.GRADE_KEY[g]), color: Kit.GRADE_TONE[g] };
              }),
              note: t('n.gradesNote', { n: Fmt.grouped(Data.gradeTotal) }),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'progress-bars',
              data: Data.grades.map(function (r) {
                return {
                  label: t(Kit.GRADE_KEY[r[0]]),
                  value: r[1],
                  color: Kit.GRADE_TONE[r[0]],
                };
              }),
              valueFormat: 'grouped',
              note: t('n.gradesNote', { n: Fmt.grouped(Data.gradeTotal) }),
            });
          },
        ],
      },

      {
        id: 'pr-profile',
        x: 17, y: 0, w: 7, h: 5, minW: 5, minH: 3,
        titleKey: 'w.compare',
        chipKeys: ['c.profile', 'c.classes'],
        views: [
          /* Normalised per status, so the four axes are comparable — a raw
             radar would be one Engineer blob. The note says as much. */
          function (el) {
            Chart.mount(el, {
              chart: 'radar',
              levels: 4,
              radiusDomain: [0, 100],
              fillOpacity: 0.22,
              data: Data.classProfile.map(function (row) {
                var out = { metric: t(Kit.STATUS_KEY[row.metric]) };
                Data.register.classOrder.forEach(function (cls) {
                  out[cls] = row[cls];
                });
                return out;
              }),
              series: Data.register.classOrder.map(function (cls) {
                return { key: cls, label: t(Kit.CLASS_KEY[cls]), color: Kit.CLASS_TONE[cls] };
              }),
              note: t('n.profileNote'),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'pie',
              donut: true,
              gap: 3,
              cornerRadius: 3,
              showAnnotations: true,
              showLegend: false,
              data: Data.classes.map(function (r, i) {
                return { label: t(Kit.CLS_KEY[r[0]]), value: r[1], color: [T.cy, T.green, T.gold][i] };
              }),
              centerLabel: t('m.reg'),
              centerValue: Data.head.reg,
            });
          },
        ],
      },

      {
        id: 'pr-spec',
        x: 0, y: 5, w: 10, h: 3, minW: 5, minH: 2,
        titleKey: 'w.spec',
        chipKeys: ['c.engineers', 'c.technicians', 'c.specialists'],
        /* One card, one renderer. "Top specialties" also appears on the Big
           Screen's first scene, on Ecosystem and in the KPI Library, and all
           three draw it as the Figma bar list (node 5039:94566) — same title,
           same three chips, same five rows. Here alone it was a cartesian
           horizontal bar chart with its own axis, gradient fills and a track
           band, so the wall showed the same panel two ways depending on which
           screen you caught. The reference is the Big Screen's own first page,
           so the bar list wins and this becomes the fourth copy of it rather
           than a second design. */
        views: [Kit.CLASS_TONE.Engineer, Kit.CLASS_TONE.Technician, Kit.CLASS_TONE.Specialist].map(
          function (tone, i) {
            var rows = [Data.eng5, Data.tech5, Data.spec5][i];
            return function (el) {
              Chart.mount(el, {
                chart: 'progress-bars',
                data: Kit.barData(rows, tone),
                note: t('n.specNote'),
              });
            };
          }
        ),
      },

      {
        id: 'pr-nat',
        x: 10, y: 5, w: 7, h: 3, minW: 5, minH: 2,
        titleKey: 'w.nat',
        chipKeys: ['c.bars', 'c.share'],
        views: [
          /* The same bar list Ecosystem and the KPI Library give this card,
             for the same reason as 'w.spec' above. */
          function (el) {
            Chart.mount(el, {
              chart: 'progress-bars',
              data: Kit.barData(Data.nat5, T.purple),
              note: t('n.natNote'),
            });
          },
          function (el) {
            Chart.mount(el, {
              chart: 'pie',
              donut: true,
              gap: 3,
              cornerRadius: 3,
              legendPosition: 'right',
              /* One hue, faded by rank — not five borrowed tones. cy/green/gold/
                 blue already mean Engineer/Technician/near-expiry/expired
                 elsewhere on this board; a nationality has no such recurring
                 identity, so it gets a fade of the bar tab's own purple
                 instead of colours that mean something else here. */
              data: Data.nat5.map(function (r, i) {
                return {
                  label: r[0],
                  value: r[1],
                  color: 'rgba(180, 138, 245, ' + (1 - i * 0.18).toFixed(2) + ')',
                };
              }),
              note: t('n.natNote'),
            });
          },
        ],
      },

      {
        id: 'pr-register',
        x: 17, y: 5, w: 7, h: 3, minW: 5, minH: 2,
        titleKey: 'w.register',
        chipKeys: ['c.kpis'],
        views: [
          function (el) {
            Chart.mount(el, {
              chart: 'indicator',
              cols: 2,
              items: [
                { value: Data.register.total, format: 'grouped', label: t('m.reg') },
                { value: Data.register.active, format: 'grouped', label: t('m.active') },
                { value: Data.register.near, format: 'grouped', label: t('m.near') },
                { value: Data.register.lapsed, format: 'grouped', label: t('m.lapsed') },
              ],
            });
          },
        ],
      },
    ],
  };
})(window);
