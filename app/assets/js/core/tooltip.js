/* Shared mark tooltip, ported from axion.gen.web's map/chart hover +
   click-to-pin behaviour (docs/sdui-tooltips.md) onto this board's vanilla
   marks: one floating card, one delegated listener set, fed by
   `data-tip-*` attributes that chart-dsl.js and map.js write on their own
   marks rather than each owning a tooltip of its own.

   Two input modes, same content:
   - Mouse/pen HOVER: `pointerover`/`pointermove`/`pointerout` follow the
     cursor while it rests on a mark. This is transient -- it never steals
     focus and disappears the instant the pointer leaves.
   - Touch TAP: a touchscreen has no hover to open it and no cursor to park
     it under, so a tap PINS the card above the tapped mark instead. It stays
     open (surviving the finger lifting off the glass) until the next tap
     outside a mark, Escape, or the board tearing the chart down. Exactly the
     axion pattern: "click: tooltip ... also the way to see a tooltip on
     touch devices, which have no hover." */

(function (global) {
  'use strict';

  var ATTR = 'data-tip-label';
  var VIEWPORT_PAD = 10;
  var POINTER_OFFSET = 14;

  var card = null;
  var labelEl = null;
  var valueEl = null;
  var metaEl = null;

  var current = null; // the mark element the card currently describes
  var pinned = false;

  function build() {
    if (card) return;
    card = document.createElement('div');
    card.className = 'ax-tooltip';
    /* Announced politely rather than focused: a screen-reader user driving
       the board from the keyboard never triggers this at all (marks carry
       no tabindex, see the comment in chart-dsl.js), so this only narrates
       the hover/tap a sighted or touch user already initiated. */
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');

    labelEl = document.createElement('div');
    labelEl.className = 'ax-tooltip-label';
    labelEl.setAttribute('dir', 'auto');
    card.appendChild(labelEl);

    var valueRow = document.createElement('div');
    valueRow.className = 'ax-tooltip-value';
    valueEl = document.createElement('span');
    valueEl.className = 'ax-tooltip-num';
    valueRow.appendChild(valueEl);
    metaEl = document.createElement('span');
    metaEl.className = 'ax-tooltip-meta';
    metaEl.setAttribute('dir', 'auto');
    valueRow.appendChild(metaEl);
    card.appendChild(valueRow);

    document.body.appendChild(card);
  }

  function fillFrom(target) {
    labelEl.textContent = target.getAttribute('data-tip-label') || '';
    var value = target.getAttribute('data-tip-value') || '';
    valueEl.textContent = value;
    var meta = target.getAttribute('data-tip-meta');
    metaEl.textContent = meta || '';
    metaEl.style.display = meta ? '' : 'none';
    /* A map bubble hands over one pre-composed "City · 1,234,567" string as
       the label and nothing else -- charts split label/value in two, the
       map already decided how to say both in one line. Hiding the empty
       value row rather than leaving a blank bold line lets both shapes share
       one card. */
    var valueRow = valueEl.parentNode;
    valueRow.style.display = value ? '' : 'none';
    card.classList.toggle('is-label-only', !value);
    var tone = target.getAttribute('data-tip-tone');
    card.style.setProperty('--tip-tone', tone || 'var(--tx)');
  }

  /* Clamped to the viewport on every axis, and flipped to the side that has
     room rather than letting the card run under the cursor/finger it is
     supposed to be labelling. */
  function place(x, y, above) {
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var r = card.getBoundingClientRect();

    var left = x - r.width / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - r.width - VIEWPORT_PAD));

    var top = above ? y - r.height - POINTER_OFFSET : y + POINTER_OFFSET;
    if (top < VIEWPORT_PAD) top = y + POINTER_OFFSET;
    if (top + r.height > vh - VIEWPORT_PAD) top = y - r.height - POINTER_OFFSET;
    top = Math.max(VIEWPORT_PAD, Math.min(top, vh - r.height - VIEWPORT_PAD));

    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function showAtPointer(target, x, y) {
    build();
    fillFrom(target);
    current = target;
    card.classList.add('is-visible');
    place(x, y, true);
  }

  /* Pinned card anchors to the MARK's own box, not the touch point: a
     fingertip covers 8-10mm of glass, so anchoring to it would put the card
     under the very hand that opened it. */
  function showPinnedOn(target) {
    build();
    fillFrom(target);
    current = target;
    pinned = true;
    card.classList.add('is-visible', 'is-pinned');
    var r = target.getBoundingClientRect();
    place(r.left + r.width / 2, r.top, true);
  }

  function hide() {
    current = null;
    pinned = false;
    if (card) card.classList.remove('is-visible', 'is-pinned');
  }

  function markOf(ev) {
    return ev.target.closest ? ev.target.closest('[' + ATTR + ']') : null;
  }

  document.addEventListener('pointerover', function (ev) {
    if (pinned || ev.pointerType === 'touch') return;
    var mark = markOf(ev);
    if (mark) showAtPointer(mark, ev.clientX, ev.clientY);
  });

  document.addEventListener('pointermove', function (ev) {
    if (pinned || !current) return;
    var mark = markOf(ev);
    if (!mark) {
      hide();
      return;
    }
    if (mark !== current) fillFrom(mark);
    current = mark;
    place(ev.clientX, ev.clientY, true);
  });

  document.addEventListener('pointerout', function (ev) {
    if (pinned || !current) return;
    if (ev.target === current || (ev.target.closest && ev.target.closest('[' + ATTR + ']') === current)) {
      hide();
    }
  });

  /* Tap-to-pin. A real click (mouse) toggles the same way so a mouse user on
     a touch-style trackpad, or anyone who prefers not to hold the pointer
     still, gets the identical affordance. */
  document.addEventListener('click', function (ev) {
    var mark = markOf(ev);
    if (!mark) {
      if (pinned) hide();
      return;
    }
    if (pinned && current === mark) {
      hide();
      return;
    }
    showPinnedOn(mark);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && pinned) hide();
  });

  /* A resize or a scale nudge (`[`/`]`) reflows every mark's geometry under
     a pinned card without moving the card itself, so it drifts off the mark
     it is meant to be attached to. Cheapest correct fix: drop it: the mark
     is still tappable, and a stale card floating over new geometry would be
     worse than no card. */
  window.addEventListener('resize', hide);

  global.Tooltip = {
    hide: hide,
    attr: ATTR,
  };
})(window);
