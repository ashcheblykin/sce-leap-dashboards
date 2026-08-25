/* Synchronised count-up.

   Every number on a board shares ONE requestAnimationFrame clock and one fixed
   duration, so a 1,116,186 and a 402 finish on exactly the same frame. This is
   the point Slava made in the kick-off: driving each counter at its own speed
   makes the board look like one eye blinking before the other. */

(function (global) {
  'use strict';

  var DURATION = 600;

  var active = [];
  var frame = 0;
  var startedAt = 0;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /* One table, shared with the chart DSL's `format` field. */
  var FORMATTERS = Fmt.by;

  function tick(now) {
    var t = Math.min(1, (now - startedAt) / DURATION);
    var eased = easeOutCubic(t);

    for (var i = 0; i < active.length; i++) {
      var c = active[i];
      c.el.textContent = c.format(c.from + (c.to - c.from) * eased);
    }

    if (t < 1) {
      frame = requestAnimationFrame(tick);
      return;
    }

    // Land on the exact value rather than whatever the easing produced.
    for (var j = 0; j < active.length; j++) {
      active[j].el.textContent = active[j].format(active[j].to);
    }
    active = [];
    frame = 0;
  }

  /**
   * Animate every `[data-count]` inside `root` from zero to its target.
   * Prefixes and suffixes stay in sibling nodes so only the digits move.
   */
  function run(root) {
    if (frame) {
      cancelAnimationFrame(frame);
      // Snap anything mid-flight to its target before starting the next board.
      for (var k = 0; k < active.length; k++) {
        active[k].el.textContent = active[k].format(active[k].to);
      }
      active = [];
      frame = 0;
    }

    var nodes = root.querySelectorAll('[data-count]');
    if (!nodes.length) return;

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var to = parseFloat(el.getAttribute('data-count'));
      if (!isFinite(to)) continue;
      var name = el.getAttribute('data-count-format') || 'grouped';
      var format = FORMATTERS[name] || FORMATTERS.grouped;
      active.push({ el: el, from: 0, to: to, format: format });
      el.textContent = format(0);
    }

    if (!active.length) return;
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
  }

  /**
   * Write every `[data-count]` in `root` at its final value, without animating.
   * A resize rebuilds a chart's SVG from scratch, so its counted text is back
   * at zero with no entry animation coming to move it; this lands it.
   */
  function settle(root) {
    var nodes = root.querySelectorAll('[data-count]');
    for (var i = 0; i < nodes.length; i++) {
      var to = parseFloat(nodes[i].getAttribute('data-count'));
      if (!isFinite(to)) continue;
      var format = FORMATTERS[nodes[i].getAttribute('data-count-format')] || FORMATTERS.grouped;
      nodes[i].textContent = format(to);
    }
  }

  /** Markup helper: a span the driver will pick up. */
  function span(value, format, className) {
    return (
      '<span class="num' +
      (className ? ' ' + className : '') +
      '" data-count="' +
      value +
      '" data-count-format="' +
      (format || 'grouped') +
      '">' +
      (FORMATTERS[format] || FORMATTERS.grouped)(0) +
      '</span>'
    );
  }

  global.Counter = { run: run, settle: settle, span: span, DURATION: DURATION };
})(window);
