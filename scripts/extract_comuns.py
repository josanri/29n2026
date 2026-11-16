"""Build the JSON of the Comuns program (134 pages, in Catalan, not translated).

Structure of the PDF:
- Six chapters. The index (page 2) gives the first page of each one. Chapter pages: 2-11, 12-37,
  38-65, 66-89, 90-104, 105-134.
- Each proposal is a bullet («•» at the start of a line). One bullet is one measure.
- Measures have no number and no title in the PDF. The number is the order in the program. The title is
  the first sentence of the text.
- A measure ends at the next bullet, at a chapter heading, or at the end of a page when its last sentence
  has ended. Hyphenated words at the end of a line are joined.
- The category comes from the chapter (the base) and from keyword rules. It is approximate.
- Texts stay in Catalan.

Usage: python scripts/extract_comuns.py public/2026/generales/programas/comuns-programa-29n-2026.pdf src/data/2026/generales/programas/comuns.json
"""
import json
import re
import sys
import unicodedata

import fitz


FUENTE_PDF = 'https://comuns.cat/wp-content/uploads/2026/11/Comuns-FA-Programa29N.pdf'
PAGINAS = 134

CAPITULOS = [
    {'id': 'habitatge', 'titulo': 'Habitatge', 'desde': 2, 'categoria': 'vivienda'},
    {'id': 'cost-de-la-vida', 'titulo': 'El cost de la vida i una economia justa', 'desde': 12, 'categoria': 'empleo'},
    {'id': 'transicio-ecosocial', 'titulo': 'Transició Ecosocial', 'desde': 38, 'categoria': 'energia'},
    {'id': 'drets', 'titulo': 'Drets', 'desde': 66, 'categoria': 'justicia'},
    {'id': 'igualtat', 'titulo': 'Igualtat', 'desde': 90, 'categoria': 'social'},
    {'id': 'plurinacionalitat', 'titulo': 'Plurinacionalitat i democràcia', 'desde': 105, 'categoria': 'democracia'},
]

# Palabras clave que cambian la categoría del capítulo (la primera que coincide gana).
REGLAS = [
    ('vivienda', r'habitatge|lloguer|desnonament|llogater'),
    ('fiscalidad', r'impost|fiscal|(?-i:\bIRPF\b|\bIVA\b)|tribut|desgrava'),
    ('energia', r'energ|electricitat|renovable|clima|carboni|llum'),
    ('infraestructuras', r'transport|ferrovi|Rodalies|carreter|tren|aigua|mobilitat'),
    ('sanidad', r'salut|sanit|hospital|atenció sanitària|malalt'),
    ('educacion', r'educaci|escola|docent|universitat|formació professional'),
    ('inmigracion', r'migra|asil|racisme|racista|estrangeri'),
    ('familia', r'infància|infants|criança|permís|fills|famílies'),
    ('social', r'violència masclista|dones|feminis'),
    ('social', r'pobresa|pensi|dependència|discapacitat|exclusió|cures'),
    ('rural', r'pagès|ramader|pesca|agricultura|rural|forestal'),
    ('exterior', r'Unió Europea|Europa|OTAN|Palestina|internacional|Ucraïna'),
    ('justicia', r'jutj|justícia|aforament|tribunal|jutge'),
    ('identidad', r'llengua|català|cultura|memòria|identitat'),
    ('territorio', r'autonomia|Estatut|competències|finançament|pacte territorial|Estat espanyol'),
    ('empleo', r'treball|salari|feina|sindicat|empresa|autònom'),
    ('innovacion', r'R\+D|innovaci|tecnolog|indústria|turisme|digital'),
]

# Chapter heading lines of the index or of the page starts («12\t El cost de la vida i»).
CABECERA = re.compile(r'^\s*(\d{1,3})\s*\t|^Programa 29N|^\d{1,3}$|^Índex$')


def quitar_cabecera(linea):
    """Quita la cabecera de página (un título largo de capítulo) que el PDF mete dentro de una línea."""
    for capitulo in CAPITULOS:
        if len(capitulo['titulo']) > 15:
            linea = linea.replace(capitulo['titulo'], ' ')
    return re.sub(r'\s+', ' ', linea).strip()


def normalizar(texto):
    texto = unicodedata.normalize('NFC', texto).replace('\x08', '')
    texto = re.sub(r'\s+', ' ', texto).strip()
    # Guion de final de línea que el PDF deja con un espacio: «per- met» pasa a «permet».
    texto = re.sub(r'([a-zàèéíòóúüç])- ([a-zàèéíòóúüç])', r'\1\2', texto)
    return re.sub(r'\s+([,.;:!?)»])', r'\1', texto)


def categoria_de(texto, base):
    for categoria, patron in REGLAS:
        if re.search(patron, texto, re.I):
            return categoria
    return base


def capitulo_de(pagina):
    actual = CAPITULOS[0]
    for capitulo in CAPITULOS:
        if pagina >= capitulo['desde']:
            actual = capitulo
    return actual


def leer_medidas(documento):
    medidas = []
    actual = None
    for numero_pagina, pagina in enumerate(documento, start=1):
        if numero_pagina < CAPITULOS[0]['desde']:
            continue
        lineas = [l.replace('\x08', '').strip() for l in pagina.get_text().splitlines()]
        lineas = [quitar_cabecera(l) for l in lineas if l]
        lineas = [l for l in lineas if l]
        for linea in lineas:
            # Un título de capítulo cierra la medida anterior y no se añade a ella.
            es_titulo = linea == 'Habitatge' or any(
                len(c['titulo']) > 15 and c['titulo'] in linea and len(linea) < 200 for c in CAPITULOS)
            if es_titulo and not linea.startswith('•'):
                if actual is not None:
                    medidas.append(actual)
                    actual = None
                continue
            if CABECERA.match(linea) and not linea.startswith('•'):
                if actual is not None and re.match(r'^\d{1,3}\s*\t', linea):
                    medidas.append(actual)
                    actual = None
                continue
            if linea.startswith('•'):
                if actual is not None:
                    medidas.append(actual)
                actual = {'pagina': numero_pagina, 'partes': [linea.lstrip('•').strip()]}
                continue
            if actual is not None:
                actual['partes'].append(linea)
        # Al final de la página: si la última frase acabó, la medida se cierra; si no, sigue en la página siguiente.
        if actual is not None and re.search(r'[.;:)»]$', normalizar(' '.join(actual['partes']))):
            medidas.append(actual)
            actual = None
    if actual is not None:
        medidas.append(actual)
    return medidas


def unir(partes):
    texto = ''
    for parte in partes:
        if texto.endswith('-') and parte[:1].islower():
            texto = texto[:-1] + parte
        else:
            texto = f'{texto} {parte}' if texto else parte
    return normalizar(texto)


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Uso: python scripts/extract_comuns.py ORIGEN.pdf DESTINO.json')
    documento = fitz.open(sys.argv[1])
    if len(documento) != PAGINAS:
        raise SystemExit(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    brutas = leer_medidas(documento)
    if len(brutas) < 1000:
        raise SystemExit(f'Se esperaban unas 1.097 medidas; hay {len(brutas)}. Revisar las viñetas.')

    bloques, secciones = [], []
    for indice, capitulo in enumerate(CAPITULOS, start=1):
        bloques.append({'id': indice, 'titulo': capitulo['titulo'], 'lema': '', 'cita': '', 'intro': '',
                        'pagina': capitulo['desde']})
        secciones.append({'id': capitulo['id'], 'bloque': indice, 'titulo': capitulo['titulo'],
                          'tituloFrase': capitulo['titulo'], 'intro': '', 'pagina': capitulo['desde'],
                          'subapartados': []})

    medidas = []
    for numero, bruta in enumerate(brutas, start=1):
        capitulo = capitulo_de(bruta['pagina'])
        indice = CAPITULOS.index(capitulo) + 1
        # La cabecera puede estar partida entre dos líneas del PDF: se quita también del texto ya unido.
        texto = quitar_cabecera(normalizar(unir(bruta['partes'])))
        if not texto:
            raise SystemExit(f'La viñeta de la página {bruta["pagina"]} está vacía')
        titulo = re.split(r'(?<=\.)\s', texto, maxsplit=1)[0][:200]
        medidas.append({
            'n': numero,
            'bloque': indice,
            'seccion': capitulo['id'],
            'pagina': bruta['pagina'],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria_de(texto, capitulo['categoria']),
            'colectivos': [],
            'palancas': [],
            'territorios': [],
            'cifras': [],
            'plazo': None,
            'deroga': None,
        })

    programa = {
        'id': 'comuns',
        'partido': 'Comuns-Front Ampli',
        'siglas': 'COMUNS',
        'comunidad': 'Cataluña',
        'observaciones': [
            'Programa en catalán. Los textos se mantienen en catalán: no están traducidos.',
            'Cada viñeta del PDF es una medida. El número es el orden en el programa. El título es la primera frase.',
            'Las categorías salen del capítulo y de palabras clave, y son aproximadas.',
            'El PDF se publicó en la web de Comuns (comuns.cat). Es el programa propio de Comuns, no una copia del programa de otra formación.',
            'Algunas medidas incluyen sub-propuestas («›» en el PDF). Se mantienen dentro de la misma medida.',
        ],
        'color': '',
        'colorClaro': '',
        'programa': 'Un com una casa',
        'subtitulo': 'Programa electoral 29N de Comuns-Front Ampli',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/comuns-programa-29n-2026.pdf',
        'fuentePdf': FUENTE_PDF,
        'paginas': PAGINAS,
        'fechaPdf': '2026-11-16',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': 'Un com una casa', 'texto': ''},
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }
    with open(sys.argv[2], encoding='utf-8') as previo:
        cabecera = json.load(previo)
    programa['color'] = cabecera['color']
    programa['colorClaro'] = cabecera['colorClaro']
    with open(sys.argv[2], 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(medidas)} medidas, {len(CAPITULOS)} capítulos')


if __name__ == '__main__':
    main()
