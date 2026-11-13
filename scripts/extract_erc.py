"""Extract and categorize ERC's 2026 Congress program."""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


EXPECTED_PAGES = 48
EXPECTED_MEASURES = set(range(1, 168)) | set(range(198, 251)) | set(range(252, 259))
OMITTED_MEASURES = list(range(168, 198)) + [251]

BLOQUES = {
    'A': ('Defensar el país', 'DEFENSAR EL PAÍS'),
    'B': ('Defensar la gent', 'DEFENSAR LA GENT'),
    'C': ('Defensar els serveis públics', 'DEFENSAR ELS SERVEIS PÚBLICS'),
}

CATEGORIA_SECCION = {
    'A.A': 'democracia',
    'A.B': 'identidad',
    'A.C': 'educacion',
    'A.D': 'territorio',
    'A.E': 'identidad',
    'A.F': 'territorio',
    'A.G': 'exterior',
    'B.A': 'vivienda',
    'B.B': 'social',
    'B.C': 'innovacion',
    'B.D': 'social',
    'B.E': 'empleo',
    'B.F': 'innovacion',
    'B.G': 'energia',
    'B.H': 'rural',
    'B.I': 'innovacion',
    'B.J': 'rural',
    'C.A': 'infraestructuras',
    'C.B': 'infraestructuras',
    'C.C': 'social',
    'C.D': 'sanidad',
    'C.E': 'seguridad',
    'C.F': 'administracion',
    'C.G': 'educacion',
}

COLECTIVOS = {
    'empresas': r'\bempres(?:a|es|arial|arials)\b|\bindústr(?:ia|ies)\b',
    'familias': r'\bfamíl(?:ia|ies)\b|\bconciliaci[oó]\b',
    'infancia': r'\binf[aà]n(?:cia|ts?)\b|\badolescents?\b|\bmenors?\b',
    'inmigrantes': r'\bmigraci[oó]\b|\bimmigrants?\b|\brefugiats?\b|\basil\b',
    'jovenes': r'\bjov(?:e|es|entut)\b|\bmenors de \d+\b',
    'rural': r'\bpagesia\b|\bagr[aà]r(?:ia|ies)\b|\bpesca\b|\bramader(?:ia|ia)\b|\bm[oó]n rural\b',
    'autonomos': r'\baut[oò]nom(?:s|es)?\b|\bpimes\b|\bemprenedors?\b',
    'agentes': r'\bMossos d[\'’]Esquadra\b|\bpolicies?\b|\bcossos policials\b',
    'mayores': r'\bpersones grans\b|\bgent gran\b|\bpensionistes?\b|\bpensions?\b',
    'discapacidad': r'\bdiscapacitat\b|\bdepend[eè]ncia\b',
    'mujeres': r'\bdones\b|\bfemin(?:isme|ista|istes)\b|\bviol[eè]ncia masclista\b',
    'victimas': r'\bv[ií]ctimes?\b',
    'pacientes': r'\bpacients?\b|\bsanit[aà]ri(?:a|es)\b|\bsalut\b',
    'funcionarios': r'\bfuncionaris?\b|\btreballadors? p[uú]blics?\b',
}

PALANCAS = {
    'ley': r'\bllei\b|\blleis\b|\bderogar\b|\breformar\b|\bmodificar\b|\bmarc normatiu\b|\blegislaci[oó]\b',
    'impuestos': r'\bfiscal(?:itat)?\b|\bimpostos?\b|\btribut(?:ari|aris|aci[oó])\b|\bIVA\b|\bIRPF\b',
    'gasto': r'\bfinan[cç](?:ament|ar)\b|\binversi[oó]\b|\brecursos\b|\bpressupost(?:ari|os)?\b|\bajuts?\b',
    'organizacion': r'\bcrear\b|\bcreaci[oó]\b|\bag[eè]ncia\b|\borganisme\b|\boficina\b|\bautoritat\b',
    'plan': r'\bpla\b|\bplans\b|\bestrat[eè]gia\b|\bprograma\b|\bpacte\b|\bacord\b',
}

TERRITORIOS = {
    'Cataluña': r'\bCatalunya\b|\bcatal[aà]\b',
    'España': r'\bEspanya\b|\bEstat espanyol\b',
    'Unión Europea': r'\bUni[oó] Europea\b|\bUE\b',
    'País Valencià': r'\bPa[ií]s Valenci[aà]\b|\bVal[eè]ncia\b',
    'Illes Balears': r'\bIlles Balears\b|\bBalears\b',
    'Aragón': r'\bArag[oó]\b',
    'Andalucía': r'\bAndalusia\b',
    'Galicia': r'\bGal[ií]cia\b|\bGaliza\b',
    'Canarias': r'\bCan[aà]ries\b',
    'País Vasco': r'\bPa[ií]s Basc\b|\bEuskadi\b',
}

DEADLINE_RE = re.compile(r'\b(?:202[6-9]|2030|primer any|primers \d+ anys)\b', re.I)
# A year in a law name, in a past or existing date, or a past verb is not a promise.
NOT_DEADLINE_RE = re.compile(
    r'\bLlei \d+/\d{4}\b'
    r'|\b(?:gener|febrer|mar[çc]|abril|maig|juny|juliol|agost|setembre|octubre|novembre|desembre) de 20\d{2}\b'
    r'|\baquest 2026\b|\bes va\b|\bva (?:acordar|aprovar|signar|anunciar)\b'
    # A period in a name («Pla de Rodalies 2026-2030», «Marc Financer Pluriennal 2028-2034») and the
    # budget of a year («2.018 MEUR per al 2026») are figures, not the date the measure is carried out.
    r'|\b20\d{2}-20\d{2}\b|\bper al 20\d{2}\b',
    re.I,
)


def find_deadline(text):
    """Return the first deadline the party promises in the text, or None."""
    for sentence in re.split(r'(?<=[.!?])\s+', text):
        match = DEADLINE_RE.search(sentence)
        if match and not NOT_DEADLINE_RE.search(sentence):
            return match.group(0)
    return None


BLOCK_RE = re.compile(r'^([A-C])\.\s*DEFENSAR\s+(.+)$', re.I)
SECTION_RE = re.compile(r'^([A-J])\.\s+(.+)$')
MEASURE_RE = re.compile(r'^(\d{1,3})\.(?:[ \t]+(.*)|$)')
PAGE_FOOTER_RE = re.compile(r'^\d+\s+Eleccions al Congrés 2026\b')


def normalize(text):
    text = text.replace('\u00ad', '').replace('\ufb01', 'fi').replace('\ufb02', 'fl')
    text = text.replace('\u00a0', ' ')
    result = ''
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if result.endswith('-') and line[:1].islower():
            result = result[:-1] + line
        else:
            result = f'{result} {line}'.strip()
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', result)).strip()


def title_and_body(text):
    match = re.search(r'(?<=[.!?])\s+', text)
    if not match:
        return text.strip(), ''
    return text[:match.start()].strip(), text[match.end():].strip()


def short_title(title):
    title = title.rstrip(' .')
    if len(title) > 125:
        title = title[:122].rsplit(' ', 1)[0] + '…'
    return title[:1].upper() + title[1:] if title else ''


def classify(patterns, text):
    return [key for key, pattern in patterns.items() if re.search(pattern, text, re.I)]


def extract(pdf_path):
    document = fitz.open(pdf_path)
    if len(document) != EXPECTED_PAGES:
        raise ValueError(f'Expected {EXPECTED_PAGES} PDF pages; found {len(document)}')

    blocks = []
    sections = []
    raw_measures = {}
    current_block = None
    current_section = None
    current_measure = None

    def save_measure():
        nonlocal current_measure
        if current_measure is None:
            return
        number = current_measure['n']
        if number in raw_measures:
            raise ValueError(f'Duplicate measure number in PDF: {number}')
        raw_measures[number] = {
            'text': normalize('\n'.join(current_measure['parts'])),
            'page': current_measure['page'],
            'section': current_measure['section'],
        }
        current_measure = None

    for page_index, page in enumerate(document):
        if page_index < 6 or page_index > 45:
            continue
        for raw_line in page.get_text().splitlines():
            line = raw_line.strip()
            if (
                not line
                or line == 'ESQUERRA REPUBLICANA'
                or line == 'Eleccions al Congrés 2026 | Programa electoral'
                or PAGE_FOOTER_RE.match(line)
            ):
                continue
            if line.isdigit():
                continue

            block_match = BLOCK_RE.match(line)
            if block_match:
                save_measure()
                key = block_match.group(1).upper()
                current_block = {
                    'key': key,
                    'title': BLOQUES[key][0],
                    'page': page_index + 1,
                    'intro_parts': [],
                }
                blocks.append(current_block)
                current_section = None
                continue

            section_match = SECTION_RE.match(line)
            if section_match and current_block:
                save_measure()
                section_key = f'{current_block["key"]}.{section_match.group(1)}'
                if section_key not in CATEGORIA_SECCION:
                    raise ValueError(f'Unexpected ERC section: {section_key} {section_match.group(2)}')
                current_section = {
                    'id': section_key,
                    'block': len(blocks),
                    'title': section_match.group(2).strip(),
                    'category': CATEGORIA_SECCION[section_key],
                    'page': page_index + 1,
                    'intro_parts': [],
                }
                sections.append(current_section)
                continue

            measure_match = MEASURE_RE.match(line)
            if measure_match and current_section:
                save_measure()
                measure_text = (measure_match.group(2) or '').strip()
                current_measure = {
                    'n': int(measure_match.group(1)),
                    'page': page_index + 1,
                    'section': current_section['id'],
                    'parts': [measure_text] if measure_text else [],
                }
                continue

            if current_measure is not None:
                current_measure['parts'].append(line)
            elif current_section is not None:
                current_section['intro_parts'].append(line)
            elif current_block is not None:
                current_block['intro_parts'].append(line)

    save_measure()

    found = set(raw_measures)
    if found != EXPECTED_MEASURES:
        raise ValueError(
            f'Unexpected proposal numbering; missing {sorted(EXPECTED_MEASURES - found)}, '
            f'extra {sorted(found - EXPECTED_MEASURES)}'
        )
    if len(blocks) != 3 or len(sections) != 24 or len(raw_measures) != 227:
        raise ValueError(
            f'Expected 3 blocks, 24 sections, 227 numbered proposals; got '
            f'{len(blocks)}, {len(sections)}, {len(raw_measures)}'
        )

    return document, blocks, sections, raw_measures


def build_program(document, blocks_raw, sections_raw, raw_measures):
    sections_by_id = {section['id']: section for section in sections_raw}
    blocks = []
    for block_id, block in enumerate(blocks_raw, 1):
        intro = normalize('\n'.join(block['intro_parts']))
        blocks.append({
            'id': block_id,
            'titulo': block['title'],
            'tituloMayus': block['title'].upper(),
            'lema': '',
            'cita': '',
            'intro': intro,
            'pagina': block['page'],
        })

    sections = []
    for section in sections_raw:
        intro = normalize('\n'.join(section['intro_parts']))
        sections.append({
            'id': section['id'],
            'bloque': section['block'],
            'titulo': section['title'],
            'tituloFrase': short_title(section['title']),
            'intro': intro,
            'pagina': section['page'],
            'subapartados': [],
        })

    measures = []
    for number in sorted(raw_measures):
        raw = raw_measures[number]
        title, body = title_and_body(raw['text'])
        if not title:
            raise ValueError(f'Empty text for ERC proposal {number}')
        section = sections_by_id[raw['section']]
        complete = raw['text']
        number_sentences = [
            sentence.strip()
            for sentence in re.split(r'(?<=[.!?])\s+', complete)
            if re.search(r'\d', sentence)
            and re.search(r'%|€|euros?|milions?|km\b|dies|anys|mesos|hores', sentence, re.I)
        ][:3]
        deadline = find_deadline(complete)
        measures.append({
            'n': number,
            'bloque': section['block'],
            'seccion': raw['section'],
            'pagina': raw['page'],
            'subapartado': None,
            'titulo': title,
            'tituloFrase': short_title(title),
            'texto': body,
            'oculta': False,
            'categoria': section['category'],
            'colectivos': classify(COLECTIVOS, complete),
            'palancas': classify(PALANCAS, complete),
            'territorios': classify(TERRITORIOS, complete),
            'cifras': number_sentences,
            'plazo': deadline,
            'deroga': None,
        })

    verbs = Counter()
    for measure in measures:
        for verb in re.findall(r'\b[\wà-ÿ]+(?:arem|erem|irem|arà|erà|irà)\b', measure['texto'].lower()):
            verbs[verb] += 1

    cifras = []
    for measure in measures:
        match = re.search(r'\b\d+(?:[.,]\d+)?\s*(?:%|€|euros?|milions?|km\b)', measure['texto'], re.I)
        if match:
            cifras.append({
                'valor': match.group(0),
                'unidad': '%' if '%' in match.group(0) else '',
                'texto': measure['tituloFrase'],
                'medida': measure['n'],
            })
        if len(cifras) == 10:
            break

    preamble_lines = [
        line.strip()
        for page in document[4:6]
        for line in page.get_text().splitlines()
        if line.strip()
        and line.strip() != 'ESQUERRA REPUBLICANA'
        and line.strip() != 'Eleccions al Congrés 2026 | Programa electoral'
        and not PAGE_FOOTER_RE.match(line.strip())
        and not line.strip().isdigit()
    ]
    preamble = normalize('\n'.join(preamble_lines))
    return {
        'id': 'erc',
        'partido': 'Esquerra Republicana de Catalunya',
        'siglas': 'ERC',
        'comunidad': 'Cataluña',
        'color': '#f5b400',
        'colorClaro': '#f7d15b',
        'programa': 'Pel país. Per la gent. Pel futur.',
        'subtitulo': 'Programa electoral d’Esquerra Republicana per a les eleccions al Congrés 2026',
        'elecciones': 'Eleccions al Congrés · 29 de novembre de 2026',
        'pdf': '/programas/erc-programa-electoral-2026.pdf',
        'fuentePdf': 'https://www.esquerra.cat/rufian-apella-votant-socialista-decebut/',
        'paginas': len(document),
        'fechaPdf': '2026-11-05',
        'presentacion': {
            'titulo': 'Pel país. Per la gent. Pel futur.',
            'texto': preamble,
        },
        'observaciones': [
            'El PDF adjunto salta de la propuesta 167 a la 198 y de la 250 a la 252. No incluye el texto de las propuestas 168–197 ni la 251; por eso el análisis contiene las 227 propuestas numeradas que sí aparecen, sin completar las 31 ausentes.',
        ],
        'cifras': cifras,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [{'verbo': verb, 'n': count} for verb, count in verbs.most_common(15)],
        'bloques': blocks,
        'secciones': sections,
        'medidas': measures,
    }


def main():
    document, blocks_raw, sections_raw, raw_measures = extract(sys.argv[1])
    program = build_program(document, blocks_raw, sections_raw, raw_measures)
    with open(sys.argv[2], 'w', encoding='utf-8') as output:
        json.dump(program, output, ensure_ascii=False, indent=1)
    print(
        'pages', program['paginas'],
        'blocks', len(program['bloques']),
        'sections', len(program['secciones']),
        'available proposals', len(program['medidas']),
        'numbering gaps', len(OMITTED_MEASURES),
    )
    print('categories', Counter(measure['categoria'] for measure in program['medidas']).most_common())


if __name__ == '__main__':
    main()
