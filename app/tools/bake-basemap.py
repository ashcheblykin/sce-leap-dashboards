#!/usr/bin/env python3
"""Bake the realistic basemap into a single offline image.

The prototypes drew a real Carto basemap through Leaflet, which a conference
machine with no internet cannot do. Rather than fall back to a bare country
outline, this pulls the raster once, stitches it, grades it into the SCE navy
palette and writes it out as one WebP data URI. The app then has a real map --
coastlines, roads, borders -- and still never opens a socket. No place-name
labels: the same "nolabels" tile the reference boards use, so a name never
reads upside-down or collides with a bubble drawn over it.

    python3 tools/bake-basemap.py

Carto's dark style cannot be graded cleanly because water and motorways share a
luminance (both 38/255), so the source here is Voyager, where water is
blue-shifted and roads are not. Classification is therefore by hue, not
brightness, and land, sea, sand and ink each get their own stop.

Needs network and Pillow. Run again only if the extent or palette changes.
"""

import base64
import concurrent.futures as futures
import io
import math
import os
import urllib.request

from PIL import Image

# West, south, east, north. Wider than anything the map widget can ask for: the
# renderer grows its viewport along whichever axis the panel has to spare, so a
# plate cut to the country's own extent leaves a bare band down the side of a
# wide panel. This covers the full range of shapes the panel can be dragged to.
BBOX = (24.0, 8.0, 67.0, 38.0)

# Display width tops out around 1400 px, so the plate is downsampled to keep two
# device pixels per CSS pixel and nothing is spent on resolution nobody sees.
MAX_WIDTH = 2400

# z6 at @2x: labels are sized for z6 but drawn at twice the resolution, which is
# what a wall needs -- big type, crisp edges. z7 would halve the label size.
ZOOM = 6
TILE = 512
RETINA = "@2x"

BASE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}%s.png" % RETINA
SUBDOMAINS = "abcd"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "assets", "js", "data", "ksa-basemap.js")

# Palette stops. Deliberately low-contrast: the basemap is a backdrop for cyan
# bubbles, so it has to stay well below them in both value and saturation.
LAND = (10, 33, 53)
DESERT = (13, 38, 58)
WATER = (3, 13, 25)
INK = (56, 124, 158)  # roads, borders, urban fabric
INK_WEIGHT = 0.6


def lonlat_to_tile(lon, lat, zoom):
    n = 2.0**zoom
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def fetch(url, x, y):
    src = url.format(s=SUBDOMAINS[(x + y) % len(SUBDOMAINS)], z=ZOOM, x=x, y=y)
    request = urllib.request.Request(src, headers={"User-Agent": "sce-leap-basemap-bake/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return Image.open(io.BytesIO(response.read())).convert("RGBA")


def mosaic(url, x0, x1, y0, y1):
    canvas = Image.new("RGBA", ((x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE))
    jobs = {}
    with futures.ThreadPoolExecutor(max_workers=8) as pool:
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                jobs[pool.submit(fetch, url, x, y)] = (x, y)
        for job in futures.as_completed(jobs):
            x, y = jobs[job]
            canvas.paste(job.result(), ((x - x0) * TILE, (y - y0) * TILE))
    return canvas


def smoothstep(edge0, edge1, x):
    t = (x - edge0) / (edge1 - edge0)
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    return t * t * (3.0 - 2.0 * t)


def mix(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def grade(plate):
    """Voyager RGB -> SCE navy, classifying by hue rather than brightness."""
    source = plate.load()
    out = Image.new("RGB", plate.size)
    target = out.load()
    width, height = plate.size

    for y in range(height):
        for x in range(width):
            r, g, b = source[x, y][:3]
            blueness = b - r
            luminance = 0.299 * r + 0.587 * g + 0.114 * b

            wet = smoothstep(4, 16, blueness)
            sand = smoothstep(-10, -35, blueness)
            # Anything printed darker than the page is infrastructure.
            ink = smoothstep(250, 205, luminance) * (1.0 - wet)

            colour = mix(mix(LAND, DESERT, sand), WATER, wet)
            target[x, y] = tuple(int(round(c)) for c in mix(colour, INK, ink * INK_WEIGHT))

    return out


def main():
    west, south, east, north = BBOX
    fx0, fy0 = lonlat_to_tile(west, north, ZOOM)
    fx1, fy1 = lonlat_to_tile(east, south, ZOOM)
    x0, x1 = int(math.floor(fx0)), int(math.floor(fx1))
    y0, y1 = int(math.floor(fy0)), int(math.floor(fy1))
    print(
        "tiles: %d (%d..%d x %d..%d) at z%d%s"
        % ((x1 - x0 + 1) * (y1 - y0 + 1), x0, x1, y0, y1, ZOOM, RETINA)
    )

    base = mosaic(BASE_URL, x0, x1, y0, y1)

    # Crop to the exact bbox so the app can place the plate by coordinates
    # alone, with no tile arithmetic at runtime.
    box = (
        round((fx0 - x0) * TILE),
        round((fy0 - y0) * TILE),
        round((fx1 - x0) * TILE),
        round((fy1 - y0) * TILE),
    )
    base = base.crop(box)

    if base.size[0] > MAX_WIDTH:
        height = round(base.size[1] * MAX_WIDTH / base.size[0])
        base = base.resize((MAX_WIDTH, height), Image.LANCZOS)
    print("plate: %dx%d px" % base.size)

    plate = grade(base)

    buffer = io.BytesIO()
    plate.save(buffer, format="WEBP", quality=84, method=6)
    payload = base64.b64encode(buffer.getvalue()).decode("ascii")
    print("webp: %.1f KB -> %.1f KB base64" % (len(buffer.getvalue()) / 1024, len(payload) / 1024))

    with open(TARGET, "w") as fh:
        fh.write(
            "/* Realistic basemap, baked by tools/bake-basemap.py.\n"
            "   Carto Voyager raster (c) OpenStreetMap contributors, (c) CARTO, graded into\n"
            "   the SCE palette and inlined so the app never contacts a tile server.\n"
            "   bbox is [west, south, east, north] in WGS84; the plate is Web Mercator, so\n"
            "   placing it is linear in longitude and in projected latitude. */\n"
            "var KSA_BASEMAP = {\n"
            "  bbox: [%s, %s, %s, %s],\n" % (west, south, east, north)
            + '  credit: "\\u00a9 OpenStreetMap \\u00b7 \\u00a9 CARTO",\n'
            + '  src: "data:image/webp;base64,'
            + payload
            + '",\n'
            + "};\n"
        )
    print("wrote %s (%.1f KB)" % (TARGET, os.path.getsize(TARGET) / 1024))


if __name__ == "__main__":
    main()
