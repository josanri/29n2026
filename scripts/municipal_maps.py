"""
Draws the map of the municipalities of each province for /resultados/: one JSON file for each province,
`public/<election>/mapas/municipios/<province>.json`, with the SVG path, the INE code and the name of each municipality.
The page loads the file of a province only when the reader opens it.

Source: es-atlas 0.6.0 (MIT), a TopoJSON of the «Líneas límite municipales» of the Instituto Geográfico Nacional
(CNIG). The script downloads the npm package to .cache/es-atlas/ the first time.

    python scripts/municipal_maps.py

Each province has its own projection: longitude times the cosine of the mean latitude, so the shapes keep their
proportions, fitted into a box 600 wide. The arcs are simplified once (Douglas-Peucker, 0.35 px) and then joined into
rings, so two neighbors share the same simplified border and there is no gap between them.
"""

import io
import json
import math
import os
import sys
import tarfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ELECTION = os.environ.get("ELECTION", "2026/generales")
CACHE = os.path.join(ROOT, ".cache", "es-atlas")
SOURCE = os.path.join(CACHE, "municipalities.json")
TARBALL = "https://registry.npmjs.org/es-atlas/-/es-atlas-0.6.0.tgz"
OUT_DIR = os.path.join(ROOT, "public", *ELECTION.split("/"), "mapas", "municipios")
WIDTH = 600
MAX_HEIGHT = 600
TOLERANCE = 0.35


def load_topology():
    if not os.path.exists(SOURCE):
        os.makedirs(CACHE, exist_ok=True)
        print(f"Descargando {TARBALL}")
        data = urllib.request.urlopen(TARBALL, timeout=60).read()
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            member = archive.getmember("package/es/municipalities.json")
            with open(SOURCE, "wb") as target:
                target.write(archive.extractfile(member).read())
    with open(SOURCE, encoding="utf-8") as source:
        return json.load(source)


def decode_arcs(topology):
    scale_x, scale_y = topology["transform"]["scale"]
    shift_x, shift_y = topology["transform"]["translate"]
    arcs = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * scale_x + shift_x, y * scale_y + shift_y))
        arcs.append(points)
    return arcs


def simplify(points, tolerance):
    """Douglas-Peucker on an open line: the two ends stay, so shared borders still meet."""
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    farthest, index = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if length:
            distance = abs(dy * px - dx * py + end[0] * start[1] - end[1] * start[0]) / length
        else:
            distance = math.hypot(px - start[0], py - start[1])
        if distance > farthest:
            farthest, index = distance, i
    if farthest <= tolerance:
        return [start, end]
    return simplify(points[: index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def polygons_of(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["arcs"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["arcs"]
    return []


def arc_ids(geometry):
    for polygon in polygons_of(geometry):
        for ring in polygon:
            for index in ring:
                yield index if index >= 0 else ~index


def main():
    topology = load_topology()
    arcs = decode_arcs(topology)
    municipalities = topology["objects"]["municipalities"]["geometries"]
    by_province = {}
    shared = []
    for geometry in municipalities:
        code = str(geometry.get("id", ""))
        if len(code) != 5 or not code.isdigit():
            continue
        # 53xxx: land that several municipalities share (no census, no votes). 54xxx: Gibraltar, out of the election.
        if code.startswith("53"):
            shared.append(geometry)
        elif int(code[:2]) <= 52:
            by_province.setdefault(code[:2], []).append(geometry)
    # A shared land goes to the province with which it shares the most border, so the province map has no hole.
    arc_province = {}
    for province, geometries in by_province.items():
        for geometry in geometries:
            for arc in arc_ids(geometry):
                arc_province.setdefault(arc, {}).setdefault(province, 0)
                arc_province[arc][province] += 1
    for geometry in shared:
        votes = {}
        for arc in arc_ids(geometry):
            for province, count in arc_province.get(arc, {}).items():
                votes[province] = votes.get(province, 0) + count
        if votes:
            by_province[max(votes, key=votes.get)].append({**geometry, "shared": True})

    os.makedirs(OUT_DIR, exist_ok=True)
    total_bytes = 0
    for province, geometries in sorted(by_province.items()):
        used = sorted({arc for geometry in geometries for arc in arc_ids(geometry)})
        points = [point for arc in used for point in arcs[arc]]
        min_lon = min(point[0] for point in points)
        max_lon = max(point[0] for point in points)
        min_lat = min(point[1] for point in points)
        max_lat = max(point[1] for point in points)
        x_factor = math.cos(math.radians((min_lat + max_lat) / 2))
        scale = min(WIDTH / ((max_lon - min_lon) * x_factor), MAX_HEIGHT / (max_lat - min_lat))
        width = round((max_lon - min_lon) * x_factor * scale, 1)
        height = round((max_lat - min_lat) * scale, 1)

        def project(point):
            return ((point[0] - min_lon) * x_factor * scale, (max_lat - point[1]) * scale)

        projected = {arc: simplify([project(point) for point in arcs[arc]], TOLERANCE) for arc in used}

        items = []
        for geometry in geometries:
            parts = []
            for polygon in polygons_of(geometry):
                for ring in polygon:
                    ring_points = []
                    for index in ring:
                        line = projected[index] if index >= 0 else projected[~index][::-1]
                        ring_points.extend(line if not ring_points else line[1:])
                    rounded = []
                    for x, y in ring_points:
                        point = (round(x, 1), round(y, 1))
                        if not rounded or point != rounded[-1]:
                            rounded.append(point)
                    if len(rounded) < 3:
                        continue
                    parts.append("M" + "L".join(f"{x:g},{y:g}" for x, y in rounded) + "Z")
            if parts:
                item = {"codigo": geometry["id"], "nombre": geometry.get("properties", {}).get("name", geometry["id"]), "d": "".join(parts)}
                if geometry.get("shared"):
                    item["compartido"] = True
                items.append(item)
        items.sort(key=lambda item: item["codigo"])
        text = json.dumps({"ancho": width, "alto": height, "municipios": items}, ensure_ascii=False, separators=(",", ":"))
        with open(os.path.join(OUT_DIR, f"{province}.json"), "w", encoding="utf-8") as target:
            target.write(text)
        total_bytes += len(text.encode("utf-8"))
    print(f"{len(by_province)} provincias, {sum(len(g) for g in by_province.values())} municipios, {total_bytes / 1e6:.1f} MB en {OUT_DIR}")


if __name__ == "__main__":
    sys.exit(main())
