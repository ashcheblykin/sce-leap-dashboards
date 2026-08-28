/* Which shape of screen the wall is running on.

   The board is designed once, at 2880x1152, and every other size is that
   design rescaled by `--u` (see tokens.css). That works down to a laptop
   because a laptop is still a wide screen: 24 columns of a 1280px window are
   53px each, which is narrow but legible. It stops working the moment the
   screen is not wide — an iPad held upright is 820px across, so the same 24
   columns are 34px each and a card title reads "National ecosys...".

   So there are two modes, and exactly one place that decides which:

     wall     — the design, fitted to the screen. Nothing scrolls. Every board
                fills its stage exactly, as the LED panel and every laptop
                preview have always done.
     compact  — the same widgets, the same data, the same card, reflowed into
                one or two columns and allowed to scroll vertically. The
                brief's own words for the tablet: content does not fit across,
                so it goes down, and every block stays reachable.

   EVERY breakpoint in the app is here and nowhere else. The stylesheet does
   not repeat one: each is published as an attribute on <html> and
   responsive.css keys off `[data-view]`, `[data-cols]` and `[data-narrow]`,
   so the CSS half and the JS half cannot drift into disagreeing about what a
   tablet is — which is what two copies of a breakpoint always eventually do.

   Why these numbers.

   1080px is where 24 columns stop being a layout: below it a wing panel is
   under 240px and the Figma card's own 12px padding is a tenth of it. It was
   set at 1000, which let 1024x768 — an iPad on its side, and the shape the
   wall is most often previewed at — stay on the wall with 228px wings. Type
   does not shrink with them: `--u` has a 0.74px floor (tokens.css), so below
   ~1640px the columns keep narrowing while the type holds, and at 1024 a card
   title had 46px of the 228 left after its own tab track and read
   "Top spe...". The floor is deliberate — the alternative is 8pt type — so
   the honest answer is the one this file already has: reflow.

   5/4 is the aspect at which the board stops being a board. The design is
   2.5:1. A 4:3 screen (1024x768, and every 12.9" iPad on its side) is 1.33
   and still reads as a wide dashboard; anything squarer or taller is being
   asked to show a 2.5:1 composition in a box with no room for it, and
   reflowing is the honest answer rather than shrinking the type to 8pt.

   760px is where two cards side by side stop holding a five-row bar list.

   640px is where the dock runs out of room for four labels beside two
   buttons, so its floating scene picker is wider than the screen it floats
   over. */

(function (global) {
  'use strict';

  var QUERIES = {
    compact: '(max-width: 1080px), (max-aspect-ratio: 5 / 4)',
    single: '(max-width: 760px)',
    narrow: '(max-width: 640px)',
  };

  var mqs = {};
  for (var key in QUERIES) {
    if (QUERIES.hasOwnProperty(key)) mqs[key] = global.matchMedia(QUERIES[key]);
  }

  var listeners = [];
  var mode = null;
  var cols = 0;

  function apply() {
    var nextMode = mqs.compact.matches ? 'compact' : 'wall';
    /* Column count is a compact-mode idea; on the wall the boards are placed
       absolutely on 24 columns and this says nothing. */
    var nextCols = nextMode === 'compact' ? (mqs.single.matches ? 1 : 2) : 24;

    var root = document.documentElement;
    root.setAttribute('data-cols', nextCols);
    if (mqs.narrow.matches) root.setAttribute('data-narrow', '');
    else root.removeAttribute('data-narrow');

    if (nextMode === mode && nextCols === cols) return;
    var changed = nextMode !== mode || nextCols !== cols;
    mode = nextMode;
    cols = nextCols;
    root.setAttribute('data-view', mode);
    if (!changed) return;
    for (var i = 0; i < listeners.length; i++) listeners[i](mode, cols);
  }

  /* `addEventListener` on a MediaQueryList is the modern form; Safari carried
     only `addListener` until 14, and the wall's browser is fixed but the
     tablet's is not. */
  function watch(mq) {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }

  for (var k in mqs) if (mqs.hasOwnProperty(k)) watch(mqs[k]);
  apply();

  global.Viewport = {
    /** 'wall' | 'compact' — also mirrored on <html data-view>. */
    mode: function () {
      return mode;
    },
    isCompact: function () {
      return mode === 'compact';
    },
    /** How many columns a reflowed board runs in; 24 on the wall. */
    columns: function () {
      return cols;
    },
    /** Too narrow for the dock's floating scene picker. */
    isNarrow: function () {
      return mqs.narrow.matches;
    },
    /** Called with (mode, columns) whenever either changes. */
    onChange: function (fn) {
      listeners.push(fn);
    },
  };
})(window);
