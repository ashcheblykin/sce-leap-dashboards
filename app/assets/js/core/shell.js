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

  var SETTINGS_KEYS = {
    tickerVisible: 'sce.leap.settings.tickerVisible',
    tickerPaused: 'sce.leap.settings.tickerPaused',
    splashEnabled: 'sce.leap.settings.splashEnabled',
    autoplay: 'sce.leap.settings.autoplay',
    palette: 'sce.leap.settings.palette',
  };

  /* The grounds the board can be read on — the SCE teal it was designed in,
     the slate navy taken from saudieng.sa, and the deeper navy beside it. All
     three are declared in tokens.css; this list is only the vocabulary of the
     stored setting, so an unrecognised value in localStorage falls back rather
     than stamping a palette the stylesheet has never heard of. */
  var PALETTES = ['green', 'blue', 'purple'];
  /* Purple is the stand's ground (SCE review, 2026-08-29). index.html stamps
     the same value on <html> so the splash never paints the default green for
     a frame before this file runs at the foot of the body. */
  var PALETTE_DEFAULT = 'purple';

  function loadFlag(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : raw === '1';
    } catch (e) {
      return fallback;
    }
  }

  function saveFlag(key, value) {
    try {
      localStorage.setItem(key, value ? '1' : '0');
    } catch (e) {
      /* Storage can be unavailable (kiosk lockdown); the toggle still works
         for the session, it just forgets on reload. */
    }
  }

  /* The flag pair above stores '1'/'0'; the palette is one of a named set, so
     it needs its own pair that validates against that set on the way in. */
  function loadChoice(key, allowed, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return allowed.indexOf(raw) === -1 ? fallback : raw;
    } catch (e) {
      return fallback;
    }
  }

  function saveChoice(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* see saveFlag */
    }
  }

  var settings = {
    tickerVisible: loadFlag(SETTINGS_KEYS.tickerVisible, true),
    tickerPaused: loadFlag(SETTINGS_KEYS.tickerPaused, false),
    splashEnabled: loadFlag(SETTINGS_KEYS.splashEnabled, true),
    autoplay: loadFlag(SETTINGS_KEYS.autoplay, true),
    palette: loadChoice(SETTINGS_KEYS.palette, PALETTES, PALETTE_DEFAULT),
  };

  /* Stamped on <html> the same way viewport.js stamps the layout mode, and
     stamped here at load rather than in init() so it is on the element before
     the first paint — otherwise a wall restored to blue would flash the teal
     ground for a frame while the boards build. */
  function applyPalette() {
    document.documentElement.setAttribute('data-palette', settings.palette);
  }

  applyPalette();

  /* Read by splash.js at its own init(), which runs after this file has
     already set the flag — script order in index.html puts shell.js first. */
  global.AppSettings = {
    isSplashEnabled: function () {
      return settings.splashEnabled;
    },
  };

  /* Two separate clocks. `holdUntil` parks the slideshow while somebody is
     working the board; `lastInteraction` decides when the wall goes back to
     the SCE attract screen. Sharing one clock made the first board sit for 90
     seconds because pressing Start counts as interaction. */
  var holdUntil = 0;
  var lastInteraction = 0;

  /* The four surfaces of the original deliverable, in its own order:
     bigscreen.html, index.html, kpis.html, field-survey.html. Profession and
     Operations are not missing — in the source they were scenes of the Big
     Screen, and that is where they live here too (see boards/bigscreen.js). */
  var BOARDS = [
    global.BOARD_BIGSCREEN,
    global.BOARD_ECOSYSTEM,
    global.BOARD_LIBRARY,
    global.BOARD_FIELD,
  ];

  var stage = document.getElementById('stage');
  var navHost = document.getElementById('nav');
  var playBtn = document.getElementById('navPlay');
  var langBtn = document.getElementById('navLang');
  var resetBtn = document.getElementById('reset');
  var tickerEl = document.getElementById('ticker');
  var sceneHost = document.getElementById('scenes');
  var settingsBtn = document.getElementById('settingsBtn');
  var settingsPanel = document.getElementById('settingsPanel');
  var setTickerVisible = document.getElementById('setTickerVisible');
  var setTickerPaused = document.getElementById('setTickerPaused');
  var setSplashEnabled = document.getElementById('setSplashEnabled');
  var setAutoplay = document.getElementById('setAutoplay');
  var setPalette = document.querySelectorAll('.settings-seg input[name="palette"]');
  /* Two hosts: the header's and the splash's. Both are built from the same
     list, so the switch is in the same place in the same shape wherever the
     wall happens to be. */
  var langHosts = document.querySelectorAll('.lang');

  var boards = [];
  var current = -1;
  var playing = true;
  var switching = false;
  var pendingIndex = -1;
  var slideStartedAt = 0;
  var sceneStartedAt = 0;
  var navFills = [];
  var navPill = null;
  var navPillIndex = -1;
  var sceneMenu = null;

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
    refreshGeometry();
  }

  /* Everything that has to happen after `--u` changes for any reason: the
     `[`/`]` keys, and now also a rotation that moves the app between the wall
     and the compact layout (see core/viewport.js), which substitutes its own
     `--u-base` and therefore moves every derived figure on the board. */
  function refreshGeometry() {
    /* Chart constants derive from --u, so the DSL has to re-read it and every
       mounted chart has to repaint at the new geometry. */
    Chart.refreshUnit();
    for (var i = 0; i < boards.length; i++) if (boards[i]) redrawCharts(boards[i].surface);
    resnapNavPill();
    positionSceneMenu();
  }

  /* The pill's left/right are frozen px from the last glide, so anything that
     reflows the nav (a window resize, a --u-scale nudge) has to re-anchor it
     without replaying the travel animation. */
  function resnapNavPill() {
    if (!navPill || navPillIndex < 0) return;
    var items = navHost.querySelectorAll('.nav-item');
    if (items[navPillIndex]) {
      navPill.snap(items[navPillIndex]);
      navPill.rest();
    }
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

  /* Raised while the slideshow itself is driving a widget's view switcher.
     Selecting a chip runs the board's onInteract, which is this very
     function — without the guard the wall would park its own slideshow the
     first time it advanced a card's tabs by itself. */
  var autoDriving = false;

  function noteInteraction() {
    if (autoDriving) return;
    lastInteraction = Date.now();
    holdUntil = lastInteraction + INTERACTION_PAUSE_MS;
  }

  /* --- Presentation mode ---
     "/" strips the board of everything an operator needs and nobody in the
     room does: the dock, the settings corner, the wall title. What is left
     is the header overlay in index.html — the SCE mark between the centre's
     line in English and Arabic. Deliberately an obscure key: the wall is
     driven by whoever is standing at it, and a visible button would be
     pressed by a visitor and never pressed back. */
  var clean = false;

  function setClean(on) {
    clean = on;
    /* Hiding the chrome is the opposite of taking the board over: the room is
       about to watch it run. So the key does not count as interaction — it
       lifts the 90-second hold any earlier tap left behind and hands the board
       on screen a full slot, rather than parking the show for a minute and a
       half at the moment somebody starts presenting. */
    holdUntil = 0;
    lastInteraction = Date.now();
    slideStartedAt = lastInteraction;
    sceneStartedAt = lastInteraction;
    if (on) {
      document.documentElement.setAttribute('data-clean', '');
      settingsPanel.hidden = true;
      closeSceneMenu();
      /* With the dock gone there is no visible way back to play, so a board
         paused before the key was pressed would simply stand still for the
         whole talk. Presentation mode means the wall runs. */
      if (!playing) setPlaying(true);
    } else {
      document.documentElement.removeAttribute('data-clean');
      /* The dock was faded out, not removed, but a locale or scale change
         while it was hidden left the pill anchored to stale boxes. */
      resnapNavPill();
    }
  }

  /* --- Navigation ---
     The active-item highlight is literally the same sliding pill the widgets'
     .chips view switchers use — one implementation in core/pill.js, two
     callers. The dock differs only in resting on its own spectrum glow (which
     .dock redefines locally as a drop shadow) instead of no shadow at all. */
  function buildNav() {
    if (!navPill) {
      navPill = Pill.create(navHost, {
        className: 'nav-pill',
        restShadow: 'var(--glow-spectrum)',
      });
      navPillIndex = -1;
    }

    var html = '';
    for (var i = 0; i < BOARDS.length; i++) {
      if (i > 0) html += '<span class="nav-divider" aria-hidden="true"></span>';
      html +=
        '<button class="nav-item" type="button" data-board="' +
        i +
        '"><span class="nav-item-fill"></span>' +
        Fmt.escapeHtml(I18N.t(BOARDS[i].labelKey)) +
        /* Only the Big Screen tab carries a page badge (Figma node
           5065:82899) — the others have no scenes to count. */
        (i === 0 ? '<span class="nav-badge" hidden></span>' : '') +
        '</button>';
    }
    var existing = navHost.querySelectorAll('.nav-item, .nav-divider');
    for (var e = 0; e < existing.length; e++) existing[e].remove();
    navHost.insertAdjacentHTML('afterbegin', html);
    navHost.insertBefore(navPill.el, navHost.firstChild);
    navFills = navHost.querySelectorAll('.nav-item-fill');
    if (current >= 0) markNav(current, false);
    updateNavBadge();
  }

  /* The Big Screen tab's badge stands in for the header's own scene chips
     (see buildScenes below): it shows the scene the wall is on and, clicked,
     advances to the next one the same way the auto-cycle does. */
  function updateNavBadge() {
    var badge = navHost.querySelector('.nav-badge');
    if (!badge) return;
    var board = boards[0];
    if (board && board.sceneCount > 1) {
      badge.hidden = false;
      badge.textContent = String(board.sceneIndex() + 1);
    } else {
      badge.hidden = true;
      closeSceneMenu();
    }
    if (sceneMenu && sceneMenu.hasAttribute('data-open')) renderSceneMenu();
  }

  /* --- Scene dropdown ---
     Figma node 5088:83062: clicking the Big Screen tab's page badge no longer
     just cycles to the next scene, it opens a list of every scene (the same
     ones buildScenes turns into header chips) so the room can jump straight
     to one. Each row carries the scene label and a trailing badge — a
     checkmark on the current scene, its position number on the others. */
  var CHECK_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function ensureSceneMenu() {
    if (!sceneMenu) {
      sceneMenu = document.createElement('div');
      sceneMenu.className = 'nav-scene-menu';
      navHost.appendChild(sceneMenu);
    }
    return sceneMenu;
  }

  function renderSceneMenu() {
    var board = boards[0];
    if (!board) return;
    var menu = ensureSceneMenu();
    var activeIndex = board.sceneIndex();
    var html = '';
    for (var i = 0; i < board.scenes.length; i++) {
      var isCurrent = i === activeIndex;
      html +=
        '<button class="nav-scene-option" type="button" data-scene="' +
        i +
        '">' +
        Fmt.escapeHtml(I18N.t(board.scenes[i].labelKey)) +
        '<span class="nav-scene-badge">' +
        (isCurrent ? CHECK_ICON : String(i + 1)) +
        '</span></button>';
    }
    menu.innerHTML = html;
  }

  /* The menu floats above the dock but has to line up with the badge's own
     tab, not the dock's edge — same left-offset trick Pill.edges uses for
     the sliding pill. */
  function positionSceneMenu() {
    if (!sceneMenu) return;
    var badge = navHost.querySelector('.nav-badge');
    var item = badge && badge.closest('.nav-item');
    if (!item) return;
    var wr = navHost.getBoundingClientRect();
    var ir = item.getBoundingClientRect();
    sceneMenu.style.left = ir.left - wr.left + 'px';
  }

  function openSceneMenu() {
    var board = boards[0];
    if (!board || board.sceneCount <= 1) return;
    renderSceneMenu();
    var menu = ensureSceneMenu();
    // Position before the opacity/transform transition starts, so the menu
    // doesn't visibly jump to place once it's already fading in.
    positionSceneMenu();
    menu.setAttribute('data-open', '');
  }

  function closeSceneMenu() {
    if (sceneMenu) sceneMenu.removeAttribute('data-open');
  }

  /* Step to the next scene without opening anything — what the badge did
     before the dropdown existed, and what it goes back to doing on a phone,
     where a floating list is wider than the screen it would float over
     (responsive.css hides the menu there). */
  function cycleScene() {
    var board = boards[0];
    if (!board || board.sceneCount <= 1) return;
    var next = (board.sceneIndex() + 1) % board.sceneCount;
    if (sceneTabs) sceneTabs.select(next);
    else board.setScene(next);
    sceneStartedAt = Date.now();
    updateNavBadge();
  }

  function toggleSceneMenu() {
    if (Viewport.isNarrow()) {
      cycleScene();
      return;
    }
    if (sceneMenu && sceneMenu.hasAttribute('data-open')) closeSceneMenu();
    else openSceneMenu();
  }

  function markNav(index, animate) {
    var items = navHost.querySelectorAll('.nav-item');
    for (var i = 0; i < items.length; i++) {
      if (i === index) items[i].setAttribute('data-on', '');
      else items[i].removeAttribute('data-on');
      setNavFill(navFills[i], 0);
    }
    if (items[index]) {
      if (animate && navPillIndex >= 0) {
        navPill.glide(items[index], index > navPillIndex);
      } else {
        navPill.snap(items[index]);
        navPill.rest();
      }
      navPillIndex = index;
    }
  }

  /* --- Big Screen scenes ---
     The Figma dock (node 5057:82427) folds the scene indicator into the nav
     tab's own page badge (see updateNavBadge above) instead of a second
     segmented control in the header, so `sceneHost` is built exactly as
     before — attachChipTabs still drives board.setScene and the auto-cycle
     below still needs `sceneTabs` — but stays permanently hidden. */
  var sceneTabs = null;

  function buildScenes() {
    var board = current >= 0 ? boards[current] : null;
    var hasScenes = !!(board && board.sceneCount > 1);

    sceneHost.hidden = true;
    sceneHost.innerHTML = '';
    sceneTabs = null;
    if (!hasScenes) {
      updateNavBadge();
      return;
    }

    for (var i = 0; i < board.scenes.length; i++) {
      sceneHost.insertAdjacentHTML(
        'beforeend',
        '<button class="chip" type="button" data-scene="' +
          i +
          '"' +
          (i === board.sceneIndex() ? ' data-on' : '') +
          '>' +
          Fmt.escapeHtml(I18N.t(board.scenes[i].labelKey)) +
          '</button>'
      );
    }

    /* No noteInteraction() here: the document-level pointer listener already
       registers a tap, and calling it from the auto-cycle would park the
       slideshow the moment the wall advanced a scene by itself. */
    sceneTabs = Board.attachChipTabs(sceneHost, function (index) {
      board.setScene(index);
      sceneStartedAt = Date.now();
      updateNavBadge();
    });
    updateNavBadge();
  }

  /* --- Language ---
     Switching locale rebuilds the boards: every label, every chip and every
     chart spec is produced from the message table at render time, and the RTL
     flip changes which side an axis lands on. Layouts survive (they live in
     localStorage per board) and so does the board you were on. */
  var LOCALES = [
    { code: 'en', label: 'EN' },
    { code: 'ar', label: 'AR' },
  ];

  function buildLang() {
    /* One button, showing the locale it switches TO — not the active one. */
    var target = LOCALES[0].code === I18N.locale ? LOCALES[1] : LOCALES[0];
    for (var h = 0; h < langHosts.length; h++) {
      var host = langHosts[h];
      host.innerHTML = '';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-btn';
      btn.setAttribute('data-locale', target.code);
      btn.setAttribute('lang', target.code);
      btn.setAttribute('aria-label', I18N.t('ctl.lang') + ': ' + target.label);
      btn.textContent = target.label;
      host.appendChild(btn);
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

  /* --- Rotation ---
     Moving between the wall layout and the compact one is not a resize: the
     grid goes from absolute placement to flow, `--u` changes base, and the KPI
     Library changes column count, which changes whether its bar lists render
     dense. Charts are rebuilt from their spec on every mount anyway, so the
     honest response is to rebuild the boards rather than to teach a dozen
     renderers to re-measure themselves — an iPad is rotated seconds apart, not
     frames apart, and the cost is one board's mount. */
  function remount() {
    var keep = current;
    switching = false;
    pendingIndex = -1;
    for (var i = 0; i < boards.length; i++) {
      if (boards[i]) boards[i].destroy();
      boards[i] = null;
    }
    current = -1;
    refreshGeometry();
    if (keep >= 0) {
      show(keep);
      if (stage) stage.scrollTop = 0;
    }
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
    if (langBtn) langBtn.setAttribute('aria-label', I18N.t('ctl.lang'));
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
    closeSceneMenu();
    if (index === current) {
      pendingIndex = -1;
      return;
    }
    /* A tab tapped mid-transition used to be dropped on the floor — the
       switching guard just returned, so a click during the ~300ms exit/enter
       animation had no effect and the wall looked like it "worked every
       other time". Queue it instead: the transition in flight finishes
       normally, then picks up the latest requested tab. */
    if (switching) {
      pendingIndex = index;
      return;
    }
    switching = true;

    var next = mount(index);
    next.surface.style.display = 'none';
    /* The wall's main screen always opens on OVERVIEW, wherever its cycle had
       got to when the board was last on screen. */
    if (next.sceneCount > 1) next.setScene(0);

    function reveal() {
      if (current >= 0 && boards[current]) boards[current].surface.style.display = 'none';
      current = index;
      next.surface.style.display = '';
      measure();
      markNav(index, true);
      buildScenes();
      Motion.enter(next.surface);
      slideStartedAt = Date.now();
      sceneStartedAt = slideStartedAt;
      switching = false;

      if (pendingIndex >= 0) {
        var target = pendingIndex;
        pendingIndex = -1;
        if (target !== current) show(target);
      }
    }

    if (current >= 0 && boards[current]) {
      Motion.exit(boards[current].surface, reveal);
      return;
    }
    reveal();
  }

  /* `auto` marks the slideshow's own step, as opposed to ArrowRight.

     The show is a loop whose top is the cover: once the last board has had
     its slot the wall hands back to the splash and starts over from the
     first board, rather than wrapping straight into it. A key press is
     somebody driving the wall, so it still wraps — dropping a presenter onto
     the attract screen is not what the arrow means — and presentation mode
     never shows the cover at all. */
  function advance(auto) {
    var next = current + 1;
    if (next >= BOARDS.length) {
      if (auto && !clean && settings.splashEnabled) {
        global.Splash.show();
        /* Rewind behind the cover rather than after it lifts. start() runs
           180ms into the 620ms recede, so a board change made there plays its
           exit animation in front of the room and the outgoing board flashes
           back for a beat before the first one arrives. */
        show(0);
        return;
      }
      next = 0;
    }
    show(next);
  }

  /* --- Slideshow --- */

  /* The dwell fill, as a scale rather than a width.

     slideshowTick runs every 200ms for as long as the wall is up, so this is
     the one write on the page that never stops. As a width each call was a
     layout and a repaint inside the dock, and the repaint invalidated the
     backdrop of the pill sitting over it — five Gaussians a second with
     nothing on screen moving. The box is full-width now and scaled from its
     reading-start edge, which the compositor owns outright: no layout, no
     repaint, and nothing for the pill above to re-sample. */
  function setNavFill(el, ratio) {
    el.style.transform = 'scaleX(' + ratio + ')';
  }

  function setPlaying(on) {
    playing = on;
    if (on) {
      playBtn.setAttribute('data-playing', '');
      slideStartedAt = Date.now();
    } else {
      playBtn.removeAttribute('data-playing');
      for (var i = 0; i < navFills.length; i++) setNavFill(navFills[i], 0);
    }
    playBtn.setAttribute('aria-label', I18N.t(on ? 'ctl.pause' : 'ctl.play'));

    /* The play/pause button and the settings checkbox are two faces of the
       same switch — whichever one moves, the other and the saved preference
       follow, so pausing from the nav also sticks across a reload. */
    settings.autoplay = on;
    saveFlag(SETTINGS_KEYS.autoplay, on);
    if (setAutoplay) setAutoplay.checked = on;
  }

  /* --- View cycling ---
     A card that ships two or three views only ever showed the first one on
     an unattended wall, and the map — six of them — showed a sixth of what
     it knows. Every switcher on the board therefore walks its own segments
     within the slot the board is on screen for: the segments divide the
     dwell, so a two-view card turns once at 22.5s of a 45s slot and the map
     turns every 7.5s. The Big Screen divides its 25s scene instead, since
     that is how long its cards are actually up.

     Driven off elapsed time rather than per-widget timers so the whole board
     stays in step with the dwell bar in the dock, and so a hold (see the
     caller) rewinds every switcher together simply by moving the clock. */
  function cycleViews(now, dwellMs) {
    var board = current >= 0 ? boards[current] : null;
    if (!board) return;
    var tracks = board.surface.querySelectorAll('.chips');
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      var tabs = track._tabs;
      if (!tabs) continue;
      var count = track.querySelectorAll('.chip').length;
      if (count < 2) continue;

      /* Clamped: a scene that changed earlier in this same tick set its
         start a hair after `now`, and a negative step would index off the
         front of the track. */
      var step = Math.floor(Math.max(0, now - sceneStartedAt) / (dwellMs / count));
      if (step === track._autoStep) continue;
      /* Whatever the card opened on is step 0, so a widget with a
         defaultView still leads with it before the rotation starts. */
      if (track._autoBase == null) track._autoBase = tabs.index();
      track._autoStep = step;

      autoDriving = true;
      tabs.select((track._autoBase + step) % count);
      autoDriving = false;
    }
  }

  function slideshowTick() {
    var now = Date.now();

    if (global.Splash.visible()) {
      lastInteraction = now;
      return;
    }

    /* Presentation mode has no idle: nobody touches the board while it is
       being shown, and dropping to the attract screen mid-talk is the one
       thing the mode exists to prevent. */
    if (!clean && settings.splashEnabled && now - lastInteraction > IDLE_TO_SPLASH_MS) {
      global.Splash.show();
      return;
    }

    if (!playing || switching || now < holdUntil) {
      if (!switching && current >= 0 && navFills[current]) {
        setNavFill(navFills[current], 0);
      }
      // Whatever is on screen gets a full slot once the hold lifts.
      slideStartedAt = now;
      sceneStartedAt = now;
      return;
    }

    /* A scene board runs its own inner cycle first: the Big Screen steps
       OVERVIEW -> PROFESSION -> OPERATIONS every 25s and only then hands the
       wall on, which is why its slot is three scenes long. */
    var board = current >= 0 ? boards[current] : null;
    var dwellMs = current >= 0 && BOARDS[current].sceneMs ? BOARDS[current].sceneMs : SLIDE_MS;
    if (board && board.sceneCount > 1 && sceneTabs) {
      if (now - sceneStartedAt >= dwellMs) {
        sceneTabs.select((board.sceneIndex() + 1) % board.sceneCount);
      }
    }

    /* After the scene step above, so a scene that has just changed cycles
       against its own fresh sceneStartedAt rather than the outgoing one's. */
    cycleViews(now, dwellMs);

    var slideMs = current >= 0 && BOARDS[current].slideMs ? BOARDS[current].slideMs : SLIDE_MS;
    var elapsed = now - slideStartedAt;
    if (current >= 0 && navFills[current]) {
      setNavFill(navFills[current], Math.min(1, elapsed / slideMs));
    }
    if (elapsed >= slideMs) advance(true);
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

  /* --- Settings --- */
  function applySettings() {
    tickerEl.hidden = !settings.tickerVisible;
    tickerEl.classList.toggle('is-paused', settings.tickerPaused);
  }

  function bindSettings() {
    for (var i = 0; i < setPalette.length; i++) {
      setPalette[i].checked = setPalette[i].value === settings.palette;
    }
    setTickerVisible.checked = settings.tickerVisible;
    setTickerPaused.checked = settings.tickerPaused;
    setSplashEnabled.checked = settings.splashEnabled;
    setAutoplay.checked = settings.autoplay;
    applySettings();

    settingsBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      noteInteraction();
      settingsPanel.hidden = !settingsPanel.hidden;
    });

    // Anything outside the panel closes it; the panel's own clicks never
    // bubble here because they land on the checkboxes/labels, not the button.
    document.addEventListener('click', function (ev) {
      if (!settingsPanel.hidden && !settingsPanel.contains(ev.target)) {
        settingsPanel.hidden = true;
      }
    });

    setTickerVisible.addEventListener('change', function () {
      settings.tickerVisible = setTickerVisible.checked;
      saveFlag(SETTINGS_KEYS.tickerVisible, settings.tickerVisible);
      applySettings();
    });

    setTickerPaused.addEventListener('change', function () {
      settings.tickerPaused = setTickerPaused.checked;
      saveFlag(SETTINGS_KEYS.tickerPaused, settings.tickerPaused);
      applySettings();
    });

    setSplashEnabled.addEventListener('change', function () {
      settings.splashEnabled = setSplashEnabled.checked;
      saveFlag(SETTINGS_KEYS.splashEnabled, settings.splashEnabled);
      if (!settings.splashEnabled && global.Splash.visible()) global.Splash.hide();
    });

    setAutoplay.addEventListener('change', function () {
      noteInteraction();
      setPlaying(setAutoplay.checked);
      if (setAutoplay.checked) holdUntil = 0;
    });

    /* One listener per radio rather than one on the group: the panel is built
       in the markup, so the set is fixed and there is no delegation to earn.
       Nothing has to be redrawn — the ground and its plates are custom
       properties, so the attribute alone repaints the whole wall. */
    for (var j = 0; j < setPalette.length; j++) {
      setPalette[j].addEventListener('change', function (ev) {
        if (!ev.target.checked) return;
        noteInteraction();
        settings.palette = ev.target.value;
        saveChoice(SETTINGS_KEYS.palette, settings.palette);
        applyPalette();
      });
    }
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
      var badge = ev.target.closest('.nav-badge');
      if (badge) {
        ev.stopPropagation();
        noteInteraction();
        toggleSceneMenu();
        return;
      }
      var option = ev.target.closest('.nav-scene-option');
      if (option) {
        ev.stopPropagation();
        noteInteraction();
        var sceneIndex = parseInt(option.getAttribute('data-scene'), 10);
        if (sceneTabs) sceneTabs.select(sceneIndex);
        else if (boards[0]) boards[0].setScene(sceneIndex);
        updateNavBadge();
        closeSceneMenu();
        return;
      }
      var item = ev.target.closest('.nav-item');
      if (!item) return;
      var boardIndex = parseInt(item.getAttribute('data-board'), 10);
      noteInteraction();
      // The Big Screen tab is already on screen once it's the active one —
      // clicking it again (anywhere on it, not just the badge) opens the
      // scene picker instead of a no-op re-select.
      if (boardIndex === current && boardIndex === 0) {
        // Stop here, or the document-level outside-click closer below sees
        // this same click bubble past the item and immediately shuts the
        // menu we just opened.
        ev.stopPropagation();
        toggleSceneMenu();
        return;
      }
      closeSceneMenu();
      show(boardIndex);
    });

    // Anything outside the menu (and outside the badge that opens it) closes
    // it, same pattern as the settings panel below.
    document.addEventListener('click', function (ev) {
      if (
        sceneMenu &&
        sceneMenu.hasAttribute('data-open') &&
        !sceneMenu.contains(ev.target) &&
        !ev.target.closest('.nav-badge')
      ) {
        closeSceneMenu();
      }
    });

    if (langBtn) {
      langBtn.addEventListener('click', function () {
        noteInteraction();
        I18N.toggle();
      });
    }

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
      } else if (ev.key === '/') {
        ev.preventDefault();
        setClean(!clean);
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
    window.addEventListener('resize', resnapNavPill);
    window.addEventListener('resize', positionSceneMenu);

    Viewport.onChange(remount);
  }

  function start() {
    /* The cover is the top of the loop, so leaving it always hands back to
       the first board and to that board's first scene, however far the cycle
       had got when the splash came up. */
    if (current !== 0) show(0);
    else {
      if (boards[0].sceneCount > 1) boards[0].setScene(0);
      measure();
      Motion.enter(boards[0].surface);
    }
    // Leaving the splash is not board interaction: the first board runs its
    // normal slot rather than being held.
    lastInteraction = Date.now();
    holdUntil = 0;
    /* Both clocks, not just the slide one. The scene clock used to survive
       the cover, so a board coming back from it had already spent the
       cover's dwell and stepped its scene the moment it appeared — the
       splash's seconds were being charged to the board behind it. */
    slideStartedAt = lastInteraction;
    sceneStartedAt = lastInteraction;
    setPlaying(settings.autoplay);
  }

  function init() {
    Data.check();
    applyScale();
    buildNav();
    buildLang();
    buildTicker();
    localizeStatic();
    bindControls();
    bindSettings();
    setPlaying(settings.autoplay);
    setInterval(slideshowTick, 200);
  }

  global.Shell = { init: init, start: start, show: show, measure: measure };
})(window);
