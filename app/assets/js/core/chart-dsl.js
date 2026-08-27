/* Chart DSL — a vanilla-SVG port of axion.gen.web
   frontend/src/shared/ui/charts.

   The originals are visx + React. This file reproduces their geometry and
   their constants rather than approximating the look: the numbers below are
   lifted from the source files named beside them, so a chart here lays out the
   way the same chart lays out in the product.

     dsl/Chart.tsx            -> Chart.mount() dispatch
     shared/ChartFrame.tsx    -> frame(): legend + measured plot area
     shared/SyncParentSize    -> one shared ResizeObserver, synchronous render
     shared/layout.ts         -> band padding, pie/radar radius
     shared/gradients.ts      -> adjustLightness, gradient ids
     shared/ChartGradients    -> the 0.36 -> 0.05 bar/area gradient
     shared/GradientBars.tsx  -> bar body, 2px value-end stripe, end labels
     shared/ChartText.tsx     -> RTL: LTR-pinned frame, logical text anchors
     shared/legend.tsx        -> dot legend
     CartesianChart.tsx       -> axes, grid, bars, lines, areas
     PieChart.tsx             -> donut + leader-line annotations
     RadarChart.tsx           -> rings, spokes, closed radial lines
     ProgressBarsChart.tsx    -> HTML rows (label/value over track/fill)
     TableChart.tsx           -> HTML table
     IndicatorChart.tsx       -> headline value + caption (no delta pill: no
                                 figure on this wall has a period to compare to)
     SankeyChart.tsx          -> layered node/link layout
     SunburstChart.tsx        -> partition rings with depth fade

   Two departures, both deliberate:

   1. Sizes scale. Axion's chart type is a fixed 11px because it renders in a
      product window. This wall is designed at 2880x1152 and previewed on a
      laptop, so every px constant is multiplied by `--chart-u` (derived from
      the board's own `--u`). The RATIOS are Axion's; only the unit changes.

   2. Entry animation. The kick-off asked for numbers that count up and tiles
      that arrive in sequence, so a first render grows its marks from the
      baseline over the same 600ms the counters use. A re-render caused by a
      resize paints the final state immediately -- growing the bars again every
      time the operator drags a panel edge would be seasickness. */

(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* --- Palette ---
     The SCE tones, named once and used everywhere: the ordered array is what a
     spec falls back to when it names no colour (Axion's CHART_COLORS), and the
     named form is what the boards reach for when a colour has to MEAN something
     (green is in good standing on every board).

     The values are READ OUT OF tokens.css rather than restated here. They used
     to be six hex literals in this file, four of which duplicated a token in
     the cascade (`--cy`, `--green`, `--gold`, `--purple`) and two of which
     existed nowhere else — so `--purple` read as an unused token while its
     colour was live on three boards. One definition, one place to change it.
     The literals stay only as a fallback for a stylesheet that failed to load,
     which on this machine cannot happen. */
  var TONE_FALLBACK = {
    cy: '#39d7f5',
    green: '#3ee6a4',
    gold: '#d4af5a',
    purple: '#b48af5',
    blue: '#7ac8ff',
    pink: '#f58aa8',
  };
  var TONE = (function () {
    var css = getComputedStyle(document.documentElement);
    var out = {};
    for (var name in TONE_FALLBACK) {
      if (!TONE_FALLBACK.hasOwnProperty(name)) continue;
      var raw = String(css.getPropertyValue('--' + name) || '').trim();
      out[name] = /^#[0-9a-fA-F]{3,6}$/.test(raw) ? raw : TONE_FALLBACK[name];
    }
    return out;
  })();
  var COLORS = [TONE.cy, TONE.green, TONE.gold, TONE.purple, TONE.blue, TONE.pink];

  /* --- Constants, from the files named above --------------------------------
     Each is Axion's own value; `m()` turns it into wall units. */
  var C = {
    /* shared/layout.ts */
    GROUP_GAP: 16,
    BAR_GAP: 2,
    /* shared/GradientBars.tsx */
    TOP_STRIPE: 2,
    STACK_FILL_OPACITY: 0.2,
    LABEL_GAP: 4,
    LABEL_FONT: 11,
    LABEL_MIN_BAR_WIDTH: 30,
    LABEL_PAD_X: 2,
    /* shared/cartesianUtils.ts */
    AXIS_FONT: 11,
    TICK_LENGTH: 4,
    /* CartesianChart.tsx */
    H_VALUE_RESERVE: 44,
    /* PieChart.tsx */
    LEADER_RADIAL: 12,
    LABEL_OFFSET: 24,
    ANNOTATION_TEXT_BUDGET: 52,
    ANNOTATION_GAP: 4,
    /* RadarChart.tsx */
    RADAR_LABEL_GAP: 16,
    RADAR_DOT: 4,
    /* SankeyChart.tsx */
    NODE_WIDTH: 16,
    NODE_PADDING: 10,
    /* SunburstChart.tsx */
    MIN_STROKE_ARC: 4,
    SUNBURST_LABEL_PAD: 8,
  };

  var MARGIN = {
    cartesian: { top: 16, right: 16, bottom: 40, left: 52 },
    pie: { top: 16, right: 16, bottom: 16, left: 16 },
    radar: { top: 40, right: 40, bottom: 40, left: 40 },
    sankey: { top: 16, right: 16, bottom: 16, left: 16 },
    sunburst: { top: 16, right: 16, bottom: 16, left: 16 },
  };

  /* Wall unit. `--chart-u` is 1 in an Axion product window and ~1.9 on the
     panel, so every constant above keeps its ratio to every other one. */
  var unit = 1;

  function refreshUnit() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--chart-u');
    var v = parseFloat(raw);
    unit = isFinite(v) && v > 0 ? v : 1;
  }

  /** A constant in wall units. */
  function m(v) {
    return v * unit;
  }

  /* ---------------------------------------------------------------- helpers */

  function svg(name, attrs) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k) && attrs[k] !== undefined && attrs[k] !== null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    return node;
  }

  function html(name, className, text) {
    var node = document.createElement(name);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /** Stamp the shared tooltip's content onto a mark (core/tooltip.js) -- a
      hover or a tap on `node` reads these back rather than either chart-dsl
      or tooltip.js owning a per-mark tooltip instance. No-op if `value` is
      empty: an unlabelled mark (a stack's inner segment, say) should not
      become a dead hit target that opens an empty card. */
  function tip(node, label, value, meta, tone) {
    if (!value) return node;
    node.setAttribute('data-tip-label', label || '');
    node.setAttribute('data-tip-value', value);
    if (meta) node.setAttribute('data-tip-meta', meta);
    if (tone) node.setAttribute('data-tip-tone', tone);
    return node;
  }

  function sum(arr, pick) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += pick ? pick(arr[i]) : arr[i];
    return t;
  }

  /* --- shared/gradients.ts ------------------------------------------------- */

  function parseHex(input) {
    var m2 = String(input).trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!m2) return null;
    var h = m2[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function rgbToHsl(r, g, b) {
    var rn = r / 255,
      gn = g / 255,
      bn = b / 255;
    var max = Math.max(rn, gn, bn),
      min = Math.min(rn, gn, bn);
    var l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l };
    var d = max - min;
    var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    var h;
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    return { h: h * 60, s: s, l: l };
  }

  /** adjustLightness from shared/gradients.ts. */
  function adjustLightness(color, deltaPercent) {
    var rgb = parseHex(color);
    if (!rgb) return color;
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var next = clamp(hsl.l * 100 + deltaPercent, 0, 100);
    return 'hsl(' + hsl.h.toFixed(1) + ' ' + (hsl.s * 100).toFixed(1) + '% ' + next.toFixed(1) + '%)';
  }

  /** hexToRgba from shared/colors.ts. */
  function rgba(hex, alpha) {
    var rgb = parseHex(hex);
    if (!rgb) return hex;
    return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + clamp(alpha, 0, 1) + ')';
  }

  function slug(color) {
    return String(color).replace(/[^a-zA-Z0-9]/g, '');
  }

  var idSeq = 0;

  /* The board runs dark, so ChartGradients' delta is the dark-theme -25. */
  function gradientDefs(chartId, colors, horizontal) {
    var defs = svg('defs');
    var seen = {};
    var axis = horizontal
      ? { x1: '1', y1: '0', x2: '0', y2: '0' }
      : { x1: '0', y1: '0', x2: '0', y2: '1' };
    for (var i = 0; i < colors.length; i++) {
      var color = colors[i];
      if (!color || seen[color]) continue;
      seen[color] = true;
      var faded = adjustLightness(color, -25);
      var pos = svg('linearGradient', {
        id: 'g-' + chartId + '-' + slug(color),
        x1: axis.x1,
        y1: axis.y1,
        x2: axis.x2,
        y2: axis.y2,
      });
      pos.appendChild(svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.36 }));
      pos.appendChild(svg('stop', { offset: '100%', 'stop-color': faded, 'stop-opacity': 0.05 }));
      defs.appendChild(pos);
    }
    return defs;
  }

  function gradientUrl(chartId, color) {
    return 'url(#g-' + chartId + '-' + slug(color) + ')';
  }

  /* --- scales -------------------------------------------------------------- */

  /** d3-scale band. `padding` is the outer padding fraction, as visx takes it. */
  function bandScale(domain, range, padding) {
    var n = domain.length;
    var span = range[1] - range[0];
    var p = padding || 0;
    var step = n > 0 ? span / (n + p) : 0;
    var bandwidth = step * (1 - p);
    var index = {};
    for (var i = 0; i < n; i++) index[String(domain[i])] = i;
    return {
      type: 'band',
      domain: domain,
      bandwidth: bandwidth,
      step: step,
      scale: function (v) {
        var i = index[String(v)];
        return i === undefined ? undefined : range[0] + (step * p) / 2 + i * step;
      },
      center: function (v) {
        var x = this.scale(v);
        return x === undefined ? undefined : x + bandwidth / 2;
      },
    };
  }

  /** d3 tick step for a [lo, hi] span split into ~count intervals. */
  function tickStep(lo, hi, count) {
    var span = Math.abs(hi - lo) || 1;
    var rough = span / Math.max(1, count);
    var power = Math.floor(Math.log(rough) / Math.LN10);
    var base = Math.pow(10, power);
    var err = rough / base;
    var mult = err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1;
    return mult * base;
  }

  /** d3 nice(): widen [lo, hi] out to the enclosing tick step. */
  function niceDomain(lo, hi, count) {
    if (lo === hi) return lo === 0 ? [0, 1] : [Math.min(0, lo), Math.max(0, hi)];
    var step = tickStep(lo, hi, count || 5);
    return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
  }

  function linearScale(domain, range) {
    var d0 = domain[0],
      d1 = domain[1];
    var r0 = range[0],
      r1 = range[1];
    var span = d1 - d0 || 1;
    return {
      type: 'linear',
      domain: [d0, d1],
      scale: function (v) {
        return r0 + ((v - d0) / span) * (r1 - r0);
      },
      invert: function (px) {
        return d0 + ((px - r0) / (r1 - r0 || 1)) * span;
      },
      ticks: function (count) {
        var step = tickStep(d0, d1, count || 5);
        var out = [];
        var start = Math.ceil(d0 / step) * step;
        for (var v = start; v <= d1 + step * 1e-6; v += step) {
          out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
        }
        return out;
      },
    };
  }

  /* --- shared/layout.ts --------------------------------------------------- */

  /* Axion's own solve for a constant inter-group gap. One addition: it clamps
     at 0.9, which on a SHORT band axis (ten regions down 430px, five
     specialties down 200px) means the 16px gap eats the whole step and the
     bars come out as hairlines. Capping the target at a third of the natural
     step keeps Axion's 16px wherever there is room for it and degrades in
     proportion where there is not. */
  var MAX_GAP_FRACTION = 0.34;

  function computeOuterPadding(innerWidth, n, targetGap) {
    if (n <= 0 || innerWidth <= 0) return 0;
    var gap = Math.min(targetGap, (innerWidth / n) * MAX_GAP_FRACTION);
    if (gap <= 0 || innerWidth <= gap) return 0;
    return clamp((gap * n) / (innerWidth - gap), 0, 0.9);
  }

  function computeInnerPadding(groupBandwidth, seriesCount, barGap) {
    if (seriesCount <= 1 || groupBandwidth <= barGap) return 0;
    return clamp((barGap * seriesCount) / (groupBandwidth - barGap), 0, 0.9);
  }

  function groupBandwidth(innerWidth, n, outerPadding) {
    if (n <= 0) return 0;
    return (innerWidth * (1 - outerPadding)) / (n + outerPadding);
  }

  /* Axion's 16px chart margin is sized for a product window. Scaled to the
     wall it becomes ~30px, which on a two-row panel is 45% of the height and
     leaves a donut the size of a coin. Cap it against the box so the margin
     stays a margin instead of becoming the layout. */
  function capMargin(width, height, base) {
    return Math.min(m(base), Math.min(width, height) * 0.055);
  }

  function computePieRadius(width, height, margin, reserveH, reserveV) {
    var innerW = width - margin.left - margin.right - (reserveH || 0) * 2;
    var innerH = height - margin.top - margin.bottom - (reserveV || 0) * 2;
    return Math.max(0, Math.min(innerW, innerH) / 2);
  }

  /* --- text -------------------------------------------------------------- */

  var measureCtx = null;
  var measureCache = {};

  function measureText(text, fontSize, weight) {
    if (!text) return 0;
    var font = (weight || 400) + ' ' + fontSize + 'px ' + FONT_FAMILY;
    var key = font + '|' + text;
    if (measureCache[key] !== undefined) return measureCache[key];
    if (!measureCtx) {
      var canvas = document.createElement('canvas');
      measureCtx = canvas.getContext('2d');
    }
    if (!measureCtx) return 0;
    measureCtx.font = font;
    var w = measureCtx.measureText(text).width;
    measureCache[key] = w;
    return w;
  }

  var FONT_FAMILY = "'Roboto Flex','Almarai Arabic',sans-serif";

  /** resolveTextAnchor from shared/ChartText.tsx. */
  function anchorFor(align, rtl) {
    if (align === 'middle') return 'middle';
    if (!rtl) return align;
    return align === 'start' ? 'end' : 'start';
  }

  /**
   * A `<text>` that gets RTL right. `kind` drives bidi ordering exactly as
   * ChartText.tsx's textBidiStyle does: a label is reordered by its own base
   * direction (`plaintext`), a numeric run is forced LTR as one unit
   * (`isolate`) so signs, separators and percent glyphs never scramble.
   */
  function text(opts) {
    var node = svg('text', {
      x: opts.x,
      y: opts.y,
      'text-anchor': anchorFor(opts.align || 'start', opts.rtl && opts.logical !== false),
      'font-size': opts.size,
      'font-weight': opts.weight,
      fill: opts.fill,
      'font-family': FONT_FAMILY,
      'dominant-baseline': opts.baseline,
      'pointer-events': 'none',
      class: opts.className,
    });
    node.style.direction = 'ltr';
    node.style.unicodeBidi = opts.kind === 'numeric' ? 'isolate' : 'plaintext';
    node.textContent = opts.value;
    return node;
  }

  function truncate(label, maxWidth, fontSize) {
    if (measureText(label, fontSize) <= maxWidth) return label;
    var s = label;
    while (s.length > 1 && measureText(s + '…', fontSize) > maxWidth) s = s.slice(0, -1);
    return s + '…';
  }

  /* --- rounded rect (visx BarRounded) ------------------------------------- */

  function roundedRect(x, y, w, h, r, corners) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    if (rr === 0) return 'M' + x + ',' + y + 'h' + w + 'v' + h + 'h' + -w + 'Z';
    var tl = corners.tl ? rr : 0,
      tr = corners.tr ? rr : 0,
      br = corners.br ? rr : 0,
      bl = corners.bl ? rr : 0;
    return (
      'M' + (x + tl) + ',' + y +
      'H' + (x + w - tr) + (tr ? 'a' + tr + ',' + tr + ' 0 0 1 ' + tr + ',' + tr : '') +
      'V' + (y + h - br) + (br ? 'a' + br + ',' + br + ' 0 0 1 ' + -br + ',' + br : '') +
      'H' + (x + bl) + (bl ? 'a' + bl + ',' + bl + ' 0 0 1 ' + -bl + ',' + -bl : '') +
      'V' + (y + tl) + (tl ? 'a' + tl + ',' + tl + ' 0 0 1 ' + tl + ',' + -tl : '') +
      'Z'
    );
  }

  /* --- annular sector (visx Arc / Pie) ------------------------------------ */

  function polar(cx, cy, r, angle) {
    /* Zero points up and angles run clockwise, matching d3-shape's pie. */
    return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
  }

  /**
   * Annular sector path. Corner rounding is applied by the caller as a stroke
   * of width 2*cornerRadius with round joins over an inset sector -- the
   * standard trick, and exact for this shape.
   */
  function sectorPath(cx, cy, r0, r1, a0, a1) {
    if (r1 <= 0 || a1 - a0 <= 1e-9) return '';
    var full = a1 - a0 >= 2 * Math.PI - 1e-9;
    if (full) {
      /* Two half-circles, so a whole-circle slice still renders. */
      var d = 'M' + (cx) + ',' + (cy - r1) +
        'A' + r1 + ',' + r1 + ' 0 1 1 ' + cx + ',' + (cy + r1) +
        'A' + r1 + ',' + r1 + ' 0 1 1 ' + cx + ',' + (cy - r1);
      if (r0 > 0) {
        d += 'M' + cx + ',' + (cy - r0) +
          'A' + r0 + ',' + r0 + ' 0 1 0 ' + cx + ',' + (cy + r0) +
          'A' + r0 + ',' + r0 + ' 0 1 0 ' + cx + ',' + (cy - r0);
      }
      return d + 'Z';
    }
    var large = a1 - a0 > Math.PI ? 1 : 0;
    var o0 = polar(cx, cy, r1, a0),
      o1 = polar(cx, cy, r1, a1);
    var d2 = 'M' + o0[0].toFixed(3) + ',' + o0[1].toFixed(3) +
      'A' + r1 + ',' + r1 + ' 0 ' + large + ' 1 ' + o1[0].toFixed(3) + ',' + o1[1].toFixed(3);
    if (r0 > 0) {
      var i1 = polar(cx, cy, r0, a1),
        i0 = polar(cx, cy, r0, a0);
      d2 += 'L' + i1[0].toFixed(3) + ',' + i1[1].toFixed(3) +
        'A' + r0 + ',' + r0 + ' 0 ' + large + ' 0 ' + i0[0].toFixed(3) + ',' + i0[1].toFixed(3);
    } else {
      d2 += 'L' + cx + ',' + cy;
    }
    return d2 + 'Z';
  }

  /**
   * Like sectorPath, but the inner and outer arcs each get their own angular
   * span. Needed because a constant-angle inset (sectorPath) corresponds to a
   * shrinking physical gap toward the centre — the same degrees cover far
   * less arc length at r0 than at r1 — so a single shared inset either
   * starves the outer edge or overruns the inner one.
   */
  function sectorPathAsym(cx, cy, r0, r1, a0in, a1in, a0out, a1out) {
    if (r1 <= 0 || a1out - a0out <= 1e-9) return '';
    var large = a1out - a0out > Math.PI ? 1 : 0;
    var o0 = polar(cx, cy, r1, a0out),
      o1 = polar(cx, cy, r1, a1out);
    var d = 'M' + o0[0].toFixed(3) + ',' + o0[1].toFixed(3) +
      'A' + r1 + ',' + r1 + ' 0 ' + large + ' 1 ' + o1[0].toFixed(3) + ',' + o1[1].toFixed(3);
    if (r0 > 0) {
      var largeIn = a1in - a0in > Math.PI ? 1 : 0;
      var i1 = polar(cx, cy, r0, a1in),
        i0 = polar(cx, cy, r0, a0in);
      d += 'L' + i1[0].toFixed(3) + ',' + i1[1].toFixed(3) +
        'A' + r0 + ',' + r0 + ' 0 ' + largeIn + ' 0 ' + i0[0].toFixed(3) + ',' + i0[1].toFixed(3);
    } else {
      d += 'L' + cx + ',' + cy;
    }
    return d + 'Z';
  }

  /**
   * A sector with `cornerRadius` rounding: inset the geometry by cr and give
   * the path a cr-wide round-joined stroke of its own colour. The inner and
   * outer edges are inset by their own local radius (see sectorPathAsym) so
   * the gap between neighbouring sectors stays a constant width from hub to
   * rim instead of pinching shut near the centre.
   */
  function sectorNode(cx, cy, r0, r1, a0, a1, cornerRadius, fill, opacity) {
    var cr = Math.max(0, Math.min(cornerRadius || 0, (r1 - r0) / 2));
    var span = a1 - a0;
    var node;
    if (cr > 0 && span > 1e-9) {
      var outerR = r1 - cr,
        innerR = r0 + cr;
      var angInsetOuter = Math.min(cr / Math.max(outerR, 1), span / 2 - 1e-6);
      var angInsetInner = r0 > 0 ? Math.min(cr / Math.max(innerR, 1), span / 2 - 1e-6) : angInsetOuter;
      if (angInsetOuter > 0) {
        node = svg('path', {
          d: sectorPathAsym(
            cx, cy, innerR, outerR,
            a0 + angInsetInner, a1 - angInsetInner,
            a0 + angInsetOuter, a1 - angInsetOuter
          ),
          fill: fill,
          stroke: fill,
          'stroke-width': cr * 2,
          'stroke-linejoin': 'round',
        });
      }
    }
    if (!node) node = svg('path', { d: sectorPath(cx, cy, r0, r1, a0, a1), fill: fill });
    if (opacity !== undefined) node.setAttribute('opacity', opacity);
    return node;
  }

  /* --- curves ------------------------------------------------------------- */

  function linePath(points) {
    var d = '';
    for (var i = 0; i < points.length; i++) {
      d += (i === 0 ? 'M' : 'L') + points[i][0].toFixed(2) + ',' + points[i][1].toFixed(2);
    }
    return d;
  }

  /** d3 curveMonotoneX, for the enforcement trend. */
  function monotonePath(points) {
    var n = points.length;
    if (n < 3) return linePath(points);
    var dx = [],
      dy = [],
      slope = [];
    for (var i = 0; i < n - 1; i++) {
      dx.push(points[i + 1][0] - points[i][0]);
      dy.push(points[i + 1][1] - points[i][1]);
      slope.push(dx[i] ? dy[i] / dx[i] : 0);
    }
    var tangent = [slope[0]];
    for (var j = 0; j < slope.length - 1; j++) {
      var s0 = slope[j],
        s1 = slope[j + 1];
      if (s0 * s1 <= 0) tangent.push(0);
      else {
        var h0 = dx[j],
          h1 = dx[j + 1],
          h = h0 + h1;
        tangent.push((3 * h) / ((h + h1) / s0 + (h + h0) / s1));
      }
    }
    tangent.push(slope[slope.length - 1]);

    var d = 'M' + points[0][0].toFixed(2) + ',' + points[0][1].toFixed(2);
    for (var k = 0; k < n - 1; k++) {
      var t = dx[k] / 3;
      d += 'C' + (points[k][0] + t).toFixed(2) + ',' + (points[k][1] + tangent[k] * t).toFixed(2) +
        ' ' + (points[k + 1][0] - t).toFixed(2) + ',' + (points[k + 1][1] - tangent[k + 1] * t).toFixed(2) +
        ' ' + points[k + 1][0].toFixed(2) + ',' + points[k + 1][1].toFixed(2);
    }
    return d;
  }

  /* --- number formatting -------------------------------------------------- */

  function fmtOf(spec) {
    if (typeof spec === 'function') return spec;
    if (typeof spec === 'string' && Fmt.by[spec]) return Fmt.by[spec];
    return Fmt.compact;
  }

  /* ================================================================== FRAME */

  /* One observer for every chart on the board, so a resize frame batches them
     all. RO fires after layout and before paint, so rendering synchronously in
     the callback puts the chart on screen in the SAME frame as its container --
     the point of SyncParentSize's flushSync. rAF or a debounce would trail by
     a frame or two, which is exactly the lag that makes a resized panel look
     like it is catching up with the pointer. */
  var observed = new Map();
  var observer = null;

  function deliver(entries) {
    refreshUnit();
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var rec = observed.get(entry.target);
      if (!rec) continue;
      var box = entry.contentRect;
      var w = Math.round(box.width);
      var h = Math.round(box.height);
      if (rec.w === w && rec.h === h) continue;
      rec.w = w;
      rec.h = h;
      if (w > 0 && h > 0) rec.draw(w, h, false);
    }
  }

  function observe(el, draw) {
    if (!observer) observer = new ResizeObserver(deliver);
    observed.set(el, { draw: draw, w: 0, h: 0 });
    observer.observe(el);
  }

  function unobserve(el) {
    observed.delete(el);
    if (observer) observer.unobserve(el);
  }

  /** ChartLegend from shared/legend.tsx: a dot and a label per series. */
  function legendNode(items, position) {
    var wrap = html('div', 'ax-legend ax-legend--' + (position || 'bottom'));
    for (var i = 0; i < items.length; i++) {
      var row = html('div', 'ax-legend-item');
      var dot = svg('svg', { width: 10, height: 10, viewBox: '0 0 10 10', class: 'ax-legend-dot' });
      dot.appendChild(svg('circle', { cx: 5, cy: 5, r: 4.5, fill: items[i].color }));
      row.appendChild(dot);
      var label = html('span', 'ax-legend-label', items[i].label);
      if (items[i].rtl) label.setAttribute('dir', 'rtl');
      row.appendChild(label);
      if (items[i].value !== undefined) {
        row.appendChild(html('span', 'ax-legend-value ax-num', items[i].value));
      }
      wrap.appendChild(row);
    }
    return wrap;
  }

  /**
   * ChartFrame: an optional legend plus a plot area that fills what is left.
   * `render(width, height, animate)` is called on mount and on every resize.
   */
  function frame(host, opts, render) {
    host.innerHTML = '';
    var position = opts.legendPosition || 'bottom';
    var sideways = position === 'left' || position === 'right';
    /* Outer shell is always a column: the note is a caption under the whole
       chart, so it must not become a third column when the legend sits beside
       the plot. (It did, and it squeezed the plot to nothing.) */
    var shell = html('div', 'ax-chart-shell');
    var root = html('div', 'ax-chart' + (sideways ? ' ax-chart--h' : '') + ' ax-chart--' + position);

    var legend = opts.legend && opts.legend.length ? legendNode(opts.legend, position) : null;
    var area = html('div', 'ax-chart-area');

    if (legend && (position === 'top' || position === 'left')) root.appendChild(legend);
    root.appendChild(area);
    if (legend && (position === 'bottom' || position === 'right')) root.appendChild(legend);

    shell.appendChild(root);
    if (opts.note) shell.appendChild(html('div', 'ax-chart-note', opts.note));
    host.appendChild(shell);

    var canvas = null;

    function draw(w, h, animate) {
      if (canvas) canvas.remove();
      canvas = render(w, h, animate);
      if (!canvas) return;
      area.appendChild(canvas);
      /* A resize rebuilds the SVG, so any counted text inside it is back at
         zero. Only a first render animates; a redraw lands on the value. */
      if (!animate) Counter.settle(canvas);
    }

    observe(area, draw);
    /* First paint: the observer's own first delivery lands before paint, but
       drawing here too means the chart is never one frame blank. */
    var box = area.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      var rec = observed.get(area);
      rec.w = Math.round(box.width);
      rec.h = Math.round(box.height);
      draw(rec.w, rec.h, true);
    }
    return { area: area, redraw: draw };
  }

  /* ============================================================== CARTESIAN */

  /**
   * CartesianChart. `series[].type` is 'bar' | 'line' | 'area'; bars share a
   * band scale whose padding is solved for a 16px inter-group gap the way
   * shared/layout.ts solves it, so the gaps stay constant as the panel resizes
   * instead of scaling with it.
   */
  function cartesian(host, spec) {
    var rtl = I18N.isRtl();
    var chartId = 'c' + ++idSeq;
    var series = spec.series || [];
    var colors = spec.colors || COLORS;
    var resolved = series.map(function (s, i) {
      return s.color || colors[i % colors.length];
    });
    var horizontal = !!spec.horizontal;
    var stacked = spec.stack === 'bar' || spec.stack === true;
    var showGrid = spec.showGrid !== false;
    var gridDirection = spec.gridDirection || 'rows';

    var bars = [],
      lines = [],
      areas = [];
    series.forEach(function (s, i) {
      var entry = { def: s, color: resolved[i], index: i };
      if (s.type === 'line') lines.push(entry);
      else if (s.type === 'area') areas.push(entry);
      else bars.push(entry);
    });

    var categories = spec.xAxis && spec.xAxis.domain
      ? spec.xAxis.domain
      : (series[0] ? series[0].data.map(function (d) { return d.x; }) : []);

    var valueFmt = fmtOf(spec.yAxis && spec.yAxis.tickFormat);
    var categoryFmt = spec.xAxis && spec.xAxis.tickFormat ? fmtOf(spec.xAxis.tickFormat) : String;

    var legend = spec.showLegend === false || series.length < 2
      ? null
      : series.map(function (s, i) {
          return { label: s.label || s.key, color: resolved[i] };
        });

    /* Value extent across every series, so bars and lines share one scale. */
    var lo = 0,
      hi = 0;
    if (stacked) {
      for (var ci = 0; ci < categories.length; ci++) {
        var stackTotal = 0;
        for (var si = 0; si < bars.length; si++) {
          var pt = bars[si].def.data[ci];
          if (pt && isFinite(pt.y)) stackTotal += pt.y;
        }
        if (stackTotal > hi) hi = stackTotal;
      }
      lines.concat(areas).forEach(function (s) {
        s.def.data.forEach(function (d) {
          if (isFinite(d.y) && d.y > hi) hi = d.y;
        });
      });
    } else {
      series.forEach(function (s) {
        s.data.forEach(function (d) {
          if (!isFinite(d.y)) return;
          if (d.y > hi) hi = d.y;
          if (d.y < lo) lo = d.y;
        });
      });
    }
    var domain = spec.yAxis && spec.yAxis.domain
      ? spec.yAxis.domain
      : niceDomain(lo, hi, (spec.yAxis && spec.yAxis.numTicks) || 5);

    return frame(host, { legend: legend, legendPosition: spec.legendPosition, note: spec.note }, function (width, height, animate) {
      var font = m(C.AXIS_FONT);
      /* computeYAxisLayout: grow the value-axis margin to the widest tick. */
      var valueTicks = linearScale(domain, [0, 1]).ticks((spec.yAxis && spec.yAxis.numTicks) || 5);
      var widestValue = 0;
      for (var t = 0; t < valueTicks.length; t++) {
        widestValue = Math.max(widestValue, measureText(valueFmt(valueTicks[t]), font));
      }
      var widestCategory = 0;
      if (horizontal) {
        for (var c = 0; c < categories.length; c++) {
          widestCategory = Math.max(widestCategory, measureText(categoryFmt(categories[c]), font));
        }
        widestCategory = Math.min(widestCategory, m(120));
      }

      var sideWidth = Math.ceil(m(C.TICK_LENGTH) + (horizontal ? widestCategory : widestValue) + m(4));
      var margin = {
        top: capMargin(width, height, MARGIN.cartesian.top),
        right: capMargin(width, height, MARGIN.cartesian.right),
        /* The bottom margin carries the category axis labels, so it is a line
           of type plus the tick gap rather than a fraction of the box. */
        bottom: Math.min(m(MARGIN.cartesian.bottom), font * 2.4),
        left: m(MARGIN.cartesian.left),
      };
      /* Category labels sit on the reading-start side, as axisSideFor does. */
      if (rtl) margin.right = Math.max(margin.right, sideWidth);
      else margin.left = Math.max(margin.left, sideWidth);
      if (horizontal) {
        /* Bars grow rightward in the LTR-pinned frame regardless of locale, so
           a positive value label always lands at the RIGHT plot edge. In RTL
           that same edge carries the category axis, so the reserve is added on
           top of the axis margin there rather than folded in with max() —
           otherwise the label sits on the category name. Straight from
           CartesianChart.tsx. */
        var reserve = m(C.H_VALUE_RESERVE);
        if (rtl) {
          margin.right += reserve;
          margin.left = Math.max(margin.left, reserve);
        } else {
          margin.right = Math.max(margin.right, reserve);
        }
      }
      if (spec.margin) {
        for (var key in spec.margin) if (spec.margin.hasOwnProperty(key)) margin[key] = m(spec.margin[key]);
      }

      var innerW = Math.max(0, width - margin.left - margin.right);
      var innerH = Math.max(0, height - margin.top - margin.bottom);
      var root = svg('svg', { width: width, height: height, class: 'ax-svg' });
      if (!innerW || !innerH) return root;

      root.appendChild(gradientDefs(chartId, resolved, horizontal));
      var plot = svg('g', { transform: 'translate(' + margin.left + ',' + margin.top + ')' });
      root.appendChild(plot);

      /* Band padding solved for a constant visual gap (shared/layout.ts). */
      var bandExtent = horizontal ? innerH : innerW;
      var grouped = !stacked && bars.length > 1;
      var targetGap = m(C.GROUP_GAP) - (grouped ? 2 * m(C.BAR_GAP) : 0);
      var outerPadding = bars.length
        ? computeOuterPadding(bandExtent, categories.length, targetGap)
        : (spec.xAxis && spec.xAxis.padding) || 0;

      var band = bandScale(categories, [0, bandExtent], outerPadding);
      var value = linearScale(domain, horizontal ? [0, innerW] : [innerH, 0]);
      var zero = value.scale(0);

      var innerPadding = 0;
      var subBand = null;
      if (grouped) {
        innerPadding = computeInnerPadding(band.bandwidth, bars.length, m(C.BAR_GAP));
        subBand = bandScale(
          bars.map(function (b) { return b.def.key; }),
          [0, band.bandwidth],
          innerPadding
        );
      }

      /* --- grid (visx Grid, numTicks 5) --- */
      if (showGrid) {
        var gridG = svg('g', { class: 'ax-grid' });
        var rows = gridDirection === 'rows' || gridDirection === 'both';
        var cols = gridDirection === 'columns' || gridDirection === 'both';
        var vTicks = value.ticks(5);
        for (var g = 0; g < vTicks.length; g++) {
          var vp = value.scale(vTicks[g]);
          if (horizontal ? cols : rows) {
            gridG.appendChild(
              horizontal
                ? svg('line', { x1: vp, y1: 0, x2: vp, y2: innerH })
                : svg('line', { x1: 0, y1: vp, x2: innerW, y2: vp })
            );
          }
        }
        plot.appendChild(gridG);
      }

      /* --- bars (shared/GradientBars.tsx) ---
         Bodies and stripes live in a group that grows from the zero line on a
         first render; the value labels ride in a second group that fades, so a
         growing bar never squashes its own number. */
      var barsG = svg('g', { class: 'ax-mark' + (animate ? ' is-entering' : '') });
      barsG.style.transformOrigin = horizontal ? '0px 0px' : '0px ' + innerH + 'px';
      barsG.style.setProperty('--ax-grow', horizontal ? 'scale(0.001, 1)' : 'scale(1, 0.001)');
      plot.appendChild(barsG);
      var labelsG = svg('g', { class: 'ax-mark-label' + (animate ? ' is-entering' : '') });
      plot.appendChild(labelsG);

      var radius = m(spec.barRadius === undefined ? 3 : spec.barRadius);
      var stripe = m(C.TOP_STRIPE);
      var labelFont = m(C.LABEL_FONT);
      var labelGap = m(C.LABEL_GAP);
      var showLabels = spec.barValueLabels !== false;
      var slotThickness = grouped ? subBand.bandwidth : band.bandwidth;
      var labelsAllowed =
        showLabels &&
        !stacked &&
        (horizontal ? slotThickness >= labelFont : slotThickness >= m(C.LABEL_MIN_BAR_WIDTH));

      for (var bi = 0; bi < bars.length; bi++) {
        var entry = bars[bi];
        for (var di = 0; di < categories.length; di++) {
          var datum = entry.def.data[di];
          if (!datum || !isFinite(datum.y)) continue;
          var color = datum.color || entry.color;

          var along = band.scale(categories[di]);
          if (along === undefined) continue;
          var thickness = band.bandwidth;
          if (grouped) {
            along += subBand.scale(entry.def.key);
            thickness = subBand.bandwidth;
          }

          /* Stacked segments start where the previous series ended. */
          var base = 0;
          if (stacked) {
            for (var pb = 0; pb < bi; pb++) {
              var prev = bars[pb].def.data[di];
              if (prev && isFinite(prev.y)) base += prev.y;
            }
          }
          var v0 = value.scale(base);
          var v1 = value.scale(base + datum.y);

          var x, y, w, h;
          if (horizontal) {
            x = Math.min(v0, v1);
            w = Math.abs(v1 - v0);
            y = along;
            h = thickness;
          } else {
            x = along;
            w = thickness;
            y = Math.min(v0, v1);
            h = Math.abs(v1 - v0);
          }
          if (w <= 0 || h <= 0) continue;

          /* The outermost segment of a stack carries the rounded end and the
             accent stripe; inner segments are flat and translucent. */
          var isOuter = !stacked || bi === bars.length - 1;
          var corners = horizontal
            ? { tl: false, bl: false, tr: isOuter, br: isOuter }
            : { tl: isOuter, tr: isOuter, bl: false, br: false };

          var body = svg('path', {
            d: roundedRect(x, y, w, h, radius, corners),
            fill: stacked && !isOuter ? color : gradientUrl(chartId, color),
            'fill-opacity': stacked && !isOuter ? C.STACK_FILL_OPACITY : undefined,
          });
          barsG.appendChild(body);

          var barLabel = categoryFmt(categories[di]);
          if (bars.length > 1) barLabel += ' · ' + (entry.def.label || entry.def.key);
          var barValueText = (spec.barValueFormat ? fmtOf(spec.barValueFormat) : valueFmt)(datum.y);
          tip(body, barLabel, barValueText, null, color);

          /* A bar thinner than a comfortable fingertip (~28px) still gets a
             fingertip-sized hit target: an invisible rect centred on the
             same slot, padded out only in the THIN axis so it does not creep
             into a neighbouring bar's own territory along the band. */
          var thinAxis = horizontal ? h : w;
          if (thinAxis < 28) {
            var padded =
              thinAxis === h
                ? { x: x, y: y - (28 - h) / 2, w: w, h: 28 }
                : { x: x - (28 - w) / 2, y: y, w: 28, h: h };
            barsG.appendChild(
              tip(
                svg('rect', {
                  x: padded.x,
                  y: padded.y,
                  width: padded.w,
                  height: padded.h,
                  fill: 'transparent',
                  style: 'pointer-events:all',
                }),
                barLabel,
                barValueText,
                null,
                color
              )
            );
          }

          if (isOuter) {
            var sw = Math.min(stripe, horizontal ? w : h);
            barsG.appendChild(
              tip(
                svg('rect', {
                  x: horizontal ? x + w - sw : x,
                  y: horizontal ? y : y,
                  width: horizontal ? sw : w,
                  height: horizontal ? h : sw,
                  fill: color,
                }),
                barLabel,
                barValueText,
                null,
                color
              )
            );
          }

          if (labelsAllowed) {
            var labelText = (spec.barValueFormat ? fmtOf(spec.barValueFormat) : valueFmt)(datum.y);
            if (horizontal) {
              labelsG.appendChild(
                text({
                  x: x + w + labelGap,
                  y: y + h / 2,
                  align: 'start',
                  logical: false,
                  value: labelText,
                  size: labelFont,
                  fill: color,
                  kind: 'numeric',
                  baseline: 'central',
                })
              );
            } else {
              labelsG.appendChild(
                text({
                  x: x + w / 2,
                  y: y - labelGap,
                  align: 'middle',
                  value: labelText,
                  size: labelFont,
                  fill: color,
                  kind: 'numeric',
                  baseline: 'alphabetic',
                })
              );
            }
          }
        }
      }

      /* --- areas and lines --- */
      function pointsOf(entry) {
        var pts = [];
        for (var i = 0; i < entry.def.data.length; i++) {
          var d = entry.def.data[i];
          if (!isFinite(d.y)) continue;
          var along = band.type === 'band' ? band.center(d.x) : undefined;
          if (along === undefined) {
            /* A point/linear category axis: spread evenly, as scalePoint does. */
            along = categories.length > 1 ? (i / (categories.length - 1)) * bandExtent : bandExtent / 2;
          }
          var pt = horizontal ? [value.scale(d.y), along] : [along, value.scale(d.y)];
          /* Riding along on the same array `linePath`/`monotonePath` index
             into by [0]/[1] -- the tooltip hit-circles below read these back
             without a second pass over `entry.def.data`. */
          pt.category = d.x;
          pt.value = d.y;
          pts.push(pt);
        }
        return pts;
      }

      areas.concat(lines).forEach(function (entry) {
        var pts = pointsOf(entry);
        if (pts.length < 2) return;
        var curve = entry.def.curve === 'monotoneX' ? monotonePath : linePath;
        var d = curve(pts);
        if (entry.def.type === 'area') {
          var closed = d + 'L' + pts[pts.length - 1][0].toFixed(2) + ',' + zero.toFixed(2) +
            'L' + pts[0][0].toFixed(2) + ',' + zero.toFixed(2) + 'Z';
          plot.appendChild(
            svg('path', { d: closed, fill: gradientUrl(chartId, entry.color), stroke: 'none' })
          );
        }
        plot.appendChild(
          svg('path', {
            d: d,
            fill: 'none',
            stroke: entry.color,
            'stroke-width': m(entry.def.strokeWidth || 2),
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
            'stroke-dasharray': entry.def.strokeDasharray,
          })
        );
        /* Draw-on: pathLength=1 makes the dash pattern resolution-independent,
           so the line can be revealed without measuring it. */
        if (animate && !entry.def.strokeDasharray) {
          var stroke = plot.lastChild;
          stroke.setAttribute('pathLength', 1);
          stroke.setAttribute('stroke-dasharray', '1 1');
          stroke.setAttribute('class', 'ax-line is-entering');
        }
        if (entry.def.showDots) {
          for (var p = 0; p < pts.length; p++) {
            plot.appendChild(
              svg('circle', { cx: pts[p][0], cy: pts[p][1], r: m(3.5), fill: entry.color })
            );
          }
        }

        /* A line/area has no bar body to hover -- without this, the series
           would be the one mark on the whole board a pointer can see but
           not query. One invisible, fingertip-sized hit circle per data
           point, on top of the stroke rather than dot-sized, so hovering
           anywhere near the line (not just exactly on a visible dot) reads
           the nearest point's value. */
        var lineLabel = series.length > 1 ? ' · ' + (entry.def.label || entry.def.key) : '';
        for (var hp = 0; hp < pts.length; hp++) {
          plot.appendChild(
            tip(
              svg('circle', {
                cx: pts[hp][0],
                cy: pts[hp][1],
                r: 14,
                fill: 'transparent',
                style: 'pointer-events:all',
              }),
              categoryFmt(pts[hp].category) + lineLabel,
              valueFmt(pts[hp].value),
              null,
              entry.color
            )
          );
        }
      });

      /* --- axes (visx Axis: hairline value line, no tick marks) --- */
      var axisG = svg('g', { class: 'ax-axis' });
      plot.appendChild(axisG);

      /* Category axis. Vertical bars put it along the bottom; horizontal bars
         put it on the reading-start side. */
      if (horizontal) {
        var step = band.step;
        var everyK = step >= font * 1.35 ? 1 : Math.ceil((font * 1.35) / Math.max(step, 1));
        for (var ci2 = 0; ci2 < categories.length; ci2 += everyK) {
          var cy2 = band.center(categories[ci2]);
          axisG.appendChild(
            text({
              x: rtl ? innerW + m(C.TICK_LENGTH) + m(4) : -m(C.TICK_LENGTH) - m(4),
              y: cy2,
              align: 'end',
              rtl: rtl,
              value: truncate(categoryFmt(categories[ci2]), widestCategory, font),
              size: font,
              fill: 'var(--chart-tick)',
              baseline: 'central',
            })
          );
        }
      } else {
        axisG.appendChild(
          svg('line', { x1: 0, y1: innerH, x2: innerW, y2: innerH, class: 'ax-axis-line' })
        );
        /* Thin category labels to the band step, budgeting label width per
           step the way bandTickProps does rather than counting ticks. */
        var stepX = band.step;
        var labelBudget = Math.max(stepX - m(4), m(12));
        var strideX = 1;
        var widest = 0;
        for (var w2 = 0; w2 < categories.length; w2++) {
          widest = Math.max(widest, measureText(categoryFmt(categories[w2]), font));
        }
        if (widest > labelBudget) strideX = Math.ceil(Math.min(widest, m(72)) / Math.max(stepX, 1));
        for (var ci3 = 0; ci3 < categories.length; ci3 += strideX) {
          axisG.appendChild(
            text({
              x: band.center(categories[ci3]),
              y: innerH + font + m(10),
              align: 'middle',
              rtl: rtl,
              value: truncate(categoryFmt(categories[ci3]), Math.max(labelBudget, m(28)) * strideX, font),
              size: font,
              fill: 'var(--chart-tick)',
              baseline: 'alphabetic',
            })
          );
        }
      }

      /* Value axis: ticks only, no axis line (visx hideAxisLine). */
      var vAxis = value.ticks(5);
      for (var vi = 0; vi < vAxis.length; vi++) {
        var vpos = value.scale(vAxis[vi]);
        if (horizontal) {
          axisG.appendChild(
            text({
              x: vpos,
              y: innerH + font + m(10),
              align: 'middle',
              value: valueFmt(vAxis[vi]),
              size: font,
              fill: 'var(--chart-tick)',
              kind: 'numeric',
              baseline: 'alphabetic',
            })
          );
        } else {
          axisG.appendChild(
            text({
              x: rtl ? innerW + m(C.TICK_LENGTH) + m(4) : -m(C.TICK_LENGTH) - m(4),
              y: vpos,
              align: 'end',
              rtl: rtl,
              value: valueFmt(vAxis[vi]),
              size: font,
              fill: 'var(--chart-tick)',
              kind: 'numeric',
              baseline: 'central',
            })
          );
        }
      }

      return root;
    });
  }

  /* ==================================================================== PIE */

  /** PieChart: a donut with optional leader-line annotations. */
  function pie(host, spec) {
    var data = spec.data || [];
    var colors = spec.colors || COLORS;
    var resolved = data.map(function (d, i) {
      return d.color || colors[i % colors.length];
    });
    var total = sum(data, function (d) { return d.value; });
    var valueFmt = fmtOf(spec.valueFormat || 'compact');

    var legend =
      spec.showLegend === false
        ? null
        : data.map(function (d, i) {
            return {
              label: Labels.t(d.label),
              color: resolved[i],
              rtl: Labels.isArabic(d.label),
              value: spec.legendValues === false ? undefined : valueFmt(d.value),
            };
          });

    return frame(
      host,
      { legend: legend, legendPosition: spec.legendPosition || 'right', note: spec.note },
      function (width, height, animate) {
        var font = m(C.AXIS_FONT);
        var pad = capMargin(width, height, MARGIN.pie.top);
        var margin = { top: pad, right: pad, bottom: pad, left: pad };
        var showAnnotations = !!spec.showAnnotations;
        var reserveH = showAnnotations
          ? m(C.LABEL_OFFSET + C.ANNOTATION_GAP + C.ANNOTATION_TEXT_BUDGET)
          : 0;
        var reserveV = showAnnotations ? m(C.LEADER_RADIAL) + font : 0;
        var outer = computePieRadius(width, height, margin, reserveH, reserveV);
        var root = svg('svg', { width: width, height: height, class: 'ax-svg' });
        if (outer <= 0) return root;

        var inner = spec.donut === false ? 0 : outer * (spec.innerRadiusFraction || 0.55);
        var pad = ((spec.gap || 0) * Math.PI) / 180;
        var cx = width / 2;
        var cy = height / 2;
        var g = svg('g', { class: 'ax-mark-radial' + (animate ? ' is-entering' : '') });
        g.style.transformOrigin = cx + 'px ' + cy + 'px';
        root.appendChild(g);

        var angle = 0;
        for (var i = 0; i < data.length; i++) {
          var share = total ? data[i].value / total : 0;
          var span = share * 2 * Math.PI;
          var a0 = angle + pad / 2;
          var a1 = angle + span - pad / 2;
          angle += span;
          if (a1 <= a0) continue;

          g.appendChild(
            tip(
              sectorNode(cx, cy, inner, outer, a0, a1, m(spec.cornerRadius || 0), resolved[i]),
              Labels.t(data[i].label),
              valueFmt(data[i].value),
              (share * 100).toFixed(share < 0.1 ? 1 : 0) + '%',
              resolved[i]
            )
          );

          if (showAnnotations && share > 0.02) {
            var mid = (a0 + a1) / 2;
            var sin = Math.sin(mid);
            var onRight = sin >= 0;
            var p1 = polar(cx, cy, outer, mid);
            var p2 = polar(cx, cy, outer + m(C.LEADER_RADIAL), mid);
            var labelX = cx + (outer + m(C.LABEL_OFFSET)) * (onRight ? 1 : -1);
            g.appendChild(
              svg('polyline', {
                points:
                  p1[0].toFixed(1) + ',' + p1[1].toFixed(1) + ' ' +
                  p2[0].toFixed(1) + ',' + p2[1].toFixed(1) + ' ' +
                  labelX.toFixed(1) + ',' + p2[1].toFixed(1),
                fill: 'none',
                stroke: resolved[i],
                'stroke-width': 1,
              })
            );
            var avail = onRight
              ? Math.max(0, width - margin.right - labelX - m(C.ANNOTATION_GAP))
              : Math.max(0, labelX - m(C.ANNOTATION_GAP) - margin.left);
            g.appendChild(
              text({
                x: labelX + (onRight ? m(C.ANNOTATION_GAP) : -m(C.ANNOTATION_GAP)),
                y: p2[1],
                align: onRight ? 'start' : 'end',
                logical: false,
                value: truncate(Labels.t(data[i].label), avail, font),
                size: font,
                fill: 'var(--chart-label)',
                baseline: 'middle',
              })
            );
          }
        }

        /* Centre readout. Axion has no donut label; this board does, because a
           ring with the total in the hole is what the SCE prototypes showed. */
        if (spec.centerLabel && inner > 0) {
          var value = spec.centerValue === undefined ? total : spec.centerValue;
          /* The readout has to fit the hole, not just the ring: size the value
             off the hole's chord and drop the caption when it would spill over
             the arc (which is what made "REGISTERED WITH SCE" run off it). */
          var chord = inner * 1.62;
          var formatted = fmtOf(spec.centerFormat || 'compact')(value);
          var big = Math.min(m(44), inner * 0.72, (chord / Math.max(formatted.length, 3)) * 1.7);
          var capSize = Math.min(big * 0.36, m(13));
          var capFits = measureText(spec.centerLabel, capSize) <= chord;
          var vNode = text({
            x: cx,
            y: cy - big * 0.06,
            align: 'middle',
            value: '0',
            size: big,
            weight: 400,
            fill: 'var(--chart-value)',
            kind: 'numeric',
            baseline: 'middle',
            className: 'ax-num',
          });
          vNode.setAttribute('data-count', value);
          vNode.setAttribute('data-count-format', spec.centerFormat || 'compact');
          if (capFits) vNode.setAttribute('y', cy - capSize * 0.7);
          g.appendChild(vNode);
          if (capFits) {
            g.appendChild(
              text({
                x: cx,
                y: cy + big * 0.52,
                align: 'middle',
                value: spec.centerLabel,
                size: capSize,
                fill: 'var(--chart-tick)',
                baseline: 'middle',
              })
            );
          }
        }
        return root;
      }
    );
  }

  /* ================================================================== RADAR */

  function radar(host, spec) {
    /* No direction handling: a radar has no reading-order axis, and its labels
       are anchored physically by the sign of sin(angle). */
    var data = spec.data || [];
    var series = spec.series || [];
    var colors = spec.colors || COLORS;
    var resolved = series.map(function (s, i) {
      return s.color || colors[i % colors.length];
    });
    var levels = spec.levels || 4;
    var legend =
      spec.showLegend === false
        ? null
        : series.map(function (s, i) {
            return { label: s.label || s.key, color: resolved[i] };
          });

    var globalMax = 1;
    data.forEach(function (row) {
      series.forEach(function (s) {
        var v = row[s.key];
        if (isFinite(v) && v > globalMax) globalMax = v;
      });
    });

    return frame(
      host,
      { legend: legend, legendPosition: spec.legendPosition || 'bottom', note: spec.note },
      function (width, height, animate) {
        var font = m(C.AXIS_FONT);
        /* The radar's margin holds its axis labels, so it is measured from
           them rather than fixed: the widest label sets the horizontal
           reserve (capped, or a long metric name would leave no radar), one
           line of type sets the vertical one. Axion's fixed 40 is the floor
           it starts from. */
        var widestLabel = 0;
        for (var li = 0; li < data.length; li++) {
          widestLabel = Math.max(widestLabel, measureText(data[li].metric, font));
        }
        var labelGap = m(C.RADAR_LABEL_GAP);
        var base = Math.min(m(MARGIN.radar.top), Math.min(width, height) * 0.14);
        var marginX = Math.min(Math.max(base, widestLabel + labelGap), width * 0.24);
        var marginY = Math.max(base, font * 1.8);
        var radius = Math.max(
          0,
          Math.min((width - marginX * 2) / 2, (height - marginY * 2) / 2)
        );
        /* Whatever the reserve could not cover, the label gives up with an
           ellipsis rather than running off the panel. */
        var labelBudget = Math.max(width / 2 - radius - labelGap, m(24));
        var root = svg('svg', { width: width, height: height, class: 'ax-svg' });
        if (radius <= 0 || data.length < 3) return root;

        var domain = spec.radiusDomain || niceDomain(0, globalMax, levels);
        var rScale = linearScale(domain, [0, radius]);
        var cx = width / 2;
        var cy = height / 2;
        var N = data.length;
        var g = svg('g', { class: 'ax-mark-radial' + (animate ? ' is-entering' : '') });
        g.style.transformOrigin = cx + 'px ' + cy + 'px';
        root.appendChild(g);

        function point(i, r) {
          var a = (i / N) * 2 * Math.PI;
          return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
        }

        if (spec.showGrid !== false) {
          var grid = svg('g', { class: 'ax-grid' });
          for (var l = 1; l <= levels; l++) {
            var rr = (radius * l) / levels;
            var ring = [];
            for (var k = 0; k < N; k++) ring.push(point(k, rr));
            grid.appendChild(svg('path', { d: linePath(ring) + 'Z', fill: 'none' }));
          }
          for (var s2 = 0; s2 < N; s2++) {
            var tip = point(s2, radius);
            grid.appendChild(svg('line', { x1: cx, y1: cy, x2: tip[0], y2: tip[1] }));
          }
          g.appendChild(grid);
        }

        for (var si = 0; si < series.length; si++) {
          var pts = [];
          for (var mi = 0; mi < N; mi++) {
            var v = data[mi][series[si].key];
            pts.push(point(mi, rScale.scale(isFinite(v) ? v : 0)));
          }
          g.appendChild(
            svg('path', {
              d: linePath(pts) + 'Z',
              fill: resolved[si],
              'fill-opacity': spec.fillOpacity === undefined ? 0.36 : spec.fillOpacity,
              stroke: resolved[si],
              'stroke-width': m(2),
              'stroke-linejoin': 'round',
            })
          );
          for (var dp = 0; dp < pts.length; dp++) {
            g.appendChild(
              svg('circle', { cx: pts[dp][0], cy: pts[dp][1], r: m(C.RADAR_DOT), fill: resolved[si] })
            );
          }
        }

        if (spec.showAxisLabels !== false) {
          for (var ai = 0; ai < N; ai++) {
            var a2 = (ai / N) * 2 * Math.PI;
            var pos = point(ai, radius + m(C.RADAR_LABEL_GAP));
            var sinA = Math.sin(a2);
            var align = Math.abs(sinA) < 0.1 ? 'middle' : sinA > 0 ? 'start' : 'end';
            g.appendChild(
              text({
                x: pos[0],
                y: pos[1],
                align: align,
                logical: false,
                value:
                  align === 'middle'
                    ? data[ai].metric
                    : truncate(data[ai].metric, labelBudget, font),
                size: font,
                fill: 'var(--chart-tick)',
                baseline: 'middle',
              })
            );
          }
        }
        return root;
      }
    );
  }

  /* ================================================================= SANKEY */

  /**
   * SankeyChart. Nodes declare their own `layer`, which is all this board's
   * graphs need (class -> status is two columns), so the layout is the
   * deterministic part of d3-sankey without the relaxation pass: stack each
   * column by value, then stack each node's links by the opposite endpoint's
   * position so ribbons cross as little as possible.
   */
  function sankey(host, spec) {
    var rtl = I18N.isRtl();
    var nodes = (spec.nodes || []).map(function (n, i) {
      return { index: i, label: n.label, color: n.color, layer: n.layer || 0 };
    });
    var links = (spec.links || []).map(function (l, i) {
      return { index: i, source: l.source, target: l.target, value: l.value, color: l.color };
    });
    var valueFmt = fmtOf(spec.valueFormat || 'compact');
    var legend = spec.legendItems && spec.legendItems.length ? spec.legendItems : null;

    return frame(
      host,
      { legend: legend, legendPosition: spec.legendPosition || 'bottom', note: spec.note },
      function (width, height, animate) {
        var font = m(C.AXIS_FONT);
        var margin = m(MARGIN.sankey.top);
        var nodeWidth = m(C.NODE_WIDTH);
        var nodePadding = m(C.NODE_PADDING);

        /* Labels sit outside the node columns, so reserve their width. */
        var labelSpace = 0;
        if (spec.showLabels !== false) {
          for (var i = 0; i < nodes.length; i++) {
            labelSpace = Math.max(labelSpace, measureText(nodes[i].label, font) + m(8));
          }
          labelSpace = Math.min(labelSpace, width * 0.22);
        }

        var left = margin + labelSpace;
        var right = width - margin - labelSpace;
        var innerW = Math.max(0, right - left);
        var innerH = Math.max(0, height - margin * 2);
        var root = svg('svg', { width: width, height: height, class: 'ax-svg' });
        if (!innerW || !innerH || !nodes.length) return root;

        /* Node totals. */
        var layers = {};
        nodes.forEach(function (n) {
          n.inValue = 0;
          n.outValue = 0;
          (layers[n.layer] = layers[n.layer] || []).push(n);
        });
        links.forEach(function (l) {
          nodes[l.source].outValue += l.value;
          nodes[l.target].inValue += l.value;
        });
        nodes.forEach(function (n) {
          n.value = Math.max(n.inValue, n.outValue);
        });

        var layerKeys = Object.keys(layers).map(Number).sort(function (a, b) { return a - b; });
        var columns = layerKeys.length;

        /* One value->pixel factor for every column, so a ribbon keeps its
           thickness end to end. */
        var ky = Infinity;
        layerKeys.forEach(function (key) {
          var col = layers[key];
          var totalValue = sum(col, function (n) { return n.value; });
          var free = innerH - (col.length - 1) * nodePadding;
          if (totalValue > 0) ky = Math.min(ky, free / totalValue);
        });
        if (!isFinite(ky) || ky <= 0) return root;

        var columnStep = columns > 1 ? (innerW - nodeWidth) / (columns - 1) : 0;
        layerKeys.forEach(function (key, ci) {
          var col = layers[key];
          var used = sum(col, function (n) { return n.value * ky; }) + (col.length - 1) * nodePadding;
          var y = margin + (innerH - used) / 2;
          col.forEach(function (n) {
            n.x0 = rtl ? right - nodeWidth - ci * columnStep : left + ci * columnStep;
            n.x1 = n.x0 + nodeWidth;
            n.y0 = y;
            n.y1 = y + n.value * ky;
            y = n.y1 + nodePadding;
          });
        });

        /* Stack links at both ends, ordered by the opposite endpoint. */
        nodes.forEach(function (n) {
          n.outLinks = [];
          n.inLinks = [];
        });
        links.forEach(function (l) {
          l.width = l.value * ky;
          nodes[l.source].outLinks.push(l);
          nodes[l.target].inLinks.push(l);
        });
        nodes.forEach(function (n) {
          n.outLinks.sort(function (a, b) { return nodes[a.target].y0 - nodes[b.target].y0; });
          n.inLinks.sort(function (a, b) { return nodes[a.source].y0 - nodes[b.source].y0; });
          var oy = n.y0;
          n.outLinks.forEach(function (l) {
            l.sy = oy + l.width / 2;
            oy += l.width;
          });
          var iy = n.y0;
          n.inLinks.forEach(function (l) {
            l.ty = iy + l.width / 2;
            iy += l.width;
          });
        });

        var linkG = svg('g', { class: 'ax-sankey-links' + (animate ? ' is-entering' : '') });
        root.appendChild(linkG);
        links.forEach(function (l) {
          var s = nodes[l.source];
          var t = nodes[l.target];
          var x0 = rtl ? s.x0 : s.x1;
          var x1 = rtl ? t.x1 : t.x0;
          var mx = (x0 + x1) / 2;
          linkG.appendChild(
            svg('path', {
              d: 'M' + x0.toFixed(1) + ',' + l.sy.toFixed(1) +
                'C' + mx.toFixed(1) + ',' + l.sy.toFixed(1) +
                ' ' + mx.toFixed(1) + ',' + l.ty.toFixed(1) +
                ' ' + x1.toFixed(1) + ',' + l.ty.toFixed(1),
              fill: 'none',
              stroke: l.color || nodes[l.source].color,
              'stroke-width': Math.max(1, l.width),
              'stroke-opacity': spec.linkOpacity === undefined ? 0.4 : spec.linkOpacity,
            })
          );
        });

        var nodeG = svg('g', { class: 'ax-sankey-nodes' });
        root.appendChild(nodeG);
        nodes.forEach(function (n) {
          var h = Math.max(1, n.y1 - n.y0);
          nodeG.appendChild(
            svg('path', {
              d: roundedRect(n.x0, n.y0, nodeWidth, h, m(3), { tl: 1, tr: 1, bl: 1, br: 1 }),
              fill: n.color,
            })
          );
          if (spec.showLabels === false) return;
          /* Labels hang outside their column: first column reads outward on
             the start side, last column on the end side. */
          var atStart = n.layer === layerKeys[0];
          var outward = rtl ? !atStart : atStart;
          nodeG.appendChild(
            text({
              x: outward ? n.x0 - m(8) : n.x1 + m(8),
              y: (n.y0 + n.y1) / 2 - font * 0.55,
              align: outward ? 'end' : 'start',
              logical: false,
              value: n.label,
              size: font,
              fill: 'var(--chart-label)',
              baseline: 'middle',
            })
          );
          nodeG.appendChild(
            text({
              x: outward ? n.x0 - m(8) : n.x1 + m(8),
              y: (n.y0 + n.y1) / 2 + font * 0.75,
              align: outward ? 'end' : 'start',
              logical: false,
              value: valueFmt(n.value),
              size: font * 0.92,
              fill: 'var(--chart-tick)',
              kind: 'numeric',
              baseline: 'middle',
            })
          );
        });
        return root;
      }
    );
  }

  /* ============================================================== SUNBURST */

  /**
   * SunburstChart. `roots` is a one-or-two level hierarchy; a parent's own
   * residual (value minus its children) keeps its angular share as an unfilled
   * wedge, which is how the d3 partition in the original behaves. Deeper rings
   * fade toward the ground so a branch reads as one hue with depth.
   */
  function sunburst(host, spec) {
    var roots = spec.roots || [];
    var valueFmt = fmtOf(spec.valueFormat || 'compact');
    var legend = spec.legendItems && spec.legendItems.length ? spec.legendItems : null;
    var total = sum(roots, function (r) { return r.value; });
    var rings = 1;
    roots.forEach(function (r) {
      if (r.children && r.children.length) rings = 2;
    });

    return frame(
      host,
      { legend: legend, legendPosition: spec.legendPosition || 'bottom', note: spec.note },
      function (width, height, animate) {
        var font = m(C.AXIS_FONT);
        var pad = capMargin(width, height, MARGIN.sunburst.top);
        var margin = { top: pad, right: pad, bottom: pad, left: pad };
        var outer = computePieRadius(width, height, margin, 0, 0);
        var root = svg('svg', { width: width, height: height, class: 'ax-svg' });
        if (outer <= 0 || !total) return root;

        var inner = outer * (spec.innerRadiusFraction || 0);
        var ringWidth = (outer - inner) / rings;
        var pad = ((spec.gap || 0) * Math.PI) / 180;
        var cx = width / 2;
        var cy = height / 2;
        var g = svg('g', { class: 'ax-mark-radial' + (animate ? ' is-entering' : '') });
        g.style.transformOrigin = cx + 'px ' + cy + 'px';
        root.appendChild(g);

        var angle = 0;
        for (var i = 0; i < roots.length; i++) {
          var node = roots[i];
          var span = (node.value / total) * 2 * Math.PI;
          var a0 = angle + pad / 2;
          var a1 = angle + span - pad / 2;
          angle += span;
          if (a1 <= a0) continue;

          g.appendChild(
            sectorNode(cx, cy, inner, inner + ringWidth, a0, a1, m(spec.cornerRadius || 0), node.color)
          );
          if (spec.showLabels !== false && (a1 - a0) * (inner + ringWidth / 2) > measureText(node.label, font)) {
            g.appendChild(arcLabel(cx, cy, inner + ringWidth / 2, (a0 + a1) / 2, node.label, font, 'var(--chart-value)'));
          }

          var kids = node.children || [];
          var childAngle = a0;
          var childSpan = a1 - a0;
          for (var j = 0; j < kids.length; j++) {
            var kid = kids[j];
            var kSpan = node.value ? (kid.value / node.value) * childSpan : 0;
            var k0 = childAngle + pad / 2;
            var k1 = childAngle + kSpan - pad / 2;
            childAngle += kSpan;
            if (k1 - k0 <= 1e-6) continue;
            var r0 = inner + ringWidth;
            var r1 = inner + ringWidth * 2;
            /* DEPTH_FADE from the original: ring two at 84% alpha. */
            var fill = rgba(kid.color || node.color, 1 - 0.16);
            var arcNode = sectorNode(cx, cy, r0, r1, k0, k1, m(spec.cornerRadius || 0), fill);
            /* Siblings share a hue, so a hairline in the ground separates them —
               skipped on arcs too small to survive the inset. */
            if ((k1 - k0) * ((r0 + r1) / 2) > m(C.MIN_STROKE_ARC)) {
              arcNode.setAttribute('stroke', 'var(--chart-ground)');
              arcNode.setAttribute('stroke-width', 1);
            }
            g.appendChild(arcNode);
            if (spec.showLabels !== false) {
              var mid = (k0 + k1) / 2;
              var room = (k1 - k0) * ((r0 + r1) / 2);
              var label = kid.label;
              if (room > measureText(label, font) + m(C.SUNBURST_LABEL_PAD)) {
                g.appendChild(arcLabel(cx, cy, (r0 + r1) / 2, mid, label, font, 'var(--chart-label)'));
              }
            }
          }
        }
        return root;
      }
    );
  }

  /** A label laid along an arc's mid-angle, upright and centred. */
  function arcLabel(cx, cy, r, angle, label, font, fill) {
    var pos = polar(cx, cy, r, angle);
    var node = text({
      x: pos[0],
      y: pos[1],
      align: 'middle',
      logical: false,
      value: label,
      size: font,
      fill: fill,
      baseline: 'middle',
    });
    return node;
  }

  /* =========================================================== HTML KINDS */

  /**
   * ProgressBarsChart: label and value over a track, exactly the original's
   * geometry (8px bar, 24px row gap, 4px radius, 15% track tint). HTML rather
   * than SVG for the same reason as the original -- logical flow mirrors itself
   * in RTL with no coordinate maths.
   */
  function progressBars(host, spec) {
    var data = spec.data || [];
    var colors = spec.colors || COLORS;
    var valueFmt = fmtOf(spec.valueFormat || 'compact');
    var max = spec.max;
    if (!(typeof max === 'number' && max > 0)) {
      max = 0;
      data.forEach(function (d) {
        if (isFinite(d.value) && d.value > max) max = d.value;
      });
      if (!max) max = 1;
    }

    host.innerHTML = '';
    var shell = html('div', 'ax-chart-shell');
    var root = html('div', 'ax-bars');
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var color = d.color || colors[i % colors.length];
      var ratio = isFinite(d.value) ? clamp(d.value / max, 0, 1) : 0;

      var row = html('div', 'ax-bars-row');
      var head = html('div', 'ax-bars-head');
      var label = html('span', 'ax-bars-label', Labels.t(d.label));
      if (Labels.isArabic(d.label)) label.setAttribute('dir', 'rtl');
      head.appendChild(label);
      if (spec.showValue !== false) {
        var value = html('span', 'ax-bars-value ax-num');
        value.setAttribute('data-count', d.value);
        value.setAttribute('data-count-format', typeof spec.valueFormat === 'string' ? spec.valueFormat : 'compact');
        value.textContent = valueFmt(0);
        head.appendChild(value);
      }
      row.appendChild(head);

      var track = html('div', 'ax-bars-track');
      /* The rail is neutral, not a tint of the fill: Figma paints it
         rgba(255,255,255,0.2) whatever colour the bar is (node 5039:94566).
         Tinting it per series meant a five-series list had five different
         rail colours, so the rails carried a distinction the data had not
         asked them to carry — and on a single-series list it just made the
         empty part of the bar look like a paler bar. A board can still
         override with `trackOpacity`, but nothing does. */
      track.style.backgroundColor =
        spec.trackOpacity === undefined
          ? 'rgba(255, 255, 255, 0.2)'
          : rgba(color, spec.trackOpacity);
      var fill = html('div', 'ax-bars-fill');
      fill.style.backgroundColor = color;
      fill.setAttribute('data-grow', (ratio * 100).toFixed(2));
      track.appendChild(fill);
      row.appendChild(track);

      if (d.note) row.appendChild(html('div', 'ax-bars-note', d.note));
      root.appendChild(row);
    }
    shell.appendChild(root);
    if (spec.note) shell.appendChild(html('div', 'ax-chart-note', spec.note));
    host.appendChild(shell);
    return { area: root };
  }

  /** TableChart. */
  function table(host, spec) {
    var columns = spec.columns || [];
    var rows = spec.rows || [];
    host.innerHTML = '';
    var wrap = html('div', 'ax-chart-shell ax-table-wrap');
    var t = html('table', 'ax-table');
    /* Rows share the body height, so the type has to be capped against the row
       count — otherwise an eight-row table renders six rows and clips two. */
    t.style.setProperty('--ax-rows', rows.length);
    var thead = html('thead');
    var hr = html('tr');
    columns.forEach(function (col) {
      var th = html('th', col.align === 'end' ? 'is-end' : null, col.header);
      if (col.width) th.style.width = col.width;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    var tbody = html('tbody');
    rows.forEach(function (row, ri) {
      var tr = html('tr');
      columns.forEach(function (col) {
        var raw = row[col.field];
        var td = html('td', col.align === 'end' ? 'is-end ax-num' : null);
        if (col.rank) {
          td.className = 'ax-table-rank';
          td.textContent = ri + 1;
        } else if (col.count) {
          td.classList.add('ax-num');
          td.setAttribute('data-count', raw);
          td.setAttribute('data-count-format', col.format || 'grouped');
          td.textContent = '';
        } else {
          var value = col.label ? Labels.t(raw) : raw;
          td.textContent = col.format ? fmtOf(col.format)(value) : value;
          if (col.label && Labels.isArabic(raw)) td.setAttribute('dir', 'rtl');
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    wrap.appendChild(t);
    if (spec.note) wrap.appendChild(html('div', 'ax-chart-note', spec.note));
    host.appendChild(wrap);
    return { area: wrap };
  }

  /**
   * IndicatorChart, and the tile grid built out of it. Axion sizes the value
   * with a type-scale step (text-2xl / 4xl / 5xl / 6xl); here every factoid on
   * the wall reads at one rung instead, capped against the tile's own height,
   * so a KPI row can never have one headline louder than its neighbours.
   */
  function indicatorTile(item) {
    var tile = html('div', 'ax-kpi' + (item.labelFirst ? ' is-label-first' : ''));

    /* The number leads and the label trails directly under it (the Figma
       "factoid" cell, node 5039:94565). */
    var body = html('div', 'ax-kpi-body');

    var value = html('div', 'ax-kpi-value');
    var format = item.format || 'grouped';
    /* NUMERIC_ISOLATE on the whole value, not just each span: in the split
       branch below, two sibling spans both being dir="ltr" still lets the
       bidi algorithm swap which one reads first inside an RTL ancestor
       ("K180" instead of "180K") unless the pair itself is isolated too. */
    value.setAttribute('dir', 'ltr');

    if (item.raw !== undefined) {
      var raw = html('span', 'ax-num', item.raw);
      value.appendChild(raw);
    } else if (format === 'compact' || format === 'sar') {
      /* Magnitude and unit letter as two counters sharing one target value,
         so they land on the same frame every tick while taking separate
         colors — the digits stay full-strength white, the K/M/B (or SAR's
         M) trails it in the quiet neutral grey. */
      var mag = html('span', 'ax-num');
      mag.setAttribute('data-count', item.value);
      mag.setAttribute('data-count-format', format === 'sar' ? 'sarValue' : 'compactValue');
      mag.textContent = '0';
      var unit = html('span', 'ax-kpi-unit ax-num');
      unit.setAttribute('data-count', item.value);
      unit.setAttribute('data-count-format', format === 'sar' ? 'sarUnit' : 'compactUnit');
      value.appendChild(mag);
      value.appendChild(unit);
    } else {
      var num = html('span', 'ax-num');
      num.setAttribute('data-count', item.value);
      num.setAttribute('data-count-format', format);
      num.textContent = '0';
      value.appendChild(num);
    }
    body.appendChild(value);

    var label = html('div', 'ax-kpi-label', item.label);
    if (item.labelFirst) {
      tile.appendChild(label);
      tile.appendChild(body);
    } else {
      tile.appendChild(body);
      tile.appendChild(label);
    }
    if (item.note) tile.appendChild(html('div', 'ax-kpi-note', item.note));
    return tile;
  }

  function indicator(host, spec) {
    host.innerHTML = '';
    var items = spec.items || [spec];
    var cols = spec.cols || Math.min(items.length, 2);
    var rows = Math.ceil(items.length / cols);
    var shell = html('div', 'ax-chart-shell');
    var grid = html('div', 'ax-kpis');
    grid.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))';
    for (var i = 0; i < items.length; i++) {
      var tile = indicatorTile(items[i]);
      var isLastCol = i % cols === cols - 1 || i === items.length - 1;
      var isLastRow = Math.floor(i / cols) === rows - 1;
      /* Hairline grid between cells (border/ghost in Figma) rather than a
         gap + per-tile fill: the four factoids read as one quiet block. */
      if (!isLastCol) tile.classList.add('is-div-r');
      if (!isLastRow) tile.classList.add('is-div-b');
      grid.appendChild(tile);
    }
    shell.appendChild(grid);
    if (spec.note) shell.appendChild(html('div', 'ax-chart-note', spec.note));
    host.appendChild(shell);
    return { area: grid };
  }

  /* ================================================================ DISPATCH */

  /** Release the observers a widget body owns before its content is replaced. */
  function unmount(host) {
    var areas = host.querySelectorAll('.ax-chart-area');
    for (var i = 0; i < areas.length; i++) unobserve(areas[i]);
    if (host.classList && host.classList.contains('ax-chart-area')) unobserve(host);
    /* The board tearing this chart down is also the one moment a stray
       hover/pinned tooltip is guaranteed to be pointing at a mark that is
       about to stop existing. */
    if (global.Tooltip) global.Tooltip.hide();
  }

  var KINDS = {
    cartesian: cartesian,
    pie: pie,
    radar: radar,
    sankey: sankey,
    sunburst: sunburst,
    'progress-bars': progressBars,
    table: table,
    indicator: indicator,
  };

  /* Chart kinds with a Figma title glyph (see WIDGET_ICONS in board.js) —
     'map' is stamped by Kit.mapView, not through this DSL. */
  var ICON_CHART_KINDS = { indicator: true, 'progress-bars': true, pie: true, map: true };

  /* Every number handed to a chart, in the order it was handed over. The
     deliverable's whole claim is that it displays the dataset and never invents
     a figure, and tools/audit-data.mjs makes that checkable: it walks every
     board and every chip view, reads this log, and reconciles each value
     against leap_data.js. Keeping it in the shipped file is what lets the
     check run against the single-file deliverable rather than only against
     the source tree. */
  var audit = [];
  var AUDIT_CAP = 20000;

  function record(kind, value, label) {
    if (audit.length >= AUDIT_CAP) return;
    if (typeof value !== 'number' || !isFinite(value)) return;
    audit.push({ chart: kind, value: value, label: label === undefined ? null : label });
  }

  function recordSpec(spec) {
    var kind = spec.chart;
    function walk(list, pick, labelOf) {
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        record(kind, pick(list[i]), labelOf ? labelOf(list[i]) : null);
      }
    }
    if (spec.items) walk(spec.items, function (d) { return d.value; }, function (d) { return d.label; });
    if (spec.value !== undefined) record(kind, spec.value, spec.label);
    walk(spec.data, function (d) { return d.value; }, function (d) { return d.label; });
    if (spec.series) {
      for (var s = 0; s < spec.series.length; s++) {
        var series = spec.series[s];
        if (!series.data) continue;
        for (var d2 = 0; d2 < series.data.length; d2++) {
          var point = series.data[d2];
          if (point && point.y !== undefined) record(kind, point.y, series.key + ':' + point.x);
          else if (typeof point === 'number') record(kind, point, series.key);
        }
      }
      /* Radar rows are metric-keyed rather than {x, y}. */
      if (spec.chart === 'radar' && spec.data) {
        for (var r = 0; r < spec.data.length; r++) {
          for (var k = 0; k < spec.series.length; k++) {
            record(kind, spec.data[r][spec.series[k].key], spec.data[r].metric + ':' + spec.series[k].key);
          }
        }
      }
    }
    if (spec.links) walk(spec.links, function (l) { return l.value; });
    if (spec.roots) {
      for (var ro = 0; ro < spec.roots.length; ro++) {
        record(kind, spec.roots[ro].value, spec.roots[ro].label);
        walk(spec.roots[ro].children, function (c) { return c.value; }, function (c) { return c.label; });
      }
    }
    if (spec.rows && spec.columns) {
      for (var rw = 0; rw < spec.rows.length; rw++) {
        for (var c2 = 0; c2 < spec.columns.length; c2++) {
          record(kind, spec.rows[rw][spec.columns[c2].field], spec.columns[c2].field);
        }
      }
    }
    if (spec.centerValue !== undefined) record(kind, spec.centerValue, 'center');
    if (spec.max !== undefined) record(kind, spec.max, 'max');
  }

  /** Chart.mount — the dsl/Chart.tsx dispatch. */
  function mount(host, spec) {
    refreshUnit();
    unmount(host);
    var render = KINDS[spec.chart];
    if (!render) throw new Error('Chart DSL: unknown kind ' + spec.chart);
    recordSpec(spec);
    /* A stat-card grid already reads as separated from the title without a
       rule underneath it — tagging the card lets the header give that hairline
       and its padding back to the cards instead. */
    var widget = host.closest('.widget');
    if (widget) {
      widget.setAttribute('data-chart', spec.chart);
      /* Only kinds with a Figma glyph (see WIDGET_ICONS in board.js) touch
         data-icon-chart, so a chip that swaps to an un-iconized kind (e.g.
         indicator -> cartesian) leaves the previous glyph in place instead
         of the header icon vanishing. */
      if (ICON_CHART_KINDS[spec.chart]) widget.setAttribute('data-icon-chart', spec.chart);
    }
    return render(host, spec);
  }

  /** Release the geometry animation once the marks are laid out. */
  function play(root) {
    var growing = root.querySelectorAll('[data-grow]');
    var entering = root.querySelectorAll('.is-entering');
    requestAnimationFrame(function () {
      for (var i = 0; i < growing.length; i++) {
        growing[i].style.width = growing[i].getAttribute('data-grow') + '%';
      }
      for (var j = 0; j < entering.length; j++) entering[j].classList.remove('is-entering');
    });
  }

  global.Chart = {
    mount: mount,
    unmount: unmount,
    play: play,
    /** Every value any chart has been handed — see tools/audit-data.mjs. */
    audit: audit,
    TONE: TONE,
    COLORS: COLORS,
    refreshUnit: refreshUnit,
  };
})(window);
