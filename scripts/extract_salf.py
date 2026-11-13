"""Extract SALF's 119 numbered proposals from its simplified 2026 electoral contract."""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


EXPECTED_PAGES = 40
# A time phrase counts as a deadline only when the party promises it (see find_deadline), and only
# when it says when the measure is carried out. A service time («cita con tu médico en 48 horas»,
# «okupa fuera en 48 horas») or a period («cada año») is a figure of the measure, not a deadline.
DEADLINE_RE = re.compile(
    r'\b((?:\d+|dos|tres|cuatro|seis|doce|dieciocho) meses?|(?:dos|tres|cuatro) años|en la legislatura|en \d{4})\b',
    re.I,
)
# Time phrases that are how long something lasts or what it costs, not when it arrives: a rent guarantee
# of twelve months (8), a service of six to twelve months (17), the cost over the term (63), zero
# contributions for two years (90) and two years of paid internship (98).
NOT_DEADLINE = {8, 17, 63, 90, 98}
NUMBER_WORDS = {'dos': '2', 'tres': '3', 'cuatro': '4', 'seis': '6', 'doce': '12', 'dieciocho': '18'}
# Deadlines read in the measure when the first time phrase is not the right one: the IRPF calendar of
# measure 25 ends in 2030 (15.000 euros in 2027 … 35.000 in 2030), and the deduction of measure 111
# applies «desde la renta de 2027».
DEADLINE_OVERRIDE = {25: 'en 2030', 111: 'en 2027'}
# Past tense and «fue»/«había» mark a fact, not a promise. «sólo» and «cómo» end in «ó» but are not past tense.
PAST_RE = re.compile(
    r'\b(?!s[oó]lo\b|c[oó]mo\b)(\w+(?:aron|ieron|eron|ió|ó)|fue|fueron|hab[ií]a|hab[ií]an|tuvo|tuvieron)\b',
    re.I,
)
# A time phrase inside a condition («si no…») or in a demand on another state («readmisión…») is a figure, not a promise.
CONDITION_RE = re.compile(r'\bsi no\b|\breadmi\w*', re.I)


def normalize_deadline(deadline):
    """Write the number in digits («seis meses» → «6 meses») so the timeline can order it, and the
    term as the other programs do («en la legislatura» → «Fin de legislatura»)."""
    if deadline.lower() == 'en la legislatura':
        return 'Fin de legislatura'
    number, _, unit = deadline.partition(' ')
    return f"{NUMBER_WORDS.get(number.lower(), number)} {unit}" if unit else deadline


def find_deadline(text):
    """Return the first deadline the party promises in the text, or None.

    A sentence is skipped when it has a past tense verb, when it names a year before 2026,
    when it cites an existing legal deadline («plazo legal»), or when the time phrase
    is a condition or a demand on another state (see CONDITION_RE).
    """
    for sentence in re.split(r'(?<=[.!?])\s+', text):
        match = DEADLINE_RE.search(sentence)
        if (not match or PAST_RE.search(sentence) or re.search(r'plazo legal', sentence, re.I)
                or CONDITION_RE.search(sentence)):
            continue
        year = re.fullmatch(r'en (\d{4})', match.group(1), re.I)
        if year and int(year.group(1)) < 2026:
            continue
        return normalize_deadline(match.group(1))
    return None
SECCIONES = [
    {
        'titulo': 'Vivienda',
        'lema': 'Tu primera casa, un 35 % más barata. Y el okupa, fuera en 48 horas.',
        'categoria': 'vivienda',
        'paginas': range(5, 8),
        'medidas': 10,
    },
    {
        'titulo': 'Seguridad',
        'lema': 'El que viola, mata o trafica cumple entero. El que entra en tu casa asume el riesgo.',
        'categoria': 'seguridad',
        'paginas': range(8, 12),
        'medidas': 14,
    },
    {
        'titulo': 'Impuestos',
        'lema': 'Libertad económica, sin dejar a nadie atrás.',
        'categoria': 'fiscalidad',
        'paginas': range(12, 17),
        'medidas': 14,
    },
    {
        'titulo': 'Inmigración',
        'lema': 'Solo legal. Expulsión en 48 horas. Paralización total de inmigración de países no colaboradores contra las mafias de trata de personas.',
        'categoria': 'inmigracion',
        'paginas': range(17, 20),
        'medidas': 10,
    },
    {
        'titulo': 'Pensiones',
        'lema': 'Las de hoy, blindadas. Las de mañana, a tu nombre.',
        'categoria': 'social',
        'paginas': range(20, 22),
        'medidas': 10,
    },
    {
        'titulo': 'Sanidad',
        'lema': 'Una central de compras. 60 días para operarte. Profesionales pagados como en Europa.',
        'categoria': 'sanidad',
        'paginas': range(22, 25),
        'medidas': 12,
    },
    {
        'titulo': 'Corrupción',
        'lema': 'Imprescriptible. Sin tercer grado. Devuelves el triple. El que denuncia cobra el 15 %.',
        'categoria': 'democracia',
        'paginas': range(25, 30),
        'medidas': 15,
    },
    {
        'titulo': 'Empleo',
        'lema': 'Trabajar tiene que salir a cuenta.',
        'categoria': 'empleo',
        'paginas': range(30, 33),
        'medidas': 10,
    },
    {
        'titulo': 'Educación',
        'lema': 'El Estado no es dueño de tus hijos.',
        'categoria': 'educacion',
        'paginas': range(33, 35),
        'medidas': 10,
    },
    {
        'titulo': 'Geopolítica',
        'lema': 'España primero. Ni Bruselas, ni Rabat, ni los Hermanos Musulmanes deciden por los españoles.',
        'categoria': 'exterior',
        'paginas': range(35, 40),
        'medidas': 14,
    },
]

MEDIDA_RE = re.compile(r'^\s*(\d{1,2})\s*(?:\|\s*|\n\s*)(.+)$', re.S)
CATEGORIAS = [
    ('vivienda', r'\bviviend|alquiler|inmobili|hipotec|suelo público'),
    ('seguridad', r'\bpolic[ií]|guardia civil|delit|c[aá]rcel|pris[ió]n|seguridad|criminal|narco'),
    ('inmigracion', r'\binmigr|expulsi[oó]n|nacionalidad|menores|extranjer|regularizaci[oó]n'),
    ('sanidad', r'\bsanidad|sanitari|salud|hospital|m[eé]dic|paciente|medicamento'),
    ('educacion', r'\beducaci[oó]n|educativ|alumn|escolar|profesor|docente|formaci[oó]n profesional'),
    ('empleo', r'\bempleo|laboral|trabajador|trabajo|aut[oó]nom|cotizaci[oó]n|contrato'),
    ('fiscalidad', r'\bimpuestos?|fiscal|tribut|IRPF|IVA|hacienda|cotizaci[oó]n'),
    ('justicia', r'\bjusticia|jueces?|fiscales?|tribunal|corrupci[oó]n|amnist[ií]a|indulto|aforamiento'),
    ('defensa', r'\bdefensa|militares?|ej[eé]rcito|armada|frontera'),
    ('identidad', r'\bcastellano|españa|español|hisp[aá]nica|identidad|lengua'),
    ('energia', r'\benerg[ií]a|luz|agua|clim[aá]tic'),
    ('administracion', r'\badministraci[oó]n|ministerio|gobierno|contrato p[uú]blico|gasto p[uú]blico'),
]
COLECTIVOS = {
    'jovenes': r'\bj[oó]ven(?:es)?\b|juventud|menores de \d+',
    'mayores': r'\bpersonas? mayores\b|jubilad\w*|pensionistas?|pensiones?',
    'mujeres': r'\bmujeres?\b|violencia de g[eé]nero',
    'familias': r'\bfamilias?\b|conciliaci[oó]n',
    'infancia': r'\bniñ[oa]s?\b|\binfancia\b|menores',
    'autonomos': r'\baut[oó]nom\w*|emprendedor\w*',
    'empresas': r'\bempresas?\b|empresarial|pymes|sociedades',
    'rural': r'\brural(?:es)?\b|agricultura|ganader[ií]a|pesca',
    'funcionarios': r'\bfuncionari\w*|empleados? p[uú]blicos?',
    'discapacidad': r'\bdiscapacidad\b|dependencia',
    'victimas': r'\bv[ií]ctimas?\b',
    'inmigrantes': r'\binmigrantes?\b|migraci[oó]n|extranjeros?',
    'pacientes': r'\bpacientes?\b|sanidad|sanitaria|hospitales?',
    'agentes': r'\bpolic[ií]as?\b|guardia civil|jueces?|fiscales?',
}
PALANCAS = {
    'ley': r'\bley\b|leyes|reforma|reformar|derog|constituci[oó]n|normativa|legislaci[oó]n',
    'impuestos': r'\bIRPF\b|\bIVA\b|impuesto|fiscal|tribut|cotizaci[oó]n',
    'gasto': r'\bfinanciaci[oó]n|financiar|inversi[oó]n|fondos?|ayudas?|recursos|presupuesto|coste',
    'organizacion': r'\bcrear|creaci[oó]n|agencia|organismo|oficina|central|registro|establecer',
    'plan': r'\bplan(?:es)?\b|programa|estrategia|agenda|convenio|acuerdo|pacto',
}
TERRITORIOS = {
    'España': r'\bEspaña\b|\bespañol(?:a|es)?\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bBruselas\b|\bUE\b',
    'Canarias': r'\bCanarias\b|\bcanari[oa]s?\b',
    'Ceuta': r'\bCeuta\b',
    'Melilla': r'\bMelilla\b',
    'Cataluña': r'\bCataluñ[ae]?\b|\bCatalunya\b',
    'País Vasco': r'\bPa[ií]s Vasco\b|\bEuskadi\b|\bmosso\b',
    'Marruecos': r'\bMarruecos\b|\bRabat\b',
    'Hispanoamérica': r'\bHispanoam[eé]rica\b|\bAm[eé]rica\b',
}


def normalizar(texto):
    texto = texto.replace('\ufb01', 'fi').replace('\ufb02', 'fl')
    texto = texto.replace('\u00a0', ' ')
    resultado = ''
    for linea in texto.splitlines():
        linea = linea.strip()
        if not linea:
            continue
        if resultado.endswith(('-', '‐', '‑')) and linea[:1].islower():
            resultado = resultado[:-1] + linea
        else:
            resultado = f'{resultado} {linea}'.strip()
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', resultado)).strip()


def clasificar(patrones, texto):
    return [nombre for nombre, patron in patrones.items() if re.search(patron, texto, re.I)]


def extraer(documento):
    if len(documento) != EXPECTED_PAGES:
        raise ValueError(f'Se esperaban {EXPECTED_PAGES} páginas; el PDF tiene {len(documento)}')

    por_pagina = {}
    medidas_raw = []
    for bloque_id, seccion in enumerate(SECCIONES, start=1):
        propuestas = []
        for numero_pagina in seccion['paginas']:
            pagina = documento[numero_pagina - 1]
            bloques_pagina = sorted(pagina.get_text('blocks'), key=lambda bloque: (bloque[1], bloque[0]))
            por_pagina[numero_pagina] = bloques_pagina
            for bloque in bloques_pagina:
                x, y, _, _, texto = bloque[:5]
                if x > 160 or y < 45 or y > 780:
                    continue
                coincidencia = MEDIDA_RE.match(texto.strip())
                if not coincidencia:
                    continue
                numero = int(coincidencia.group(1))
                titulo = normalizar(coincidencia.group(2))
                if numero > seccion['medidas'] or not titulo:
                    continue
                propuestas.append({
                    'numero_origen': numero,
                    'pagina': numero_pagina,
                    'y': y,
                    'x': x,
                    'titulo': titulo,
                    'bloque_texto': bloque,
                    'bloque_id': bloque_id,
                    'seccion': seccion,
                })

        numeros = [propuesta['numero_origen'] for propuesta in propuestas]
        esperados = list(range(1, seccion['medidas'] + 1))
        if numeros != esperados:
            raise ValueError(
                f'{seccion["titulo"]}: se esperaban las medidas {esperados}, '
                f'se encontraron {numeros}'
            )
        medidas_raw.extend(propuestas)

    if len(medidas_raw) != 119:
        raise ValueError(f'Se esperaban 119 medidas impresas; se encontraron {len(medidas_raw)}')

    for indice, propuesta in enumerate(medidas_raw):
        cuerpo = []
        siguiente = medidas_raw[indice + 1] if indice + 1 < len(medidas_raw) else None
        for numero_pagina in range(propuesta['pagina'], siguiente['pagina'] + 1 if siguiente else propuesta['pagina'] + 1):
            for bloque in por_pagina[numero_pagina]:
                x, y, _, _, texto = bloque[:5]
                if bloque is propuesta['bloque_texto']:
                    continue
                if x < 70 or x > 160 or y < 45 or y > 780:
                    continue
                if numero_pagina == propuesta['pagina'] and y <= propuesta['y']:
                    continue
                if siguiente and numero_pagina == siguiente['pagina'] and y >= siguiente['y']:
                    continue
                cuerpo.append(texto)
        propuesta['texto'] = normalizar('\n'.join(cuerpo))
        if not propuesta['texto']:
            raise ValueError(
                f'Medida {propuesta["numero_origen"]} de {propuesta["seccion"]["titulo"]} '
                f'(pág. {propuesta["pagina"]}) sin texto extraído'
            )
    return medidas_raw


def crear_programa(documento, extraidas):
    bloques = []
    secciones = []
    medidas = []
    global_id = 0
    for bloque_id, seccion in enumerate(SECCIONES, start=1):
        medidas_seccion = [m for m in extraidas if m['bloque_id'] == bloque_id]
        primera_pagina = medidas_seccion[0]['pagina']
        bloques.append({
            'id': bloque_id,
            'titulo': seccion['titulo'],
            'tituloMayus': seccion['titulo'].upper(),
            'lema': seccion['lema'],
            'cita': '',
            'intro': '',
            'pagina': primera_pagina,
        })
        sid = str(bloque_id)
        secciones.append({
            'id': sid,
            'bloque': bloque_id,
            'titulo': seccion['titulo'],
            'tituloFrase': seccion['lema'],
            'intro': '',
            'pagina': primera_pagina,
            'subapartados': [],
        })
        for propuesta in medidas_seccion:
            global_id += 1
            completo = f'{propuesta["titulo"]}. {propuesta["texto"]}'
            categoria = next(
                (nombre for nombre, patron in CATEGORIAS if re.search(patron, completo, re.I)),
                seccion['categoria'],
            )
            frases_cifra = [
                parte.strip()
                for parte in re.split(r'(?<=[.!?])\s+', propuesta['texto'])
                if re.search(r'\d', parte)
                and re.search(r'%|€|euros?|mill[oó]nes?|d[ií]as?|años?|meses?', parte, re.I)
            ][:3]
            plazo = None if global_id in NOT_DEADLINE else DEADLINE_OVERRIDE.get(global_id) or find_deadline(completo)
            medidas.append({
                'n': global_id,
                'bloque': bloque_id,
                'seccion': sid,
                'pagina': propuesta['pagina'],
                'subapartado': None,
                'titulo': propuesta['titulo'],
                'tituloFrase': propuesta['titulo'],
                'texto': propuesta['texto'],
                'oculta': False,
                'categoria': categoria,
                'colectivos': clasificar(COLECTIVOS, completo),
                'palancas': clasificar(PALANCAS, completo),
                'territorios': clasificar(TERRITORIOS, completo),
                'cifras': frases_cifra,
                'plazo': plazo,
                'deroga': None,
            })

    verbos = Counter()
    for medida in medidas:
        for verbo in re.findall(r'\b\w+(?:aremos|eremos|iremos)\b', medida['texto'].lower()):
            verbos[verbo] += 1

    cifras = []
    for medida in medidas:
        match = re.search(r'\b\d+(?:[.,]\d+)?\s*%', medida['texto'])
        if match:
            cifras.append({
                'valor': match.group(0),
                'unidad': '%',
                'texto': medida['tituloFrase'],
                'medida': medida['n'],
            })
        if len(cifras) == 8:
            break

    return {
        'id': 'salf',
        'partido': 'Se Acabó La Fiesta',
        'siglas': 'SALF',
        'color': '#111111',
        'colorClaro': '#ffd23f',
        'programa': 'Contrato Electoral',
        'subtitulo': '119 propuestas del contrato electoral simplificado para el 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/salf-contrato-electoral-29n.pdf',
        'fuentePdf': 'https://www.seacabolafiesta.com/SALF_Contrato_Electoral_29N.pdf?v=073425b9522d',
        'paginas': len(documento),
        'presentacion': {
            'titulo': 'Contrato electoral simplificado',
            'texto': (
                'El documento reúne diez compromisos temáticos y los desarrolla en 119 propuestas numeradas. '
                'En la cláusula de penalización, SALF afirma que comparará esas 119 medidas con los votos '
                'emitidos en junio de 2030. La numeración se reinicia en cada compromiso; los identificadores '
                'de esta web son consecutivos para poder enlazar las 119 propuestas.'
            ),
        },
        'cifras': cifras,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [{'verbo': verbo, 'n': total} for verbo, total in verbos.most_common(15)],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def main():
    documento = fitz.open(sys.argv[1])
    programa = crear_programa(documento, extraer(documento))
    with open(sys.argv[2], 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    print('páginas', programa['paginas'], 'compromisos', len(programa['bloques']), 'medidas', len(programa['medidas']))
    print('categorías', Counter(medida['categoria'] for medida in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
