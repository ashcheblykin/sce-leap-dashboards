/* Board runtime: turns a board definition into Axion widgets on the grid.

   A definition looks like

     { id, labelKey, widgets: [{ id, x, y, w, h, minW, minH, titleKey,
                                 chipKeys: ['c.a', 'c.b'],
                                 views: [fn(el), fn(el)] }] }

   Views receive their body element and render into it — normally by handing a
   chart spec to `Chart.mount`. Because the body is a flex child whose height is
   already settled, swapping a view cannot move the panel: the "everything
   jumps" bug from the prototypes.

   Panel titles are bilingual in both directions, the way the four source
   dashboards title theirs ("National Ecosystem · المنظومة"): the active locale
   sets the name, the other locale rides behind it as a gloss and is the first
   thing to give way when the header runs out of room. */

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
    var GLOW = 'var(--glow-spectrum)';
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
      pill.style.boxShadow = GLOW;
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
    };
  }

  function widgetMarkup(def) {
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

    var gloss = I18N.other(def.titleKey);
    return (
      '<div class="widget"><div class="widget-head" data-drag-handle>' +
      '<div class="widget-title"><span class="label">' +
      Fmt.escapeHtml(I18N.t(def.titleKey)) +
      '</span>' +
      (gloss ? '<span class="gloss">' + Fmt.escapeHtml(gloss) + '</span>' : '') +
      '</div>' +
      chips +
      '</div><div class="widget-body"></div></div>' +
      '<div data-resize-handle="s"></div>' +
      '<div data-resize-handle="e"></div>' +
      '<div data-resize-handle="w"></div>' +
      '<div data-resize-handle="se"></div>' +
      '<div data-resize-handle="sw"></div>'
    );
  }

  /**
   * Show the other-language gloss only when it fits WHOLE. A truncated Arabic
   * gloss with an ellipsis reads as a defect rather than as a subtitle, and
   * `text-overflow` cannot express "all or nothing".
   *
   * The natural width is measured once, while the gloss is still visible, and
   * cached on the element: re-measuring after hiding it would read 0, and
   * deciding from the title's own width would oscillate (hide -> room appears
   * -> show -> no room -> hide). The head's width minus its chips is stable
   * either way, so the decision is stable too.
   */
  function fitGloss(head, remeasure) {
    var gloss = head.querySelector('.gloss');
    if (!gloss) return;
    var label = head.querySelector('.label');
    var chips = head.querySelector('.chips');
    /* The faces are `font-display: block`, so the first observer callback can
       land while the text is still in its block period and measure a width the
       final face will not have. That figure was then cached forever, and the
       panel kept a decision made about a font it never rendered in — which
       showed up as BOTH the name and the gloss truncating, the one outcome
       this function exists to prevent. `document.fonts.ready` re-runs the pass
       with `remeasure`, which un-hides the gloss first so scrollWidth reads the
       content rather than 0. */
    if (remeasure) {
      gloss.hidden = false;
      delete gloss.dataset.natural;
    }
    if (gloss.dataset.natural === undefined || gloss.dataset.natural === '0') {
      if (!gloss.scrollWidth) return;
      gloss.dataset.natural = gloss.scrollWidth;
    }
    var title = head.querySelector('.widget-title');
    var gap = parseFloat(getComputedStyle(title).columnGap) || 0;
    /* The accent bar is a flex item of the title, so it and its gap count
       toward what the title needs; erring a hair conservative just means the
       gloss disappears slightly early, which is the harmless direction. */
    var accent = parseFloat(getComputedStyle(title, '::before').width) || 0;
    /* clientWidth is 0 while the board is still display:none, and deciding
       from that would latch "hidden" until something else resized the head. */
    if (head.clientWidth === 0) return;
    var available = head.clientWidth - (chips ? chips.offsetWidth + gap : 0);
    var needed = accent + gap * 2 + label.scrollWidth + parseFloat(gloss.dataset.natural);
    /* A few px of slack. The estimate is within ~5px of what the browser lays
       out, and right at the boundary "fits" turns into a one-glyph ellipsis —
       which is the exact thing this function exists to avoid. */
    gloss.hidden = needed + 10 > available;
  }

  function create(def, host) {
    var surface = document.createElement('div');
    surface.setAttribute('data-grid-surface', '');
    surface.setAttribute('data-board', def.id);
    host.appendChild(surface);

    var state = { layout: loadLayout(def.id, def.widgets) };

    var views = {};
    /* Some views pick a layout from the panel's proportions (a donut sits
       beside its legend in a wide panel and above it in a tall one), so the
       body carries its own orientation as an attribute. */
    var orientObserver = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var box = entries[i].contentRect;
        entries[i].target.setAttribute('data-orient', box.width >= box.height * 1.35 ? 'row' : 'col');
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
        var head = entries[i].target;
        fitGloss(head);
        var chipsEl = head.querySelector('.chips');
        if (chipsEl && chipsEl._tabs) chipsEl._tabs.snap();
      }
    });

    /* One re-decision per board, once the real faces are in. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        var heads = surface.querySelectorAll('.widget-head');
        for (var i = 0; i < heads.length; i++) fitGloss(heads[i], true);
      });
    }

    for (var i = 0; i < def.widgets.length; i++) {
      var w = def.widgets[i];
      var item = document.createElement('div');
      item.setAttribute('data-grid-item', w.id);
      item.innerHTML = widgetMarkup(w);
      surface.appendChild(item);

      var body = item.querySelector('.widget-body');
      orientObserver.observe(body);
      headObserver.observe(item.querySelector('.widget-head'));

      var chipsEl = item.querySelector('.chips');
      if (chipsEl) chipsEl._tabs = attachChipTabs(chipsEl, onChipSelect);

      views[w.id] = { def: w, body: body, current: 0 };
      w.views[0](body);
    }

    var grid = AxGrid.attachInteraction(surface, state, {
      cols: AxGrid.COLS,
      rows: AxGrid.ROWS,
      onCommit: function (layout) {
        saveLayout(def.id, layout);
        if (def.onInteract) def.onInteract();
      },
    });

    grid.paint(state.layout);

    function reset() {
      state.layout = loadLayout(def.id, def.widgets);
      grid.paint(state.layout);
    }

    function destroy() {
      orientObserver.disconnect();
      headObserver.disconnect();
      for (var id in views) {
        if (views.hasOwnProperty(id)) Chart.unmount(views[id].body);
      }
      surface.remove();
    }

    return {
      id: def.id,
      def: def,
      surface: surface,
      reset: reset,
      destroy: destroy,
    };
  }

  global.Board = {
    create: create,
    clearLayouts: clearLayouts,
    loadLayout: loadLayout,
  };
})(window);
