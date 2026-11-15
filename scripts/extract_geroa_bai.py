"""Extract the commitments in the «Bases políticas» of Geroa Bai for 29N.

PDF «Bases políticas · Elecciones generales · 29 de noviembre de 2026» (14 pages, exported from Word), published on
geroabai.eus on 12 November 2026 (Transparencia → Programas). It has five chapters, each one a cover page
(«1. DEFENDER Y DEFENDERNOS» and a rule) followed by pages of prose:

1. Defender y defendernos (pages 4-5)
2. Navarra, sujeto político (page 7)
3. ¿Una nueva gamazada? (page 9)
4. Defender el Estado del bienestar, defender la democracia (pages 11-12)
5. La pluralidad, eje de la convivencia (page 14)

The document is a political text, not a list of measures. A commitment is each thing the coalition says it will
defend, demand or keep in the Cortes Generales: the four bullets «exige…» of chapter 2, the Convenio Económico of
chapter 3, the welfare state and the pending matters of chapter 4, and the «Combatir a la ultraderecha es…» list of
chapter 5. Chapter 1 explains the context and has no commitment. They are written below (`COMPROMISOS`) with their
literal text, which the script checks against the PDF, and a short editorial title.

Usage: python scripts/extract_geroa_bai.py PDF JSON [--depurar ARCHIVO]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


PAGINAS = 14
CABECERA = re.compile(r'^(BASES POLÍTICAS · ELECCIONES GENERALES 2026|GEROA BAI\s+·\s+\d+|━+)$')

# Chapter number → (title, pages with its text).
CAPITULOS = {
    1: ('Defender y defendernos', [4, 5]),
    2: ('Navarra, sujeto político', [7]),
    3: ('¿Una nueva gamazada?', [9]),
    4: ('Defender el Estado del bienestar, defender la democracia', [11, 12]),
    5: ('La pluralidad, eje de la convivencia', [14]),
}

# (chapter, page, editorial title, literal text in the PDF, category)
COMPROMISOS = [
    (2, 7, 'Que el Estado cumpla sus obligaciones en ferrocarril y regadío',
     'exige el cumplimiento de las obligaciones que el Estado quiere obviar en nuestro territorio en materia de '
     'infraestructuras ferroviarias o de regadío.', 'infraestructuras'),
    (2, 7, 'Las transferencias que marca la LORAFNA',
     'exige el cumplimiento de lo marcado por la LORAFNA en materia de transferencias.', 'territorio'),
    (2, 7, 'Navarra, con voz y voto en las instituciones europeas que deciden sobre competencias forales',
     'exige la presencia de una representación del Gobierno de Navarra con voz y con voto en aquellas instituciones '
     'europeas que deciden sobre competencias forales (como es el Ecofin).', 'exterior'),
    (2, 7, 'Reparar el daño de la Ley de Secretos Oficiales',
     'exige el reconocimiento del daño causado con la reforma de la Ley de Secretos Oficiales, que permita resolver '
     'casos como el de Mikel Zabalza ante los que los sucesivos gobiernos de PP y PSOE han optado por mirar a otro lado.',
     'democracia'),
    (3, 9, 'Mantener el Convenio Económico',
     'Geroa Bai defenderá en las urnas el próximo 29 de noviembre la permanencia del Convenio Económico como '
     'herramienta básica del autogobierno, frente a quienes amparan gamazadas encubiertas.', 'territorio'),
    (4, 11, 'Defender el Estado de bienestar y los servicios públicos de los recortes',
     'ese es el compromiso de Geroa Bai: la defensa el Estado de Bienestar y los servicios públicos de los recortes '
     'que se avecinan.', 'social'),
    (4, 12, 'La posición de Navarra en la planificación eléctrica 2030',
     'la posición de Navarra en la planificación eléctrica 2030', 'energia'),
    (4, 12, 'La conexión ferroviaria de Navarra con la Y vasca',
     'la definición de la conexión ferroviaria navarra con la Y vasca', 'infraestructuras'),
    (4, 12, 'Los compromisos con el regadío navarro', 'los compromisos con el regadío navarro', 'rural'),
    (4, 12, 'La transferencia de la competencia de becas a Navarra',
     'la transferencia de la competencia de becas a Navarra', 'educacion'),
    (4, 12, 'Presencia reglada de Navarra en las reuniones con la UE',
     'la presencia reglada y regulada de Navarra en reuniones con la UE sobre materias reguladas por nuestra comunidad',
     'exterior'),
    (5, 14, 'Acabar con la Ley de Secretos Oficiales',
     'combatir a la ultraderecha es combatir monumentos franquistas como la Ley de Secretos Oficiales.', 'democracia'),
    (5, 14, 'Mantener los derechos civiles del colectivo LGTBI',
     'combatir a la ultraderecha es mantener vigentes los derechos civiles conquistados estos años para el colectivo LGTBI.',
     'social'),
    (5, 14, 'Reforzar la protección de las mujeres víctimas de maltrato',
     'Combatir a la ultraderecha reforzando las políticas públicas de protección de mujeres víctimas de maltrato.',
     'seguridad'),
    (5, 14, 'Seguir siendo tierra de acogida', 'Combatir a la ultraderecha es seguir siendo tierra de acogida',
     'inmigracion'),
    (5, 14, 'Reforzar las políticas frente al cambio climático', 'reforzar las políticas frente al cambio climático',
     'energia'),
    (5, 14, 'Reforzar las políticas de memoria', 'reforzar las políticas de memoria', 'identidad'),
]

COLECTIVOS = {
    'mujeres': r'\bmujeres?\b|violencia de g[eé]nero|maltrato',
    'victimas': r'\bv[ií]ctimas?\b|Zabalza',
    'inmigrantes': r'\bacogida\b|inmigra',
    'rural': r'\bregad[ií]o',
    'jovenes': r'\bbecas?\b',
}
PALANCAS = {
    'ley': r'\bley\b|LORAFNA|Convenio Econ[oó]mico',
    'organizacion': r'\btransferencia|competencia|representaci[oó]n|presencia',
    'plan': r'\bplanificaci[oó]n|pol[ií]ticas',
    'gasto': r'\bservicios p[uú]blicos|infraestructuras|recortes',
}
TERRITORIOS = {
    'Navarra': r'\bNavarra\b|navarr[oa]|LORAFNA|Convenio Econ[oó]mico',
    'Euskadi': r'\bY vasca\b',
    'Unión Europea': r'\bUE\b|europeas?|Ecofin',
}


def limpiar(texto):
    texto = texto.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace(' ', ' ')
    return unicodedata.normalize('NFC', texto)


def parrafos(documento, paginas):
    """Text of some pages as paragraphs: a line that ends a sentence and a line that starts a bullet end a paragraph."""
    lineas = []
    for numero in paginas:
        for linea in limpiar(documento[numero - 1].get_text()).splitlines():
            linea = linea.strip()
            if linea and not CABECERA.match(linea):
                lineas.append(linea)
    resultado, actual = [], ''
    for linea in lineas:
        es_vineta = linea.startswith('•')
        linea = linea.lstrip('•').strip()
        if es_vineta and actual:
            resultado.append(actual)
            actual = ''
        actual = f'{actual} {linea}'.strip()
        if re.search(r'[.…?]$', linea):
            resultado.append(actual)
            actual = ''
    if actual:
        resultado.append(actual)
    return [re.sub(r'\s+', ' ', parrafo) for parrafo in resultado]


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    # The chapters must be the ones in the index on page 2.
    indice = re.findall(r'^\d\.\s+(.+?)\s*$', limpiar(documento[1].get_text()), re.M)
    esperado = [titulo.upper() for titulo, _ in CAPITULOS.values()]
    if [titulo.upper() for titulo in indice] != esperado:
        raise ValueError(f'El índice del PDF no coincide con los capítulos:\n{indice}')
    return documento


def coincide(literal, parrafos_pagina):
    literal_norm = literal.lower()
    return any(literal_norm in parrafo.lower() for parrafo in parrafos_pagina)


def crear_programa(documento):
    bloques, secciones, medidas = [], [], []
    for numero, (titulo, paginas) in CAPITULOS.items():
        texto = parrafos(documento, paginas)
        bloques.append({
            'id': numero, 'titulo': titulo, 'tituloMayus': titulo.upper(), 'lema': '', 'cita': '',
            'intro': '\n\n'.join(texto), 'pagina': paginas[0] - 1,
        })
        secciones.append({
            'id': str(numero), 'bloque': numero, 'titulo': titulo, 'tituloFrase': titulo, 'intro': '',
            'pagina': paginas[0] - 1, 'subapartados': [],
        })

    for n, (capitulo, pagina, titulo, literal, categoria) in enumerate(COMPROMISOS, start=1):
        if not coincide(literal, parrafos(documento, [pagina])):
            raise ValueError(f'El compromiso {n} no está literal en la página {pagina}: {literal!r}')
        texto = literal[0].upper() + literal[1:]
        completo = f'{titulo}. {texto}'
        medidas.append({
            'n': n,
            'bloque': capitulo,
            'seccion': str(capitulo),
            'pagina': pagina,
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto if texto.endswith('.') else f'{texto}.',
            'oculta': False,
            'categoria': categoria,
            'colectivos': [nombre for nombre, patron in COLECTIVOS.items() if re.search(patron, completo, re.I)],
            'palancas': [nombre for nombre, patron in PALANCAS.items() if re.search(patron, completo, re.I)],
            'territorios': [nombre for nombre, patron in TERRITORIOS.items() if re.search(patron, completo)],
            'cifras': [],
            'plazo': None,
            'deroga': None,
        })

    capitulo_1 = parrafos(documento, [4, 5])
    return {
        'id': 'geroa-bai',
        'partido': 'Geroa Bai',
        'siglas': 'GBAI',
        'comunidad': 'Navarra',
        'color': '#3a5a98',
        'colorClaro': '#a6b5d1',
        'programa': 'Defiéndete, Nafarroa',
        'subtitulo': 'Bases políticas de Geroa Bai para las elecciones generales del 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/geroa-bai-bases-politicas-29n-2026.pdf',
        'fuentePdf': 'https://geroabai.eus/files/2026/11/bases-politicas-29n-1.pdf',
        'paginas': len(documento),
        'fechaPdf': '2026-11-12',
        'observaciones': [
            'El documento son unas bases políticas en prosa, no un programa de medidas. Los compromisos son las '
            'exigencias y defensas que el texto enumera; sus títulos cortos son editoriales y el texto es literal.',
            'Los metadatos del PDF dicen 13 de noviembre de 2026; la web del partido lo fecha el 12 de noviembre, '
            'el día de su publicación.',
            'Hay versión en euskera: https://geroabai.eus/files/2026/11/bases-politicas-29n-euskeraz-1.pdf',
        ],
        'unidadMedida': 'compromiso',
        'unidadMedidas': 'compromisos',
        'presentacion': {
            'titulo': 'Defender y defendernos',
            'texto': '\n\n'.join([capitulo_1[0], capitulo_1[-1]]),
        },
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def depurar(programa, ruta):
    with open(ruta, 'w', encoding='utf-8') as archivo:
        for bloque in programa['bloques']:
            archivo.write(f"\n##### {bloque['id']}. {bloque['titulo']} (p. {bloque['pagina']})\n{bloque['intro']}\n")
            for m in [m for m in programa['medidas'] if m['bloque'] == bloque['id']]:
                archivo.write(f"\n[{m['n']}] p.{m['pagina']} {m['categoria']} | {m['titulo']}\n    {m['texto']}\n")


def main():
    argumentos = sys.argv[1:]
    ruta_depurar = None
    if '--depurar' in argumentos:
        posicion = argumentos.index('--depurar')
        ruta_depurar = argumentos[posicion + 1]
        del argumentos[posicion:posicion + 2]
    programa = crear_programa(extraer(argumentos[0]))
    with open(argumentos[1], 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    if ruta_depurar:
        depurar(programa, ruta_depurar)
    print('páginas', programa['paginas'], 'capítulos', len(programa['bloques']), 'compromisos', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
