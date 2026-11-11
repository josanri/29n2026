"""Extract and categorize the 100 measures in Defiende Canarias."""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


CAUSAS = [
    ('Defender los derechos de Canarias', 1, 8, 'territorio'),
    ('Defender nuestros servicios públicos y los cuidados', 9, 15, 'social'),
    ('Defender el derecho a vivir y permanecer en Canarias', 16, 30, 'vivienda'),
    ('Defender a quienes levantan Canarias cada día', 31, 44, 'empleo'),
    ('Defender el futuro de nuestros jóvenes y el conocimiento', 45, 51, 'educacion'),
    ('Defender nuestra tierra y nuestros recursos', 52, 67, 'energia'),
    ('Defender las ocho islas', 68, 81, 'infraestructuras'),
    ('Defender una política migratoria solidaria y europea', 82, 86, 'inmigracion'),
    ('Defender nuestra identidad y nuestra posición en el Atlántico', 87, 95, 'identidad'),
    ('Defender nuestra capacidad para decidir y exigir resultados', 96, 100, 'territorio'),
]

CATEGORIAS = [
    ('vivienda', r'\bviviend|hogar|alquiler|residencial|inmueble'),
    ('inmigracion', r'\bmigraci[oó]n|inmigr|menores no acompa|acogida'),
    ('infraestructuras', r'\btransporte|movilidad|conexi[oó]n|carreter|ferrovi|puerto|aeropuerto|guagua|tranv[ií]a|mercanc[ií]as'),
    ('energia', r'\benerg[ií]a|el[eé]ctric|renovable|e[oó]lica|combustible|emisiones|clim[aá]tic|agua|saneamiento|depuraci[oó]n|vulcan|costa|residuos|recarga'),
    ('rural', r'\bagr[ií]col|pesca|pesquer|ganad|POSEI|cultivo|aliment'),
    ('sanidad', r'\bsanidad|sanitari|salud mental|hospital|centro de salud|atenci[oó]n sanitaria'),
    ('educacion', r'\beducaci[oó]n|educativ|formaci[oó]n profesional|beca|universidad|investigaci[oó]n|conocimiento|ciencia'),
    ('empleo', r'\bempleo|laboral|aut[oó]nom|empresa|empresari|actividad econ[oó]mica|turismo|salario|trabajo estable|econom[ií]a azul'),
    ('fiscalidad', r'\bfiscal|impuestos?|tribut|IRPF|financiaci[oó]n|presupuestos?'),
    ('identidad', r'\bcultura|identidad|deporte|canarios? del exterior|retorno|atl[aá]ntico|Europa|europe[oa]|lengua'),
    ('administracion', r'\bayuntamientos?|cabildos?|municipios?|administraci[oó]n|competencias|gesti[oó]n'),
    ('social', r'\bdependencia|cuidados?|pobreza|pensiones?|discapacidad|infantil|violencia de g[eé]nero|familias?|personas mayores'),
    ('democracia', r'\brendir cuentas|transparencia|participaci[oó]n|evaluaci[oó]n|decisiones|representaci[oó]n|agenda canaria'),
]

COLECTIVOS = {
    'jovenes': r'\bj[oó]ven(?:es)?\b|juventud|menores de 35',
    'mayores': r'\bpersonas mayores\b|pensionistas?|pensiones?',
    'mujeres': r'\bmujeres?\b|violencia de g[eé]nero',
    'familias': r'\bfamilias?\b|conciliaci[oó]n',
    'infancia': r'\binfancia\b|infantil|menores|niñ[oa]s?',
    'autonomos': r'\baut[oó]nom[oa]s?\b|pymes|pequeñas empresas',
    'empresas': r'\bempresas?\b|industria|sector primario',
    'rural': r'\brural(?:es)?\b|agricultura|ganader[ií]a|pesca',
    'funcionarios': r'\bfuncionari[oa]s?\b|empleados p[uú]blicos',
    'discapacidad': r'\bdiscapacidad\b|dependencia',
    'victimas': r'\bv[ií]ctimas?\b',
    'inmigrantes': r'\binmigrantes?\b|migraci[oó]n|menores no acompañados|acogida',
    'pacientes': r'\bpacientes?\b|sanidad|sanitaria|salud mental|hospitales?',
}

PALANCAS = {
    'ley': r'\bley\b|reforma|reformar|norma|legislaci[oó]n|Estatuto|derogar|marco jurídico',
    'impuestos': r'\bIRPF\b|fiscal|impuesto|tribut|deducci[oó]n|bonificaci[oó]n',
    'gasto': r'\bfinanciaci[oó]n|financiar|inversi[oó]n|fondos?|ayudas?|recursos|aportaci[oó]n',
    'organizacion': r'\bcrear|creaci[oó]n|agencia|organismo|oficina|centro nacional|establecer|participaci[oó]n',
    'plan': r'\bplan(?:es)?\b|programa|estrategia|agenda|convenio|acuerdo|pacto',
}

TERRITORIOS = {
    'Canarias': r'\bCanarias\b|\bcanario\b|\bcanaria\b|\barchipi[eé]lago\b',
    'La Palma': r'\bLa Palma\b',
    'La Gomera': r'\bLa Gomera\b',
    'El Hierro': r'\bEl Hierro\b',
    'Tenerife': r'\bTenerife\b',
    'Gran Canaria': r'\bGran Canaria\b',
    'Lanzarote': r'\bLanzarote\b',
    'Fuerteventura': r'\bFuerteventura\b',
    'La Graciosa': r'\bLa Graciosa\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\beurope[oa]s?\b',
    'África': r'\b[ÁA]frica\b',
    'América': r'\bAm[eé]rica\b',
}

MEDIDA_RE = re.compile(r'^\s*(\d{1,3})\.\s+(.*)$')
CABECERAS = {'DEFIENDE', 'CANARIAS', '29 DE NOVIEMBRE DE 2026'}


def normalizar(texto):
    texto = texto.replace('\ufb01', 'fi').replace('\ufb02', 'fl')
    texto = texto.replace('\u00a0', ' ')
    lineas = [linea.strip() for linea in texto.splitlines()]
    resultado = ''
    for linea in lineas:
        if not linea or linea in CABECERAS or linea.startswith('Estos compromisos expresan'):
            continue
        if resultado.endswith('-') and linea[:1].islower():
            resultado = resultado[:-1] + linea
        else:
            resultado = f'{resultado} {linea}'.strip()
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', resultado)).strip()


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != 23:
        raise ValueError(f'Se esperaban 23 páginas; el PDF tiene {len(documento)}')

    medidas_raw = {}
    numero_actual = None
    partes = []
    pagina_actual = None
    saltar_intro = False

    def guardar():
        if numero_actual is not None:
            if numero_actual in medidas_raw:
                raise ValueError(f'Medida duplicada en el PDF: {numero_actual}')
            medidas_raw[numero_actual] = {
                'texto': normalizar('\n'.join(partes)),
                'pagina': pagina_actual,
            }

    for indice, pagina in enumerate(documento):
        for linea in pagina.get_text().splitlines():
            coincidencia = MEDIDA_RE.match(linea)
            if coincidencia:
                numero = int(coincidencia.group(1))
                guardar()
                numero_actual = numero
                pagina_actual = indice + 1
                partes = [coincidencia.group(2).strip()]
                saltar_intro = False
            elif linea.strip().startswith('Estos compromisos expresan'):
                guardar()
                numero_actual = None
                partes = []
                saltar_intro = True
            elif linea.strip().upper().startswith('DEFENDER ') and linea.strip().isupper():
                saltar_intro = True
            elif numero_actual is not None and not saltar_intro and linea.strip():
                partes.append(linea.strip())
        if indice == 20:
            break
    guardar()

    esperadas = set(range(1, 101))
    if set(medidas_raw) != esperadas:
        faltan = sorted(esperadas - set(medidas_raw))
        sobran = sorted(set(medidas_raw) - esperadas)
        raise ValueError(f'La extracción no da las medidas 1-100 (faltan {faltan}; sobran {sobran})')
    return documento, medidas_raw


def crear_programa(documento, extraidas):
    bloques = []
    secciones = []
    medidas = []
    for bloque_id, (titulo, primero, ultimo, categoria_base) in enumerate(CAUSAS, start=1):
        ids = range(primero, ultimo + 1)
        bloques.append({
            'id': bloque_id,
            'titulo': titulo,
            'tituloMayus': titulo.upper(),
            'lema': '',
            'cita': '',
            'intro': '',
            'pagina': extraidas[primero]['pagina'],
        })
        sid = str(bloque_id)
        secciones.append({
            'id': sid,
            'bloque': bloque_id,
            'titulo': titulo,
            'tituloFrase': titulo,
            'intro': '',
            'pagina': extraidas[primero]['pagina'],
            'subapartados': [],
        })

        for numero in ids:
            extraida = extraidas[numero]
            titulo_medida, separador, texto = extraida['texto'].partition('. ')
            if not separador:
                raise ValueError(f'No se pudo separar el título de la medida {numero}')
            titulo_medida = titulo_medida.rstrip('.')
            texto = texto.strip()
            completo = f'{titulo_medida}. {texto}'
            categoria = next(
                (nombre for nombre, patron in CATEGORIAS if re.search(patron, completo, re.I)),
                categoria_base,
            )
            frases_cifra = [
                parte.strip()
                for parte in re.split(r'(?<=[.!?])\s+', texto)
                if re.search(r'\d', parte) and re.search(r'%|€|euros?|mill[oó]ns?|km\b|d[ií]as?|años?|meses?', parte, re.I)
            ][:3]
            match_plazo = re.search(r'\b(cuatrienal|plurianual|anual|en \d{4}|hasta \d{4})\b', completo, re.I)
            medidas.append({
                'n': numero,
                'bloque': bloque_id,
                'seccion': sid,
                'pagina': extraida['pagina'],
                'subapartado': None,
                'titulo': titulo_medida,
                'tituloFrase': titulo_medida,
                'texto': texto,
                'oculta': False,
                'categoria': categoria,
                'colectivos': [nombre for nombre, patron in COLECTIVOS.items() if re.search(patron, completo, re.I)],
                'palancas': [nombre for nombre, patron in PALANCAS.items() if re.search(patron, completo, re.I)],
                'territorios': [nombre for nombre, patron in TERRITORIOS.items() if re.search(patron, completo, re.I)],
                'cifras': frases_cifra,
                'plazo': match_plazo.group(1) if match_plazo else None,
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
        'id': 'cc',
        'partido': 'Coalición Canaria–Primero Canarias',
        'siglas': 'CC',
        'comunidad': 'Canarias',
        'color': '#0099a6',
        'colorClaro': '#ffd43b',
        'programa': 'Defiende Canarias',
        'subtitulo': '10 causas y 100 medidas para defender Canarias en Madrid',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/cc-defiende-canarias-2026.pdf',
        'fuentePdf': 'https://primerocanarias.com/2026/11/09/1ocan-cc-presenta-su-programa-electoral-para-el-29n-diez-grandes-causas-y-cien-medidas-para-defender-canarias-en-madrid/',
        'paginas': len(documento),
        'fechaPdf': '2026-11-09',
        'presentacion': {
            'titulo': 'Canarias tiene que contar',
            'texto': normalizar('\n'.join(pagina.get_text() for pagina in documento[1:5])),
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
    documento, extraidas = extraer(sys.argv[1])
    programa = crear_programa(documento, extraidas)
    with open(sys.argv[2], 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    print('páginas', programa['paginas'], 'causas', len(programa['bloques']), 'medidas', len(programa['medidas']))
    print('categorías', Counter(medida['categoria'] for medida in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
