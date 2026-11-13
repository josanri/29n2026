#!/usr/bin/env python3
"""Extract Adelante Andalucía's complete program from its official area pages."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


BASE_URL = "https://programa.adelanteandalucia.org"
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("src/data/2026/generales/programas/adelante.json")
EXPECTED_PROPOSALS = 719
EXPECTED_AREA_PROPOSALS = 637
EXPECTED_TERRITORIAL_PROPOSALS = 82

NUMBER_RE = re.compile(
    r"\d[\d.,]*\s*(?:%|€|euros?|horas?|minutos?|d[ií]as?|semanas?|mes(?:es)?|a[nñ]os?|"
    r"habitantes|municipios|personas|familias|viviendas|kil[oó]metros|km|millones|miles)",
    re.IGNORECASE,
)
UNIT_RE = re.compile(
    r"(?:%|€|euros?|horas?|minutos?|d[ií]as?|semanas?|mes(?:es)?|a[nñ]os?|habitantes|"
    r"municipios|personas|familias|viviendas|kil[oó]metros|km|millones|miles)$",
    re.IGNORECASE,
)
PROPOSAL_LINK_RE = re.compile(r"/propuesta/(\d+)/")
AREA_LINK_RE = re.compile(r"/\d+-[a-z0-9-]+/")


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn")


def clean(text: str) -> str:
    return " ".join(text.split())


def number_context(text: str, value: str) -> str:
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if re.search(re.escape(value), sentence, re.IGNORECASE):
            return clean(sentence)
    return clean(text)


class AreaIndex(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self.current_href: str | None = None
        self.current_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        if AREA_LINK_RE.fullmatch(href):
            self.current_href = href
            self.current_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current_href:
            self.links.append((self.current_href, clean("".join(self.current_text))))
            self.current_href = None

    def handle_data(self, data: str) -> None:
        if self.current_href:
            self.current_text.append(data)


class ProgramArea(HTMLParser):
    def __init__(self, block: int) -> None:
        super().__init__()
        self.block = block
        self.capture: str | None = None
        self.buffer: list[str] = []
        self.area_title = ""
        self.intro = ""
        self.sections: list[dict] = []
        self.current_section: dict | None = None
        self.current_subsection: int | None = None
        self.current_proposal: dict | None = None
        self.proposals: list[dict] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").split())

        if tag == "li" and "prop" in classes:
            self.finish_proposal()
            match = re.fullmatch(r"p(\d+)", attributes.get("id") or "")
            if not match:
                raise RuntimeError(f"Malformed proposal entry in area {self.block}")
            self.current_proposal = {
                "n": int(match.group(1)),
                "section": self.current_section,
                "subapartado": self.current_subsection,
                "titulo": "",
                "texto": "",
                "justificacion": "",
            }
        elif tag == "h1":
            self.start_capture("area_title")
        elif tag == "h2" and "sec" in classes:
            self.start_capture("section")
        elif tag == "h3" and "sub" in classes:
            self.start_capture("subsection")
        elif tag == "p" and "intro-area" in classes:
            self.start_capture("area_intro")
        elif tag == "p" and "intro" in classes and self.current_proposal is None:
            self.start_capture("intro")
        elif self.current_proposal is not None and tag in {"h2", "h3", "h4"} and "pt" in classes:
            self.start_capture("proposal_title")
        elif self.current_proposal is not None and tag == "p" and "tx" in classes:
            self.start_capture("proposal_text")
        elif self.current_proposal is not None and tag == "p" and "pq" in classes:
            self.start_capture("proposal_reason")

    def handle_endtag(self, tag: str) -> None:
        capture_tags = {
            "area_title": "h1",
            "section": "h2",
            "subsection": "h3",
            "area_intro": "p",
            "intro": "p",
            "proposal_title": "h3",
            "proposal_text": "p",
            "proposal_reason": "p",
        }
        if self.capture and (
            capture_tags[self.capture] == tag
            or self.capture == "proposal_title" and tag in {"h2", "h4"}
        ):
            value = clean("".join(self.buffer))
            capture = self.capture
            self.capture = None
            self.buffer = []
            if capture == "area_title":
                self.area_title = re.sub(r"^\d+\.\s*", "", value)
            elif capture == "area_intro":
                self.intro = value
            elif capture == "section":
                match = re.match(r"^(\d+\.\d+|\d+)\.?\s*(.*)$", value)
                section_id = match.group(1) if match else f"{self.block}.{len(self.sections) + 1}"
                title = match.group(2) if match else value
                self.current_section = {
                    "id": section_id,
                    "titulo": title,
                    "intro": "",
                    "subapartados": [],
                }
                self.sections.append(self.current_section)
                self.current_subsection = None
            elif capture == "subsection":
                if self.current_section is None:
                    raise RuntimeError(f"Subsection without a section in area {self.block}")
                self.current_section["subapartados"].append({"titulo": value, "intro": ""})
                self.current_subsection = len(self.current_section["subapartados"]) - 1
            elif capture == "intro":
                if self.current_section is None:
                    pass
                elif self.current_subsection is not None:
                    subsection = self.current_section["subapartados"][self.current_subsection]
                    subsection["intro"] = value
                elif not self.current_section["intro"]:
                    self.current_section["intro"] = value
            elif capture == "proposal_title" and self.current_proposal is not None:
                self.current_proposal["titulo"] = value
            elif capture == "proposal_text" and self.current_proposal is not None:
                self.current_proposal["texto"] = value
            elif capture == "proposal_reason" and self.current_proposal is not None:
                self.current_proposal["justificacion"] = value
        elif tag == "li" and self.current_proposal is not None:
            self.finish_proposal()

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.buffer.append(data)

    def start_capture(self, capture: str) -> None:
        self.capture = capture
        self.buffer = []

    def finish_proposal(self) -> None:
        if self.current_proposal is None:
            return
        if not self.current_proposal["titulo"] or not self.current_proposal["texto"]:
            number = self.current_proposal["n"]
            raise RuntimeError(f"Could not extract title and text for proposal {number}")
        self.proposals.append(self.current_proposal)
        self.current_proposal = None


def fetch(path: str) -> str:
    request = Request(f"{BASE_URL}{path}", headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"Official program page {path} returned HTTP {response.status}")
        return response.read().decode("utf-8")


def category_for(area: str, section: str, title: str, text: str) -> str:
    heading = normalize(section)
    content = normalize(f"{title} {text}")

    explicit = [
        ("vivienda", "vivienda"),
        ("sanidad", "sanidad"),
        ("educacion", "educacion"),
        ("universidad", "educacion"),
        ("cuidados, dependencia", "social"),
        ("servicios sociales", "familia"),
        ("pensiones", "social"),
        ("empleo publico", "administracion"),
        ("fiscalidad", "fiscalidad"),
        ("fraude fiscal", "fiscalidad"),
        ("banca publica", "innovacion"),
        ("modelo productivo", "innovacion"),
        ("empleo digno", "empleo"),
        ("proteccion social", "social"),
        ("trabajo autonomo", "empleo"),
        ("consumo, campo", "rural"),
        ("financiacion justa", "territorio"),
        ("autogobierno", "territorio"),
        ("inversion del estado", "territorio"),
        ("municipios y territorio", "territorio"),
        ("ferrocarril", "infraestructuras"),
        ("transporte publico", "infraestructuras"),
        ("clima y energia", "energia"),
        ("agua", "infraestructuras"),
        ("naturaleza, incendios", "rural"),
        ("mundo rural", "rural"),
        ("fin de los privilegios", "democracia"),
        ("transparencia", "democracia"),
        ("justicia", "justicia"),
        ("administracion cercana", "administracion"),
        ("libertades", "democracia"),
        ("medios y libertad", "democracia"),
        ("estado laico", "democracia"),
        ("violencias machistas", "seguridad"),
        ("igualdad y cuidados", "social"),
        ("derechos sexuales", "sanidad"),
        ("migraciones", "inmigracion"),
        ("memoria democratica", "identidad"),
        ("paz y cooperacion", "exterior"),
        ("pueblo gitano", "social"),
        ("cultura y trabajo cultural", "identidad"),
        ("hablas andaluzas", "identidad"),
        ("derechos digitales", "innovacion"),
        ("deporte", "social"),
        ("tauromaquia", "rural"),
        ("caza", "rural"),
        ("lgtbi", "social"),
    ]
    for keyword, category in explicit:
        if keyword in heading:
            return category

    keyword_categories = [
        (("vivienda", "alquiler", "desahucio", "vpo"), "vivienda"),
        (("sanidad", "hospital", "paciente", "salud", "farmaceut", "medico"), "sanidad"),
        (("educacion", "escuela", "alumnado", "docente", "universidad", "beca"), "educacion"),
        (("migracion", "migrante", "asilo", "racismo", "xenofobia"), "inmigracion"),
        (("ferrocarril", "tren", "carretera", "autovia", "transporte", "puerto", "aeropuerto", "metro"), "infraestructuras"),
        (("agua", "regadio", "rio", "inundacion", "depuradora", "embalse"), "infraestructuras"),
        (("campo", "agricultura", "ganaderia", "pesca", "caza", "animal", "rural", "incendio", "litoral"), "rural"),
        (("energia", "clima", "renovable", "contaminacion", "residuo", "reciclaje"), "energia"),
        (("impuesto", "irpf", "tribut", "fiscal", "deuda"), "fiscalidad"),
        (("empleo", "trabajo", "salario", "laboral", "autonomo", "sindicato"), "empleo"),
        (("mujer", "machista", "igualdad", "violencia de genero"), "seguridad"),
        (("justicia", "juzgado", "tribunal", "fiscalia"), "justicia"),
        (("policia", "seguridad", "violencia"), "seguridad"),
        (("cultura", "lengua", "habla", "memoria", "deporte", "patrimonio"), "identidad"),
        (("andalucia", "provincia", "municipio", "autogobierno", "financiacion"), "territorio"),
        (("infancia", "familia", "menor", "crianza"), "familia"),
        (("pension", "mayor", "dependencia", "discapacidad", "cuidados", "pobreza"), "social"),
        (("institucion", "democracia", "transparencia", "corrupcion", "libertad", "prensa"), "democracia"),
        (("empresa", "industria", "turismo", "digital", "investigacion", "ciencia"), "innovacion"),
        (("exterior", "internacional", "palestina", "sahara", "cooperacion", "paz"), "exterior"),
    ]
    if "lo que exigiremos" in heading or "reclamaciones territoriales" in normalize(area):
        for keywords, category in keyword_categories:
            if any(keyword in content for keyword in keywords):
                return category

    area_heading = normalize(area)
    if "economia y empleo" in area_heading:
        return "empleo"
    if "bienes comunes" in area_heading:
        return "energia"
    if "instituciones limpias" in area_heading:
        return "democracia"
    if "feminismos" in area_heading or "lgtbi" in area_heading:
        return "social"
    if "derechos humanos" in area_heading:
        return "social"
    if "cultura" in area_heading:
        return "identidad"
    if "animales" in area_heading:
        return "rural"
    if "movilidad" in area_heading:
        return "infraestructuras"
    return "territorio"


def collectives_for(text: str) -> list[str]:
    value = normalize(text)
    rules = [
        ("familias", ("familia", "hogar", "conciliacion")),
        ("infancia", ("infancia", "menor", "nino", "alumnado", "estudiante")),
        ("inmigrantes", ("migrante", "inmigrante", "persona refugiada", "asilo")),
        ("jovenes", ("joven", "juventud")),
        ("rural", ("rural", "agricultura", "ganaderia", "pesca", "campo")),
        ("autonomos", ("autonomo", "pyme", "emprendedor")),
        ("agentes", ("policia", "guardia civil", "militar")),
        ("mayores", ("mayor", "pension")),
        ("discapacidad", ("discapacidad", "dependencia", "diversidad funcional")),
        ("mujeres", ("mujer", "feminismo", "machista", "violencia de genero")),
        ("victimas", ("victima", "violencia", "acoso")),
        ("pacientes", ("paciente", "sanidad", "salud", "hospital")),
        ("funcionarios", ("funcionario", "empleo publico", "personal publico")),
        ("empresas", ("empresa", "industria", "comercio")),
    ]
    return [identifier for identifier, keywords in rules if any(word in value for word in keywords)]


def levers_for(text: str) -> list[str]:
    value = normalize(text)
    rules = [
        ("ley", ("ley", "derog", "reforma", "regular", "prohib", "obligacion", "derecho")),
        ("impuestos", ("impuesto", "tribut", "irpf", "fiscal", "cotizacion")),
        ("gasto", ("presupuesto", "financiacion", "inversion", "gasto", "recursos", "plantilla", "subvencion", "ayuda")),
        ("organizacion", ("crear", "creacion", "agencia", "oficina", "servicio", "sistema", "gestion", "red publica")),
        ("plan", ("plan", "estrategia", "pacto", "programa", "calendario")),
    ]
    return [identifier for identifier, keywords in rules if any(word in value for word in keywords)]


def section_record(block: int, source: dict) -> dict:
    return {
        "id": source["id"],
        "bloque": block,
        "titulo": source["titulo"],
        "tituloFrase": source["titulo"],
        "intro": source["intro"],
        "subapartados": source["subapartados"],
    }


def main() -> None:
    home = AreaIndex()
    home.feed(fetch("/"))
    areas_by_path = {path: title for path, title in home.links}
    areas = list(areas_by_path.items())
    if len(areas) != 12:
        raise RuntimeError(f"Expected 12 official program areas, found {len(areas)}")

    blocks: list[dict] = []
    sections: list[dict] = []
    proposals_by_number: dict[int, dict] = {}

    for block, (path, _) in enumerate(areas, start=1):
        page = ProgramArea(block)
        page.feed(fetch(path))
        page.finish_proposal()
        if not page.area_title or not page.proposals:
            raise RuntimeError(f"Could not extract area title or proposals from {path}")
        if not page.sections:
            page.sections.append({
                "id": str(block),
                "titulo": page.area_title,
                "intro": "",
                "subapartados": [],
            })
        for proposal in page.proposals:
            if proposal["section"] is None:
                proposal["section"] = page.sections[0]

        blocks.append({
            "id": block,
            "titulo": page.area_title,
            "tituloMayus": page.area_title.upper(),
            "lema": "",
            "cita": "",
            "intro": page.intro,
        })
        sections.extend(section_record(block, section) for section in page.sections)
        for proposal in page.proposals:
            proposal["bloque"] = block
            proposal["area"] = page.area_title
            if proposal["n"] not in proposals_by_number:
                proposals_by_number[proposal["n"]] = proposal

    numbers = sorted(proposals_by_number)
    if numbers != list(range(1, EXPECTED_PROPOSALS + 1)):
        raise RuntimeError(
            f"Expected consecutive official proposals 1-{EXPECTED_PROPOSALS}; "
            f"found {len(numbers)} proposals, missing "
            f"{sorted(set(range(1, EXPECTED_PROPOSALS + 1)) - set(numbers))[:20]}"
        )

    area_count = sum(1 for proposal in proposals_by_number.values() if proposal["bloque"] < 12)
    territorial_count = sum(1 for proposal in proposals_by_number.values() if proposal["bloque"] == 12)
    if area_count != EXPECTED_AREA_PROPOSALS or territorial_count != EXPECTED_TERRITORIAL_PROPOSALS:
        raise RuntimeError(
            f"Expected {EXPECTED_AREA_PROPOSALS} area and {EXPECTED_TERRITORIAL_PROPOSALS} "
            f"territorial proposals; found {area_count} and {territorial_count}"
        )

    measures = []
    for number in numbers:
        source = proposals_by_number[number]
        section = next(
            (
                item for item in sections
                if item["bloque"] == source["bloque"] and item["id"] == source["section"]["id"]
            ),
            None,
        )
        if section is None:
            raise RuntimeError(f"Could not find section for proposal {number}")

        text = source["texto"]
        if source["justificacion"]:
            text = f"{text}\n\n{source['justificacion']}"
        all_text = f"{source['titulo']}. {text}"
        numbers_in_text = list(dict.fromkeys(NUMBER_RE.findall(all_text)))
        # The times in the text ("cita en 48 horas", "tratamiento en 21 días") are
        # part of the measure itself, not a deadline to implement it. No proposal
        # of this program fixes a deadline.
        deadline = None

        measures.append({
            "n": number,
            "bloque": source["bloque"],
            "seccion": section["id"],
            "subapartado": source["subapartado"],
            "titulo": source["titulo"],
            "tituloFrase": source["titulo"],
            "texto": text,
            "oculta": False,
            "categoria": category_for(source["area"], section["titulo"], source["titulo"], text),
            "colectivos": collectives_for(all_text),
            "palancas": levers_for(all_text),
            "territorios": ["Andalucía"] if source["bloque"] == 12 else [],
            "cifras": numbers_in_text,
            "plazo": deadline.group(0) if deadline else None,
            "deroga": None,
            "fuente": f"{BASE_URL}/propuesta/{number}/",
        })

    cifras = []
    plazos = []
    for measure in measures:
        for value in measure["cifras"]:
            unit_match = UNIT_RE.search(value)
            cifras.append({
                "valor": value,
                "unidad": unit_match.group(0) if unit_match else "",
                "texto": measure["titulo"],
                "contexto": number_context(measure["texto"], value),
                "medida": measure["n"],
            })
        if measure["plazo"]:
            plazos.append({
                "plazo": measure["plazo"],
                "texto": measure["titulo"],
                "medida": measure["n"],
            })

    intro = (
        "El programa completo distingue 29 medidas principales de 637 propuestas por áreas y "
        "82 propuestas territoriales: 719 propuestas numeradas en total. El análisis incluye "
        "los textos del programa oficial por áreas; las categorías, colectivos y palancas son "
        "clasificaciones editoriales."
    )
    data = {
        "id": "adelante",
        "partido": "Adelante Andalucía",
        "siglas": "AA",
        "comunidad": "Andalucía",
        "color": "#004242",
        "colorClaro": "#00ff8d",
        "programa": "29 medidas para el 29N",
        "subtitulo": "719 propuestas en 11 áreas temáticas y 9 territorios",
        "unidadMedidas": "propuestas",
        "unidadMedida": "propuesta",
        "pdf": "/programas/programa-adelante-andalucia-29n.pdf",
        "pdfResumen": "/programas/las-29-del-29n-adelante-andalucia.pdf",
        "tipoDocumento": "pdf",
        "origenMedidas": "web",
        "paginas": 134,
        "fechaPdf": "2026-11-10",
        "fuentePdf": f"{BASE_URL}/",
        "fechaFuente": "2026-11-10",
        "presentacion": {
            "titulo": "29 medidas para el 29N",
            "texto": intro,
        },
        "observaciones": [
            "El PDF completo tiene 134 páginas. Las 29 medidas principales son un resumen; el programa desarrolla 637 propuestas por áreas y 82 propuestas territoriales. Este análisis recoge esas 719 propuestas numeradas y no suma las 29 medidas-resumen por separado."
        ],
        "cifras": cifras,
        "plazos": plazos,
        "ordenPlazos": list(dict.fromkeys(item["plazo"] for item in plazos)),
        "verbos": [],
        "bloques": blocks,
        "secciones": sections,
        "medidas": measures,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Extracted {len(measures)} official proposals "
        f"({area_count} by area, {territorial_count} territorial) into {OUTPUT}"
    )


if __name__ == "__main__":
    main()
