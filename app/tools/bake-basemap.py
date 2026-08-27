#!/usr/bin/env python3
"""Bake the realistic basemap into a single offline image.

The prototypes drew a real basemap through Leaflet, which a conference
machine with no internet cannot do. Rather than fall back to a bare country
outline, this pulls two rasters once, stitches them, grades them into the SCE
palette and writes the result out as one WebP data URI. The app then has a
real map -- coastlines, borders, terrain relief -- and still never opens a
socket.

    python3 tools/bake-basemap.py

Source switched 2026-08-27: Carto's rastertiles/voyager_nolabels endpoint now
demands an API key (basemaps.cartocdn.com/basemaps/apikey) and returns a
watermarked placeholder without one -- see git history for the old grade().
Esri's public ArcGIS Online basemaps need no key. World_Terrain_Base carries
borders, water and a faint relief in one low-contrast plate (classified by
saturation, not hue: land and border are both near-white, water is the only
saturated tile); World_Shaded_Relief is unlabelled terrain-only hillshade,
multiplied in on top for the visible mountain texture the Figma reference
calls for that Terrain_Base alone is too flat to give.

Terrain_Base's own near-white plate is not flat, though -- mountain shading
dips its luminance across almost the same range a real border line does
(down to ~186/255 over the Zagros, with no border anywhere nearby), so a
plain luminance threshold reads every rugged range as a scribble of false
border ink. The fix leans on World_Shaded_Relief a second time: real relief
varies a lot pixel-to-pixel in rough terrain and barely at all on flat
ground, so a local-roughness gate built from Relief's own variance can tell
"mountain shadow" from "thin line crossing flat desert" even though the two
look alike in raw luminance. See border_gate() below.

Needs network, Pillow and NumPy. Run again only if the extent or palette
changes.
"""

import base64
import concurrent.futures as futures
import io
import math
import os
import urllib.request

import numpy as np
from PIL import Image

# West, south, east, north. Wider than anything the map widget can ask for: the
# renderer grows its viewport along whichever axis the panel has to spare, so a
# plate cut to the country's own extent leaves a bare band down the side of a
# wide panel. This covers the full range of shapes the panel can be dragged to.
BBOX = (24.0, 8.0, 67.0, 38.0)

# Display width tops out around 1400 px, so the plate is downsampled to keep two
# device pixels per CSS pixel and nothing is spent on resolution nobody sees.
MAX_WIDTH = 2400

# z6: labels are sized for z6 -- but these plates carry no labels at all, so
# unlike the old @2x Carto bake there is no retina tile to ask for.
ZOOM = 6

TERRAIN_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
RELIEF_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "assets", "js", "data", "ksa-basemap.js")

# Palette stops. Deliberately low-contrast: the basemap is a backdrop for cyan
# bubbles, so it has to stay well below them in both value and saturation.
# SCE navy: a teal-navy land mass, near-black water and a bright cyan-teal
# border/coast line, sampled from the reference render (2026-08-27).
LAND = (2, 51, 65)
WATER = (1, 2, 6)
INK = (27, 154, 165)  # borders
INK_WEIGHT = 0.6

# Shaded-relief luminance -> land brightness multiplier. Centred so a mid-grey
# relief pixel leaves the base colour untouched; shadows and ridges push it
# darker or lighter around that centre, which is what reads as terrain
# texture. The swing is wide (RELIEF_GAIN) because the border gate below
# already keeps rough terrain from reading as false ink, so relief contrast is
# free to carry the mountains on its own instead of borrowing false ink for it.
RELIEF_LO, RELIEF_HI = 0.3, 1.9
RELIEF_GAIN = 1.8

# Border-gate tuning: ROUGH_RADIUS sets the neighbourhood (px) that Relief's
# local variance is measured over; ROUGH_LO/HI is the smoothstep on that
# variance that fades ink out as terrain gets rougher. INK_LUM_HI tightens the
# luminance side of the classification to boot, since raising it back to the
# original 232 let the palette's brighter navy ink make the residual mountain
# noise visible again even with the gate in place.
ROUGH_RADIUS = 7
ROUGH_LO, ROUGH_HI = 3.5, 8.0
INK_LUM_LO, INK_LUM_HI = 253, 225


def lonlat_to_tile(lon, lat, zoom):
    n = 2.0**zoom
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def fetch(url, x, y):
    src = url.format(z=ZOOM, x=x, y=y)
    request = urllib.request.Request(src, headers={"User-Agent": "sce-leap-basemap-bake/1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return Image.open(io.BytesIO(response.read())).convert("RGB")


def mosaic(url, x0, x1, y0, y1, tile):
    canvas = Image.new("RGB", ((x1 - x0 + 1) * tile, (y1 - y0 + 1) * tile))
    jobs = {}
    with futures.ThreadPoolExecutor(max_workers=8) as pool:
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                jobs[pool.submit(fetch, url, x, y)] = (x, y)
        for job in futures.as_completed(jobs):
            x, y = jobs[job]
            canvas.paste(job.result(), ((x - x0) * tile, (y - y0) * tile))
    return canvas


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def luminance(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def local_variance(plane, radius):
    """Variance of `plane` in a (2*radius+1)-square window, via a box-filtered
    E[x^2] - E[x]^2 (integral image, so the window size doesn't cost more)."""

    def box_mean(a):
        padded = np.pad(a, radius, mode="edge")
        integral = np.cumsum(np.cumsum(padded, axis=0), axis=1)
        integral = np.pad(integral, ((1, 0), (1, 0)))
        k = 2 * radius + 1
        total = integral[k:, k:] - integral[:-k, k:] - integral[k:, :-k] + integral[:-k, :-k]
        return total / (k * k)

    mean1 = box_mean(plane)
    mean2 = box_mean(plane * plane)
    return np.clip(mean2 - mean1 * mean1, 0.0, None)


def border_gate(relief_lum):
    """1 on flat ground, fading to 0 as terrain gets rough.

    A thin border line and a mountain shadow can dip Terrain_Base's luminance
    by the same amount, so luminance alone cannot tell them apart (see module
    docstring). Relief's *local variance* can: real relief barely moves
    pixel-to-pixel over flat ground, so a border there stands out as the only
    high-variance thing around, but in genuinely rugged terrain the shading
    itself is high-variance everywhere, which is exactly where the false
    "border" ink was showing up as scribble. Gating ink by roughness keeps
    real border/coast lines crossing flat desert while suppressing shading
    dips in mountains -- at the cost of fading out any border that happens to
    run along a ridgeline instead of a valley, which is the trade this bake
    makes deliberately: a mountain range mis-read as unbroken land reads as
    terrain, but a mountain range full of glowing scribble reads as broken.
    """
    roughness = np.sqrt(local_variance(relief_lum, ROUGH_RADIUS))
    return 1.0 - smoothstep(ROUGH_LO, ROUGH_HI, roughness)


def grade(terrain, relief):
    """Esri terrain+relief RGB -> SCE navy, classifying by saturation.

    Terrain_Base is near-white for both land and borders and only mildly
    cyan-tinted for water, so wet/dry comes from saturation rather than the
    old blueness test; border ink comes from the small luminance gap that is
    left once water is excluded, gated by border_gate() so mountain shading
    doesn't get classified as ink too. Relief is then multiplied in for
    texture.
    """
    t = np.asarray(terrain, dtype=np.float64)
    r = np.asarray(relief, dtype=np.float64)

    sat = t.max(axis=2) - t.min(axis=2)
    lum = luminance(t)
    relief_lum = luminance(r)

    wet = smoothstep(15, 35, sat)
    ink = smoothstep(INK_LUM_LO, INK_LUM_HI, lum) * (1.0 - wet) * border_gate(relief_lum)

    land = np.array(LAND, dtype=np.float64)
    water = np.array(WATER, dtype=np.float64)
    ink_colour = np.array(INK, dtype=np.float64)

    colour = land[None, None, :] * (1.0 - wet[..., None]) + water[None, None, :] * wet[..., None]
    ink_t = (ink * INK_WEIGHT)[..., None]
    colour = colour * (1.0 - ink_t) + ink_colour[None, None, :] * ink_t

    shade = np.clip(0.65 + RELIEF_GAIN * (relief_lum / 255.0 - 0.5), RELIEF_LO, RELIEF_HI)
    colour = np.clip(colour * shade[..., None], 0.0, 255.0)

    return Image.fromarray(np.round(colour).astype(np.uint8))


def main():
    west, south, east, north = BBOX
    fx0, fy0 = lonlat_to_tile(west, north, ZOOM)
    fx1, fy1 = lonlat_to_tile(east, south, ZOOM)
    x0, x1 = int(math.floor(fx0)), int(math.floor(fx1))
    y0, y1 = int(math.floor(fy0)), int(math.floor(fy1))
    print("tiles: %d (%d..%d x %d..%d) at z%d" % ((x1 - x0 + 1) * (y1 - y0 + 1), x0, x1, y0, y1, ZOOM))

    terrain_mosaic = mosaic(TERRAIN_URL, x0, x1, y0, y1, 256)
    relief_mosaic = mosaic(RELIEF_URL, x0, x1, y0, y1, 256)

    # Crop to the exact bbox so the app can place the plate by coordinates
    # alone, with no tile arithmetic at runtime.
    box = (
        round((fx0 - x0) * 256),
        round((fy0 - y0) * 256),
        round((fx1 - x0) * 256),
        round((fy1 - y0) * 256),
    )
    terrain = terrain_mosaic.crop(box)
    relief = relief_mosaic.crop(box)

    if terrain.size[0] > MAX_WIDTH:
        height = round(terrain.size[1] * MAX_WIDTH / terrain.size[0])
        terrain = terrain.resize((MAX_WIDTH, height), Image.LANCZOS)
        relief = relief.resize((MAX_WIDTH, height), Image.LANCZOS)
    print("plate: %dx%d px" % terrain.size)

    plate = grade(terrain, relief)

    buffer = io.BytesIO()
    plate.save(buffer, format="WEBP", quality=84, method=6)
    payload = base64.b64encode(buffer.getvalue()).decode("ascii")
    print("webp: %.1f KB -> %.1f KB base64" % (len(buffer.getvalue()) / 1024, len(payload) / 1024))

    with open(TARGET, "w") as fh:
        fh.write(
            "/* Realistic basemap, baked by tools/bake-basemap.py.\n"
            "   Esri World_Terrain_Base + World_Shaded_Relief (c) Esri, graded into\n"
            "   the SCE palette and inlined so the app never contacts a tile server.\n"
            "   bbox is [west, south, east, north] in WGS84; the plate is Web Mercator, so\n"
            "   placing it is linear in longitude and in projected latitude. */\n"
            "var KSA_BASEMAP = {\n"
            "  bbox: [%s, %s, %s, %s],\n" % (west, south, east, north)
            + '  credit: "\\u00a9 Esri",\n'
            + '  src: "data:image/webp;base64,'
            + payload
            + '",\n'
            + "};\n"
        )
    print("wrote %s (%.1f KB)" % (TARGET, os.path.getsize(TARGET) / 1024))


if __name__ == "__main__":
    main()
