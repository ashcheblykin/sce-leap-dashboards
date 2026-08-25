/* Number formatting, following axion.gen.web
   frontend/src/shared/ui/charts/dsl/format.ts: values at or above 10,000 go
   compact (8006090 -> 8.01M), smaller ones stay grouped, and a hyphen-minus is
   always upgraded to a typographic minus. */

(function (global) {
  'use strict';

  var MINUS = '\u2212';

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
