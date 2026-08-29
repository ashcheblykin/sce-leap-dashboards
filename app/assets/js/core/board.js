/* Board runtime: turns a board definition into Axion widgets on the grid.

   A definition looks like

     { id, labelKey, widgets: [{ id, x, y, w, h, minW, minH, titleKey,
                                 chipKeys: ['c.a', 'c.b'],
                                 views: [fn(el), fn(el)] }] }

   Views receive their body element and render into it — normally by handing a
   chart spec to `Chart.mount`. Because the body is a flex child whose height is
   already settled, swapping a view cannot move the panel: the "everything
   jumps" bug from the prototypes. */

(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'sce.leap.layout.v2.';

  /* Per-chart-kind title glyphs, extracted from the Axion Figma source
     (node 5037:93297, "Big screen"): a factoid mark for indicator cards, a
     bar glyph for progress-bars, a wedge glyph for pie, a pin-in-circle for
     the map. Chart.mount/Kit.mapView stamp `data-chart` on `.widget` as each
     view mounts (see chart-dsl.js and boards/kit.js) — widget.css keys off
     that same attribute to show only the matching glyph, so a chip switch
     between chart kinds (e.g. pie -> progress-bars) swaps the icon with it.
     Only `table` is left without a glyph; it renders no icon rather than a
     guessed one. */
  /* The gap the title leaves between its ellipsis and the tab track, on top
     of the track's own measured width. The track sits 8px in from the card
     edge (see .widget-head > .chips) and the card's padding is 12px, so 8
     here puts the title's last glyph 4px clear of the track's left rim at the
     default scale. Read in px because the value it is added to is a measured
     px width. */
  var GUTTER_GAP = 8;

  function loadLayout(boardId, widgets) {
    var base = widgets.map(function (w) {
      return { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: w.minW || 3, minH: w.minH || 1 };
    });

    var raw;
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_PREFIX + boardId) || 'null');
    } catch (e) {
      raw = null;
    }
    if (!raw) return base;

    // A stored layout is only honoured when it still describes this board.
    var byId = {};
    for (var i = 0; i < raw.length; i++) byId[raw[i].id] = raw[i];
    for (var j = 0; j < base.length; j++) {
      var saved = byId[base[j].id];
      if (!saved) return base;
      base[j].x = saved.x;
      base[j].y = saved.y;
      base[j].w = saved.w;
      base[j].h = saved.h;
    }
    return base;
  }

  function saveLayout(boardId, layout) {
    try {
      localStorage.setItem(STORAGE_PREFIX + boardId, JSON.stringify(layout));
    } catch (e) {
      /* private mode; layouts just won't persist */
    }
  }

  function clearLayouts() {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf(STORAGE_PREFIX) === 0) localStorage.removeItem(key);
      }
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Sliding-pill tabs for a `.chips` segmented control (ported from the
   * tabs-anima prototype, retimed and recoloured to Axion's spectrum glow).
   * One call per `.chips` instance — the pill, gestures and liquid-stretch
   * state machine are all scoped to this closure, since a board can mount
   * several widgets each with their own view switcher.
   *
   * `onSelect(index, chipsEl)` fires once a segment becomes active (tap or
   * settled drag) so the caller can swap the widget's content; it does not
   * fire for the no-op of re-selecting the already-active segment.
   */
  function attachChipTabs(chipsEl, onSelect) {
    var tabs = [].slice.call(chipsEl.querySelectorAll('.chip'));
    if (tabs.length < 2) return null;

    /* The pill itself — its travel, its fills and its timers — is Pill's (see
       core/pill.js); this closure keeps only what is specific to a widget's
       view tabs: which segment is active, and the press/drag gesture below. */
    var p = Pill.create(chipsEl, { className: 'chip-pill', restShadow: 'none' });
    var pill = p.el;

    var active = 0;
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].hasAttribute('data-on')) {
        active = i;
        break;
      }
    }

    var mq = p.reduced;
    /* Only the three the gesture below still decides for itself: a plain
       select hands its timing to Pill.glide. */
    var LEAD = Pill.ms('--chip-dur-lead');
    var HOLD = Pill.ms('--chip-hold');
    var POP = Pill.ms('--chip-dur-pop');

    function paintActive(i) {
      for (var k = 0; k < tabs.length; k++) {
        if (k === i) tabs[k].setAttribute('data-on', '');
        else tabs[k].removeAttribute('data-on');
      }
    }

    function edges(i) {
      return p.edges(tabs[i]);
    }

    function setScale(s) {
      pill.style.transform = 'translateZ(0) scale(' + s + ')';
    }

    function selectTab(i) {
      if (i === active) return;
      var movingRight = i > active;
      active = i;
      paintActive(i);
      if (onSelect) onSelect(i, chipsEl);
      p.glide(tabs[i], movingRight);
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        if (drag.suppressClick) return;
        selectTab(i);
      });
    });

    /* Press/drag on the pill itself: force-press pops it past the track,
       a horizontal drag slides it and commits to the nearest segment on
       release — same gesture language as the tabs-anima prototype. */
    var PRESS = 1.1;
    var DRAG_SCALE = 1.03;
    var OVER = 3;
    var THRESH = 6;

    var drag = {
      on: false,
      moving: false,
      lifted: false,
      startX: 0,
      startLeft: 0,
      width: 0,
      wrapWidth: 0,
      centers: [],
      suppressClick: false,
    };
    var pressLockUntil = 0;

    function rubber(v, min, max) {
      if (v < min) return min - Math.min(OVER, Math.pow(min - v, 0.82));
      if (v > max) return max + Math.min(OVER, Math.pow(v - max, 0.82));
      return v;
    }

    function tabCenters() {
      var wl = chipsEl.getBoundingClientRect().left;
      return tabs.map(function (t) {
        var r = t.getBoundingClientRect();
        return r.left - wl + r.width / 2;
      });
    }
    function nearestTab(centerX, centers) {
      var best = 0,
        bd = Infinity;
      for (var i = 0; i < centers.length; i++) {
        var d = Math.abs(centers[i] - centerX);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    }

    chipsEl.addEventListener('pointerdown', function (e) {
      if (mq.matches || e.button) return;
      var wr = chipsEl.getBoundingClientRect();
      var x = e.clientX - wr.left;
      var e0 = edges(active);
      var w = wr.width - e0.left - e0.right;
      if (x < e0.left - THRESH || x > e0.left + w + THRESH) return;

      p.cancel();
      drag.on = true;
      drag.moving = false;
      drag.startX = e.clientX;
      drag.startLeft = e0.left;
      drag.width = w;
      drag.wrapWidth = wr.width;
      drag.centers = tabCenters();
      pill.style.willChange = 'transform';
      try {
        chipsEl.setPointerCapture(e.pointerId);
      } catch (_) {}

      p.setDur(0, 0);
      drag.lifted = Date.now() >= pressLockUntil;
      if (drag.lifted) {
        pill.style.setProperty('--pt', 'var(--chip-dur-press)');
        pill.style.setProperty('--pe', 'var(--chip-ease)');
        /* A press wears the same bloom an arrival does — it is the pill
           lifting off the track either way. */
        p.bloom();
        setScale(PRESS);
      }
    });

    chipsEl.addEventListener('pointermove', function (e) {
      if (!drag.on) return;
      var dx = e.clientX - drag.startX;
      if (!drag.moving && Math.abs(dx) > THRESH) {
        drag.moving = true;
        if (!drag.lifted) {
          p.bloom();
          drag.lifted = true;
        }
        pill.style.setProperty('--pt', 'var(--chip-dur-press)');
        setScale(DRAG_SCALE);
      }
      if (!drag.moving) return;

      var ww = drag.wrapWidth;
      var left = rubber(drag.startLeft + dx, 0, ww - drag.width);
      p.place(left, ww - left - drag.width);
      var n = nearestTab(left + drag.width / 2, drag.centers);
      if (n !== active) {
        active = n;
        paintActive(n);
      }
    });

    chipsEl.addEventListener('webkitmouseforcewillbegin', function (e) {
      if (drag.on) e.preventDefault();
    });

    function endGesture(e) {
      if (!drag.on) return;
      drag.on = false;
      try {
        chipsEl.releasePointerCapture(e.pointerId);
      } catch (_) {}
      pressLockUntil = Date.now() + POP;

      if (!drag.moving && !drag.lifted) return;

      p.cancel();
      pill.style.setProperty('--pt', 'var(--chip-dur-pop)');
      pill.style.setProperty('--pe', 'var(--chip-ease-pop)');
      setScale(1);

      if (drag.moving) {
        drag.suppressClick = true;
        setTimeout(function () {
          drag.suppressClick = false;
        }, 80);
        /* Which way the pill still has to travel is measured from where the
           finger left it, not from the segment it started on. */
        var curLeft = parseFloat(pill.style.left);
        var target = nearestTab(curLeft + drag.width / 2, drag.centers);
        active = target;
        paintActive(target);
        if (onSelect) onSelect(target, chipsEl);
        p.glide(tabs[target], p.edges(tabs[target]).left >= curLeft);
      } else {
        /* A press that never moved: both edges come home together, and it
           keeps the bloom it lifted with rather than re-ghosting. */
        p.setDur(LEAD, LEAD);
        var e2 = edges(active);
        p.place(e2.left, e2.right);
        p.bloom();
        p.later(p.rest, HOLD);
      }
      p.later(function () {
        pill.style.setProperty('--pe', 'var(--chip-ease)');
        pill.style.willChange = '';
      }, POP + 40);
    }
    chipsEl.addEventListener('pointerup', endGesture);
    chipsEl.addEventListener('pointercancel', endGesture);

    p.snap(tabs[active]);
    p.rest();
    paintActive(active);

    return {
      snap: function () {
        p.snap(tabs[active]);
      },
      /* Measure-then-write halves of the same thing, for a caller re-anchoring
         several tracks in one pass (see headObserver). */
      measure: function () {
        return p.edges(tabs[active]);
      },
      freeze: function (e) {
        p.freeze(e.left, e.right);
      },
      thaw: p.thaw,
      /* Programmatic selection, so the Big Screen's own 25s scene cycle drives
         the same pill through the same travel animation a tap would. */
      select: selectTab,
      index: function () {
        return active;
      },
    };
  }

  /* Re-anchor every pill and re-reserve every title's gutter, reading the
     whole board before writing any of it.

     A card's tabs are pinned to its top-right corner absolutely, so the title
     no longer shrinks against them in flex flow; its padding has to stand in
     for their width, and that width can only be measured. Done per widget the
     measure-then-write pair invalidates layout for the next widget's measure,
     so a twenty-card board paid for twenty synchronous layouts every time the
     window moved. One read pass, one write pass, one flush.

     Module-level rather than a closure inside mountScene because the KPI
     Library needs it too and never goes through mountScene. That was the last
     thing keeping the chips track's 410px-radius blur alive: with no gutter
     reserved, twenty Arabic titles ran under their own tab tracks, and since
     the track's plate is fully transparent the blur was the only thing
     smearing the collision out of sight. Reserved on every board, the blur
     has nothing left to hide and drops to blur(0px) — see .chips in
     widget.css. */
  function reanchorChips(widgetEls, flushHost) {
    var plan = [];
    for (var i = 0; i < widgetEls.length; i++) {
      var chipsEl = widgetEls[i].querySelector('.chips');
      if (!chipsEl) continue;
      var title = widgetEls[i].querySelector('.widget-head .widget-title');
      /* Overlay boards (the map) float their track over the imagery inside
         .widget-body, so it never shares the header row and there is nothing
         for the title to get out of the way of. Reserving there was pure
         loss: the map's title was clipped to one letter to make room for a
         track sitting 200px below it. */
      var inHead = chipsEl.parentNode === widgetEls[i].querySelector('.widget-head');
      plan.push({
        tabs: chipsEl._tabs || null,
        edges: chipsEl._tabs ? chipsEl._tabs.measure() : null,
        title: title,
        width: title && inHead ? chipsEl.offsetWidth : 0,
      });
    }
    if (!plan.length) return;

    for (var w = 0; w < plan.length; w++) {
      if (plan[w].tabs) plan[w].tabs.freeze(plan[w].edges);
      /* The track's own 8px inset from the card edge, plus one more so the
         title's ellipsis never touches it. Logical, because in Arabic the
         tabs sit on the other side.

         Only when there is a track to clear. A card whose chips are overlaid
         or absent keeps the symmetric --fsp-4 the stylesheet gives it, rather
         than being pinned to 8px on one side and --fsp-4 on the other. */
      if (plan[w].title) {
        if (plan[w].width) {
          plan[w].title.style.paddingInlineEnd = plan[w].width + GUTTER_GAP + 'px';
        } else {
          plan[w].title.style.removeProperty('padding-inline-end');
        }
      }
    }

    /* One flush for the whole board, so the transitions the freezes
       suppressed are actually suppressed before they are restored. */
    if (flushHost) void flushHost.offsetWidth;

    for (var t = 0; t < plan.length; t++) if (plan[t].tabs) plan[t].tabs.thaw();
  }

  function widgetMarkup(def, kiosk) {
    var chips = '';
    var defaultView = def.defaultView || 0;
    if (def.chipKeys && def.chipKeys.length > 1) {
      chips = '<div class="chips" data-no-drag>';
      for (var i = 0; i < def.chipKeys.length; i++) {
        chips +=
          '<button class="chip" type="button" data-view="' +
          i +
          '"' +
          (i === defaultView ? ' data-on' : '') +
          '>' +
          Fmt.escapeHtml(I18N.t(def.chipKeys[i])) +
          '</button>';
      }
      chips += '</div>';
    }

    // The map (Figma node 5039:94568) floats its tabs over the imagery
    // itself, top-right, rather than spending a header row on them — the
    // map is the only view here with room to spare. `.widget-view-mount`
    // is what views actually render into so the chips (a plain sibling of
    // it) survive Kit.mapView's one-time `el.innerHTML = ''` on first mount.
    var overlay = !!def.chipsOverlay;

    return (
      '<div class="widget"' +
      (overlay ? ' data-chips-overlay' : '') +
      '>' +
      '<div class="widget-head" data-drag-handle>' +
      '<div class="widget-title">' +
      '<span class="label">' +
      Fmt.escapeHtml(I18N.t(def.titleKey)) +
      '</span>' +
      '</div>' +
      // Every card's tabs float in its own top-right corner, whatever the
      // segment count (see .widget-head > .chips in widget.css); only the map
      // moves them inside the body, over the imagery.
      (overlay ? '' : chips) +
      '</div>' +
      '<div class="widget-body">' +
      (overlay ? chips + '<div class="widget-view-mount"></div>' : '') +
      '</div></div>' +
      /* A wall board has no operator: the original BigScreen deliberately
         fixed its panels, and a visitor who drags one on an unattended stand
         has broken the screen until somebody finds the reset. Kiosk boards
         therefore ship without handles at all, not merely with drag ignored. */
      (kiosk
        ? ''
        : '<div data-resize-handle="s"></div>' +
          '<div data-resize-handle="e"></div>' +
          '<div data-resize-handle="w"></div>' +
          '<div data-resize-handle="se"></div>' +
          '<div data-resize-handle="sw"></div>')
    );
  }

  /* A board is either
       - a widget board:  { widgets: [...] }
       - a scene board:   { scenes: [{ key, labelKey, widgets }, ...] }   or
       - a custom board:  { render: fn(surface) }   — the KPI Library, whose
                          twenty cards are a flow layout, not a 24x8 grid.

     Scenes exist because the original BigScreen was one screen that cycled
     OVERVIEW / PROFESSION / OPERATIONS rather than three pages. Switching a
     scene tears its widgets down and builds the next set into the same
     surface: the charts re-enter with their normal 600ms arrival, which is the
     behaviour you want every 25 seconds on a wall anyway. */
  function create(def, host) {
    var scenes =
      def.scenes && def.scenes.length ? def.scenes : [{ key: def.id, widgets: def.widgets }];
    var multiScene = scenes.length > 1;

    var surface = document.createElement('div');
    surface.setAttribute('data-grid-surface', '');
    surface.setAttribute('data-board', def.id);
    if (def.kiosk) surface.setAttribute('data-kiosk', '');
    if (def.render) surface.setAttribute('data-custom', '');
    host.appendChild(surface);

    /* Each scene keeps its own stored arrangement, so a reset or a drag on one
       cannot silently reshuffle another. */
    function sceneStorageId(scene) {
      return multiScene ? def.id + ':' + scene.key : def.id;
    }

    var sceneIndex = 0;
    var mounted = null;

    function mountScene(index) {
      var scene = scenes[index];
      var storageId = sceneStorageId(scene);
      var state = { layout: loadLayout(storageId, scene.widgets) };
      var views = {};
      /* Some views pick a layout from the panel's proportions (a donut sits
         beside its legend in a wide panel and above it in a tall one), so the
         body carries its own orientation as an attribute. */
      var orientObserver = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var box = entries[i].contentRect;
          entries[i].target.setAttribute(
            'data-orient',
            box.width >= box.height * 1.35 ? 'row' : 'col'
          );
        }
      });

      // Chip switching re-renders only the body of its own widget. Looked up
      // dynamically (not captured per loop iteration) since it's shared by
      // every widget's attachChipTabs() callback below.
      function onChipSelect(index, chipsEl) {
        var item = chipsEl.closest('[data-grid-item]');
        var entry = views[item.getAttribute('data-grid-item')];
        if (!entry || entry.current === index) return;

        entry.current = index;
        entry.def.views[index](entry.body);
        Motion.animate(entry.body);
        if (def.onInteract) def.onInteract();
      }

      var headObserver = new ResizeObserver(function (entries) {
        var targets = [];
        for (var i = 0; i < entries.length; i++) targets.push(entries[i].target);
        reanchorChips(targets, surface);
      });

      for (var i = 0; i < scene.widgets.length; i++) {
        var w = scene.widgets[i];
        var item = document.createElement('div');
        item.setAttribute('data-grid-item', w.id);
        item.innerHTML = widgetMarkup(w, def.kiosk);
        surface.appendChild(item);

        var body = item.querySelector('.widget-view-mount') || item.querySelector('.widget-body');
        orientObserver.observe(body);
        headObserver.observe(item.querySelector('.widget'));

        var chipsEl = item.querySelector('.chips');
        if (chipsEl) chipsEl._tabs = attachChipTabs(chipsEl, onChipSelect);

        var dv = w.defaultView || 0;
        views[w.id] = { def: w, body: body, current: dv };
        w.views[dv](body);
      }

      /* Kiosk boards still need paint() to place the widgets; they just never
         get the pointer handlers that would move them. */
      var grid = def.kiosk
        ? { paint: function (layout) {
            for (var p = 0; p < layout.length; p++) {
              var el = surface.querySelector('[data-grid-item="' + layout[p].id + '"]');
              if (el) AxGrid.applyGeometry(el, layout[p]);
            }
          } }
        : AxGrid.attachInteraction(surface, state, {
            cols: AxGrid.COLS,
            rows: AxGrid.ROWS,
            onCommit: function (layout) {
              saveLayout(storageId, layout);
              if (def.onInteract) def.onInteract();
            },
          });

      grid.paint(state.layout);

      // Set the initial reserve synchronously against the just-painted
      // layout rather than waiting on headObserver's first (async) callback,
      // so the title never flashes underneath the tabs on first render.
      var initial = [];
      for (var wi = 0; wi < scene.widgets.length; wi++) {
        var widgetEl = surface.querySelector('[data-grid-item="' + scene.widgets[wi].id + '"] .widget');
        if (widgetEl) initial.push(widgetEl);
      }
      reanchorChips(initial, surface);

      mounted = {
        scene: scene,
        storageId: storageId,
        state: state,
        views: views,
        grid: grid,
        orientObserver: orientObserver,
        headObserver: headObserver,
      };
    }

    function unmountScene() {
      if (!mounted) return;
      mounted.orientObserver.disconnect();
      mounted.headObserver.disconnect();
      for (var id in mounted.views) {
        if (mounted.views.hasOwnProperty(id)) Chart.unmount(mounted.views[id].body);
      }
      surface.innerHTML = '';
      mounted = null;
    }

    function setScene(index) {
      index = ((index % scenes.length) + scenes.length) % scenes.length;
      if (mounted && index === sceneIndex) return;
      sceneIndex = index;
      unmountScene();
      mountScene(index);
      Motion.enter(surface);
    }

    if (def.render) def.render(surface);
    else mountScene(0);

    function reset() {
      if (def.render || !mounted) return;
      mounted.state.layout = loadLayout(mounted.storageId, mounted.scene.widgets);
      mounted.grid.paint(mounted.state.layout);
    }

    function destroy() {
      if (def.render && def.teardown) def.teardown(surface);
      unmountScene();
      surface.remove();
    }

    return {
      id: def.id,
      def: def,
      surface: surface,
      scenes: scenes,
      sceneCount: scenes.length,
      sceneIndex: function () {
        return sceneIndex;
      },
      setScene: setScene,
      reset: reset,
      destroy: destroy,
    };
  }

  global.Board = {
    create: create,
    /* The KPI Library builds its own cards rather than grid widgets, but its
       view switchers must be the same control as everywhere else — and must
       reserve the same title gutter. */
    attachChipTabs: attachChipTabs,
    reanchorChips: reanchorChips,
    widgetMarkup: widgetMarkup,
    clearLayouts: clearLayouts,
    loadLayout: loadLayout,
  };
})(window);
