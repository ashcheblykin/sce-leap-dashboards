/* Board transitions.

   Agreed scope from the kick-off: tiles arrive one after another, leave the
   same way in reverse, and the numbers count up. Nothing else — opacity and
   transform only, so a modest conference PC never drops a frame. */

(function (global) {
  'use strict';

  var ENTER_STAGGER = 55;
  var EXIT_STAGGER = 35;
  var EXIT_FADE = 200;

  function readingOrder(items) {
    return items.slice().sort(function (a, b) {
      var ay = parseFloat(a.style.getPropertyValue('--grid-item-y')) || 0;
      var by = parseFloat(b.style.getPropertyValue('--grid-item-y')) || 0;
      var ax = parseFloat(a.style.getPropertyValue('--grid-item-x')) || 0;
      var bx = parseFloat(b.style.getPropertyValue('--grid-item-x')) || 0;
      return ay - by || ax - bx;
    });
  }

  /** Re-run counters and mark growth for a freshly rendered subtree. */
  function animate(root) {
    Counter.run(root);
    Chart.play(root);
  }

  function enter(surface) {
    var items = readingOrder(Array.prototype.slice.call(surface.querySelectorAll('[data-grid-item]')));
    for (var i = 0; i < items.length; i++) {
      items[i].style.setProperty('--enter-delay', i * ENTER_STAGGER + 'ms');
      items[i].removeAttribute('data-leaving');
      items[i].setAttribute('data-entering', '');
    }

    // Force a style flush so the transition actually runs from the hidden state.
    void surface.offsetHeight;

    requestAnimationFrame(function () {
      for (var j = 0; j < items.length; j++) items[j].removeAttribute('data-entering');
      animate(surface);
    });

    return items.length * ENTER_STAGGER + Counter.DURATION;
  }

  function exit(surface, done) {
    var items = readingOrder(
      Array.prototype.slice.call(surface.querySelectorAll('[data-grid-item]')),
    ).reverse();

    for (var i = 0; i < items.length; i++) {
      items[i].style.setProperty('--enter-delay', i * EXIT_STAGGER + 'ms');
      items[i].setAttribute('data-leaving', '');
    }

    setTimeout(done, items.length * EXIT_STAGGER + EXIT_FADE);
  }

  global.Motion = {
    animate: animate,
    enter: enter,
    exit: exit,
    ENTER_STAGGER: ENTER_STAGGER,
    EXIT_STAGGER: EXIT_STAGGER,
  };
})(window);
