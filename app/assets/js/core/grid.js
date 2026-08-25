/* Grid engine ported from axion.gen.web frontend/src/shared/ui/grid
   (engine/layout.ts, interaction.ts, lib/gesture.ts).

   One difference from the Axion original: a wall board has a fixed number of
   rows and nothing may fall off the bottom of the LED panel, so a gesture whose
   resolved layout exceeds `rows` is rejected outright instead of being
   compacted. That keeps every board flush inside 2880x1152 no matter how the
   operator drags things around. */

(function (global) {
  'use strict';

  var COLS = 24;
  var ROWS = 8;
  var GAP = 8; // must match --grid-gap

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function collides(a, b) {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }

  function cloneLayout(layout) {
    return layout.map(function (i) {
      return { id: i.id, x: i.x, y: i.y, w: i.w, h: i.h, minW: i.minW, minH: i.minH };
    });
  }

  function find(layout, id) {
    for (var i = 0; i < layout.length; i++) if (layout[i].id === id) return layout[i];
    return null;
  }

  /* Push every collider below the mover. For a direct pointer drag the collider
     is first offered the slot the mover just vacated, so dragging onto a
     neighbour swaps with it rather than shoving it down the board. */
  function resolveCollisions(layout, mover, userMove, depth) {
    if (depth > 24) return layout;
    var result = layout.slice();
    var colliders = result
      .filter(function (i) {
        return i.id !== mover.id && collides(i, mover);
      })
      .sort(function (a, b) {
        return a.y - b.y;
      });

    for (var c = 0; c < colliders.length; c++) {
      var current = find(result, colliders[c].id);
      if (!current || !collides(current, mover)) continue;

      var pushed = null;
      if (userMove) {
        var candidate = { id: current.id, x: current.x, y: Math.max(0, mover.y - current.h), w: current.w, h: current.h, minW: current.minW, minH: current.minH };
        var free = !result.some(function (i) {
          return i.id !== candidate.id && i.id !== mover.id && collides(i, candidate);
        });
        if (free && !collides(candidate, mover)) pushed = candidate;
      }
      if (!pushed) {
        pushed = { id: current.id, x: current.x, y: mover.y + mover.h, w: current.w, h: current.h, minW: current.minW, minH: current.minH };
      }

      result = result.map(function (i) {
        return i.id === pushed.id ? pushed : i;
      });
      result = resolveCollisions(result, pushed, false, (depth || 0) + 1);
    }
    return result;
  }

  /* Vertical gravity in reading order, so the cursor's Y decides stacking. */
  function compact(layout) {
    var placed = [];
    var movable = layout.slice().sort(function (a, b) {
      return a.y - b.y || a.x - b.x;
    });

    for (var m = 0; m < movable.length; m++) {
      var item = movable[m];
      var y = item.y;
      while (y > 0) {
        var probe = { id: item.id, x: item.x, y: y - 1, w: item.w, h: item.h };
        var blocked = placed.some(function (p) {
          return collides(p, probe);
        });
        if (blocked) break;
        y -= 1;
      }
      placed.push(y === item.y ? item : Object.assign({}, item, { y: y }));
    }
    return placed;
  }

  function overflows(layout, rows) {
    return layout.some(function (i) {
      return i.y + i.h > rows;
    });
  }

  function anyCollision(layout) {
    for (var i = 0; i < layout.length; i++) {
      for (var j = i + 1; j < layout.length; j++) {
        if (collides(layout[i], layout[j])) return true;
      }
    }
    return false;
  }

  function itemCovering(layout, skipId, x, y) {
    for (var i = 0; i < layout.length; i++) {
      var it = layout[i];
      if (it.id === skipId) continue;
      if (x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h) return it;
    }
    return null;
  }

  /* These boards are packed edge to edge, so pushing colliders down always
     runs off the bottom and every drag would be refused. Trading places with
     whatever sits under the cursor is the move that still works on a full
     board, and it is what an operator expects on a fixed wall anyway. */
  function trySwap(layout, id, x, y, cols, rows) {
    var moving = find(layout, id);
    var target = itemCovering(layout, id, x, y);
    if (!target) return null;

    var a = Object.assign({}, moving, { x: target.x, y: target.y });
    var b = Object.assign({}, target, { x: moving.x, y: moving.y });
    if (a.x + a.w > cols || a.y + a.h > rows || b.x + b.w > cols || b.y + b.h > rows) return null;

    var next = layout.map(function (i) {
      if (i.id === a.id) return a;
      if (i.id === b.id) return b;
      return i;
    });
    return anyCollision(next) ? null : next;
  }

  function moveElement(layout, id, x, y, cols, rows) {
    var moving = find(layout, id);
    if (!moving) return layout;

    var nx = clamp(x, 0, Math.max(0, cols - moving.w));
    var ny = clamp(y, 0, Math.max(0, rows - moving.h));
    if (nx === moving.x && ny === moving.y) return layout;

    var updated = Object.assign({}, moving, { x: nx, y: ny });
    var next = layout.map(function (i) {
      return i.id === id ? updated : i;
    });
    var resolved = compact(resolveCollisions(next, updated, true, 0));
    if (!overflows(resolved, rows)) return resolved;

    return trySwap(layout, id, nx, ny, cols, rows) || layout;
  }

  function resizeElementEdges(layout, id, dCol, dRow, edges, cols, rows) {
    var item = find(layout, id);
    if (!item) return layout;

    var x = item.x;
    var y = item.y;
    var w = item.w;
    var h = item.h;

    var minW = Math.min(item.minW || 1, cols);
    if (edges.right) {
      var maxWr = cols - item.x;
      w = clamp(item.w + dCol, Math.min(minW, maxWr), maxWr);
    } else if (edges.left) {
      var right = item.x + item.w;
      var maxWl = right;
      w = clamp(item.w - dCol, Math.min(minW, maxWl), maxWl);
      x = right - w;
    }

    var minH = item.minH || 1;
    if (edges.bottom) {
      h = clamp(item.h + dRow, minH, rows - item.y);
    }

    if (x === item.x && y === item.y && w === item.w && h === item.h) return layout;

    var updated = Object.assign({}, item, { x: x, y: y, w: w, h: h });
    var next = layout.map(function (i) {
      return i.id === id ? updated : i;
    });
    var resolved = compact(resolveCollisions(next, updated, false, 0));
    return overflows(resolved, rows) ? layout : resolved;
  }

  /* Pointer gestures, rAF-coalesced. The preview writes CSS custom properties
     straight onto the elements so a drag never re-renders anything. */
  function startPointerGesture(startEvent, onMove, onEnd) {
    var frame = 0;
    var latest = startEvent;

    function flush() {
      frame = 0;
      onMove(latest);
    }

    function move(ev) {
      latest = ev;
      if (!frame) frame = requestAnimationFrame(flush);
    }

    function up() {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('grid-dragging');
      onEnd();
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    document.body.classList.add('grid-dragging');
  }

  function applyGeometry(el, item) {
    el.style.setProperty('--grid-item-x', item.x);
    el.style.setProperty('--grid-item-y', item.y);
    el.style.setProperty('--grid-item-w', item.w);
    el.style.setProperty('--grid-item-h', item.h);
  }

  /**
   * Wire drag + resize on a surface whose children carry `data-grid-item`.
   * `opts.onCommit(layout)` fires once per completed gesture.
   */
  function attachInteraction(surface, state, opts) {
    var cols = opts.cols || COLS;
    var rows = opts.rows || ROWS;

    // Measured live off the surface, so a gesture always matches what CSS drew.
    function unitX() {
      return (surface.clientWidth + GAP) / cols;
    }

    function unitY() {
      return (surface.clientHeight + GAP) / rows;
    }

    function paint(layout) {
      for (var i = 0; i < layout.length; i++) {
        var el = surface.querySelector('[data-grid-item="' + layout[i].id + '"]');
        if (el) applyGeometry(el, layout[i]);
      }
    }

    function begin(ev, id, edges) {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      ev.preventDefault();

      var el = surface.querySelector('[data-grid-item="' + id + '"]');
      if (!el) return;

      var origin = cloneLayout(state.layout);
      var start = find(origin, id);
      var sx = ev.clientX;
      var sy = ev.clientY;
      var working = origin;

      el.setAttribute(edges ? 'data-resizing' : 'data-moving', '');

      startPointerGesture(
        ev,
        function (e) {
          var dCol = Math.round((e.clientX - sx) / unitX());
          var dRow = Math.round((e.clientY - sy) / unitY());
          working = edges
            ? resizeElementEdges(origin, id, dCol, dRow, edges, cols, rows)
            : moveElement(origin, id, start.x + dCol, start.y + dRow, cols, rows);
          paint(working);
          if (opts.onPreview) opts.onPreview(id);
        },
        function () {
          el.removeAttribute(edges ? 'data-resizing' : 'data-moving');
          state.layout = working;
          paint(working);
          if (opts.onCommit) opts.onCommit(working);
        },
      );
    }

    surface.addEventListener('pointerdown', function (ev) {
      var handle = ev.target.closest('[data-resize-handle]');
      var item = ev.target.closest('[data-grid-item]');
      if (!item) return;
      var id = item.getAttribute('data-grid-item');

      if (handle) {
        var dir = handle.getAttribute('data-resize-handle');
        begin(ev, id, {
          right: dir.indexOf('e') !== -1,
          left: dir.indexOf('w') !== -1,
          bottom: dir.indexOf('s') !== -1,
        });
        return;
      }

      // Buttons and chips inside the header must not start a drag.
      if (ev.target.closest('[data-no-drag]')) return;
      if (!ev.target.closest('[data-drag-handle]')) return;
      begin(ev, id, null);
    });

    return { paint: paint };
  }

  global.AxGrid = {
    COLS: COLS,
    ROWS: ROWS,
    GAP: GAP,
    clamp: clamp,
    collides: collides,
    compact: compact,
    cloneLayout: cloneLayout,
    moveElement: moveElement,
    resizeElementEdges: resizeElementEdges,
    applyGeometry: applyGeometry,
    attachInteraction: attachInteraction,
  };
})(window);
