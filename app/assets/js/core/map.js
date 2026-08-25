/* Offline map.

   The prototypes drew their maps with Leaflet from cdnjs on top of Carto tiles,
   which cannot work on a conference machine with no internet. So the tiles are
   baked instead: assets/js/data/ksa-basemap.js holds the real Carto raster --
   coastlines, roads, borders, city labels -- stitched, graded into the SCE
   palette and inlined as one WebP (see tools/bake-basemap.py).

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

    /* Grow the viewBox along whichever axis the panel has to spare, so the core
       area is always fully visible no matter how the operator resizes. */
    var view = { w: coreW, h: coreH };

    function fit() {
      var box = container.getBoundingClientRect();
      if (!box.width || !box.height) return;

      var aspect = box.width / box.height;
      var w = coreW;
      var h = coreH;
      if (aspect > coreW / coreH) w = coreH * aspect;
      else h = coreW / aspect;

      view.w = w;
      view.h = h;

      var x = coreCx - w / 2;
      var y = coreCy - h / 2;
      svg.setAttribute('viewBox', x.toFixed(3) + ' ' + y.toFixed(3) + ' ' + w.toFixed(3) + ' ' + h.toFixed(3));

      // Everything that has to cover the viewport rather than a fixed extent.
      var full = [ground, maskAll, scrim];
      for (var i = 0; i < full.length; i++) {
        full[i].setAttribute('x', x);
        full[i].setAttribute('y', y);
        full[i].setAttribute('width', w);
        full[i].setAttribute('height', h);
      }
    }

    fit();
    new ResizeObserver(fit).observe(container);

    var hud = document.createElement('div');
    hud.className = 'map-hud';
    container.appendChild(hud);

    var foot = document.createElement('div');
    foot.className = 'map-foot';
    container.appendChild(foot);

    var credit = document.createElement('div');
    credit.className = 'map-credit';
    /* Pinned LTR. Both strings are Latin, and the attribution opens with a bare
       "\u00a9" — a bidi-neutral character, so on the Arabic board it resolved to
       the paragraph direction and jumped to the far end of the line:
       "OpenStreetMap \u00b7 \u00a9 CARTO \u00a9". The credit Carto and OSM require has to
       read the way they wrote it in both locales. */
    credit.dir = 'ltr';
    credit.innerHTML =
      '<span class="map-attr">' + KSA_BASEMAP.credit + '</span><span>Powered by Axion</span>';
    container.appendChild(credit);

    /**
     * mode: {
     *   points: [[lat, lng, value, label, variant?]],
     *   tone, maxRadius, hud: {value, format, label}, note
     * }
     */
    function render(mode) {
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

      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var ratio = max ? Math.sqrt(p[2] / max) : 0;
        var r = Math.max(minR, ratio * maxR);
        var circle = svgEl('circle', {
          cx: px(p[1]).toFixed(3),
          cy: py(p[0]).toFixed(3),
          r: r.toFixed(3),
          class: 'map-dot' + (p[4] ? ' map-dot--' + p[4] : ''),
          style: 'color:' + (mode.tone || Chart.TONE.cy),
        });
        if (p[3]) {
          var title = svgEl('title', {});
          title.textContent = p[3];
          circle.appendChild(title);
        }
        frag.appendChild(circle);
      }
      markers.appendChild(frag);

      hud.innerHTML = mode.hud
        ? '<div class="map-hud-value hud-value" style="color:' +
          (mode.tone || Chart.TONE.cy) +
          '">' +
          Counter.span(mode.hud.value, mode.hud.format || 'compact') +
          (mode.hud.unit ? '<span class="unit">' + mode.hud.unit + '</span>' : '') +
          '</div><div class="map-hud-label">' +
          mode.hud.label +
          '</div>'
        : '';

      foot.textContent = mode.note || '';
      if (mode.legend) {
        foot.innerHTML = mode.legend;
      }
    }

    return { render: render, el: container };
  }

  global.AxMap = { create: create };
})(window);
