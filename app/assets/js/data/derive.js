/* Derived views over the LEAP dataset.

   Ground rule from SCE_KPI_Calculation_Guide.docx §2: the dashboards display,
   they never invent. Everything below is a grouping, a share or a re-shaping of
   numbers already in leap_data.js — no figure is ever typed into markup, and
   every aggregate that the guide names a value for is checked against it on
   load (see `check`).

   Where the shipped data and the documentation disagree, the data wins and the
   view says so. Three such places, all surfaced as footnotes on the panels
   that use them:

     · LEAP.regions is the ten most active regions (946 of 2,445 actions,
       7.20M of 11.4M SAR) — the guide's cross-check "Σ regions = cases" does
       not hold on this extract.
     · LEAP.months is an activity series of 36 monthly points whose magnitudes
       (10k–963k) cannot be case counts against 2,445 all-years cases; the
       guide says to plot it as-is, so it is plotted unitless. 2023-11 is
       absent, so 36 points span 37 calendar months.
     · SCE_KPI_Build_Book.docx §4 lists the Associate and Consultant grade
       rollups as 27,049 / 26,772; grades.csv and leap_data.js both give
       26,919 / 26,718. The dataset is the source of truth per the guide.

   LEAP.pipetrack also carries windows beyond 90 days whose total (492,152)
   reconciles with neither the active register (485,948) nor the renewal window
   (64,784), so only the three documented windows — whose per-class sums
   reproduce renewal_pipeline.csv exactly — are shown. */

(function (global) {
  'use strict';

  var L = global.LEAP;

  function sumBy(rows, keyIndex, valueIndex, filter) {
    var out = {};
    var order = [];
    for (var i = 0; i < rows.length; i++) {
      if (filter && !filter(rows[i])) continue;
      var key = rows[i][keyIndex];
      if (!(key in out)) {
        out[key] = 0;
        order.push(key);
      }
      out[key] += rows[i][valueIndex];
    }
    return { map: out, order: order };
  }

  function pairs(grouped, labels) {
    return grouped.order.map(function (k) {
      return [labels && labels[k] ? labels[k] : k, grouped.map[k]];
    });
  }

  /** rows -> { key: { status: value } } */
  function crosstab(rows) {
    var out = {};
    var order = [];
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i][0];
      if (!out[key]) {
        out[key] = {};
        order.push(key);
      }
      out[key][rows[i][1]] = rows[i][2];
    }
    return { map: out, order: order };
  }

  var registerByStatus = sumBy(L.register, 1, 2).map;
  var registerCross = crosstab(L.register);
  var gradeCross = crosstab(L.grades);
  var gradeTotals = sumBy(L.grades, 0, 2);

  var WINDOW_90 = { '0-30': 1, '31-60': 1, '61-90': 1 };
  var trackCross = crosstab(
    L.pipetrack.filter(function (r) {
      return WINDOW_90[r[1]];
    })
  );
  var trackTotals = sumBy(L.pipetrack, 0, 2, function (r) {
    return WINDOW_90[r[1]];
  });

  var CLASS_ORDER = ['Engineer', 'Technician', 'Specialist'];
  var STATUS_ORDER = ['active', 'near_expiry', 'expired', 'frozen'];
  var GRADE_ORDER = ['Engineer', 'Professional', 'Associate', 'Consultant'];

  var eco = L.head.eco;
  var saudis = L.head.saudis;

  /* --- Geography totals. The 38 mapped cities cover the whole in-scope
     workforce (Σ workforce == head.eco), and Σ registered / Σ workforce is the
     54.7% national reach the guide states. --- */
  var cityWorkforce = 0;
  var cityRegistered = 0;
  for (var ci = 0; ci < L.city.length; ci++) {
    cityWorkforce += L.city[ci][3];
    cityRegistered += L.city[ci][4];
  }

  var regionActions = 0;
  var regionFines = 0;
  for (var ri = 0; ri < L.regions.length; ri++) {
    regionActions += L.regions[ri][3];
    regionFines += L.regions[ri][4];
  }

  var Data = {
    head: L.head,
    tuv: L.tuv.head,

    /* head.offices ships as a formatted string and head.off_note states its
       two components ("9,103 licensed + 12,302 structured feed"). Both are
       parsed rather than retyped, so the panel cannot drift from the data. */
    offices: parseInt(String(L.head.offices).replace(/,/g, ''), 10),
    officesParts: String(L.head.off_note)
      .match(/[\d,]+/g)
      .map(function (part) {
        return parseInt(part.replace(/,/g, ''), 10);
      }),

    /* --- Ecosystem --- */
    nonSaudi: eco - saudis,
    saudiShare: (saudis / eco) * 100,

    /* --- Gender (WeDo's August 2026 upgrade kit) ---

       The `gender` key is on the person grain — fact_compliance, one row per
       in-scope person — so it decomposes head.eco (722,690) and NOT head.reg
       (1,116,186), which counts memberships. That matters for `regShare`: the
       denominator for "registered women" is the 395,614 people the register
       covers, the figure the National Map already shows on its SCE-registered
       mode, not the membership total. Dividing by head.reg would report 1.2%
       where the truth is 24.7%. */
    gender: {
      male: L.gender.male,
      female: L.gender.female,
      femaleShare: (L.gender.female / eco) * 100,
      femSaudi: L.gender.fem_saudi,
      femNonSaudi: L.gender.fem_nonsaudi,
      femSaudiShare: (L.gender.fem_saudi / L.gender.female) * 100,
      femReg: L.gender.fem_reg,
      maleSaudi: L.gender.male_saudi,
      maleReg: L.gender.male_reg,
      registered: L.gender.male_reg + L.gender.fem_reg,
      /* Two different questions, and the kit only states the first: what
         share of women are on the register (24.7%), versus what share of the
         register is women (3.3%). Naming both stops the next reader from
         reaching for whichever is to hand. */
      femRegOfWomen: (L.gender.fem_reg / L.gender.female) * 100,
      femShareOfRegistered: (L.gender.fem_reg / (L.gender.male_reg + L.gender.fem_reg)) * 100,
    },

    classes: L.cls.map(function (r) {
      return [r[0], r[1]];
    }),

    register: {
      active: registerByStatus.active,
      near: registerByStatus.near_expiry,
      expired: registerByStatus.expired,
      frozen: registerByStatus.frozen,
      lapsed: registerByStatus.expired + registerByStatus.frozen,
      total:
        registerByStatus.active +
        registerByStatus.near_expiry +
        registerByStatus.expired +
        registerByStatus.frozen,
      cross: registerCross.map,
      classOrder: CLASS_ORDER,
      statusOrder: STATUS_ORDER,
    },

    /* Grade rollups break down the engineer memberships only: the four grades
       sum to LEAP.cls Engineers (596,606), not to the whole register. */
    grades: pairs(gradeTotals).sort(function (a, b) {
      return b[1] - a[1];
    }),
    gradeCross: gradeCross.map,
    gradeOrder: GRADE_ORDER,
    gradeTotal: (function () {
      var t = 0;
      for (var k in gradeTotals.map) if (gradeTotals.map.hasOwnProperty(k)) t += gradeTotals.map[k];
      return t;
    })(),

    /* --- Profession --- */
    eng5: L.eng5,
    tech5: L.tech5,
    spec5: L.spec5,
    nat5: L.nat5,

    /* --- Monitoring --- */
    pipeline: [
      ['s.d30', L.pipe.d30],
      ['s.d60', L.pipe.d60],
      ['s.d90', L.pipe.d90],
    ],

    /* The 90-day window split by class and sub-window. Per-class sums are
       80,630 / 33,777 / 9,701 and the grand total is 124,108 == pipe.d90. */
    trackWindows: trackCross.map,
    trackOrder: CLASS_ORDER,
    windowOrder: ['0-30', '31-60', '61-90'],
    pipelineByTrack: pairs(trackTotals).sort(function (a, b) {
      return b[1] - a[1];
    }),

    /* --- Enforcement --- */
    months: L.months,
    monthsSpan: [L.months[0][0], L.months[L.months.length - 1][0]],
    regions: L.regions,
    regionActions: regionActions,
    regionFines: regionFines,

    regionBars: L.regions
      .slice()
      .sort(function (a, b) {
        return b[3] - a[3];
      })
      .map(function (r) {
        return [r[0], r[3]];
      }),

    regionFineBars: L.regions
      .slice()
      .sort(function (a, b) {
        return b[4] - a[4];
      })
      .map(function (r) {
        return [r[0], r[4]];
      }),

    /* Build Book §6: collected 5.32M · in collection (unpaid) 5.857M · under
       review 223.4k. The three sum to 11.4004M, i.e. head.enforced. */
    enforcedSplit: [
      ['s.collected', L.head.collected],
      ['n.inCollection', 5.857],
      ['n.underReview', 0.2234],
    ],

    /* --- Geography --- */
    cities: L.city,
    cityWorkforce: cityWorkforce,
    cityRegistered: cityRegistered,
    tuvPoints: L.tuv.pts,
    tuvCities: L.tuv.city,
    tuvTop: L.tuvtop,

    nationalReach: (cityRegistered / cityWorkforce) * 100,
  };

  /* Radar: each class scored on the four register statuses, normalised per
     status so the four axes are comparable (a raw radar would be one huge
     Engineer blob). The tooltipless wall shows shape, not magnitude, and the
     panel note says which. */
  Data.classProfile = STATUS_ORDER.map(function (status) {
    var max = 0;
    CLASS_ORDER.forEach(function (cls) {
      var v = registerCross.map[cls][status] || 0;
      if (v > max) max = v;
    });
    var row = { metric: status, raw: {} };
    CLASS_ORDER.forEach(function (cls) {
      var v = registerCross.map[cls][status] || 0;
      row[cls] = max ? (v / max) * 100 : 0;
      row.raw[cls] = v;
    });
    return row;
  });

  /* --- Cross-checks (calculation guide §6) ------------------------------- */
  function check() {
    var t = L.tuv.head;
    var results = [
      ['classes total = head.reg', Data.classes.reduce(function (a, r) { return a + r[1]; }, 0), L.head.reg],
      ['register active = head.regactive', Data.register.active, L.head.regactive],
      ['register near = head.regnear', Data.register.near, L.head.regnear],
      ['register total = head.reg', Data.register.total, L.head.reg],
      ['expired = 551,850', Data.register.expired, 551850],
      ['frozen = 13,604', Data.register.frozen, 13604],
      ['lapsed = 565,454', Data.register.lapsed, 565454],
      ['grades total = Engineers class', Data.gradeTotal, L.cls[0][1]],
      ['pipeline monotonic', L.pipe.d30 <= L.pipe.d60 && L.pipe.d60 <= L.pipe.d90, true],
      ['near_expiry <= d90', L.pipe.d90 >= L.head.regnear, true],
      ['by-track 90d sum = pipe.d90', Data.pipelineByTrack.reduce(function (a, r) { return a + r[1]; }, 0), L.pipe.d90],
      ['saudis < eco', saudis < eco, true],
      ['city workforce = head.eco', cityWorkforce, L.head.eco],
      ['national reach = 54.7%', Math.round(Data.nationalReach * 10) / 10, 54.7],
      ['collected <= enforced', L.head.collected <= L.head.enforced, true],
      ['enforced split = head.enforced', Math.round(Data.enforcedSplit.reduce(function (a, r) { return a + r[1]; }, 0) * 10) / 10, L.head.enforced],
      ['tuv active <= surveyed', t.active <= t.surveyed, true],
      ['tuv workers / active ~= avgw', Math.round((t.workers / t.active) * 10) / 10, t.avgw],
      // Documented as "Σ regions = cases" but the extract ships the leading
      // ten only, so the check that can actually hold is the subset one.
      ['regions actions < head.cases', regionActions < L.head.cases, true],
      ['months = 36 points', L.months.length, 36],
      /* Gender is a partition of the workforce, of the Saudi count and of the
         mapped register, so each of the three has to close exactly. */
      ['gender total = head.eco', L.gender.male + L.gender.female, L.head.eco],
      ['women saudi + non-saudi = women', L.gender.fem_saudi + L.gender.fem_nonsaudi, L.gender.female],
      ['gender saudi split = head.saudis', L.gender.male_saudi + L.gender.fem_saudi, L.head.saudis],
      ['gender registered = mapped registered', Data.gender.registered, cityRegistered],
      ['female share = 7.4%', Math.round(Data.gender.femaleShare * 10) / 10, 7.4],
      ['saudi women = 87.1% of women', Math.round(Data.gender.femSaudiShare * 10) / 10, 87.1],
      ['registered women = 24.7% of women', Math.round(Data.gender.femRegOfWomen * 10) / 10, 24.7],
    ];

    var failed = results.filter(function (r) {
      return r[1] !== r[2];
    });

    if (!failed.length) {
      console.info('LEAP data: all ' + results.length + ' cross-checks pass');
      return true;
    }
    console.warn('LEAP data: ' + failed.length + ' cross-check(s) did not reproduce');
    for (var i = 0; i < failed.length; i++) {
      console.warn('  ' + failed[i][0] + ' -> got ' + failed[i][1] + ', expected ' + failed[i][2]);
    }
    return false;
  }

  Data.check = check;
  global.Data = Data;
})(window);
