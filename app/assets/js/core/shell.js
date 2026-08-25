/* Application shell: navigation, the language switch, the 45-second slideshow,
   the ticker, and the idle return to the splash.

   The type-scale keys deserve a note. The wall's real viewing distance is not
   known until the stand is built, and it is the one thing nobody can fix from a
   laptop, so `[` and `]` nudge `--u-scale` live and the choice is remembered.
   Everything on the board — type, padding, chart geometry — derives from that
   one number, so a single keypress rescales the whole thing coherently. */

(function (global) {
  'use strict';

  var SLIDE_MS = 45000;
  var INTERACTION_PAUSE_MS = 90000;
  var IDLE_TO_SPLASH_MS = 300000;

  var SCALE_STORAGE = 'sce.leap.uscale';
  var SCALE_MIN = 0.9;
  var SCALE_MAX = 2;
  var SCALE_STEP = 0.05;
  var SCALE_DEFAULT = 1.3;

  /* Two separate clocks. `holdUntil` parks the slideshow while somebody is
     working the board; `lastInteraction` decides when the wall goes back to
     the SCE attract screen. Sharing one clock made the first board sit for 90
     seconds because pressing Start counts as interaction. */
  var holdUntil = 0;
  var lastInteraction = 0;

  var BOARDS = [
    global.BOARD_ECOSYSTEM,
    global.BOARD_PROFESSION,
    global.BOARD_OPERATIONS,
    global.BOARD_FIELD,
  ];

  var stage = document.getElementById('stage');
  var navHost = document.getElementById('nav');
  var playBtn = document.getElementById('navPlay');
  var clockEl = document.getElementById('clock');
  var resetBtn = document.getElementById('reset');
  /* Two hosts: the header's and the splash's. Both are built from the same
     list, so the switch is in the same place in the same shape wherever the
     wall happens to be. */
  var langHosts = document.querySelectorAll('.lang');

  var boards = [];
  var current = -1;
  var playing = true;
  var switching = false;
  var slideStartedAt = 0;
  var navFills = [];

  /* --- Type scale --- */
  var scale = SCALE_DEFAULT;
  try {
    var savedScale = parseFloat(localStorage.getItem(SCALE_STORAGE));
    if (isFinite(savedScale) && savedScale >= SCALE_MIN && savedScale <= SCALE_MAX) {
      scale = savedScale;
    }
  } catch (e) {
    /* private mode */
  }

  function applyScale() {
    document.documentElement.style.setProperty('--u-scale', scale.toFixed(2));
    /* Chart constants derive from --u, so the DSL has to re-read it and every
       mounted chart has to repaint at the new geometry. */
    Chart.refreshUnit();
    for (var i = 0; i < boards.length; i++) if (boards[i]) redrawCharts(boards[i].surface);
  }

  function nudgeScale(delta) {
    var next = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale + delta)) * 100) / 100;
    if (next === scale) return;
    scale = next;
    try {
      localStorage.setItem(SCALE_STORAGE, String(scale));
    } catch (e) {
      /* ignore */
    }
    applyScale();
    flash(Math.round(scale * 100) + '%');
  }

  /* A resize changes --u, so the observer would repaint anyway; a scale change
     does not, so nudge each chart's box by a hair to make it deliver. */
  function redrawCharts(surface) {
    var areas = surface.querySelectorAll('.ax-chart-area');
    for (var i = 0; i < areas.length; i++) {
      var a = areas[i];
      a.style.paddingRight = '0.01px';
      void a.offsetWidth;
      a.style.paddingRight = '';
    }
  }

  var toast = null;
  function flash(message) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'shell-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.setAttribute('data-on', '');
    clearTimeout(flash._timer);
    flash._timer = setTimeout(function () {
      toast.removeAttribute('data-on');
    }, 1100);
  }

  /* Both grid axes are derived in CSS from the surface's own container-query
     size, so the board always fills its stage exactly. */
  function measure() {
    document.documentElement.style.setProperty('--grid-cols', AxGrid.COLS);
    document.documentElement.style.setProperty('--grid-rows', AxGrid.ROWS);
  }

  function noteInteraction() {
    lastInteraction = Date.now();
    holdUntil = lastInteraction + INTERACTION_PAUSE_MS;
  }

  /* --- Navigation --- */
  function buildNav() {
    var html = '';
    for (var i = 0; i < BOARDS.length; i++) {
      html +=
        '<button class="nav-item" type="button" data-board="' +
        i +
        '"><span class="nav-item-fill"></span>' +
        Fmt.escapeHtml(I18N.t(BOARDS[i].labelKey)) +
        '</button>';
    }
    var existing = navHost.querySelectorAll('.nav-item');
    for (var e = 0; e < existing.length; e++) existing[e].remove();
    navHost.insertAdjacentHTML('afterbegin', html);
    navFills = navHost.querySelectorAll('.nav-item-fill');
    if (current >= 0) markNav(current);
  }

  function markNav(index) {
    var items = navHost.querySelectorAll('.nav-item');
    for (var i = 0; i < items.length; i++) {
      if (i === index) items[i].setAttribute('data-on', '');
      else items[i].removeAttribute('data-on');
      navFills[i].style.width = '0%';
    }
  }

  /* --- Language ---
     Switching locale rebuilds the boards: every label, every chip and every
     chart spec is produced from the message table at render time, and the RTL
     flip changes which side an axis lands on. Layouts survive (they live in
     localStorage per board) and so does the board you were on. */
  var LOCALES = [
    { code: 'en', label: 'EN' },
    { code: 'ar', label: 'ع' },
  ];

  function buildLang() {
    for (var h = 0; h < langHosts.length; h++) {
      var host = langHosts[h];
      host.innerHTML = '';
      for (var i = 0; i < LOCALES.length; i++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lang-btn' + (LOCALES[i].code === I18N.locale ? ' is-on' : '');
        btn.setAttribute('data-locale', LOCALES[i].code);
        btn.setAttribute('lang', LOCALES[i].code);
        btn.setAttribute('aria-label', I18N.t('ctl.lang') + ': ' + LOCALES[i].label);
        btn.textContent = LOCALES[i].label;
        host.appendChild(btn);
      }
    }
  }

  function relocalize() {
    var keep = current;
    for (var i = 0; i < boards.length; i++) {
      if (boards[i]) boards[i].destroy();
      boards[i] = null;
    }
    current = -1;
    buildNav();
    buildLang();
    buildTicker();
    localizeStatic();
    if (keep >= 0) show(keep);
  }

  /** The parts of index.html that are markup rather than board output. */
  function localizeStatic() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = I18N.t(nodes[i].getAttribute('data-i18n'));
    }
    var glosses = document.querySelectorAll('[data-i18n-gloss]');
    for (var g = 0; g < glosses.length; g++) {
      glosses[g].textContent = I18N.other(glosses[g].getAttribute('data-i18n-gloss'));
    }
    resetBtn.textContent = I18N.t('ctl.reset');
    playBtn.setAttribute('aria-label', I18N.t(playing ? 'ctl.pause' : 'ctl.play'));
  }

  /* --- Board switching --- */
  function mount(index) {
    if (boards[index]) return boards[index];
    var board = Board.create(BOARDS[index], stage);
    BOARDS[index].onInteract = noteInteraction;
    boards[index] = board;
    return board;
  }

  function show(index) {
    if (switching || index === current) return;
    switching = true;

    var next = mount(index);
    next.surface.style.display = 'none';

    function reveal() {
      if (current >= 0 && boards[current]) boards[current].surface.style.display = 'none';
      current = index;
      next.surface.style.display = '';
      measure();
      markNav(index);
      Motion.enter(next.surface);
      slideStartedAt = Date.now();
      switching = false;
    }

    if (current >= 0 && boards[current]) {
      Motion.exit(boards[current].surface, reveal);
      return;
    }
    reveal();
  }

  function advance() {
    show((current + 1) % BOARDS.length);
  }

  /* --- Slideshow --- */
  function setPlaying(on) {
    playing = on;
    if (on) {
      playBtn.setAttribute('data-playing', '');
      slideStartedAt = Date.now();
    } else {
      playBtn.removeAttribute('data-playing');
      for (var i = 0; i < navFills.length; i++) navFills[i].style.width = '0%';
    }
    playBtn.setAttribute('aria-label', I18N.t(on ? 'ctl.pause' : 'ctl.play'));
  }

  function slideshowTick() {
    var now = Date.now();

    if (global.Splash.visible()) {
      lastInteraction = now;
      return;
    }

    if (now - lastInteraction > IDLE_TO_SPLASH_MS) {
      global.Splash.show();
      return;
    }

    if (!playing || switching || now < holdUntil) {
      if (!switching && current >= 0 && navFills[current]) {
        navFills[current].style.width = '0%';
      }
      // Whatever is on screen gets a full slot once the hold lifts.
      slideStartedAt = now;
      return;
    }

    var elapsed = now - slideStartedAt;
    if (current >= 0 && navFills[current]) {
      navFills[current].style.width = Math.min(100, (elapsed / SLIDE_MS) * 100) + '%';
    }
    if (elapsed >= SLIDE_MS) advance();
  }

  /* --- Ticker ---
     Two identical halves translated by exactly -50% never show a gap. Every
     figure is read from Data, and the wording is a message key, so the Arabic
     board gets an Arabic crawl. */
  function buildTicker() {
    var facts = [
      ['b', Fmt.grouped(Data.head.eco), I18N.t('t.eco')],
      ['g', Fmt.grouped(Data.head.reg), I18N.t('t.reg')],
      ['b', Data.head.offices, I18N.t('t.offices')],
      ['g', Fmt.pct(Data.tuv.scecov), I18N.t('t.scecov')],
      ['b', Fmt.grouped(Data.head.proact), I18N.t('t.proact')],
      ['g', Fmt.grouped(Data.head.renewengage), I18N.t('t.engage')],
      ['y', Fmt.sar(Data.head.enforced), I18N.t('t.money', { n: Fmt.sar(Data.head.collected) })],
      ['b', Fmt.grouped(Data.tuv.surveyed), I18N.t('t.surveyed', { n: Data.tuv.regions })],
      ['g', Fmt.grouped(Data.register.active), I18N.t('t.active')],
      ['b', Fmt.grouped(Data.tuv.workers), I18N.t('t.workers')],
      ['y', Fmt.grouped(Data.head.saudis), I18N.t('t.saudis')],
    ];

    var half = '';
    for (var i = 0; i < facts.length; i++) {
      var tone = facts[i][0];
      half +=
        '<span class="ticker-item"><span class="' + tone + ' ax-num" dir="ltr">' +
        Fmt.escapeHtml(facts[i][1]) +
        '</span><span>' +
        Fmt.escapeHtml(facts[i][2]) +
        '</span><span class="ticker-sep">·</span></span>';
    }
    half +=
      '<span class="ticker-item ticker-item--credit">Powered by ' +
      Fmt.axionMark +
      '<span class="ticker-sep">·</span></span>';

    document.getElementById('ticker').innerHTML =
      '<div class="ticker-track"><div class="ticker-half">' +
      half +
      '</div><div class="ticker-half" aria-hidden="true">' +
      half +
      '</div></div>';
  }

  /* --- Clock --- */
  function startClock() {
    function paint() {
      var d = new Date();
      /* en-GB in both locales: the wall shows one unambiguous 24h clock, and
         an ar-SA date would switch calendars mid-demo. */
      clockEl.textContent =
        d.toLocaleDateString('en-GB') +
        ' · ' +
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    paint();
    setInterval(paint, 10000);
  }

  function bindControls() {
    playBtn.addEventListener('click', function () {
      noteInteraction();
      setPlaying(!playing);
      // Pressing play means play now, not in ninety seconds.
      if (playing) holdUntil = 0;
    });

    resetBtn.addEventListener('click', function () {
      Board.clearLayouts();
      for (var i = 0; i < boards.length; i++) if (boards[i]) boards[i].reset();
      noteInteraction();
    });

    navHost.addEventListener('click', function (ev) {
      var item = ev.target.closest('.nav-item');
      if (!item) return;
      noteInteraction();
      show(parseInt(item.getAttribute('data-board'), 10));
    });

    /* Delegated from the document so the splash's switch and the header's
       share one handler, and so a rebuilt switch stays live. */
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.lang-btn');
      if (!btn) return;
      noteInteraction();
      I18N.set(btn.getAttribute('data-locale'));
    });

    I18N.onChange(relocalize);

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight') {
        noteInteraction();
        advance();
      } else if (ev.key === 'ArrowLeft') {
        noteInteraction();
        show((current - 1 + BOARDS.length) % BOARDS.length);
      } else if (ev.key === ' ') {
        ev.preventDefault();
        playBtn.click();
      } else if (ev.key === 'r' || ev.key === 'R') {
        resetBtn.click();
      } else if (ev.key === 'l' || ev.key === 'L') {
        noteInteraction();
        I18N.toggle();
      } else if (ev.key === ']') {
        nudgeScale(SCALE_STEP);
      } else if (ev.key === '[') {
        nudgeScale(-SCALE_STEP);
      } else if (ev.key === '\\') {
        scale = SCALE_DEFAULT;
        applyScale();
        flash(Math.round(scale * 100) + '%');
      }
    });

    ['pointerdown', 'wheel', 'touchstart'].forEach(function (type) {
      document.addEventListener(type, noteInteraction, { passive: true });
    });

    window.addEventListener('resize', measure);
  }

  function start() {
    if (current < 0) show(0);
    else {
      measure();
      Motion.enter(boards[current].surface);
    }
    // Leaving the splash is not board interaction: the first board runs its
    // normal slot rather than being held.
    lastInteraction = Date.now();
    holdUntil = 0;
    slideStartedAt = lastInteraction;
    setPlaying(true);
  }

  function init() {
    Data.check();
    applyScale();
    buildNav();
    buildLang();
    buildTicker();
    localizeStatic();
    startClock();
    bindControls();
    setPlaying(true);
    setInterval(slideshowTick, 200);
  }

  global.Shell = { init: init, start: start, show: show, measure: measure };
})(window);
