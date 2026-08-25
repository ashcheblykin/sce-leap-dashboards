/* Number formatting, following axion.gen.web
   frontend/src/shared/ui/charts/dsl/format.ts: values at or above 10,000 go
   compact (8006090 -> 8.01M), smaller ones stay grouped, and a hyphen-minus is
   always upgraded to a typographic minus. */

(function (global) {
  'use strict';

  var MINUS = '\u2212';

  /* The Axion wordmark, inlined so `currentColor` picks up whatever the
     surrounding credit line is styled with (shell.js's ticker, map.js's
     corner credit, and the splash footer all render this same markup). */
  global.AXION_MARK_SVG =
    '<svg class="axion-mark" viewBox="0 0 1391 234" role="img" aria-label="Axion">' +
    '<path d="M153.472 4.33727L303.275 213.193L389.353 123.445L344.312 76.069H290.597V4.33727H344.312C354.766 4.33727 363.885 5.44939 371.67 7.67362C379.678 9.89786 386.795 12.9006 393.023 16.6818C399.251 20.2406 404.923 24.4666 410.038 29.36C415.154 34.0309 420.159 39.0354 425.052 44.3736L445.07 65.7263L503.79 4.33727H606.884L495.783 119.775L530.815 156.809H593.538V228.541H530.815C522.362 228.541 514.578 227.651 507.46 225.871C500.343 224.092 493.781 221.757 487.776 218.865C481.77 215.751 476.21 212.192 471.094 208.189C466.2 203.963 461.53 199.514 457.081 194.843L440.399 177.494L391.355 228.541H215.529L168.152 163.482H80.7399V228.541H0V159.478C0 137.903 5.5606 122 16.6818 111.768C27.803 101.537 43.9287 96.4208 65.059 96.4208H119.108L52.0472 4.33727H153.472ZM720.32 228.541H639.58V4.33727H720.32V228.541ZM907.823 67.3944C884.691 67.3944 867.787 71.3981 857.11 79.4053C846.434 87.4126 841.096 99.7571 841.096 116.439C841.096 133.121 846.434 145.576 857.11 153.806C867.787 162.036 884.691 166.151 907.823 166.151C931.4 166.151 948.638 162.036 959.537 153.806C970.435 145.576 975.885 133.121 975.885 116.439C975.885 99.7571 970.324 87.4126 959.203 79.4053C948.082 71.3981 930.955 67.3944 907.823 67.3944ZM907.489 0C930.399 0 951.196 2.44666 969.879 7.33999C988.785 12.2333 1004.91 19.4621 1018.26 29.0263C1031.82 38.5905 1042.28 50.6014 1049.62 65.059C1056.96 79.2941 1060.63 95.8647 1060.63 114.771C1060.63 135.011 1057.07 152.583 1049.95 167.485C1042.83 182.388 1032.6 194.732 1019.26 204.519C1006.13 214.305 990.12 221.645 971.214 226.539C952.53 231.21 931.511 233.545 908.157 233.545C884.802 233.545 863.672 231.21 844.766 226.539C826.082 221.645 810.068 214.305 796.722 204.519C783.599 194.732 773.479 182.388 766.362 167.485C759.244 152.583 755.685 135.011 755.685 114.771C755.685 76.9587 767.918 48.3772 792.385 29.0263C816.852 9.67544 855.22 0 907.489 0ZM1390.59 4.33727V228.541H1340.88C1333.1 228.541 1326.31 227.984 1320.53 226.872C1314.97 225.76 1309.85 224.092 1305.18 221.868C1300.73 219.644 1296.51 216.863 1292.51 213.527C1288.72 209.968 1284.72 205.965 1280.49 201.516L1188.74 104.094V228.541H1117.35V74.0672H1072.31V4.33727H1144.37C1154.6 4.33727 1163.83 5.11576 1172.06 6.67273C1180.51 8.22969 1188.3 10.6763 1195.42 14.0127C1202.76 17.1266 1209.65 21.2415 1216.1 26.3572C1222.78 31.2506 1229.45 37.256 1236.12 44.3736L1318.86 130.785V4.33727H1390.59Z" fill="currentColor"/>' +
    '</svg>';

  function withMinus(s) {
    return s.replace(/-/g, MINUS);
  }

  function grouped(n) {
    return withMinus(Math.round(n).toLocaleString('en-US'));
  }

  /* Trailing zeros are only ever noise after a decimal point. Stripping them
     from the integer part turns 430k into 43k, which is exactly the kind of
     error nobody catches on a wall until the client does. */
  function trimZeros(s) {
    if (s.indexOf('.') === -1) return s;
    return s.replace(/0+$/, '').replace(/\.$/, '');
  }

  function compact(n) {
    var abs = Math.abs(n);
    if (abs < 10000) {
      var rounded = abs < 100 ? Math.round(n * 10) / 10 : Math.round(n);
      return withMinus(rounded.toLocaleString('en-US'));
    }
    var units = [
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'k'],
    ];
    for (var i = 0; i < units.length; i++) {
      if (abs >= units[i][0]) {
        var v = n / units[i][0];
        var digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
        return withMinus(trimZeros(v.toFixed(digits)) + units[i][1]);
      }
    }
    return grouped(n);
  }

  function pct(n, digits) {
    return withMinus(n.toFixed(digits === undefined ? 1 : digits)) + '%';
  }

  function sar(millions) {
    return withMinus(trimZeros(millions.toFixed(2))) + 'M';
  }

  /* Arabic city and specialty labels arrive from LEAP; wrap them so the Arabic
     face and RTL isolation apply without leaking into the surrounding line. */
  function ar(text) {
    return '<span class="ar" dir="rtl">' + text + '</span>';
  }

  /* A numeric run inside RTL copy. `dir="ltr"` plus isolation is Axion's
     NUMERIC_ISOLATE (shared/ChartText.tsx): without it a value like
     "11.4M SAR" reorders its sign, separators and unit in an Arabic line. */
  function num(text) {
    return '<span class="ax-num" dir="ltr">' + text + '</span>';
  }

  function one(n) {
    return withMinus(n.toFixed(1));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Named formatters, so a chart spec and a counter can both say 'compact'
     and mean the same function (the `format` field of Axion's DSL). */
  var by = {
    grouped: grouped,
    compact: compact,
    pct: pct,
    pct0: function (n) {
      return pct(n, 0);
    },
    sar: sar,
    one: one,
    plain: function (n) {
      return String(n);
    },
  };

  global.Fmt = {
    grouped: grouped,
    compact: compact,
    pct: pct,
    sar: sar,
    one: one,
    ar: ar,
    num: num,
    by: by,
    escapeHtml: escapeHtml,
  };
})(window);
