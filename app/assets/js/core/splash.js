/* Splash screen.

   The scene itself is pure CSS over one still and one ten-second video loop
   (see splash.css); this file only owns the lifecycle — when the screen
   shows, when it hands the wall back to the slideshow, and keeping the
   video from decoding while nobody can see it. */

(function (global) {
  'use strict';

  var el = document.getElementById('splash');
  var video = document.getElementById('splashVideo');

  /* Left alone, the splash hands the wall back to the slideshow. Without this
     an unattended stand would sit on a static screen for the rest of the day. */
  var ATTRACT_MS = 40000;

  var attract = 0;

  function play() {
    /* play() after a hide/show cycle; the promise rejection is the browser
       saying "not yet visible", which resolves itself on the next show. */
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function stop() {
    video.pause();
  }

  function visible() {
    return !el.hidden;
  }

  function hide() {
    if (el.hidden) return;
    clearTimeout(attract);
    el.setAttribute('data-leaving', '');
    setTimeout(function () {
      el.hidden = true;
      stop();
      Shell.start();
    }, 520);
  }

  function show() {
    clearTimeout(attract);
    attract = setTimeout(hide, ATTRACT_MS);
    if (!el.hidden) return;

    el.hidden = false;
    // Let `hidden` clear before the transition target is removed.
    requestAnimationFrame(function () {
      el.removeAttribute('data-leaving');
      play();
    });
  }

  function init() {
    /* No Start button in the design: the whole poster is the control. The
       language switch sits on top of it and must not double as "start". */
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('.lang')) return;
      hide();
    });

    /* A machine that cannot decode the HEVC loop shows the still instead. */
    video.addEventListener('error', function () {
      video.hidden = true;
    });

    if (global.AppSettings && !global.AppSettings.isSplashEnabled()) {
      el.hidden = true;
      stop();
      Shell.start();
      return;
    }
    attract = setTimeout(hide, ATTRACT_MS);
  }

  global.Splash = { init: init, show: show, hide: hide, visible: visible };
})(window);
