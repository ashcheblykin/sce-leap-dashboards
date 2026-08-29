/* Shared board helpers. Nothing here decides what a panel says — that is each
   board file's job — it only saves every one of them from restating the same
   plumbing: the tone palette, the [label, value] -> chart-spec adapters, and
   the map host that has to survive a view switch without being rebuilt. */

(function (global) {
  'use strict';

  /* One palette, defined by the chart DSL. */
  var T = Chart.TONE;

  /* Register statuses carry a fixed colour across every panel that shows them,
     so "green means in good standing" holds on all four boards. */
  var STATUS_TONE = {
    active: T.green,
    near_expiry: T.gold,
    expired: T.blue,
    frozen: T.purple,
  };

  var STATUS_KEY = {
    active: 's.active',
    near_expiry: 's.near',
    expired: 's.expired',
    frozen: 's.frozen',
  };

  var CLASS_TONE = { Engineer: T.cy, Technician: T.green, Specialist: T.gold };
  var CLASS_KEY = {
    Engineer: 's.engineers',
    Technician: 's.technicians',
    Specialist: 's.specialists',
  };

  var GRADE_TONE = {
    Engineer: T.cy,
    Professional: T.green,
    Associate: T.gold,
    Consultant: T.purple,
  };
  var GRADE_KEY = {
    Engineer: 's.engineer',
    Professional: 's.professional',
    Associate: 's.associate',
    Consultant: 's.consultant',
  };

  /* LEAP.cls labels the three classes in the plural; the register rows use the
     singular. Both spellings map to the same message key. */
  var CLS_KEY = {
    Engineers: 's.engineers',
    Technicians: 's.technicians',
    Specialists: 's.specialists',
  };

  var WINDOW_KEY = { '0-30': 's.d30', '31-60': 's.d60', '61-90': 's.d90' };

  function t(key, vars) {
    return I18N.t(key, vars);
  }

  /** [[arabicOrKey, value]] -> progress-bars data, one tone for the list. */
  function barData(rows, tone) {
    return rows.map(function (r) {
      return { label: r[0], value: r[1], color: tone };
    });
  }

  /** [[label, value]] -> a single-series cartesian spec on a band axis. */
  function barSeries(rows, tone, key) {
    return [
      {
        key: key || 'v',
        type: 'bar',
        color: tone,
        data: rows.map(function (r) {
          return { x: r[0], y: r[1] };
        }),
      },
    ];
  }

  /* --- Map host ---
     The map builds its SVG once and then only swaps markers, so the element it
     lives in has to outlive a chip switch. Stashing it on the body element is
     the same trick the prototypes used, minus Leaflet. */
  function mapView(el, mode) {
    var widget = el.closest('.widget');
    if (widget) {
      widget.setAttribute('data-chart', 'map');
    }
    if (!el._map) {
      Chart.unmount(el);
      el.innerHTML = '';
      var host = document.createElement('div');
      el.appendChild(host);
      el._map = AxMap.create(host);
    }
    el._map.render(mode);
  }

  /** City bubbles: `valueIndex` 3 is workforce, 4 is SCE-registered. */
  function cityPoints(valueIndex, format) {
    return Data.cities.map(function (c) {
      return [
        c[1],
        c[2],
        c[valueIndex],
        Labels.t(c[0]) + ' · ' + (format || Fmt.grouped)(c[valueIndex]),
      ];
    });
  }

  global.Kit = {
    T: T,
    STATUS_TONE: STATUS_TONE,
    STATUS_KEY: STATUS_KEY,
    CLASS_TONE: CLASS_TONE,
    CLASS_KEY: CLASS_KEY,
    CLS_KEY: CLS_KEY,
    GRADE_TONE: GRADE_TONE,
    GRADE_KEY: GRADE_KEY,
    WINDOW_KEY: WINDOW_KEY,
    t: t,
    barData: barData,
    barSeries: barSeries,
    mapView: mapView,
    cityPoints: cityPoints,
  };
})(window);
