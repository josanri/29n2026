"""Extract the 191 numbered proposals in Por un Mundo Más Justo's 29N program."""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


SOURCE_URL = "https://www.porunmundomasjusto.es/wp-content/uploads/2026/11/Castellano.pdf"
EXPECTED_PAGES = 95
# A time phrase counts as a deadline only when the party promises it (see find_deadline).
DEADLINE_RE = re.compile(
    r"\b(48 horas?|72 horas?|15 d[ií]as?|30 d[ií]as?|60 d[ií]as?|"
    r"\d+ meses?|dos años|en \d{4}|anual|cada año)\b",
    re.I,
)
# Past tense and «fue»/«había» mark a fact, not a promise. «sólo» and «cómo» end in «ó» but are not past tense.
PAST_RE = re.compile(
    r"\b(?!s[oó]lo\b|c[oó]mo\b)(\w+(?:aron|ieron|eron|ió|ó)|fue|fueron|hab[ií]a|hab[ií]an|tuvo|tuvieron)\b",
    re.I,
)


def find_deadline(text):
    """Return the first deadline the party promises in the text, or None.

    A sentence is skipped when it has a past tense verb, when it names a year before 2026,
    or when it cites an existing legal deadline («plazo legal»).
    """
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        match = DEADLINE_RE.search(sentence)
        if not match or PAST_RE.search(sentence) or re.search(r"plazo legal", sentence, re.I):
            continue
        year = re.fullmatch(r"en (\d{4})", match.group(1), re.I)
        if year and int(year.group(1)) < 2026:
            continue
        return match.group(1)
    return None
AXES = [
    ("Vivienda", 4, "vivienda", "El programa propone ampliar la vivienda asequible, movilizar vivienda vacía y regular el alquiler."),
    ("Convivencia", 13, "social", "Reúne propuestas sobre convivencia, derechos, inclusión y respuesta a distintas formas de violencia."),
    ("Mayores", 16, "social", "Aborda pensiones, cuidados, autonomía y participación de las personas mayores."),
    ("Infancia y adolescencia", 19, "familia", "Incluye medidas de protección, bienestar, cuidados y derechos de niños, niñas y adolescentes."),
    ("Jóvenes", 22, "empleo", "Trata vivienda, empleo, educación, salud mental y participación juvenil."),
    ("Pensiones", 24, "social", "Propone cambios para reforzar la suficiencia y sostenibilidad de las pensiones."),
    ("Fiscalidad", 26, "fiscalidad", "Desarrolla medidas de reforma fiscal y distribución de las cargas tributarias."),
    ("Trabajo", 29, "empleo", "Reúne propuestas de empleo, derechos laborales, salarios y cuidados."),
    ("Autónomos", 32, "empleo", "Aborda cotización, protección social, emprendimiento y actividad de las personas autónomas."),
    ("Industria", 34, "innovacion", "Incluye propuestas sobre industria, innovación, empleo y desarrollo productivo."),
    ("Sanidad", 37, "sanidad", "Plantea medidas para reforzar la sanidad pública y mejorar su acceso y capacidad."),
    ("Salud mental", 41, "sanidad", "Propone prevención, atención psicológica y recursos públicos de salud mental."),
    ("Cuidados", 43, "sanidad", "Aborda los cuidados, la dependencia, la conciliación y el apoyo a quienes cuidan."),
    ("Educación", 45, "educacion", "Reúne medidas sobre igualdad educativa, centros, profesorado y aprendizaje."),
    ("Ciencia", 48, "innovacion", "Propone reforzar la investigación científica y su financiación."),
    ("Política migratoria", 50, "inmigracion", "Trata migración, acogida, derechos y políticas de integración."),
    ("Emergencia climática", 53, "energia", "Incluye medidas de adaptación, mitigación y transición frente al cambio climático."),
    ("Cuidado del planeta y la biodiversidad", 55, "rural", "Aborda biodiversidad, agricultura regenerativa, restauración ecológica y agua."),
    ("Transición energética", 58, "energia", "Propone cambios en generación, consumo y acceso a la energía."),
    ("Protección animal", 61, "rural", "Incluye medidas de bienestar y protección de los animales."),
    ("Cultura", 63, "identidad", "Trata acceso a la cultura, derechos culturales, memoria y actividad cultural rural."),
    ("Política exterior", 65, "exterior", "Reúne propuestas sobre relaciones internacionales, paz y cooperación."),
    ("Calidad democrática", 68, "democracia", "Aborda derechos, instituciones, transparencia y calidad democrática."),
    ("Buen gobierno", 72, "administracion", "Propone medidas sobre integridad pública, instituciones y rendición de cuentas."),
    ("Participación ciudadana", 74, "democracia", "Incluye canales de participación y fortalecimiento de la sociedad civil."),
    ("Pobreza", 76, "social", "Plantea medidas contra la pobreza y la exclusión social."),
    ("Igualdad de género y protección de los derechos de las mujeres", 78, "social", "Aborda violencia de género, autonomía económica y derechos de las mujeres."),
    ("Derechos LGTBI", 81, "social", "Reúne propuestas de igualdad, inclusión y protección de los derechos LGTBI."),
    ("Sinhogarismo", 83, "social", "Propone medidas de prevención y atención del sinhogarismo."),
    ("Prisiones", 86, "justicia", "Trata reinserción, condiciones penitenciarias, salud y acompañamiento."),
    ("Cooperación internacional", 88, "exterior", "Incluye propuestas de cooperación, ayuda al desarrollo y acción internacional."),
    ("Repoblación rural", 91, "rural", "Aborda servicios, actividad económica y población en el medio rural."),
]
EXPECTED_COUNTS = [
    11, 5, 6, 10, 5, 5, 7, 7, 5, 7, 8, 3, 4, 7, 2, 7,
    4, 5, 5, 4, 5, 8, 8, 7, 6, 6, 7, 3, 6, 6, 9, 3,
]

CATEGORIES = [
    ("vivienda", r"\bviviend|alquiler|hipotec|desahucio"),
    ("seguridad", r"\bpolic[ií]|violencia|delit|seguridad|acoso|abuso"),
    ("justicia", r"\bjusticia|juzgad|penitenciar|prisiones|c[aá]rcel"),
    ("inmigracion", r"\binmigr|migraci[oó]n|refugiad|asilo|extranjer"),
    ("democracia", r"\bdemocr|transparencia|participaci[oó]n|electoral|institucion"),
    ("social", r"\bpensi[oó]n|mayores|dependencia|pobreza|igualdad|discapacidad|derechos"),
    ("infraestructuras", r"\bferrocarril|carretera|transporte|infraestructura|agua"),
    ("identidad", r"\bcultura|memoria|lengua|patrimonio"),
    ("familia", r"\binfancia|niñ[oa]s?|adolescen|familia|crianza"),
    ("empleo", r"\bempleo|laboral|trabajo|salario|aut[oó]nom|empresa|contrataci[oó]n"),
    ("fiscalidad", r"\bfiscal|impuestos?|tribut|IRPF|IVA"),
    ("innovacion", r"\bciencia|investigaci[oó]n|industria|innovaci[oó]n|tecnolog"),
    ("rural", r"\brural|agr[ií]col|ganader|pesca|biodiversidad|animal"),
    ("educacion", r"\beducaci[oó]n|escuela|universidad|formaci[oó]n|docente"),
    ("sanidad", r"\bsanidad|sanitari|salud|hospital|cuidados|psicol[oó]g"),
    ("energia", r"\benerg[ií]a|clim[aá]t|renovable|emisiones|transici[oó]n"),
    ("exterior", r"\bexterior|internacional|cooperaci[oó]n|Uni[oó]n Europea|paz"),
    ("administracion", r"\badministraci[oó]n|gobierno|servicio p[uú]blico|burocracia"),
]
COLECTIVOS = {
    "jovenes": r"\bj[oó]ven(?:es)?\b|juventud|menores de \d+",
    "mayores": r"\bpersonas? mayores\b|jubilad\w*|pensionistas?|pensiones?",
    "mujeres": r"\bmujeres?\b|violencia de g[eé]nero",
    "familias": r"\bfamilias?\b|conciliaci[oó]n",
    "infancia": r"\bniñ[oa]s?\b|\binfancia\b|menores",
    "autonomos": r"\baut[oó]nom\w*|emprendedor\w*",
    "empresas": r"\bempresas?\b|empresarial|pymes|industria",
    "rural": r"\brural(?:es)?\b|agricultura|ganader[ií]a|pesca",
    "funcionarios": r"\bfuncionari\w*|empleados? p[uú]blicos?",
    "discapacidad": r"\bdiscapacidad\b|dependencia",
    "victimas": r"\bv[ií]ctimas?\b",
    "inmigrantes": r"\binmigrantes?\b|migraci[oó]n|refugiados?",
    "pacientes": r"\bpacientes?\b|sanidad|hospitales?",
    "agentes": r"\bpolic[ií]as?\b|guardia civil|jueces?",
}
PALANCAS = {
    "ley": r"\bley\b|leyes|reforma|reformar|derog|constituci[oó]n|normativa|legislaci[oó]n",
    "impuestos": r"\bIRPF\b|\bIVA\b|impuesto|fiscal|tribut|cotizaci[oó]n",
    "gasto": r"\bfinanciaci[oó]n|financiar|inversi[oó]n|fondos?|ayudas?|recursos|presupuesto",
    "organizacion": r"\bcrear|creaci[oó]n|agencia|organismo|oficina|registro|establecer",
    "plan": r"\bplan(?:es)?\b|programa|estrategia|agenda|convenio|acuerdo|pacto",
}
TERRITORIES = {
    "España": r"\bEspaña\b|\bespañol(?:a|es)?\b",
    "Unión Europea": r"\bUni[oó]n Europea\b|\bUE\b|\bBruselas\b",
    "Canarias": r"\bCanarias\b|\bcanari[oa]s?\b",
    "Cataluña": r"\bCataluñ[ae]?\b|\bCatalunya\b",
    "País Vasco": r"\bPa[ií]s Vasco\b|\bEuskadi\b",
}


def normalize(text):
    text = text.replace("\ufb01", "fi").replace("\ufb02", "fl").replace("\u00a0", " ")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    result = ""
    for line in lines:
        if result.endswith("-") and line[:1].islower():
            result = result[:-1] + line
        else:
            result = f"{result} {line}".strip()
    result = unicodedata.normalize("NFC", result)
    result = re.sub(r"\s+", " ", result)
    result = re.sub(r"\s+([,.;:!?])", r"\1", result)
    return result.strip()


def styled_heading(block):
    spans = [span for line in block.get("lines", []) for span in line["spans"]]
    text = normalize("".join(span["text"] for span in spans))
    match = re.match(r"^(\d{1,2})\s*\.?\s*([^\W\d_].+)$", text, re.UNICODE)
    if not match:
        return None
    if not any("SemiBold" in span["font"] or "ExtraBold" in span["font"] for span in spans[:4]):
        return None
    return int(match.group(1)), spans, match.start(2)


def split_heading(spans, number_end):
    title = []
    body = []
    started_title = False
    body_started = False
    unstyled_title = False
    offset = 0
    for span in spans:
        value = span["text"]
        end = offset + len(value)
        if body_started:
            body.append(value)
        elif end <= number_end:
            pass
        else:
            value = value[max(0, number_end - offset):]
            is_bold = "SemiBold" in span["font"] or "ExtraBold" in span["font"]
            if is_bold:
                started_title = True
                title.append(value)
            elif not started_title and normalize(value):
                unstyled_title = True
            elif started_title:
                body_started = True
                body.append(value)
        offset = end
    if unstyled_title:
        return normalize("".join(span["text"] for span in spans)[number_end:]), ""
    return normalize("".join(title)), normalize("".join(body))


def classify(patterns, text):
    return [name for name, pattern in patterns.items() if re.search(pattern, text, re.I)]


def complete_title(title, text):
    comma = text.find(",")
    if len(title) < 12 and 0 < comma < 100:
        return f"{title} {text[:comma]}".strip(), text[comma + 1:].lstrip()

    continuation = re.match(
        r"^([\wÁÉÍÓÚÜÑáéíóúüñ]{1,20}\.)\s*(?=[•·]|[A-ZÁÉÍÓÚÜÑ])",
        text,
    )
    if continuation:
        return f"{title} {continuation.group(1)}".strip(), text[continuation.end():].lstrip()

    if len(text) < 60 and re.search(r"\b(de|del|a|al|en|con|para|por|que|y|o)$", title, re.I):
        return f"{title} {text}".strip(), ""

    join_words = {"a", "al", "con", "de", "del", "el", "en", "la", "las", "los", "o", "para", "por", "que", "y"}
    title_ends_in_connector = re.search(r"\b(?:a|al|con|de|del|el|en|la|las|los|o|para|por|que|y)$", title, re.I)
    body_starts_in_connector = re.match(
        r"^(?:a|al|con|de|del|el|en|la|las|los|o|para|por|que|y)\b",
        text,
    )
    if title_ends_in_connector or body_starts_in_connector:
        words = text.split()
        moved = []
        while words and len(moved) < 3:
            moved.append(words.pop(0))
            last_word = re.sub(r"[^\wÁÉÍÓÚÜÑáéíóúüñ]", "", moved[-1]).lower()
            if title_ends_in_connector and last_word not in join_words:
                break
            if body_starts_in_connector and len(moved) >= 2 and last_word not in join_words:
                break
        return f"{title} {' '.join(moved)}".strip(), " ".join(words)
    return title, text


def extract(document):
    if len(document) != EXPECTED_PAGES:
        raise ValueError(f"Se esperaban {EXPECTED_PAGES} páginas; el PDF tiene {len(document)}")

    measures = []
    for axis_index, (title, first_page, default_category, _) in enumerate(AXES):
        last_page = AXES[axis_index + 1][1] - 1 if axis_index + 1 < len(AXES) else 92
        chapter_blocks = []
        for page_number in range(first_page, last_page + 1):
            page = document[page_number - 1]
            for block in page.get_text("dict")["blocks"]:
                if "lines" not in block:
                    continue
                x, y = block["bbox"][:2]
                if x > 550 or y < 45 or y > 780:
                    continue
                chapter_blocks.append((page_number, x, y, block))
        chapter_blocks.sort(key=lambda item: (item[0], item[2], item[1]))

        proposals = []
        current = None
        stopped_at_chart = False
        for page_number, x, y, block in chapter_blocks:
            plain_text = normalize(" ".join(
                "".join(span["text"] for span in line["spans"])
                for line in block["lines"]
            ))
            compact_text = re.sub(r"\s+", "", plain_text).upper()
            if "COMPROMISOSMEDIBLES" in compact_text or "Así podrás comprobar si cumplimos" in plain_text:
                stopped_at_chart = True
                current = None
                continue
            if stopped_at_chart:
                continue

            heading = styled_heading(block) if x <= 180 else None
            if heading:
                number, spans, number_end = heading
                if number == len(proposals) + 1:
                    proposal_title, opening_text = split_heading(spans, number_end)
                    if not proposal_title:
                        raise ValueError(f"{title}, pág. {page_number}: encabezado {number} sin título")
                    current = {
                        "number": number,
                        "page": page_number,
                        "title": proposal_title,
                        "paragraphs": [opening_text] if opening_text else [],
                    }
                    proposals.append(current)
                    continue
            if current is not None and plain_text:
                current["paragraphs"].append(plain_text)

        actual = [proposal["number"] for proposal in proposals]
        expected = list(range(1, EXPECTED_COUNTS[axis_index] + 1))
        if actual != expected:
            raise ValueError(f"{title}: se esperaban {expected}; se encontraron {actual}")
        for proposal in proposals:
            proposal["text"] = normalize("\n\n".join(proposal["paragraphs"]))
            if not proposal["text"]:
                raise ValueError(f"{title}, propuesta {proposal['number']} (pág. {proposal['page']}): texto vacío")
            proposal["title"], proposal["text"] = complete_title(proposal["title"], proposal["text"])
            proposal["axis"] = axis_index + 1
            measures.append(proposal)

    if len(measures) != 191:
        raise ValueError(f"Se esperaban 191 propuestas; se encontraron {len(measures)}")
    return measures


def create_program(document, extracted):
    blocks = []
    sections = []
    measures = []
    global_number = 0
    figures = []
    deadlines = []
    verbs = Counter()

    for axis_index, (title, first_page, default_category, intro) in enumerate(AXES, start=1):
        axis_measures = [measure for measure in extracted if measure["axis"] == axis_index]
        first_measure_page = axis_measures[0]["page"]
        blocks.append({
            "id": axis_index,
            "titulo": title,
            "tituloMayus": title.upper(),
            "lema": title,
            "cita": "",
            "intro": intro,
            "pagina": first_measure_page,
        })
        section_id = f"{axis_index:02d}"
        sections.append({
            "id": section_id,
            "bloque": axis_index,
            "titulo": title,
            "tituloFrase": title,
            "intro": intro,
            "pagina": first_page,
            "subapartados": [],
        })

        for proposal in axis_measures:
            global_number += 1
            full_text = f'{proposal["title"]}. {proposal["text"]}'
            category = next(
                (name for name, pattern in CATEGORIES if re.search(pattern, full_text, re.I)),
                default_category,
            )
            quantified_sentences = [
                sentence.strip()
                for sentence in re.split(r"(?<=[.!?])\s+", proposal["text"])
                if re.search(r"\d", sentence)
                and re.search(r"%|€|euros?|mill[oó]nes?|d[ií]as?|años?|meses?|personas?", sentence, re.I)
            ][:3]
            deadline = find_deadline(full_text)
            measures.append({
                "n": global_number,
                "bloque": axis_index,
                "seccion": section_id,
                "pagina": proposal["page"],
                "subapartado": None,
                "titulo": proposal["title"],
                "tituloFrase": proposal["title"],
                "texto": proposal["text"],
                "oculta": False,
                "categoria": category,
                "colectivos": classify(COLECTIVOS, full_text),
                "palancas": classify(PALANCAS, full_text),
                "territorios": classify(TERRITORIES, full_text),
                "cifras": quantified_sentences,
                "plazo": deadline,
                "deroga": None,
            })
            for verb in re.findall(r"\b\w+(?:aremos|eremos|iremos)\b", proposal["text"].lower()):
                verbs[verb] += 1

            percentage = re.search(r"\b\d+(?:[.,]\d+)?\s*%", proposal["text"])
            if percentage and len(figures) < 8:
                figures.append({
                    "valor": percentage.group(0),
                    "unidad": "%",
                    "texto": proposal["title"],
                    "medida": global_number,
                })
            if deadline:
                deadlines.append({
                    "plazo": deadline,
                    "texto": proposal["title"],
                    "medida": global_number,
                })

    return {
        "id": "mundo-mas-justo",
        "partido": "Por un Mundo Más Justo",
        "siglas": "MUNDO+JUSTO",
        "color": "#E7B88A",
        "colorClaro": "#F3DCC4",
        "programa": "Si no es justo, cámbialo.",
        "subtitulo": "191 propuestas en 32 ejes",
        "elecciones": "Elecciones generales · 29 de noviembre de 2026",
        "pdf": "/programas/mundo-mas-justo-29n-2026.pdf",
        "fuentePdf": SOURCE_URL,
        "paginas": len(document),
        "unidadMedida": "propuesta",
        "unidadMedidas": "propuestas",
        "presentacion": {
            "titulo": "32 ejes para un mundo más justo",
            "texto": (
                "El programa oficial de las elecciones generales del 29N desarrolla 191 propuestas "
                "numeradas en 32 ejes. La ficha mantiene la numeración consecutiva de esta web; "
                "el texto de cada propuesta y su página se pueden consultar en el PDF original."
            ),
        },
        "cifras": figures,
        "plazos": deadlines,
        "ordenPlazos": list(dict.fromkeys(item["plazo"] for item in deadlines)),
        "verbos": [{"verbo": verb, "n": count} for verb, count in verbs.most_common(15)],
        "bloques": blocks,
        "secciones": sections,
        "medidas": measures,
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Uso: python scripts/extract_mundo_mas_justo.py <pdf> <salida.json>")
    document = fitz.open(sys.argv[1])
    program = create_program(document, extract(document))
    with open(sys.argv[2], "w", encoding="utf-8") as output:
        json.dump(program, output, ensure_ascii=False, indent=1)
    print(f'páginas {program["paginas"]}; ejes {len(program["bloques"])}; propuestas {len(program["medidas"])}')
    print("categorías", Counter(measure["categoria"] for measure in program["medidas"]).most_common())


if __name__ == "__main__":
    main()
