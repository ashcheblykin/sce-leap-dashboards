/* Splash screen.

   The animated ground is a field of vertical strokes whose crest follows a few
   layered sine waves — ridge lines that read as dunes rendered out of data.
   Written by hand rather than pulled from a library because the conference
   machine has no internet. */

(function (global) {
  'use strict';

  var el = document.getElementById('splash');
  var canvas = document.getElementById('splashCanvas');
  var ctx = canvas.getContext('2d');

  /* Left alone, the splash hands the wall back to the slideshow. Without this
     an unattended stand would sit on a static screen for the rest of the day. */
  var ATTRACT_MS = 40000;

  var frame = 0;
  var started = 0;
  var attract = 0;

  var BAR_SPACING = 7;
  var LAYERS = [
    { amp: 0.1, freq: 0.0022, speed: 0.00019, base: 0.54, alpha: 0.42, color: [57, 215, 245] },
    { amp: 0.14, freq: 0.0012, speed: -0.00011, base: 0.68, alpha: 0.3, color: [72, 140, 205] },
    { amp: 0.2, freq: 0.0006, speed: 0.00007, base: 0.84, alpha: 0.22, color: [40, 70, 110] },
  ];

  function resize() {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Pure function of elapsed time: the same `t` always paints the same frame.
     Split out of the rAF loop so the screenshot harness can pin the ground to
     one phase (see freeze below) — without that, two runs of the same code
     produce two different splashes and a pixel diff can prove nothing. */
  function paint(t) {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // Far layers first, so nearer ridges overlap them.
    for (var l = LAYERS.length - 1; l >= 0; l--) {
      var layer = LAYERS[l];
      var baseline = h * layer.base;

      for (var x = 0; x <= w; x += BAR_SPACING) {
        var phase = x * layer.freq + t * layer.speed;
        var crest =
          Math.sin(phase) * 0.6 + Math.sin(phase * 2.3 + 1.7) * 0.26 + Math.sin(phase * 0.37) * 0.44;
        var top = baseline - crest * h * layer.amp;
        if (top >= h) continue;

        // Strokes dim toward the edges so the ridge reads as depth, not a band.
        var falloff = 1 - Math.min(1, Math.abs(x / w - 0.5) * 1.4);
        var alpha = layer.alpha * (0.3 + falloff * 0.7);
        var rgb = layer.color.join(',');

        var gradient = ctx.createLinearGradient(0, top, 0, h);
        gradient.addColorStop(0, 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')');
        gradient.addColorStop(0.18, 'rgba(' + rgb + ',' + (alpha * 0.5).toFixed(3) + ')');
        gradient.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, top, 2, h - top);
      }
    }
  }

  function draw(now) {
    paint(now - started);
    frame = requestAnimationFrame(draw);
  }

  function play() {
    if (frame) return;
    resize();
    started = performance.now();
    frame = requestAnimationFrame(draw);
  }

  function stop() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
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
    document.getElementById('splashStart').addEventListener('click', hide);
    global.addEventListener('resize', function () {
      if (!el.hidden) resize();
    });
    if (global.AppSettings && !global.AppSettings.isSplashEnabled()) {
      el.hidden = true;
      Shell.start();
      return;
    }
    attract = setTimeout(hide, ATTRACT_MS);
    play();
  }

  /* Harness only (tools/shoot.mjs). Stops the loop and paints one fixed phase,
     so a captured splash is the same image on every run. Nothing in the app
     calls this; the wall always animates. */
  function freeze(t) {
    stop();
    resize();
    paint(t || 0);
  }

  global.Splash = { init: init, show: show, hide: hide, visible: visible, freeze: freeze };
})(window);
