import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.request import Request, urlopen

import fitz


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/datos-electorales/candidaturas-proclamadas-2026.pdf"
CORRECTION_SOURCE = ROOT / "public/datos-electorales/candidaturas-proclamadas-2026-correccion.pdf"
OUTPUT = ROOT / "public/datos-electorales/candidaturas.json"
MAP_OUTPUT = ROOT / "src/data/provincias.json"
MAP_URL = "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson"

PROVINCES = {
    "01": ("Araba/Álava", ["ALAVA", "ARABA", "ARABA ALAVA"]),
    "02": ("Albacete", ["ALBACETE"]),
    "03": ("Alicante", ["ALICANTE", "ALACANT"]),
    "04": ("Almería", ["ALMERIA"]),
    "05": ("Ávila", ["AVILA"]),
    "06": ("Badajoz", ["BADAJOZ"]),
    "07": ("Illes Balears", ["BALEARES", "ILLES BALEARS", "ISLAS BALEARES"]),
    "08": ("Barcelona", ["BARCELONA"]),
    "09": ("Burgos", ["BURGOS"]),
    "10": ("Cáceres", ["CACERES"]),
    "11": ("Cádiz", ["CADIZ"]),
    "12": ("Castellón", ["CASTELLON", "CASTELLO"]),
    "13": ("Ciudad Real", ["CIUDAD REAL"]),
    "14": ("Córdoba", ["CORDOBA"]),
    "15": ("A Coruña", ["A CORUNA", "LA CORUNA"]),
    "16": ("Cuenca", ["CUENCA"]),
    "17": ("Girona", ["GIRONA", "GERONA"]),
    "18": ("Granada", ["GRANADA"]),
    "19": ("Guadalajara", ["GUADALAJARA"]),
    "20": ("Gipuzkoa", ["GUIPUZCOA", "GIPUZKOA"]),
    "21": ("Huelva", ["HUELVA"]),
    "22": ("Huesca", ["HUESCA"]),
    "23": ("Jaén", ["JAEN"]),
    "24": ("León", ["LEON"]),
    "25": ("Lleida", ["LLEIDA", "LERIDA"]),
    "26": ("La Rioja", ["LA RIOJA", "RIOJA"]),
    "27": ("Lugo", ["LUGO"]),
    "28": ("Madrid", ["MADRID"]),
    "29": ("Málaga", ["MALAGA"]),
    "30": ("Murcia", ["MURCIA"]),
    "31": ("Navarra", ["NAVARRA"]),
    "32": ("Ourense", ["OURENSE", "ORENSE"]),
    "33": ("Asturias", ["ASTURIAS"]),
    "34": ("Palencia", ["PALENCIA"]),
    "35": ("Las Palmas", ["LAS PALMAS"]),
    "36": ("Pontevedra", ["PONTEVEDRA"]),
    "37": ("Salamanca", ["SALAMANCA"]),
    "38": ("Santa Cruz de Tenerife", ["SANTA CRUZ DE TENERIFE"]),
    "39": ("Cantabria", ["CANTABRIA"]),
    "40": ("Segovia", ["SEGOVIA"]),
    "41": ("Sevilla", ["SEVILLA"]),
    "42": ("Soria", ["SORIA"]),
    "43": ("Tarragona", ["TARRAGONA"]),
    "44": ("Teruel", ["TERUEL"]),
    "45": ("Toledo", ["TOLEDO"]),
    "46": ("Valencia", ["VALENCIA"]),
    "47": ("Valladolid", ["VALLADOLID"]),
    "48": ("Bizkaia", ["VIZCAYA", "BIZKAIA"]),
    "49": ("Zamora", ["ZAMORA"]),
    "50": ("Zaragoza", ["ZARAGOZA"]),
    "51": ("Ceuta", ["CEUTA"]),
    "52": ("Melilla", ["MELILLA"]),
}
PROVINCE_LOOKUP = {
    re.sub(r"[^A-Z0-9]", "", alias): code
    for code, (_, aliases) in PROVINCES.items()
    for alias in aliases
}
PROVINCE_LOOKUP.update({re.sub(r"[^A-Z0-9]", "", name): code for code, (name, _) in PROVINCES.items()})


def normalized(value):
    value = unicodedata.normalize("NFKD", value)
    return "".join(char for char in value if not unicodedata.combining(char)).upper()


def clean_name(value):
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+\([A-Z][A-Z0-9 -]*(?:\([A-Z0-9-]+\))?\)\.?$", "", value)
    return value.rstrip(". ")


# Lines that always start a new block: they never continue the previous line.
BLOCK_START = re.compile(
    r"^(?:\d+\.\s+|Suplentes?\b|Titular(?:es)?:|No proclamada\b|CONGRESO DE LOS DIPUTADOS$|SENADO$|JUNTA ELECTORAL DE\b)",
    re.IGNORECASE,
)


def normalized_lines(text):
    source = [
        re.sub(r"\s+", " ", re.sub(r"[\u200b-\u200f\ufeff]", "", line).replace("\u00a0", " ").strip())
        for line in text.splitlines()
    ]
    source = [line for line in source if line]
    output = []
    index = 0
    while index < len(source):
        line = source[index]
        # A numbered line (or a "Suplente N:" line) that does not end with "." or
        # ")" continues on the next lines (long names and party names). A party
        # line that ends with ")" is complete: the next line can be
        # "No proclamada." for that party.
        if re.match(r"^(?:\d+\.\s+|Suplente \d+:)", line, re.IGNORECASE) and not line.endswith((".", ")")):
            while index + 1 < len(source) and not BLOCK_START.match(source[index + 1]):
                index += 1
                line += " " + source[index]
                if line.endswith((".", ")")):
                    break
        output.append(line)
        index += 1
    return output


def province_from_heading(line):
    match = re.search(r"JUNTA ELECTORAL DE\s+(.+)$", line.strip(), re.IGNORECASE)
    if not match:
        return None
    heading = re.sub(r"[^A-Z0-9]", "", normalized(match.group(1)))
    return PROVINCE_LOOKUP.get(heading)


def parse_pdf():
    document = fitz.open(SOURCE)
    candidaturas = []
    current_province = None
    current_constituency = None
    current_chamber = None
    current_slate = None
    # The last numbered person that was added: (list, entry). If "No proclamada."
    # comes directly after it, that line was the name of a list that was not
    # proclaimed (for example "9. José María Calvo Guerra" in Málaga), not a person.
    last_person = None
    for page in document:
        text = page.get_text()
        for line in normalized_lines(text):
            province = province_from_heading(line)
            if province:
                current_province = province
                current_constituency = PROVINCES[province][0]
                current_chamber, current_slate, last_person = None, None, None
                continue
            constituency = re.match(r"Circunscripci[oó]n electoral:\s*(.+)$", line, re.IGNORECASE)
            if constituency:
                current_constituency = constituency.group(1).strip()
                continue
            if current_province is None:
                continue
            if line == "CONGRESO DE LOS DIPUTADOS":
                current_chamber, current_slate, last_person = "Congreso", None, None
                continue
            if line == "SENADO":
                current_chamber, current_slate, last_person = "Senado", None, None
                continue
            if current_chamber is None:
                continue
            suplente = re.match(r"^Suplente\s+(\d+):\s*([^.;]+)", line, re.IGNORECASE)
            if suplente and current_chamber == "Senado" and current_slate and current_slate["titulares"]:
                current_slate["titulares"][-1]["suplentes"].append(
                    {"numero": int(suplente.group(1)), "nombre": clean_name(suplente.group(2))}
                )
                last_person = None
                continue

            numbered = re.match(r"^(\d+)\.\s+(.+)$", line)
            if not numbered:
                # Ceuta writes "Suplente:" (singular); the other boards write "Suplentes:".
                if re.match(r"^suplentes?:", line, re.IGNORECASE) and current_slate:
                    current_slate["modoSuplentes"] = True
                    last_person = None
                elif re.match(r"^no proclamada\b", line, re.IGNORECASE) and last_person:
                    people, entry = last_person
                    people.remove(entry)
                    last_person = None
                elif re.match(r"^no proclamada\b", line, re.IGNORECASE) and current_slate:
                    current_slate["proclamada"] = False
                elif (
                    # Valladolid writes the Senate candidates without a number.
                    current_chamber == "Senado"
                    and current_slate
                    and current_slate["camara"] == "Senado"
                    and line.endswith(".")
                    and not re.search(r"\d", line)
                ):
                    current_slate["titulares"].append({
                        "numero": len(current_slate["titulares"]) + 1,
                        "nombre": clean_name(line),
                        "suplentes": [],
                    })
                    last_person = None
                continue

            number, body = int(numbered.group(1)), numbered.group(2).strip()
            if (body.endswith(")") and not body.endswith(").")) or (body.isupper() and not body.endswith(".")):
                current_slate = {
                    "provincia": current_province,
                    "circunscripcion": current_constituency,
                    "camara": current_chamber,
                    "orden": number,
                    "partido": body,
                    "titulares": [],
                    "suplentes": [],
                    "modoSuplentes": False,
                }
                candidaturas.append(current_slate)
                last_person = None
                continue
            if current_slate is None or current_slate["provincia"] != current_province or current_slate["camara"] != current_chamber:
                continue
            candidate = {"numero": number, "nombre": clean_name(body)}
            if current_chamber == "Congreso" and current_slate["modoSuplentes"]:
                current_slate["suplentes"].append(candidate)
                last_person = (current_slate["suplentes"], candidate)
            elif current_chamber == "Senado":
                # Ceuta writes "Suplente:" after each candidate and then numbers the
                # substitutes of the whole list in sequence (1, 2, 3, 4). A number
                # that does not continue that sequence is the next candidate.
                titulares = current_slate["titulares"]
                previous = sum(len(titular["suplentes"]) for titular in titulares)
                if current_slate["modoSuplentes"] and titulares and number == previous + 1:
                    entry = {"numero": len(titulares[-1]["suplentes"]) + 1, "nombre": candidate["nombre"]}
                    titulares[-1]["suplentes"].append(entry)
                    last_person = (titulares[-1]["suplentes"], entry)
                else:
                    current_slate["modoSuplentes"] = False
                    entry = {**candidate, "suplentes": []}
                    titulares.append(entry)
                    last_person = (titulares, entry)
            else:
                current_slate["titulares"].append(candidate)
                last_person = (current_slate["titulares"], candidate)

    candidaturas = [slate for slate in candidaturas if slate.pop("proclamada", True)]
    for slate in candidaturas:
        slate.pop("modoSuplentes", None)
    return candidaturas


def validate(candidaturas):
    """Stop if a list has numbering gaps or repeated numbers.

    The PDF uses different formats in different provinces. A format that the
    parser does not know usually moves people to the wrong list, and that
    gives a numbering gap or a repeated number.
    """
    problems = []
    for slate in candidaturas:
        label = f"{slate['provincia']} / {slate['camara']} / {slate['orden']}. {slate['partido']}"
        groups = [("titulares", slate["titulares"]), ("suplentes", slate["suplentes"])]
        groups += [(f"suplentes de {titular['nombre']}", titular.get("suplentes", [])) for titular in slate["titulares"]]
        for name, people in groups:
            numbers = [person["numero"] for person in people]
            if numbers != list(range(1, len(numbers) + 1)):
                problems.append(f"{label}: {name} {numbers}")
        if slate["camara"] == "Congreso" and not slate["titulares"]:
            problems.append(f"{label}: no candidates")
    if problems:
        raise ValueError("Unexpected candidate numbering:\n" + "\n".join(problems))


def slate_for(candidaturas, province, chamber, party_fragment):
    matches = [
        slate for slate in candidaturas
        if slate["provincia"] == province
        and slate["camara"] == chamber
        and party_fragment.casefold() in slate["partido"].casefold()
    ]
    if len(matches) != 1:
        raise ValueError(f"Expected one slate for {province} / {chamber} / {party_fragment}, found {len(matches)}")
    return matches[0]


def replace_candidate(slate, collection, old, new):
    entries = slate[collection]
    matches = [entry for entry in entries if entry["nombre"] == old]
    if len(matches) != 1:
        raise ValueError(f"Expected one candidate {old!r} in {slate['provincia']} / {slate['partido']}")
    matches[0]["nombre"] = new


def replace_candidate_by_number(slate, collection, number, expected_name, new_name):
    matches = [
        entry for entry in slate[collection]
        if entry["numero"] == number and normalized(entry["nombre"]) == normalized(expected_name)
    ]
    if len(matches) != 1:
        raise ValueError(f"Expected candidate {number} {expected_name!r} in {slate['provincia']} / {slate['partido']}")
    matches[0]["nombre"] = new_name


def replace_supplement(slate, old, new):
    matches = [
        suplente for titular in slate["titulares"]
        for suplente in titular.get("suplentes", [])
        if suplente["nombre"] == old
    ]
    if len(matches) != 1:
        raise ValueError(f"Expected one substitute {old!r} in {slate['provincia']} / {slate['partido']}")
    matches[0]["nombre"] = new


def apply_corrections(candidaturas):
    slate = slate_for(candidaturas, "05", "Senado", "PARTIDO POPULAR")
    replace_supplement(slate, "Vidal García Jaramillo", "Vidal Galicia Jaramillo")
    slate = slate_for(candidaturas, "22", "Congreso", "SE ACABÓ LA FIESTA")
    replace_candidate(slate, "titulares", "Milagros Roca Pérez", "Milagros Roca López")
    slate = slate_for(candidaturas, "22", "Senado", "PARTIDO POPULAR")
    replace_supplement(slate, "Valeriano Terra Arroyos", "Valeriano Tella Arroyos")

    slate = slate_for(candidaturas, "26", "Congreso", "PARTIDO COMUNISTA DE LOS TRABAJADORES")
    slate["titulares"] = [
        {"numero": 1, "nombre": "Francisco Castro Portolés"},
        {"numero": 2, "nombre": "María Eugenia Oleaga Muguerza"},
        {"numero": 3, "nombre": "Gonzalo Alonso Alonso"},
        {"numero": 4, "nombre": "Lucía Sáenz Burgos"},
    ]
    slate["suplentes"] = [{"numero": 1, "nombre": "José Ángel Sáenz Díaz"}]
    slate = slate_for(candidaturas, "26", "Senado", "PARTIDO COMUNISTA DE LOS TRABAJADORES")
    slate["titulares"] = [
        {"numero": 1, "nombre": "Alejandro García Cáncer", "suplentes": [
            {"numero": 1, "nombre": "Lucía Antoñanzas Gil"},
            {"numero": 2, "nombre": "Sergio Ballesteros Muñoz"},
        ]}
    ]

    for chamber in ("Congreso", "Senado"):
        slate = slate_for(candidaturas, "31", chamber, "EUSKAL HERRIA BILDU-ESQUERRA REPUBLICANA")
        slate["partido"] = "EUSKAL HERRIA BILDU (EH BILDU)"
    slate = slate_for(candidaturas, "31", "Congreso", "SE ACABÓ LA FIESTA")
    replace_candidate_by_number(slate, "suplentes", 2, "Noelia Gonzalez Salmeron", "Noelia González Salmerón")
    slate = slate_for(candidaturas, "31", "Congreso", "FRENTE AMPLIO-FRONTE ZABALA")
    slate["partido"] = "FRENTE AMPLIO-FRONTE ZABALA (FRENTE AMPLIO-FRONTE ZABALA)"
    slate = slate_for(candidaturas, "43", "Congreso", "COMUNS-FRONT AMPLI")
    replace_candidate(slate, "titulares", "Ester Roca Domodel", "Ester Roca Domedel")
    slate = slate_for(candidaturas, "43", "Senado", "PARTIT COMUNISTA DELS TREBALLADORS")
    slate["orden"] = 5
    slate = slate_for(candidaturas, "43", "Senado", "VOX")
    slate["orden"] = 4
    slate = slate_for(candidaturas, "44", "Congreso", "PARTIDO SOCIALISTA OBRERO")
    replace_candidate(slate, "titulares", "Herminio Rufino Sancho Íniguez", "Herminio Rufino Sancho Íñiguez")
    slate = slate_for(candidaturas, "46", "Congreso", "PARTIDO COMUNISTA DE LOS TRABAJADORES")
    replace_candidate(slate, "titulares", "Francisco José Domenech Gomis", "Jose Francisco Domenech Gomis")


def simplify(points, tolerance):
    if len(points) <= 3:
        return points
    start, end = points[0], points[-1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    denominator = dx * dx + dy * dy
    farthest, index = 0, 0
    for i, point in enumerate(points[1:-1], 1):
        if denominator:
            distance = abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / denominator**0.5
        else:
            distance = ((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2) ** 0.5
        if distance > farthest:
            farthest, index = distance, i
    if farthest <= tolerance:
        return [start, end]
    left = simplify(points[: index + 1], tolerance)
    right = simplify(points[index:], tolerance)
    return left[:-1] + right


def ring_points(ring, project):
    points = [project(point) for point in ring]
    if points[0] == points[-1]:
        points = points[:-1]
    if len(points) > 4:
        farthest = max(range(1, len(points)), key=lambda index: (points[index][0] - points[0][0]) ** 2 + (points[index][1] - points[0][1]) ** 2)
        first = simplify(points[: farthest + 1], 0.75)
        second = simplify(points[farthest:] + points[:1], 0.75)
        points = first[:-1] + second[:-1]
    return points


def ring_path(ring, project):
    points = ring_points(ring, project)
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in points) + "Z"


def get_polygons(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise ValueError(f"Unsupported map geometry: {geometry['type']}")


def feature_rings(feature):
    return [ring for polygon in get_polygons(feature["geometry"]) for ring in polygon]


def bounds(points):
    return (
        min(point[0] for point in points),
        min(point[1] for point in points),
        max(point[0] for point in points),
        max(point[1] for point in points),
    )


def polygon_area(points):
    return abs(sum(
        points[index][0] * points[(index + 1) % len(points)][1]
        - points[(index + 1) % len(points)][0] * points[index][1]
        for index in range(len(points))
    )) / 2


# Layout of the 1000×680 map. The Canary Islands share one inset frame so that
# both provinces keep their real relative position. The source geometry of
# Ceuta and Melilla has only a few points, so each one is drawn as a circle at
# its geographic position.
MAP_WIDTH, MAP_HEIGHT = 1000, 680
X_FACTOR = 0.766
CANARIAS_FRAME = {"x": 12, "y": 548, "ancho": 250, "alto": 124}
CANARIAS_PADDING = 10
CITY_RADIUS = 15
# Ceuta is very near the coast of Cádiz; move it down so that the circles do not touch.
CITY_OFFSETS = {"51": (0, 20), "52": (0, 0)}
CITY_LABEL_SIDE = {"51": "izquierda", "52": "derecha"}


def circle_path(x, y, r):
    return f"M{x - r:.1f},{y:.1f}A{r},{r} 0 1 0 {x + r:.1f},{y:.1f}A{r},{r} 0 1 0 {x - r:.1f},{y:.1f}Z"


def make_map():
    request = Request(MAP_URL, headers={"User-Agent": "Programas29N/1.0"})
    with urlopen(request, timeout=30) as response:
        geojson = json.load(response)
    features = {str(feature["properties"]["cod_prov"]).zfill(2): feature for feature in geojson["features"]}
    if set(features) != set(PROVINCES):
        raise ValueError(f"Expected the 52 Spanish province geometries, found {len(features)}")

    mainland_codes = set(PROVINCES) - {"35", "38", "51", "52"}
    min_lon, min_lat, max_lon, max_lat = bounds([
        point for code in mainland_codes for ring in feature_rings(features[code]) for point in ring
    ])
    scale = min(780 / ((max_lon - min_lon) * X_FACTOR), 570 / (max_lat - min_lat))

    def main_project(point):
        return 175 + (point[0] - min_lon) * X_FACTOR * scale, 35 + (max_lat - point[1]) * scale

    canarias_points = [point for code in ("35", "38") for ring in feature_rings(features[code]) for point in ring]
    can_min_lon, can_min_lat, can_max_lon, can_max_lat = bounds(canarias_points)
    inner_width = CANARIAS_FRAME["ancho"] - 2 * CANARIAS_PADDING
    inner_height = CANARIAS_FRAME["alto"] - 2 * CANARIAS_PADDING
    can_scale = min(inner_width / ((can_max_lon - can_min_lon) * X_FACTOR), inner_height / (can_max_lat - can_min_lat))
    can_offset_x = CANARIAS_FRAME["x"] + (CANARIAS_FRAME["ancho"] - (can_max_lon - can_min_lon) * X_FACTOR * can_scale) / 2
    can_offset_y = CANARIAS_FRAME["y"] + (CANARIAS_FRAME["alto"] - (can_max_lat - can_min_lat) * can_scale) / 2

    def canarias_project(point):
        return can_offset_x + (point[0] - can_min_lon) * X_FACTOR * can_scale, can_offset_y + (can_max_lat - point[1]) * can_scale

    def city_marker(code):
        # The largest ring is the city; the others are small islets far away.
        main_ring = max(feature_rings(features[code]), key=lambda ring: polygon_area(ring))
        city_min_lon, city_min_lat, city_max_lon, city_max_lat = bounds(main_ring)
        x, y = main_project(((city_min_lon + city_max_lon) / 2, (city_min_lat + city_max_lat) / 2))
        x, y = x + CITY_OFFSETS[code][0], y + CITY_OFFSETS[code][1]
        return {"x": round(x, 1), "y": round(y, 1), "r": CITY_RADIUS, "rotulo": CITY_LABEL_SIDE[code]}

    provinces = []
    for code, (name, _) in PROVINCES.items():
        if code in {"51", "52"}:
            marker = city_marker(code)
            provinces.append({
                "codigo": code,
                "nombre": name,
                "d": circle_path(marker["x"], marker["y"], marker["r"]),
                "marcador": marker,
            })
            continue
        project = canarias_project if code in {"35", "38"} else main_project
        province = {
            "codigo": code,
            "nombre": name,
            "d": " ".join(ring_path(ring, project) for ring in feature_rings(features[code])),
        }
        provinces.append(province)
    return {
        "ancho": MAP_WIDTH,
        "alto": MAP_HEIGHT,
        "canarias": CANARIAS_FRAME,
        "provincias": provinces,
    }


def write_map():
    MAP_OUTPUT.write_text(json.dumps(make_map(), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def main():
    if "--solo-mapa" in sys.argv:
        write_map()
        print("Generated the province map")
        return
    candidaturas = parse_pdf()
    if not candidaturas:
        raise ValueError("No candidate lists were extracted from the official PDF")
    apply_corrections(candidaturas)
    validate(candidaturas)
    data = {
        "fecha": "7 de noviembre de 2026",
        "fuentes": [
            "/datos-electorales/candidaturas-proclamadas-2026.pdf",
            "/datos-electorales/candidaturas-proclamadas-2026-correccion.pdf",
        ],
        "provincias": [
            {
                "codigo": code,
                "nombre": name,
                "candidaturas": [
                    {key: value for key, value in slate.items() if key != "provincia"}
                    for slate in candidaturas
                    if slate["provincia"] == code
                ],
            }
            for code, (name, _) in PROVINCES.items()
        ],
    }
    missing = [province["nombre"] for province in data["provincias"] if not province["candidaturas"]]
    if missing:
        raise ValueError(f"No candidate lists were extracted for: {', '.join(missing)}")
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    write_map()
    print(f"Generated {len(candidaturas)} candidatures across {len(data['provincias'])} provinces")


if __name__ == "__main__":
    main()
