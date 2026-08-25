#!/usr/bin/env python3
"""Bake the offline basemap.

Takes Natural Earth 50m country polygons, keeps Saudi Arabia plus the
neighbours that give the peninsula its silhouette, clips everything to the
viewport bbox, simplifies with Douglas-Peucker and writes a plain JS global.
Run once; the app never touches the network.

    python3 tools/bake-geo.py /tmp/ne50.geojson assets/js/data/ksa-geo.js
"""

import json
import sys

BBOX = (32.0, 13.5, 60.0, 34.5)  # west, south, east, north
TOLERANCE = 0.035  # degrees

FOCUS = "Saudi Arabia"
CONTEXT = [
    "Yemen", "Oman", "United Arab Emirates", "Qatar", "Bahrain", "Kuwait",
    "Iraq", "Jordan", "Israel", "Syria", "Egypt", "Sudan", "Eritrea",
    "Ethiopia", "Djibouti", "Somalia", "Somaliland", "Iran",
]


def perpendicular_distance(pt, start, end):
    if start == end:
        return ((pt[0] - start[0]) ** 2 + (pt[1] - start[1]) ** 2) ** 0.5
    dx, dy = end[0] - start[0], end[1] - start[1]
    t = ((pt[0] - start[0]) * dx + (pt[1] - start[1]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    px, py = start[0] + t * dx, start[1] + t * dy
    return ((pt[0] - px) ** 2 + (pt[1] - py) ** 2) ** 0.5


def simplify(points, tolerance):
    if len(points) < 3:
        return points
    dmax, index = 0.0, 0
    for i in range(1, len(points) - 1):
        d = perpendicular_distance(points[i], points[0], points[-1])
        if d > dmax:
            dmax, index = d, i
    if dmax > tolerance:
        left = simplify(points[: index + 1], tolerance)
        right = simplify(points[index:], tolerance)
        return left[:-1] + right
    return [points[0], points[-1]]


def intersects_bbox(ring):
    w, s, e, n = BBOX
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return not (max(xs) < w or min(xs) > e or max(ys) < s or min(ys) > n)


def rings_of(geometry):
    kind = geometry["type"]
    if kind == "Polygon":
        return [geometry["coordinates"][0]]
    if kind == "MultiPolygon":
        return [poly[0] for poly in geometry["coordinates"]]
    return []


def collect(feature, tolerance):
    out = []
    for ring in rings_of(feature["geometry"]):
        if not intersects_bbox(ring):
            continue
        pts = [(round(x, 3), round(y, 3)) for x, y in ring]
        deduped = [pts[0]]
        for p in pts[1:]:
            if p != deduped[-1]:
                deduped.append(p)
        if len(deduped) < 4:
            continue
        reduced = simplify(deduped, tolerance)
        if len(reduced) >= 4:
            out.append([[round(x, 3), round(y, 3)] for x, y in reduced])
    return out


def main():
    source, target = sys.argv[1], sys.argv[2]
    data = json.load(open(source))

    focus, context = [], []
    for feature in data["features"]:
        name = feature["properties"].get("NAME")
        if name == FOCUS:
            focus.extend(collect(feature, TOLERANCE * 0.5))
        elif name in CONTEXT:
            context.extend(collect(feature, TOLERANCE))

    payload = {"bbox": list(BBOX), "focus": focus, "context": context}
    body = json.dumps(payload, separators=(",", ":"))

    with open(target, "w") as fh:
        fh.write(
            "/* Offline basemap, baked by tools/bake-geo.py from Natural Earth\n"
            "   50m admin-0 country polygons (public domain). Simplified and clipped\n"
            "   to the Arabian peninsula so no tile server is ever contacted. */\n"
            "var KSA_GEO = " + body + ";\n"
        )

    print(
        "focus rings: %d (%d pts) | context rings: %d (%d pts) | %.1f KB"
        % (
            len(focus),
            sum(len(r) for r in focus),
            len(context),
            sum(len(r) for r in context),
            len(body) / 1024,
        )
    )


if __name__ == "__main__":
    main()
