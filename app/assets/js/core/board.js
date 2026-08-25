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
  function fitGloss(head) {
    var gloss = head.querySelector('.gloss');
    if (!gloss) return;
    var label = head.querySelector('.label');
    var chips = head.querySelector('.chips');
    if (gloss.dataset.natural === undefined) {
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

    var headObserver = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) fitGloss(entries[i].target);
    });

    for (var i = 0; i < def.widgets.length; i++) {
      var w = def.widgets[i];
      var item = document.createElement('div');
      item.setAttribute('data-grid-item', w.id);
      item.innerHTML = widgetMarkup(w);
      surface.appendChild(item);

      var body = item.querySelector('.widget-body');
      orientObserver.observe(body);
      headObserver.observe(item.querySelector('.widget-head'));

      views[w.id] = { def: w, body: body, current: 0 };
      w.views[0](body);
    }

    // Chip switching re-renders only the body of its own widget.
    surface.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.chip');
      if (!chip) return;
      var item = chip.closest('[data-grid-item]');
      var entry = views[item.getAttribute('data-grid-item')];
      var index = parseInt(chip.getAttribute('data-view'), 10);
      if (!entry || entry.current === index) return;

      entry.current = index;
      var siblings = chip.parentNode.querySelectorAll('.chip');
      for (var s = 0; s < siblings.length; s++) siblings[s].removeAttribute('data-on');
      chip.setAttribute('data-on', '');

      entry.def.views[index](entry.body);
      Motion.animate(entry.body);
      if (def.onInteract) def.onInteract();
    });

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
