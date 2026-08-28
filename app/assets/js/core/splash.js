/* Splash screen — lifecycle only.

   The screen itself is the LEAP '26 cover (css/splash.css) and its live code
   layer (core/cover-field.js); this file just shows it, hides it, and keeps
   the field running no longer than the screen is up. */

(function (global) {
  'use strict';

  var el = document.getElementById('splash');
  var field = global.CoverField;

  /* Left alone, the splash hands the wall back to the boards. Without this an
     unattended stand would sit on a static screen for the rest of the day. */
  var ATTRACT_MS = 10000;

  /* A tablet is the one place the cover is held in the hand rather than
     watched across a room, and the one place a stray tap on a 10" surface is
     an accident rather than an intent. So there it gets a button and no
     timer, and everywhere else — the wall, a laptop, a phone — the whole
     screen opens the boards, or the timer does it after ATTRACT_MS.

     Coarse pointer inside the iPad's own range of widths: below 600 is a
     phone, whose cover is already one tap target, and above 1400 is the wall
     (DevTools device emulation reports a coarse pointer at 2880 wide too,
     which is exactly the case the upper bound rules out). Live, not read
     once, because rotating an iPad changes which side of 600 it is on. */
  var tablet = global.matchMedia(
    '(pointer: coarse) and (min-width: 600px) and (max-width: 1400px)'
  );

  var attract = 0;

  function visible() {
    return !el.hidden;
  }

  /* The cover recedes for LEAVE_MS (css/splash.css); the boards start
     HANDOVER_MS into that, so the tile stagger is already running by the time
     the cover is transparent enough to see through. Waiting for the fade to
     finish first — which is what this used to do — read as two separate
     animations with a dead beat between them. */
  var LEAVE_MS = 620;
  var HANDOVER_MS = 180;

  function hide() {
    if (el.hidden) return;
    clearTimeout(attract);
    el.setAttribute('data-leaving', '');

    /* The chrome has nothing to stagger, so it gets the one fade-and-rise of
       its own; the attribute is dropped once it has played. */
    var root = document.documentElement;
    root.setAttribute('data-booting', '');

    setTimeout(function () {
      Shell.start();
      /* One tick, not one frame: the boards Shell.start() has just mounted
         need a paint at the booting style before it is released, and a
         backgrounded tab can withhold rAF long enough to strand the chrome at
         opacity 0. */
      setTimeout(function () {
        root.removeAttribute('data-booting');
      }, 32);
    }, HANDOVER_MS);

    setTimeout(function () {
      el.hidden = true;
      if (field) field.stop();
    }, LEAVE_MS);
  }

  function arm() {
    clearTimeout(attract);
    if (!tablet.matches) attract = setTimeout(hide, ATTRACT_MS);
  }

  function show() {
    arm();
    if (!el.hidden) return;

    el.hidden = false;
    // Let `hidden` clear before the transition target is removed.
    requestAnimationFrame(function () {
      document.documentElement.removeAttribute('data-booting');
      el.removeAttribute('data-leaving');
      if (field) field.start();
    });
  }

  function init() {
    // The whole cover is the button; the id is what the capture tools click.
    document.getElementById('splashStart').addEventListener('click', hide);
    document.getElementById('splashEnter').addEventListener('click', hide);

    /* The button and the timer are two halves of one decision, so the mode
       change re-runs both — a device turned on its side mid-attract must not
       keep a timer the button has just replaced. */
    function mode() {
      if (tablet.matches) el.setAttribute('data-cta', '');
      else el.removeAttribute('data-cta');
      if (visible()) arm();
    }
    if (tablet.addEventListener) tablet.addEventListener('change', mode);
    else if (tablet.addListener) tablet.addListener(mode);
    mode();

    if (global.AppSettings && !global.AppSettings.isSplashEnabled()) {
      el.hidden = true;
      Shell.start();
      return;
    }
    arm();
    if (field) field.start();
  }

  /* Harness only (tools/shoot.mjs): pins the code layer to one phase so a
     captured splash is the same image on every run. */
  function freeze(t) {
    if (field) field.freeze(t);
  }

  global.Splash = { init: init, show: show, hide: hide, visible: visible, freeze: freeze };
})(window);
