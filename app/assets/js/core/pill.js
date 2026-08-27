/* The sliding pill.

   One highlight that glides between the segments of a track instead of
   jump-cutting, used by two controls that look nothing alike: a widget's view
   tabs (`.chips`, board.js) and the dock's board nav (`.nav`, shell.js). Both
   were carrying their own copy of the same state machine, written twice and
   drifting in the small ways two copies do.

   The travel is a liquid stretch: the edge in the direction of travel arrives
   first (--chip-dur-lead), the trailing edge lags and catches up
   (--chip-dur-trail), and while it is in flight the pill sheds its fill for a
   bare hairline rim so the move reads as a ring gliding across rather than a
   plate sliding. It lands with a brief bloom, holds it (--chip-hold), then
   settles to rest.

   The only thing the two callers disagree about is what "rest" looks like: the
   widgets' pill rests with no shadow, the dock's rests on the spectrum glow
   the dock redefines locally. That is the whole of `opts.restShadow`.

   This owns the pill's own presentation and nothing else. Which segment is
   active, what a click means, and the drag gesture all stay with the caller —
   board.js still runs the force-press and drag on its chips, and shell.js
   still decides when a board change animates. */

(function (global) {
  'use strict';

  function ms(name) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  }

  var FILL = 'var(--chip-fill)';
  var GHOST_FILL = 'var(--chip-fill-ghost)';
  var RIM = 'var(--chip-rim)';
  var BLOOM = 'var(--chip-glow-bloom)';

  /**
   * @param track     the element the segments live in; the pill is inserted as
   *                  its first child so it paints under every label
   * @param opts      { className, restShadow }
   */
  function create(track, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = opts.className;
    track.insertBefore(el, track.firstChild);

    var restShadow = opts.restShadow || 'none';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* Every scheduled step carries the generation it was queued in, so a
       second move landing mid-flight cannot have the first one's bloom fire
       over the top of it. */
    var gen = 0;
    var timers = [];

    function cancel() {
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers = [];
      return ++gen;
    }

    function later(fn, delay) {
      var g = gen;
      timers.push(
        setTimeout(function () {
          if (gen === g) fn();
        }, delay),
      );
    }

    /* Offsets from the track's own edges, not a width and a translate: the
       pill is pinned by `left`/`right`, which is what lets the two edges be
       given different durations and stretch apart in flight. */
    function edges(item) {
      var tr = track.getBoundingClientRect();
      var ir = item.getBoundingClientRect();
      return { left: ir.left - tr.left, right: tr.right - ir.right };
    }

    function setDur(l, r) {
      el.style.setProperty('--pl', l + 'ms');
      el.style.setProperty('--pr', r + 'ms');
    }

    function place(left, right) {
      el.style.left = left + 'px';
      el.style.right = right + 'px';
    }

    function ghost() {
      el.style.backgroundColor = GHOST_FILL;
      el.style.boxShadow = RIM;
    }

    /* Also the pressed/lifted look: a press and an arrival wear the same
       bloom, which is why board.js's drag reaches for this one too. */
    function bloom() {
      el.style.backgroundColor = FILL;
      el.style.boxShadow = BLOOM;
    }

    function rest() {
      el.style.backgroundColor = FILL;
      el.style.boxShadow = restShadow;
    }

    /* Geometry only, and deliberately: a resize re-snaps the pill under a
       widget that may be mid-bloom, and repainting it there would cut the
       bloom short. Callers that want the resting look ask for it.

       Split into freeze/thaw as well as the one-shot form, because the flush
       between them is a forced layout: a caller re-anchoring twenty pills at
       once (board.js's resize observer) freezes and places all of them, pays
       for one flush, then thaws all of them. */
    function freeze(left, right) {
      el.style.transition = 'none';
      place(left, right);
    }

    function thaw() {
      el.style.transition = '';
    }

    function snap(item) {
      var e = edges(item);
      freeze(e.left, e.right);
      void el.offsetWidth;
      thaw();
    }

    function glide(item, movingRight) {
      var g = cancel();

      if (reduced.matches) {
        snap(item);
        rest();
        return;
      }

      var lead = ms('--chip-dur-lead');
      var trail = ms('--chip-dur-trail');
      var hold = ms('--chip-hold');
      var lDur = movingRight ? trail : lead;
      var rDur = movingRight ? lead : trail;
      var e = edges(item);

      ghost();
      setDur(lDur, rDur);
      place(e.left, e.right);

      later(function () {
        bloom();
        later(rest, hold);
      }, Math.max(lDur, rDur));
      return g;
    }

    return {
      el: el,
      edges: edges,
      snap: snap,
      freeze: freeze,
      thaw: thaw,
      glide: glide,
      cancel: cancel,
      later: later,
      setDur: setDur,
      place: place,
      ghost: ghost,
      bloom: bloom,
      rest: rest,
      reduced: reduced,
      ms: ms,
    };
  }

  global.Pill = { create: create, ms: ms };
})(window);
