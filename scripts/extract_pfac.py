"""Extract Feministas al Congreso's 14 numbered proposals from its official PDF."""
import json
import re
import sys

import fitz


SOURCE_URL = (
    "https://www.feministasalcongreso.es/wp-content/uploads/2026/10/Programa_1IMP.pdf"
)
EXPECTED_PAGES = 2
EXPECTED_PROPOSALS = 14
COLOR = "#7368AF"
LIGHT_COLOR = "#C0BBDB"
CATEGORIES = [
    "seguridad",
    "social",
    "familia",
    "social",
    "sanidad",
    "vivienda",
    "empleo",
    "social",
    "sanidad",
    "identidad",
    "energia",
    "democracia",
    "inmigracion",
    "exterior",
]
TARGET_GROUPS = {
    "mujeres": r"\bmujer|feminist|puter|proxenet|violencia machista",
    "infancia": r"\bmenor|niñ[oa]|infancia|adolescen|pornograf",
    "familias": r"\bcrianza|familia|dependencia",
    "jovenes": r"\bmenor|niñ[oa]|adolescen|j[oó]ven",
    "inmigrantes": r"\bmigran|inmigr|fronteras",
    "pacientes": r"\bsalud|sanidad|hormon|cirug[ií]a",
}
LEVERS = {
    "ley": r"\bley|prohibi|derogaci[oó]n|derogar|revocaci[oó]n|revocar",
    "impuestos": r"\bSMI\b|salario m[ií]nimo",
    "gasto": r"\bfinanciaci[oó]n|recursos|ayudas|servicios p[uú]blicos",
    "organizacion": r"\bcrear|creaci[oó]n|poner en marcha|ampliaci[oó]n",
    "plan": r"\bplan|pacto",
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


def extract_proposals(document):
    if len(document) != EXPECTED_PAGES:
        raise ValueError(f"Se esperaban {EXPECTED_PAGES} páginas; el PDF tiene {len(document)}")

    proposals = {}
    for page_number, page in enumerate(document, start=1):
        blocks = [block for block in page.get_text("dict")["blocks"] if "lines" in block]
        numbered_blocks = []
        text_blocks = []
        for block in blocks:
            text = normalize(
                "\n".join(
                    "".join(span["text"] for span in line["spans"])
                    for line in block["lines"]
                )
            )
            if not text:
                continue
            number_match = re.fullmatch(r"\d{1,2}", text)
            if number_match and block["bbox"][0] < 45:
                number = int(number_match.group())
                if 1 <= number <= EXPECTED_PROPOSALS:
                    numbered_blocks.append((number, block))
            elif block["bbox"][0] >= 45:
                text_blocks.append((text, block))

        for number, number_block in numbered_blocks:
            number_y = (number_block["bbox"][1] + number_block["bbox"][3]) / 2
            candidates = [
                (
                    abs(number_y - (block["bbox"][1] + block["bbox"][3]) / 2),
                    text,
                )
                for text, block in text_blocks
            ]
            distance, text = min(candidates, default=(float("inf"), ""))
            if distance > 20 or not text:
                raise ValueError(f"Propuesta {number}, pág. {page_number}: texto no encontrado")
            if number in proposals:
                raise ValueError(f"Propuesta {number}: aparece más de una vez")
            proposals[number] = {"page": page_number, "text": text}

    expected_numbers = set(range(1, EXPECTED_PROPOSALS + 1))
    if set(proposals) != expected_numbers:
        missing = sorted(expected_numbers - set(proposals))
        unexpected = sorted(set(proposals) - expected_numbers)
        raise ValueError(f"Numeración incorrecta: faltan {missing}; sobran {unexpected}")
    return [proposals[number] for number in sorted(proposals)]


def short_title(text):
    sentence = re.split(r"(?<=[.!?])\s+", text, maxsplit=1)[0]
    if len(sentence) <= 82:
        return sentence
    return f"{sentence[:79].rsplit(' ', 1)[0]}..."


def classify(patterns, text):
    return [identifier for identifier, pattern in patterns.items() if re.search(pattern, text, re.I)]


def create_program(document, proposals):
    measures = []
    sections = []
    figures = []

    for number, proposal in enumerate(proposals, start=1):
        text = proposal["text"]
        title = short_title(text)
        section_id = f"1.{number}"
        measures.append(
            {
                "n": number,
                "bloque": 1,
                "seccion": section_id,
                "pagina": proposal["page"],
                "subapartado": None,
                "titulo": title,
                "tituloFrase": title,
                "texto": text,
                "oculta": False,
                "categoria": CATEGORIES[number - 1],
                "colectivos": classify(TARGET_GROUPS, text),
                "palancas": classify(LEVERS, text),
                "territorios": [],
                "cifras": [],
                "plazo": None,
                "deroga": None,
                "fuente": f"{SOURCE_URL}#page={proposal['page']}",
            }
        )
        sections.append(
            {
                "id": section_id,
                "bloque": 1,
                "titulo": f"Propuesta {number} · {title}",
                "tituloFrase": title,
                "intro": "",
                "pagina": proposal["page"],
                "subapartados": [],
            }
        )

        if number == 7:
            measures[-1]["cifras"] = ["30 %", "30 horas"]
            figures.extend(
                [
                    {
                        "valor": "30 %",
                        "unidad": "sobre el alquiler medio",
                        "texto": (
                            "La propuesta formula un SMI un 30 % superior al coste medio de los "
                            "alquileres y vinculado al IPC; no concreta un importe monetario."
                        ),
                        "medida": number,
                    },
                    {
                        "valor": "30",
                        "unidad": "horas semanales",
                        "texto": "Avanzar hacia una jornada de 30 horas sin merma salarial.",
                        "medida": number,
                    },
                ]
            )

    return {
        "id": "pfac",
        "partido": "Feministas al Congreso",
        "siglas": "PFAC",
        "color": COLOR,
        "colorClaro": LIGHT_COLOR,
        "programa": "Nuestras propuestas",
        "subtitulo": "14 propuestas feministas",
        "elecciones": "Elecciones generales · 29 de noviembre de 2026",
        "pdf": "/programas/feministas-al-congreso-2026.pdf",
        "fuentePdf": SOURCE_URL,
        "paginas": len(document),
        "fechaPdf": "2026-10-20",
        "unidadMedida": "propuesta",
        "unidadMedidas": "propuestas",
        "presentacion": {
            "titulo": "Juntas hacemos historia",
            "texto": (
                "El programa oficial reúne 14 propuestas numeradas. La ficha conserva el texto "
                "completo y la página del PDF donde aparece cada una."
            ),
        },
        "cifras": figures,
        "plazos": [],
        "ordenPlazos": [],
        "verbos": [],
        "bloques": [
            {
                "id": 1,
                "titulo": "Nuestras propuestas",
                "lema": "Juntas hacemos historia",
                "cita": "",
                "intro": "Catorce propuestas numeradas del programa oficial de Feministas al Congreso.",
                "pagina": 1,
            }
        ],
        "secciones": sections,
        "medidas": measures,
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Uso: python scripts/extract_pfac.py <pdf> <salida.json>")
    document = fitz.open(sys.argv[1])
    program = create_program(document, extract_proposals(document))
    with open(sys.argv[2], "w", encoding="utf-8") as output:
        json.dump(program, output, ensure_ascii=False, indent=1)
    print(
        f'páginas {program["paginas"]}; propuestas {len(program["medidas"])}; '
        f'cifras {len(program["cifras"])}'
    )


if __name__ == "__main__":
    main()
