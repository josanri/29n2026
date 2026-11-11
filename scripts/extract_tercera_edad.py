"""Extract En Acción 3e's measures from its six-page political program."""
import json
import re
import sys
from collections import Counter

import fitz


SOURCE_URL = (
    "https://3edad.org/wp-content/uploads/2026/11/"
    "Programa_Politico_En_Accion_3e_2026_Propuesta_Revisada.pdf"
)
EXPECTED_PAGES = 6
EXPECTED_COUNTS = [5, 11, 4, 5, 4, 4, 5, 4, 3, 5, 5, 5, 3]
CATEGORIES = [
    "democracia",
    "social",
    "sanidad",
    "empleo",
    "vivienda",
    "educacion",
    "fiscalidad",
    "justicia",
    "inmigracion",
    "rural",
    "energia",
    "democracia",
    "exterior",
]
TARGET_GROUPS = {
    "mayores": r"\bpension|pensionista|jubilad|personas mayores|envejec|edadismo",
    "jovenes": r"\bj[oó]ven",
    "familias": r"\bfamilia",
    "empresas": r"\bempresa|pymes|industria",
    "autonomos": r"\baut[oó]nom",
    "rural": r"\brural|agricultura|ganader[ií]a|pesca",
    "inmigrantes": r"\binmigr|migraci[oó]n",
    "agentes": r"\bpolic[ií]a|fuerzas de seguridad",
    "pacientes": r"\bsanidad|sanitari|paciente|salud",
    "discapacidad": r"\bdependencia|discapacidad",
}
LEVERS = {
    "ley": r"\bley|reforma|reformar|normativa|legislaci[oó]n",
    "impuestos": r"\bIRPF\b|impuesto|fiscal|tribut",
    "gasto": r"\bfinanciaci[oó]n|financiar|inversi[oó]n|fondos?|ayudas?|recursos|presupuesto",
    "organizacion": r"\bcrear|creaci[oó]n|organismo|oficina|establecer|coordinar",
    "plan": r"\bplan|programa|estrategia|acuerdo|pacto",
}


def normalize(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    result = ""
    for line in lines:
        if result.endswith("-") and line[:1].islower():
            result = result[:-1] + line
        else:
            result = f"{result} {line}".strip()
    result = re.sub(r"\s+", " ", result)
    return re.sub(r"\s+([,.;:!?])", r"\1", result).strip()


def extract(document):
    if len(document) != EXPECTED_PAGES:
        raise ValueError(f"Se esperaban {EXPECTED_PAGES} páginas; el PDF tiene {len(document)}")

    areas = []
    current_area = None
    collecting = False

    for page_number, page in enumerate(document, start=1):
        blocks = sorted(
            (block for block in page.get_text("dict")["blocks"] if "lines" in block),
            key=lambda block: (block["bbox"][1], block["bbox"][0]),
        )
        for block in blocks:
            text = normalize(
                "\n".join(
                    "".join(span["text"] for span in line["spans"])
                    for line in block["lines"]
                )
            )
            heading = re.match(r"^(\d{1,2})\.\s+(.+)$", text)
            if heading and int(heading.group(1)) == len(areas) + 1:
                current_area = {
                    "id": int(heading.group(1)),
                    "title": heading.group(2),
                    "page": page_number,
                    "commitment": "",
                    "measures": [],
                }
                areas.append(current_area)
                collecting = False

            if current_area is None:
                continue

            commitment = re.match(r"^Compromiso:\s*(.+)$", text)
            if commitment:
                current_area["commitment"] = commitment.group(1)

            if re.search(r"medir el cumplimiento|seguimiento del cumplimiento", text, re.I):
                collecting = False
                continue

            measures_heading = re.match(r"^Medidas:\s*", text)
            if measures_heading:
                collecting = True
                text = text[measures_heading.end():]

            if collecting:
                if not re.search(r"[\uf0b7\u2022]", text):
                    continue
                for item in re.split(r"[\uf0b7\u2022]\s*", text):
                    item = normalize(item)
                    if item:
                        current_area["measures"].append(
                            {"page": page_number, "text": item}
                        )

    if len(areas) != len(EXPECTED_COUNTS):
        raise ValueError(f"Se esperaban 13 áreas; se encontraron {len(areas)}")
    for area, expected_count in zip(areas, EXPECTED_COUNTS):
        actual_count = len(area["measures"])
        if actual_count != expected_count:
            raise ValueError(
                f'{area["title"]}: se esperaban {expected_count} medidas; '
                f"se encontraron {actual_count}"
            )
        if not area["commitment"]:
            raise ValueError(f'{area["title"]}: falta el compromiso')

    return areas


def measure_title(text):
    sentence = re.split(r"(?<=[.!?])\s+", text, maxsplit=1)[0]
    if len(sentence) <= 78:
        return sentence
    return f"{sentence[:75].rsplit(' ', 1)[0]}..."


def classify(patterns, text):
    return [
        identifier
        for identifier, pattern in patterns.items()
        if re.search(pattern, text, re.I)
    ]


def create_program(document, areas):
    measures = []
    blocks = []
    sections = []
    verbs = Counter()

    for area in areas:
        area_id = area["id"]
        section_id = f"{area_id}.1"
        blocks.append(
            {
                "id": area_id,
                "titulo": area["title"],
                "lema": "",
                "cita": "",
                "intro": area["commitment"],
                "pagina": area["page"],
            }
        )
        sections.append(
            {
                "id": section_id,
                "bloque": area_id,
                "titulo": area["title"],
                "tituloFrase": area["title"],
                "intro": area["commitment"],
                "pagina": area["page"],
                "subapartados": [],
            }
        )
        for item in area["measures"]:
            number = len(measures) + 1
            text = item["text"]
            title = measure_title(text)
            first_word = re.match(r"[\wÁÉÍÓÚÜÑáéíóúüñ]+", text)
            if first_word:
                verbs[first_word.group(0).lower()] += 1
            measures.append(
                {
                    "n": number,
                    "bloque": area_id,
                    "seccion": section_id,
                    "pagina": item["page"],
                    "subapartado": None,
                    "titulo": title,
                    "tituloFrase": title,
                    "texto": text,
                    "oculta": False,
                    "categoria": CATEGORIES[area_id - 1],
                    "colectivos": classify(TARGET_GROUPS, text),
                    "palancas": classify(LEVERS, text),
                    "territorios": [],
                    "cifras": [],
                    "plazo": None,
                    "deroga": None,
                    "fuente": f"{SOURCE_URL}#page={item['page']}",
                }
            )

    if len(measures) != sum(EXPECTED_COUNTS):
        raise ValueError(f"Se esperaban 63 medidas; se encontraron {len(measures)}")

    return {
        "id": "tercera-edad",
        "partido": "Tercera Edad en Acción",
        "siglas": "3e",
        "color": "#a7513a",
        "colorClaro": "#d7b1a6",
        "programa": "Programa político En Acción 3e 2026",
        "subtitulo": "63 propuestas en 13 áreas",
        "elecciones": "Elecciones generales · 29 de noviembre de 2026",
        "observaciones": [
            "El documento se basa en la Declaración Política actualizada de En Acción 3e; no se identifica expresamente como programa electoral del 29N."
        ],
        "pdf": "/programas/en-accion-3e-2026.pdf",
        "fuentePdf": SOURCE_URL,
        "paginas": len(document),
        "fechaPdf": "2026-11-06",
        "unidadMedida": "medida",
        "unidadMedidas": "medidas",
        "presentacion": {
            "titulo": "Un programa político de 2026 en 13 áreas",
            "texto": (
                "El documento oficial reúne 63 medidas en 13 áreas. Su título y metadatos lo "
                "presentan como un programa político de 2026 basado en la Declaración Política "
                "actualizada de En Acción 3e, no expresamente como el programa electoral del 29N. "
                "Las medidas de seguimiento de la última página no se cuentan como propuestas."
            ),
        },
        "cifras": [],
        "plazos": [],
        "ordenPlazos": [],
        "verbos": [{"verbo": verb, "n": count} for verb, count in verbs.most_common(15)],
        "bloques": blocks,
        "secciones": sections,
        "medidas": measures,
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            "Uso: python scripts/extract_tercera_edad.py <pdf> <salida.json>"
        )
    document = fitz.open(sys.argv[1])
    program = create_program(document, extract(document))
    with open(sys.argv[2], "w", encoding="utf-8") as output:
        json.dump(program, output, ensure_ascii=False, indent=1)
    print(
        f'páginas {program["paginas"]}; áreas {len(program["bloques"])}; '
        f'medidas {len(program["medidas"])}'
    )


if __name__ == "__main__":
    main()
