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
     Kinds without a Figma glyph (cartesian, radar, sankey, sunburst, table)
     render no icon rather than a guessed one. */
  /* The gap the title leaves between its ellipsis and the tab track, on top
     of the track's own measured width. The track sits 8px in from the card
     edge (see .widget-head > .chips) and the card's padding is 12px, so 8
     here puts the title's last glyph 4px clear of the track's left rim at the
     default scale. Read in px because the value it is added to is a measured
     px width. */
  var GUTTER_GAP = 8;

  var WIDGET_ICONS =
    '<span class="widget-icon" data-icon="indicator" aria-hidden="true">' +
    '<svg viewBox="0 0 14.9092 11.8955" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5.74902 0C7.45864 0.000128393 8.99382 0.772634 10.0469 1.99805L10.5527 0.395508H14.7539L12.5703 6.12207H12.5859L14.9092 11.4678H10.4648L10.3154 9.55859C9.2648 10.9783 7.6109 11.8954 5.74902 11.8955C2.5737 11.8955 0 9.23208 0 5.94727C0.000216247 2.66264 2.57384 0 5.74902 0ZM7.19141 1.83203C5.8484 1.36095 4.11322 2.82111 3.31543 5.09375C2.5176 7.36665 2.95966 9.59105 4.30273 10.0625C5.64581 10.5339 7.38088 9.07368 8.17871 6.80078C8.97645 4.52795 8.53444 2.30346 7.19141 1.83203Z" fill="#10B981"/>' +
    '</svg></span>' +
    '<span class="widget-icon" data-icon="progress-bars" aria-hidden="true">' +
    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14.5 3H2.5C2.22386 3 2 3.22386 2 3.5V4.5C2 4.77614 2.22386 5 2.5 5H14.5C14.7761 5 15 4.77614 15 4.5V3.5C15 3.22386 14.7761 3 14.5 3Z" fill="#6366F1" fill-opacity="0.2"/>' +
    '<path d="M14.5 11H2.5C2.22386 11 2 11.2239 2 11.5V12.5C2 12.7761 2.22386 13 2.5 13H14.5C14.7761 13 15 12.7761 15 12.5V11.5C15 11.2239 14.7761 11 14.5 11Z" fill="#6366F1" fill-opacity="0.2"/>' +
    '<path d="M14.5 7H2.5C2.22386 7 2 7.22386 2 7.5V8.5C2 8.77614 2.22386 9 2.5 9H14.5C14.7761 9 15 8.77614 15 8.5V7.5C15 7.22386 14.7761 7 14.5 7Z" fill="#6366F1" fill-opacity="0.2"/>' +
    '<path d="M12.5 3H2.5C2.22386 3 2 3.22386 2 3.5V4.5C2 4.77614 2.22386 5 2.5 5H12.5C12.7761 5 13 4.77614 13 4.5V3.5C13 3.22386 12.7761 3 12.5 3Z" fill="#6366F1"/>' +
    '<path d="M9.5 7H2.5C2.22386 7 2 7.22386 2 7.5V8.5C2 8.77614 2.22386 9 2.5 9H9.5C9.77614 9 10 8.77614 10 8.5V7.5C10 7.22386 9.77614 7 9.5 7Z" fill="#6366F1"/>' +
    '<path d="M5.5 11H2.5C2.22386 11 2 11.2239 2 11.5V12.5C2 12.7761 2.22386 13 2.5 13H5.5C5.77614 13 6 12.7761 6 12.5V11.5C6 11.2239 5.77614 11 5.5 11Z" fill="#6366F1"/>' +
    '</svg></span>' +
    '<span class="widget-icon" data-icon="pie" aria-hidden="true">' +
    '<svg viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4.39355 8.4834C4.91004 9.3886 5.88224 10 6.99902 10C7.30635 10 7.60266 9.95304 7.88184 9.86719L9.87012 13.3789C9.10254 13.7248 8.27881 13.9333 7.43555 13.9863C6.40722 14.051 5.37696 13.8881 4.41895 13.5088C3.46104 13.1295 2.59886 12.543 1.89355 11.792C1.32544 11.187 0.871686 10.4861 0.549805 9.72461L4.39355 8.4834Z" fill="#F59E0B"/>' +
    '<path d="M4.44674 5.42871C4.16465 5.88601 3.99947 6.42325 3.99947 7C3.99947 7.11592 4.00621 7.23028 4.019 7.34277L0.177207 8.58496C-0.0768236 7.49225 -0.0651546 6.35106 0.215293 5.25879C0.47743 4.23816 0.965028 3.29307 1.63912 2.49219L4.44674 5.42871Z" fill="#10B981"/>' +
    '<path d="M6.33887 4.07422C5.94749 4.16215 5.58555 4.3264 5.26855 4.55078L2.49023 1.64551C3.59594 0.714405 4.96179 0.150017 6.39844 0.0263672L6.33887 4.07422Z" fill="#EF4444"/>' +
    '<path d="M7.59766 0.0263672C8.93575 0.14204 10.2172 0.640363 11.2852 1.46875C12.5125 2.4208 13.388 3.75428 13.7744 5.25879C14.1607 6.76347 14.0359 8.35456 13.4189 9.78027C12.888 11.0072 12.0176 12.0505 10.918 12.7949L8.93457 9.28906C9.58472 8.73876 9.99902 7.91849 9.99902 7C9.99902 5.52754 8.93814 4.30318 7.53906 4.04883L7.59766 0.0263672Z" fill="#6366F1"/>' +
    '</svg></span>' +
    '<span class="widget-icon" data-icon="map" aria-hidden="true">' +
    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="8" cy="8" r="8" fill="#6366F1" fill-opacity="0.2"/>' +
    '<path d="M8.0625 1.00098C11.804 1.03524 14.842 4.00429 14.9893 7.71777L14.624 9.4375C14.5702 9.68988 14.2132 9.69926 14.1465 9.4502C14.1179 9.34274 14.0204 9.26765 13.9092 9.26758H13.2236C13.1823 9.26758 13.1409 9.27558 13.1025 9.29102L11.7715 9.82617C11.4945 9.93754 11.5027 10.3324 11.7842 10.4316L12.7266 10.7637C12.9998 10.8598 13.0191 11.2393 12.7568 11.3623L11.2529 12.0674C11.0969 12.1406 10.9102 12.0789 10.8291 11.9268L10.4668 11.2461C10.3978 11.1165 10.2494 11.0495 10.1064 11.083L9.54492 11.2148C9.32772 11.2658 9.22574 11.5161 9.3457 11.7041L9.91895 12.6006C9.99006 12.7118 10.1222 12.7685 10.252 12.7441L11.0938 12.5859C11.3276 12.5421 11.5277 12.7574 11.4668 12.9873L11.3154 13.5557C11.2967 13.6258 11.2543 13.6879 11.1963 13.7314L9.83301 14.7539C9.24769 14.9126 8.63263 15 7.99707 15C4.90728 15 2.28779 12.9972 1.35938 10.2197L1.49414 10.0166C1.56081 9.91651 1.67824 9.86155 1.79785 9.87402L4.33984 10.1387C4.38878 10.1438 4.43581 10.1605 4.47754 10.1865L5.28613 10.6924C5.3289 10.7191 5.37751 10.7355 5.42773 10.7402L8.18848 10.999C8.3519 11.0143 8.50094 10.9047 8.53516 10.7441L8.75781 9.69922C8.77656 9.61073 8.75747 9.51808 8.70508 9.44434L8.45605 9.09375C8.31925 8.90121 8.42801 8.63146 8.66016 8.58789L9.19531 8.4873C9.43503 8.44205 9.54 8.15842 9.3877 7.96777L9.09473 7.59961C8.94943 7.41806 8.66504 7.44513 8.55566 7.65039L8.5 7.75488C8.48335 7.78608 8.46133 7.81467 8.43555 7.83887L7.63965 8.58496C7.5745 8.64612 7.53812 8.73193 7.53809 8.82129V9.2373C7.53787 9.41588 7.3925 9.56055 7.21387 9.56055H6.79492C6.67541 9.56049 6.56598 9.49416 6.50977 9.38867L6.30273 9.00098C6.29336 8.98339 6.28197 8.96674 6.26953 8.95117L5.92383 8.51855C5.76694 8.32227 5.45144 8.46057 5.48926 8.70898C5.52883 8.97095 5.18296 9.10107 5.04004 8.87793L4.91699 8.68652C4.818 8.53171 4.60286 8.50433 4.46875 8.62988L3.61523 9.43164C3.53011 9.51152 3.40829 9.53875 3.29688 9.50391L2.02832 9.10742C1.81841 9.04177 1.73398 8.79063 1.86133 8.61133L2.0918 8.28711C2.17298 8.17284 2.31836 8.12319 2.45215 8.16504L2.8252 8.28223C3.00707 8.33911 3.1994 8.22733 3.23926 8.04102L3.4375 7.10742C3.46188 6.99334 3.54594 6.90116 3.65723 6.86621L4.36719 6.64453C4.39844 6.63477 4.43113 6.62988 4.46387 6.62988H5.84766C5.92989 6.62988 6.00934 6.59823 6.06934 6.54199L6.97363 5.69336C7.1099 5.5655 7.1099 5.34856 6.97363 5.2207L6.64941 4.91602C6.47926 4.75651 6.20127 4.82424 6.12305 5.04395L6.00195 5.38281C5.9847 5.43137 5.9565 5.47546 5.91895 5.51074L5.65918 5.75391C5.50375 5.89955 5.25253 5.85794 5.15234 5.66992L4.84277 5.08984C4.774 4.96079 4.80059 4.80124 4.90723 4.70117L6.19531 3.49316C6.25531 3.43692 6.33475 3.40527 6.41699 3.40527H6.84082C6.88834 3.40527 6.93549 3.41634 6.97852 3.43652L7.33887 3.60547C7.4589 3.66178 7.60155 3.63858 7.69824 3.54785L8.60645 2.69531C8.713 2.59529 8.73954 2.43662 8.6709 2.30762L8.08887 1.21484C8.05145 1.14462 8.04584 1.06935 8.0625 1.00098Z" fill="#10B981"/>' +
    '</svg></span>';

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
      plan.push({
        tabs: chipsEl._tabs || null,
        edges: chipsEl._tabs ? chipsEl._tabs.measure() : null,
        title: title,
        width: title ? chipsEl.offsetWidth : 0,
      });
    }
    if (!plan.length) return;

    for (var w = 0; w < plan.length; w++) {
      if (plan[w].tabs) plan[w].tabs.freeze(plan[w].edges);
      /* The track's own 8px inset from the card edge, plus one more so the
         title's ellipsis never touches it. Logical, because in Arabic the
         tabs sit on the other side. */
      if (plan[w].title) {
        plan[w].title.style.paddingInlineEnd = plan[w].width + GUTTER_GAP + 'px';
      }
    }

    /* One flush for the whole board, so the transitions the freezes
       suppressed are actually suppressed before they are restored. */
    if (flushHost) void flushHost.offsetWidth;

    for (var t = 0; t < plan.length; t++) if (plan[t].tabs) plan[t].tabs.thaw();
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
      WIDGET_ICONS +
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
