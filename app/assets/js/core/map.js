/* Offline map.

   The prototypes drew their maps with Leaflet from cdnjs on top of Carto tiles,
   which cannot work on a conference machine with no internet. So the tiles are
   baked instead: assets/js/data/ksa-basemap.js holds the real Carto raster --
   coastlines, roads, borders -- stitched, graded into the SCE palette and
   inlined as one WebP (see tools/bake-basemap.py).

   The plate is Web Mercator, and this renderer's screen space is longitude by
   projected latitude, so placing it is a plain linear mapping and the baked
   pixels line up with the bubbles drawn over them. The Natural Earth outlines
   in ksa-geo.js stay on top for the one thing the raster cannot say: which of
   these countries is the subject. */

(function (global) {
  'use strict';

  /* Mercator, expressed in the same units as longitude degrees so both axes of
     the viewBox share one scale and the peninsula keeps its proportions. */
  function mercatorY(lat) {
    var clamped = Math.max(-85, Math.min(85, lat));
    return (Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) * 180) / Math.PI;
  }

  /* The area that must stay on screen whatever shape the panel is: Saudi Arabia
     plus a margin. Everything baked outside it is context that may be cropped. */
  var CORE = { west: 33.2, south: 15.2, east: 57.2, north: 33.2 };

  var uid = 0;

  /* --- The living map ------------------------------------------------------
     The customer's one presentational ask that is not in Figma: the wall must
     read as something being watched right now rather than a printed poster.
     None of it touches a figure — the dataset is the customer's own and
     reconciled — so the whole of it is arrival and rhythm.

     Two devices, and the split between them is a performance decision.

     A bubble grows into place. Below `STAGGER_MAX` points each dot gets its
     own delay and the map seeds itself city by city, which is the effect
     asked for. Above it — the field-survey mode plots 2,840 offices — a
     per-element animation would be 2,840 keyframed transforms on one SVG, so
     the whole marker layer fades in as one instead. The line is drawn at the
     number of animated elements, not at anything the viewer can see.

     Three rings ping, forever, on the three largest points of whatever mode
     is showing. Three, because that is the whole cost: three composited
     transforms, no matter how many thousand dots are underneath them. */
  var STAGGER_MAX = 80;
  var PINGS = 3;

  function svgEl(name, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
    return el;
  }

  function create(container) {
    // Screen space: x is longitude, y is projected latitude flipped so north is
    // up. Both in degrees, so one viewBox unit means the same on either axis.
    function px(lng) {
      return lng;
    }

    function py(lat) {
      return -mercatorY(lat);
    }

    var coreLeft = px(CORE.west);
    var coreRight = px(CORE.east);
    var coreTop = py(CORE.north);
    var coreBottom = py(CORE.south);
    var coreW = coreRight - coreLeft;
    var coreH = coreBottom - coreTop;
    var coreCx = (coreLeft + coreRight) / 2;
    var coreCy = (coreTop + coreBottom) / 2;

    function pathOf(rings) {
      var d = '';
      for (var r = 0; r < rings.length; r++) {
        var ring = rings[r];
        for (var i = 0; i < ring.length; i++) {
          d += (i === 0 ? 'M' : 'L') + px(ring[i][0]).toFixed(3) + ' ' + py(ring[i][1]).toFixed(3);
        }
        d += 'Z';
      }
      return d;
    }

    container.innerHTML = '';
    container.classList.add('map');

    var svg = svgEl('svg', {
      preserveAspectRatio: 'xMidYMid slice',
      class: 'map-svg',
    });

    var ground = svgEl('rect', { class: 'map-ground' });
    svg.appendChild(ground);

    /* The baked raster, placed by its own bbox. Both axes are linear in this
       space, so no resampling and no per-frame projection maths. */
    var bbox = KSA_BASEMAP.bbox;
    svg.appendChild(
      svgEl('image', {
        href: KSA_BASEMAP.src,
        x: px(bbox[0]),
        y: py(bbox[3]),
        width: px(bbox[2]) - px(bbox[0]),
        height: py(bbox[1]) - py(bbox[3]),
        preserveAspectRatio: 'none',
        class: 'map-plate',
      }),
    );

    /* The raster gives every country equal weight, so a scrim goes over the lot
       with Saudi Arabia masked out of it. Filling the neighbours directly would
       be simpler but the Natural Earth outlines are simplified and would show a
       ragged seam along every coast; this way the only edge that has to line up
       is Saudi's own, and the border stroke below covers it. */
    var maskId = 'mapFocusMask-' + (uid += 1);
    var defs = svgEl('defs', {});
    var mask = svgEl('mask', { id: maskId, maskUnits: 'userSpaceOnUse' });
    var maskAll = svgEl('rect', { fill: '#fff' });
    mask.appendChild(maskAll);
    mask.appendChild(svgEl('path', { d: pathOf(KSA_GEO.focus), fill: '#000' }));
    defs.appendChild(mask);
    svg.appendChild(defs);

    var scrim = svgEl('rect', { class: 'map-scrim', mask: 'url(#' + maskId + ')' });
    svg.appendChild(scrim);
    svg.appendChild(svgEl('path', { d: pathOf(KSA_GEO.focus), class: 'map-focus' }));

    var markers = svgEl('g', { class: 'map-markers' });
    svg.appendChild(markers);
    container.appendChild(svg);

    /* --- The ping layer, and why it is HTML ---
       The rings that pulse over the three largest points are plain <div>s in a
       layer over the plate, not <circle>s in the SVG beside the bubbles they
       ring. That is not a preference; it is the only version of this that is
       free.

       Chrome does not composite a transform animation on an SVG child: it
       relays out the SVG on every frame. Measured with tools/perf.mjs, three
       ringed circles took an idle, untouched board from 0 layout passes in six
       seconds to 684 — about two a frame, for the lifetime of a wall that runs
       unattended all day. `will-change: transform` did not help; it is not a
       promotion problem. The same three rings as HTML transforms cost 0.

       The price is this: an HTML overlay has no viewBox, so the projection the
       SVG does for free has to be done by hand. `place()` below is that, and
       it runs where the viewBox is already being computed — every fit(), i.e.
       every resize — so the rings track the plate exactly. */
    var resizeObserver = null;
    var pingLayer = document.createElement('div');
    pingLayer.className = 'map-pings';
    container.appendChild(pingLayer);
    var pings = [];

    /* Grow the viewBox along whichever axis the panel has to spare, so the core
       area is always fully visible no matter how the operator resizes -- but
       never past the plate, which is the other half of this and the half that
       was missing.

       The baked raster covers lon 24-67 by lat 8-38, i.e. 43 by 33.1 units of
       this screen space. The growth above is unbounded, so a portrait panel
       asked for more latitude than exists: on a 4:3 tablet the Big Screen's
       map card is 395x635, aspect 0.62, and the core grew to 38.6 units tall
       against a 33.1-unit plate. `slice` cannot cover what the image does not
       contain, so the panel showed a hard horizontal cut with the ground
       colour above and below it -- the map "cropped in height".

       So the extent is capped at the plate's own, on both axes, keeping the
       panel's aspect (one factor, not one per axis, or the peninsula would
       stretch). Past the cap the core stops being fully visible -- there is no
       third option once the panel is squarer than the imagery -- and what goes
       is the outer margin the core carries for exactly this, not the country. */
    var plateW = px(bbox[2]) - px(bbox[0]);
    var plateH = py(bbox[1]) - py(bbox[3]);
    var view = { w: coreW, h: coreH, x: coreCx - coreW / 2, y: coreCy - coreH / 2, scale: 1, ox: 0, oy: 0 };

    function fit() {
      var box = container.getBoundingClientRect();
      if (!box.width || !box.height) return;

      var aspect = box.width / box.height;
      var w = coreW;
      var h = coreH;
      if (aspect > coreW / coreH) w = coreH * aspect;
      else h = coreW / aspect;

      var cap = Math.min(1, plateW / w, plateH / h);
      if (cap < 1) {
        w *= cap;
        h *= cap;
      }

      view.w = w;
      view.h = h;

      /* Centred on the core, then pushed back inside the plate: at the cap the
         two centres do not coincide (the raster carries more sea to the south
         than desert to the north), and an extent centred on the core would
         hang off the top edge by the difference. */
      var x = Math.min(Math.max(coreCx - w / 2, px(bbox[0])), px(bbox[2]) - w);
      var y = Math.min(Math.max(coreCy - h / 2, py(bbox[3])), py(bbox[1]) - h);
      svg.setAttribute('viewBox', x.toFixed(3) + ' ' + y.toFixed(3) + ' ' + w.toFixed(3) + ' ' + h.toFixed(3));

      /* The same mapping `preserveAspectRatio="xMidYMid slice"` applies to the
         SVG's own contents, written out so the HTML layer above can use it:
         cover the box, then centre the overflow. */
      view.x = x;
      view.y = y;
      view.scale = Math.max(box.width / w, box.height / h);
      view.ox = (box.width - w * view.scale) / 2;
      view.oy = (box.height - h * view.scale) / 2;

      // Everything that has to cover the viewport rather than a fixed extent.
      var full = [ground, maskAll, scrim];
      for (var i = 0; i < full.length; i++) {
        full[i].setAttribute('x', x);
        full[i].setAttribute('y', y);
        full[i].setAttribute('width', w);
        full[i].setAttribute('height', h);
      }

      placePings();
    }

    /** Project each ring's map position into the layer's pixel box. */
    function placePings() {
      for (var i = 0; i < pings.length; i++) {
        var ping = pings[i];
        var size = ping.r * 2 * view.scale;
        var left = view.ox + (px(ping.lng) - view.x) * view.scale - size / 2;
        var top = view.oy + (py(ping.lat) - view.y) * view.scale - size / 2;
        ping.el.style.width = size.toFixed(2) + 'px';
        ping.el.style.height = size.toFixed(2) + 'px';
        ping.el.style.left = left.toFixed(2) + 'px';
        ping.el.style.top = top.toFixed(2) + 'px';
        ping.el.style.borderWidth = Math.max(1, size * 0.06).toFixed(2) + 'px';
      }
    }

    fit();

    /* The observer is held, not dropped on the floor.

       `new ResizeObserver(fit).observe(container)` keeps no reference to the
       observer, and an observer nothing references is collectable: it fired
       once and then, at some point after the first GC, stopped. That was
       invisible for as long as the only thing it drove was the viewBox, since
       `preserveAspectRatio="slice"` covers the panel whatever aspect the
       viewBox claims — a stale one just reads as a slightly different zoom.
       It stopped being invisible the moment fit() also had to place the HTML
       ping layer, which has no slice to hide behind. Every other observer in
       the app (chart-dsl's shared one, board.js's two) is already held; this
       was the one that was not.

       The rAF is the other half. A map mounts before its grid item is
       painted, so the first fit() measures a 1x1 box — the card's own
       hairline, with no content between — and one frame later the geometry is
       real. */
    resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);
    requestAnimationFrame(fit);

    var hud = document.createElement('div');
    hud.className = 'map-hud';
    var hudBody = document.createElement('div');
    hudBody.className = 'map-hud-body';
    var foot = document.createElement('div');
    foot.className = 'map-foot';
    hud.appendChild(hudBody);
    hud.appendChild(foot);
    container.appendChild(hud);

    var credit = document.createElement('div');
    credit.className = 'map-credit';
    /* `dir="ltr"` goes on the inner span, not on the plate.

       The mark and "Powered by" are both Latin and would otherwise pick up
       the Arabic board's paragraph direction, so the run does have to be
       pinned. But CSS logical properties resolve against the element's OWN
       direction, so pinning the plate pinned its `inset-inline-end` too: on
       the Arabic board the credit stayed in the physical right corner while
       the HUD — which is positioned logically — moved there as well, and the
       two sat on top of each other. Text pinned, box mirrored. */
    credit.innerHTML = '<span dir="ltr">Powered by ' + Fmt.axionMark + '</span>';
    container.appendChild(credit);

    /**
     * mode: {
     *   points: [[lat, lng, value, label, variant?]],
     *   tone, maxRadius, hud: {value, format, label}, note
     *
     * `variant` is 'ok' | 'mid' | 'warn' — the field-verification licence
     * states, which override the mode tone (see .map-dot--* in map.css).
     * }
     */
    function render(mode) {
      /* A view switch (the map's own chip tabs) rebuilds every bubble; a
         hover tooltip already self-heals on the next pointermove, but a
         touch-pinned one would otherwise keep describing a bubble that no
         longer exists. */
      if (global.Tooltip) global.Tooltip.hide();
      while (markers.firstChild) markers.removeChild(markers.firstChild);

      var points = mode.points || [];
      var max = 0;
      for (var m = 0; m < points.length; m++) if (points[m][2] > max) max = points[m][2];

      /* Sized against the fixed core extent, never the viewBox: the viewBox
         grows with the panel's aspect, so keying off it made a bubble mean
         different things in a wide panel and a square one. */
      var maxR = mode.maxRadius || coreW * 0.045;
      var minR = mode.minRadius || coreW * 0.0035;
      var frag = document.createDocumentFragment();

      /* The touch target rides the SAME fixed-core-extent convention as
         minR/maxR just above, rather than converting a screen-pixel target
         through the container's current box size: a board can call
         render() while its panel is mid-transition (hidden, mid-slide, not
         yet laid out), and a ratio measured at that instant would bake a
         wrong -- sometimes wildly wrong -- radius into every bubble with no
         later correction (fit()'s resize handler re-fits the viewBox, but
         never re-touches already-drawn markers). A fraction of coreW carries
         no such moment to be wrong at. */
      var touchMinR = coreW * 0.02;

      /* Which points get a ping, decided before the loop so the loop stays a
         loop: the three largest by the same value the radius is drawn from. */
      var tone = mode.tone || Chart.TONE.cy;
      var staggered = points.length <= STAGGER_MAX;
      var rank = points
        .map(function (p, index) {
          return { index: index, value: p[2] };
        })
        .sort(function (a, b) {
          return b.value - a.value;
        })
        .slice(0, PINGS);
      var pingAt = {};
      for (var k = 0; k < rank.length; k++) pingAt[rank[k].index] = k;

      pingLayer.innerHTML = '';
      pings = [];

      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var ratio = max ? Math.sqrt(p[2] / max) : 0;
        var r = Math.max(minR, ratio * maxR);
        var cx = px(p[1]).toFixed(3);
        var cy = py(p[0]).toFixed(3);
        var circle = svgEl('circle', {
          cx: cx,
          cy: cy,
          r: r.toFixed(3),
          class: 'map-dot' + (p[4] ? ' map-dot--' + p[4] : ''),
          /* `--i` is the seeding delay's only input; it is read by the
             keyframe's `animation-delay` and ignored under `.is-bulk`. */
          style: 'color:' + tone + ';--i:' + (staggered ? i : 0),
        });
        frag.appendChild(circle);

        if (pingAt[i] !== undefined) {
          var ring = document.createElement('div');
          ring.className = 'map-ping';
          ring.style.color = tone;
          ring.style.setProperty('--i', pingAt[i]);
          pingLayer.appendChild(ring);
          pings.push({ el: ring, lat: p[0], lng: p[1], r: Math.max(r, coreW * 0.012) });
        }

        if (p[3]) {
          var hit = svgEl('circle', {
            cx: cx,
            cy: cy,
            r: Math.max(r, touchMinR).toFixed(3),
            fill: 'transparent',
            style: 'pointer-events:all',
          });
          hit.setAttribute('data-tip-label', p[3]);
          hit.setAttribute('data-tip-tone', mode.tone || Chart.TONE.cy);
          frag.appendChild(hit);
        }
      }
      markers.appendChild(frag);

      /* The class is written after the fragment lands, and written twice.
         `.is-seeding` restarts on its own because every dot under it is a new
         element; `.is-bulk` animates the group, which is the same element as
         last time, and re-adding a class an element already carries restarts
         nothing. Clearing it and flushing is what makes re-entering the
         field-survey mode seed again rather than sit there. */
      markers.setAttribute('class', 'map-markers');
      void markers.getBoundingClientRect();
      markers.setAttribute('class', 'map-markers ' + (staggered ? 'is-seeding' : 'is-bulk'));
      /* fit(), not placePings(): a chip switch happens with the panel laid
         out, so this is the cheapest moment to re-measure, and it lands the
         rings on the first frame of the mode they belong to rather than one
         observer callback later. */
      fit();

      /* No inline colour on the figure. It is a factoid — Figma's Tips block
         (node 5044:95235) draws it in the same white as the ones in the panels
         either side — and it was the last number on the wall still taking the
         active map mode's tone, so switching a map chip repainted it while the
         four factoids beside it stayed white. The mode's tone still carries
         the bubbles and the tooltip, which is where it means something. */
      hudBody.innerHTML = mode.hud
        ? '<div class="map-hud-value hud-value">' +
          Counter.span(mode.hud.value, mode.hud.format || 'compact') +
          '</div><div class="map-hud-label">' +
          mode.hud.label +
          '</div>'
        : '';

      foot.textContent = mode.note || '';
    }

    return { render: render, el: container };
  }

  global.AxMap = { create: create };
})(window);
