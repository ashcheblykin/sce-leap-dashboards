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

    var pill = document.createElement('div');
    pill.className = 'chip-pill';
    chipsEl.insertBefore(pill, chipsEl.firstChild);

    var active = 0;
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].hasAttribute('data-on')) {
        active = i;
        break;
      }
    }

    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var gen = 0;
    var timers = [];

    function ms(name) {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
    }
    var LEAD = ms('--chip-dur-lead');
    var TRAIL = ms('--chip-dur-trail');
    var HOLD = ms('--chip-hold');
    var POP = ms('--chip-dur-pop');
    var BLOOM = 'var(--chip-glow-bloom)';
    var RIM = 'var(--chip-rim)';

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }
    function later(fn, t) {
      timers.push(setTimeout(fn, t));
    }

    function paintActive(i) {
      for (var k = 0; k < tabs.length; k++) {
        if (k === i) tabs[k].setAttribute('data-on', '');
        else tabs[k].removeAttribute('data-on');
      }
    }

    function edges(i) {
      var wr = chipsEl.getBoundingClientRect();
      var er = tabs[i].getBoundingClientRect();
      return { left: er.left - wr.left, right: wr.right - er.right };
    }

    function setDur(l, r) {
      pill.style.setProperty('--pl', l + 'ms');
      pill.style.setProperty('--pr', r + 'ms');
    }
    function setScale(s) {
      pill.style.transform = 'translateZ(0) scale(' + s + ')';
    }

    function setNormal() {
      pill.style.backgroundColor = 'var(--chip-fill)';
      pill.style.boxShadow = 'none';
    }
    /* Travelling state: keeps a hairline cyan ring so the move is something
       you can actually watch, then blooms back to the full fill on arrival. */
    function setGhost() {
      pill.style.backgroundColor = 'var(--chip-fill-ghost)';
      pill.style.boxShadow = RIM;
    }
    function setHighlight() {
      pill.style.backgroundColor = 'var(--chip-fill)';
      pill.style.boxShadow = BLOOM;
    }
    function setLift() {
      pill.style.backgroundColor = 'var(--chip-fill)';
      pill.style.boxShadow = BLOOM;
    }

    function moveTo(i, lDur, rDur) {
      var e = edges(i);
      setDur(lDur, rDur);
      pill.style.left = e.left + 'px';
      pill.style.right = e.right + 'px';
    }

    /* jump the pill with no animation — first paint, or a re-snap after the
       track's own size changed (widget resize, board switched into view). */
    function snap(i) {
      var e = edges(i);
      pill.style.transition = 'none';
      pill.style.left = e.left + 'px';
      pill.style.right = e.right + 'px';
      void pill.offsetWidth;
      pill.style.transition = '';
    }

    function selectTab(i) {
      if (i === active) return;
      clearTimers();
      var g = ++gen;
      var movingRight = i > active;
      active = i;
      paintActive(i);
      if (onSelect) onSelect(i, chipsEl);

      if (mq.matches) {
        snap(i);
        setNormal();
        return;
      }

      setGhost();
      var lDur = movingRight ? TRAIL : LEAD;
      var rDur = movingRight ? LEAD : TRAIL;
      moveTo(i, lDur, rDur);

      later(function () {
        if (gen !== g) return;
        setHighlight();
        later(function () {
          if (gen === g) setNormal();
        }, HOLD);
      }, Math.max(lDur, rDur));
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

      clearTimers();
      gen++;
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

      setDur(0, 0);
      drag.lifted = Date.now() >= pressLockUntil;
      if (drag.lifted) {
        pill.style.setProperty('--pt', 'var(--chip-dur-press)');
        pill.style.setProperty('--pe', 'var(--chip-ease)');
        setLift();
        setScale(PRESS);
      }
    });

    chipsEl.addEventListener('pointermove', function (e) {
      if (!drag.on) return;
      var dx = e.clientX - drag.startX;
      if (!drag.moving && Math.abs(dx) > THRESH) {
        drag.moving = true;
        if (!drag.lifted) {
          setLift();
          drag.lifted = true;
        }
        pill.style.setProperty('--pt', 'var(--chip-dur-press)');
        setScale(DRAG_SCALE);
      }
      if (!drag.moving) return;

      var ww = drag.wrapWidth;
      var left = rubber(drag.startLeft + dx, 0, ww - drag.width);
      pill.style.left = left + 'px';
      pill.style.right = ww - left - drag.width + 'px';
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

      var g = ++gen;
      pill.style.setProperty('--pt', 'var(--chip-dur-pop)');
      pill.style.setProperty('--pe', 'var(--chip-ease-pop)');
      setScale(1);

      if (drag.moving) {
        drag.suppressClick = true;
        setTimeout(function () {
          drag.suppressClick = false;
        }, 80);
        var curLeft = parseFloat(pill.style.left);
        var target = nearestTab(curLeft + drag.width / 2, drag.centers);
        active = target;
        paintActive(target);
        if (onSelect) onSelect(target, chipsEl);
        setGhost();
        var movingRight = edges(target).left >= curLeft;
        var lDur = movingRight ? TRAIL : LEAD;
        var rDur = movingRight ? LEAD : TRAIL;
        moveTo(target, lDur, rDur);
        later(function () {
          if (gen !== g) return;
          setHighlight();
          later(function () {
            if (gen === g) setNormal();
          }, HOLD);
        }, Math.max(lDur, rDur));
      } else {
        setDur(LEAD, LEAD);
        var e2 = edges(active);
        pill.style.left = e2.left + 'px';
        pill.style.right = e2.right + 'px';
        setHighlight();
        later(function () {
          if (gen === g) setNormal();
        }, HOLD);
      }
      later(function () {
        pill.style.setProperty('--pe', 'var(--chip-ease)');
        pill.style.willChange = '';
      }, POP + 40);
    }
    chipsEl.addEventListener('pointerup', endGesture);
    chipsEl.addEventListener('pointercancel', endGesture);

    snap(active);
    setNormal();
    paintActive(active);

    return {
      snap: function () {
        snap(active);
      },
      /* Programmatic selection, so the Big Screen's own 25s scene cycle drives
         the same pill through the same travel animation a tap would. */
      select: selectTab,
      index: function () {
        return active;
      },
    };
  }

  function widgetMarkup(def, kiosk) {
    var chips = '';
    if (def.chipKeys && def.chipKeys.length > 1) {
      chips = '<div class="chips" data-no-drag>';
      for (var i = 0; i < def.chipKeys.length; i++) {
        chips +=
          '<button class="chip" type="button" data-view="' +
          i +
          '"' +
          (i === 0 ? ' data-on' : '') +
          '>' +
          Fmt.escapeHtml(I18N.t(def.chipKeys[i])) +
          '</button>';
      }
      chips += '</div>';
    }

    // A title paired with three-plus tab labels has nowhere to go on a
    // narrow card — the title gets crushed to an ellipsis before the tabs
    // give up any width. Those widgets opt into their own full-width tab
    // row below the title instead of squeezing both into one line.
    var stacked = !!def.stackChips;

    return (
      '<div class="widget"' + (stacked ? ' data-chips-row' : '') + '>' +
      '<div class="widget-head" data-drag-handle>' +
      '<div class="widget-title"><span class="label">' +
      Fmt.escapeHtml(I18N.t(def.titleKey)) +
      '</span>' +
      '</div>' +
      (stacked ? '' : chips) +
      '</div>' +
      (stacked ? chips : '') +
      '<div class="widget-body"></div></div>' +
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
        for (var i = 0; i < entries.length; i++) {
          var chipsEl = entries[i].target.querySelector('.chips');
          if (chipsEl && chipsEl._tabs) chipsEl._tabs.snap();
        }
      });

      for (var i = 0; i < scene.widgets.length; i++) {
        var w = scene.widgets[i];
        var item = document.createElement('div');
        item.setAttribute('data-grid-item', w.id);
        item.innerHTML = widgetMarkup(w, def.kiosk);
        surface.appendChild(item);

        var body = item.querySelector('.widget-body');
        orientObserver.observe(body);
        headObserver.observe(item.querySelector('.widget'));

        var chipsEl = item.querySelector('.chips');
        if (chipsEl) chipsEl._tabs = attachChipTabs(chipsEl, onChipSelect);

        views[w.id] = { def: w, body: body, current: 0 };
        w.views[0](body);
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
       view switchers must be the same control as everywhere else. */
    attachChipTabs: attachChipTabs,
    widgetMarkup: widgetMarkup,
    clearLayouts: clearLayouts,
    loadLayout: loadLayout,
  };
})(window);
