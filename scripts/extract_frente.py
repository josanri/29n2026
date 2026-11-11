"""Extrae el programa político del Frente Obrero al esquema compartido.

Capítulos numerados (01-21) → bloques. Cada medida numerada de la lista «Medidas» → medida.
Uso: python scripts/extract_frente.py <pdf> <salida.json>
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


ID = 'fo'
PDF_PUBLICO = '/programas/frente-obrero-recuperar-espana.pdf'
FUENTE = 'https://frenteobrero.es/wp-content/uploads/2026/10/Programa.pdf'
FECHA_PDF = '2026-10-06'
COLOR = '#b01c24'
COLOR_CLARO = '#e8787e'
NUM_CAPITULOS = 21
PAGINA_INICIO = 4  # las páginas 1-3 son portada e índice

CATEGORIA_POR_CAPITULO = {
    1: 'democracia',
    2: 'empleo',
    3: 'exterior',
    4: 'empleo',
    5: 'energia',
    6: 'fiscalidad',
    7: 'educacion',
    8: 'identidad',
    9: 'social',
    10: 'social',
    11: 'familia',
    12: 'rural',
    13: 'democracia',
    14: 'sanidad',
    15: 'vivienda',
    16: 'social',
    17: 'inmigracion',
    18: 'territorio',
    19: 'justicia',
    20: 'seguridad',
    21: 'defensa',
}
CATEGORIA_POR_MEDIDA = {}

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes?\b|\bjuventud\b',
    'mayores': r'\bpersonas mayores\b|\bmayores\b|\bpensionistas?\b|\bpensiones?\b|\bjubilaci[oó]n\b',
    'mujeres': r'\bmujeres?\b|\bfeminis\w*|\bviolencia machista\b|\bviolencia de g[eé]nero\b',
    'familias': r'\bfamilias?\b|\bnatalidad\b',
    'infancia': r'\binfancia\b|\bmenores\b|\bni[ñn][oa]s?\b',
    'autonomos': r'\baut[oó]nom[oa]s?\b|\bpymes?\b',
    'empresas': r'\bempresas?\b|\bindustria\b',
    'rural': r'\bagricultor\w*|\bagrari\w*|\bcampo\b|\bganader\w*|\bpesca\w*',
    'funcionarios': r'\bfuncionari\w*|\bempleados? p[uú]blicos?\b',
    'discapacidad': r'\bdependencia\b|\bdiscapacidad\w*',
    'victimas': r'\bv[ií]ctimas?\b',
    'inmigrantes': r'\binmigrantes?\b|\bextranjeros?\b|\bmigraci[oó]n\b|\basilo\b',
    'pacientes': r'\bpacientes?\b|\bsanidad\b|\bsalud\b',
    'agentes': r'\bpolic[ií]as?\b|\bfuerzas y cuerpos de seguridad\b',
}

PALANCAS = {
    'ley': r'\bley\w*|\bderog\w*|\breform\w*|\blegislaci[oó]n\b|\bdecreto\b|\bnormativa\b|\bconstituci[oó]n\b',
    'impuestos': r'\bfiscal\w*|\bimpuestos?\b|\btribut\w*|\bIRPF\b|\bIVA\b|\bcotizaciones?\b',
    'gasto': r'\binversi[oó]n\w*|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b|\brecursos\b|\bayudas?\b',
    'organizacion': r'\bcreaci[oó]n\b|\bcrear\b|\bagencia\b|\borganismo\b|\boficina\b|\bregistro\b',
    'plan': r'\bplan\b|\bplanes\b|\bestrategia\b|\bprograma\b|\bpacto\b',
}

TERRITORIOS = {
    'España': r'\bEspaña\b|\bespañol\w*',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bUE\b',
    'Cataluña': r'\bCataluña\b',
    'Galicia': r'\bGalicia\b',
    'Andalucía': r'\bAndaluc[ií]a\b',
    'País Vasco': r'\bPa[ií]s Vasco\b|\bEuskadi\b',
    'Canarias': r'\bCanarias\b',
    'Gibraltar': r'\bGibraltar\b',
    'Marruecos': r'\bMarruecos\b',
}

CAPITULO_RE = re.compile(r'^(\d{2})$')
MEDIDA_RE = re.compile(r'^(\d{1,2})\.(?:\s+(.*))?$')
PAGINA_RE = re.compile(r'^-\d+-$')
PIE_RE = re.compile(r'^UN PROGRAMA PARA$|^RECUPERAR ESPAÑA$')


def tiene_mayusculas_solas(texto):
    return bool(re.search(r'[A-ZÁÉÍÓÚÑ]', texto)) and not re.search(r'[a-záéíóúñü]', texto)


def normalize(text):
    # Guion blando al final de línea: la palabra continúa en la línea siguiente.
    text = re.sub(r'­\s*\n\s*', '', text)
    text = text.replace('­', '').replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    text = text.replace(' ', ' ').replace('\t', ' ')
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


def capitalizar(texto):
    texto = texto.strip()
    if not texto:
        return ''
    resultado = texto[:1].upper() + texto[1:].lower()
    return re.sub(r'\bespaña\b', 'España', resultado)


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def frase_titulo(texto):
    partes = re.split(r'(?<=[.!?])\s+', texto.strip(), maxsplit=1)
    titulo = partes[0].rstrip(' .')
    resto = partes[1].strip() if len(partes) > 1 else ''
    if len(titulo) > 125:
        # Un título demasiado largo se corta, y el texto completo queda en el cuerpo.
        titulo = titulo[:122].rsplit(' ', 1)[0] + '…'
        resto = texto.strip()
    return titulo[:1].upper() + titulo[1:] if titulo else '', resto


def frases_con_cifras(texto):
    return [
        parte.strip()
        for parte in re.split(r'(?<=[.!?])\s+', texto)
        if re.search(r'\d', parte) and re.search(r'%|€|euros?|mill[oó]nes?|d[ií]as?|a[ñn]os?|meses?', parte, re.I)
    ][:3]


def bloques_con_numero(pagina):
    """Une cada número de medida del margen (x < 60) con el bloque de texto a su misma altura."""
    bloques = [b for b in pagina.get_text('blocks') if b[6] == 0]
    margen = [b for b in bloques if b[0] < 60 and re.fullmatch(r'\s*\d{1,2}\.\s*', b[4])]
    cuerpo = [b for b in bloques if b not in margen]
    textos = []
    for bloque in sorted(cuerpo, key=lambda b: (round(b[1]), b[0])):
        texto = bloque[4]
        candidatos = [m for m in margen if abs(m[1] - bloque[1]) < 12 and bloque[0] >= 60]
        if candidatos:
            numero = candidatos[0]
            margen.remove(numero)
            texto = f'{numero[4].strip()} {texto}'
        textos.append((bloque[1], texto))
    textos.sort(key=lambda t: t[0])
    return [t for _, t in textos]


def leer_lineas(pdf_path):
    documento = fitz.open(pdf_path)
    lineas = []
    for numero, pagina in enumerate(documento, start=1):
        if numero < PAGINA_INICIO:
            continue
        for bloque in bloques_con_numero(pagina):
            for bruta in bloque.splitlines():
                linea = bruta.replace(' ', ' ').replace('\t', ' ').strip()
                if linea:
                    lineas.append((linea, numero))
    # Letra capital suelta («E» + «l Frente») se une a la línea siguiente.
    unidas = []
    i = 0
    while i < len(lineas):
        linea, pagina = lineas[i]
        if len(linea) == 1 and linea.isupper() and i + 1 < len(lineas):
            unidas.append((linea + lineas[i + 1][0], pagina))
            i += 2
            continue
        unidas.append((linea, pagina))
        i += 1
    return documento, unidas


def extraer(pdf_path):
    documento, lineas = leer_lineas(pdf_path)
    capitulos = []
    cap = None
    medida = None
    esperado_cap = 1
    esperado_med = 1

    def cerrar_medida():
        nonlocal medida
        if medida is not None:
            medida['cuerpo'] = normalize('\n'.join(medida['lineas']))
            medida = None

    i = 0
    while i < len(lineas):
        linea, pagina = lineas[i]

        capitulo = CAPITULO_RE.match(linea)
        if capitulo and int(capitulo.group(1)) == esperado_cap and esperado_cap <= NUM_CAPITULOS:
            cerrar_medida()
            titulo = []
            i += 1
            while i < len(lineas) and tiene_mayusculas_solas(lineas[i][0]) and not PAGINA_RE.match(lineas[i][0]) and not PIE_RE.match(lineas[i][0]):
                titulo.append(lineas[i][0])
                i += 1
            cap = {'num': esperado_cap, 'titulo': ' '.join(titulo), 'pagina': pagina, 'intro': [], 'medidas': []}
            capitulos.append(cap)
            esperado_cap += 1
            esperado_med = 1
            continue

        if cap is None or PAGINA_RE.match(linea) or PIE_RE.match(linea):
            i += 1
            continue

        if tiene_mayusculas_solas(linea) or linea == f'{cap["num"]:02d}':
            i += 1
            continue

        numerada = MEDIDA_RE.match(linea)
        if numerada and int(numerada.group(1)) == esperado_med:
            cerrar_medida()
            medida = {'pagina': pagina, 'lineas': [numerada.group(2) or ''], 'cap': cap}
            cap['medidas'].append(medida)
            esperado_med += 1
        elif medida is not None:
            medida['lineas'].append(linea)
        else:
            cap['intro'].append(linea)
        i += 1

    cerrar_medida()
    if len(capitulos) != NUM_CAPITULOS:
        raise ValueError(f'Se esperaban {NUM_CAPITULOS} capítulos; se encontraron {len(capitulos)}')
    return documento, capitulos


def construir(pdf_path):
    documento, capitulos = extraer(pdf_path)

    bloques = []
    secciones = []
    medidas = []
    n = 0
    presentacion = None
    for cap in capitulos:
        bid = cap['num']
        intro = normalize('\n'.join(cap['intro']))
        titulo = capitalizar(cap['titulo'])
        if bid == 1:
            presentacion = {'titulo': titulo, 'texto': intro}
            intro = ''
        bloques.append({
            'id': bid,
            'titulo': titulo,
            'tituloMayus': cap['titulo'],
            'lema': '',
            'cita': '',
            'intro': intro,
            'pagina': cap['pagina'],
        })
        secciones.append({
            'id': str(bid),
            'bloque': bid,
            'titulo': titulo,
            'tituloFrase': titulo,
            'intro': '',
            'pagina': cap['pagina'],
            'subapartados': [],
        })
        for medida_raw in cap['medidas']:
            n += 1
            texto_completo = medida_raw['cuerpo']
            titulo_medida, texto = frase_titulo(texto_completo)
            completo = f'{titulo_medida} {texto}'
            medidas.append({
                'n': n,
                'bloque': bid,
                'seccion': str(bid),
                'pagina': medida_raw['pagina'],
                'subapartado': None,
                'titulo': titulo_medida,
                'tituloFrase': titulo_medida,
                'texto': texto,
                'oculta': False,
                'categoria': CATEGORIA_POR_MEDIDA.get(n, CATEGORIA_POR_CAPITULO[bid]),
                'colectivos': coincidencias(completo, COLECTIVOS),
                'palancas': coincidencias(completo, PALANCAS),
                'territorios': coincidencias(completo, TERRITORIOS),
                'cifras': frases_con_cifras(texto_completo),
                'plazo': None,
                'deroga': None,
            })

    cifras = [
        {
            'valor': numero.group(0),
            'unidad': '%' if '%' in numero.group(0) else '€',
            'texto': medida['tituloFrase'],
            'medida': medida['n'],
        }
        for medida in medidas
        if (numero := re.search(r'\d[\d.,]*\s*(?:%|€)', medida['texto'] or medida['titulo']))
    ][:8]

    return {
        'id': ID,
        'partido': 'Frente Obrero',
        'siglas': 'FO',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Recuperar España',
        'subtitulo': 'Programa político del Frente Obrero',
        'elecciones': 'Programa político',
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': presentacion or {'titulo': '', 'texto': ''},
        'cifras': cifras,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def main():
    pdf_path, salida_path = sys.argv[1], sys.argv[2]
    programa = construir(pdf_path)
    with open(salida_path, 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())
    for medida in programa['medidas']:
        print(medida['n'], medida['bloque'], medida['pagina'], medida['titulo'][:90], '| cuerpo:', len(medida['texto']))


if __name__ == '__main__':
    main()
