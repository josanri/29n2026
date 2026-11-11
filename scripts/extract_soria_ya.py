"""Extrae el programa de Soria ¡Ya! (Elecciones generales 2026) al esquema compartido.

Capítulos numerados (01-18) → bloques. Cada párrafo del cuerpo de un capítulo → medida.
El primer párrafo de cada capítulo es su introducción.
Uso: python scripts/extract_soria_ya.py <pdf> <salida.json>
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


ID = 'soria-ya'
PDF_PUBLICO = '/programas/soria-ya-2026.pdf'
FUENTE = 'https://soriaya.org/wp-content/uploads/2026/03/Programa-Soria-Ya-2026.pdf'
# Rojo del logotipo (¡YA!), muestreado de la imagen oficial. Claro: aclarar() de generate_partidos.py, factor 0.55.
COLOR = '#c8102c'
COLOR_CLARO = '#e693a0'
NUM_CAPITULOS = 18
# En el PDF, el capítulo 05 empieza directamente con su primera medida, sin introducción.
CAPITULOS_SIN_INTRO = {5}

# Categoría por capítulo (ids de src/data/taxonomia.json).
CATEGORIA_POR_CAPITULO = {
    1: 'territorio',
    2: 'sanidad',
    3: 'educacion',
    4: 'innovacion',
    5: 'empleo',
    6: 'fiscalidad',
    7: 'administracion',
    8: 'innovacion',
    9: 'infraestructuras',
    10: 'infraestructuras',
    11: 'administracion',
    12: 'vivienda',
    13: 'energia',
    14: 'identidad',
    15: 'identidad',
    16: 'social',
    17: 'rural',
    18: 'territorio',
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes?\b|\bjuventud\b',
    'mayores': r'\bpersonas mayores\b|\bmayores\b|\bpensionistas?\b|\bpensiones?\b',
    'mujeres': r'\bmujeres?\b|\bfeminis\w*|\bviolencia machista\b|\bviolencia de g[eé]nero\b',
    'familias': r'\bfamilias?\b',
    'infancia': r'\binfancia\b|\bmenores\b|\bni[ñn][oa]s?\b',
    'autonomos': r'\baut[oó]nom[oa]s?\b|\bpymes?\b|\bemprendedor\w*',
    'empresas': r'\bempresas?\b|\bindustria\b',
    'rural': r'\bagricultur\w*|\bagrari\w*|\bpesca\b|\bganader\w*|\brural\w*|\bpueblos?\b',
    'funcionarios': r'\bfuncionari\w*|\bempleados? p[uú]blicos?\b|\bempleo p[uú]blico\b',
    'discapacidad': r'\bdependencia\b|\bdiscapacidad\w*',
    'pacientes': r'\bpacientes?\b|\bsanidad\b|\bsanitari\w*|\bmédic\w*|\bmedic\w*',
    'agentes': r'\bpolic[ií]as?\b|\bfuerzas de seguridad\b|\bguardia civil\b',
}

PALANCAS = {
    'ley': r'\bley\w*|\bderog\w*|\breform\w*|\bdecreto\b|\bnormativa\b',
    'impuestos': r'\bfiscal\w*|\bimpuestos?\b|\btribut\w*|\bIRPF\b|\bIVA\b|\bITP\b',
    'gasto': r'\binversi[oó]n\w*|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b|\bayudas?\b|\bsubvenci\w*',
    'organizacion': r'\bcreaci[oó]n\b|\bcrear\b|\bagencia\b|\borganismo\b|\boficina\b|\bobservatorio\b',
    'plan': r'\bplan\b|\bplanes\b|\bestrategia\b|\bprograma\b|\bpacto\b',
}

TERRITORIOS = {
    'Soria': r'\bSoria\b|\bsoriano\w*|\bsorianos\b',
    'Castilla y León': r'\bCastilla y Le[oó]n\b|\bCyL\b|\bSACyL\b|\bSacyl\b',
    'España': r'\bEspaña\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bUE\b',
}

# Encabezado de capítulo: «02 SANIDAD». Sin «- página», para no confundirlo con el índice.
CAPITULO_RE = re.compile(r'^(\d{2})\s+(\S.*)$', re.DOTALL)
PIE_RE = re.compile(r'^\s*\d{1,3}\s*/\s*\d{1,3}\s*$')
# Línea de fecha de cierre del documento («Febrero de 2026.»), que no es una medida.
FECHA_RE = re.compile(r'^[A-Za-zÁÉÍÓÚáéíóúñÑ]+ de \d{4}\.?$')
INDICE_RE = re.compile(r'-\s*\d{1,3}\s*$')
TRAZO_RE = re.compile(r'^\s*[●○•·]\s*')


def es_mayusculas(texto):
    return not re.search(r'[a-záéíóúñü]', texto)


def normalize(text):
    text = text.replace('­', '').replace('\xa0', ' ').replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    result = ''
    for line in text.splitlines():
        line = TRAZO_RE.sub('', line.strip())
        if not line:
            continue
        if result.endswith('-') and line[:1].islower():
            result = result[:-1] + line
        else:
            result = f'{result} {line}'.strip()
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', result)).strip()


def capitalizar(texto):
    texto = texto.strip()
    return texto[:1].upper() + texto[1:].lower() if texto else ''


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def frase(cuerpo):
    texto = re.split(r'(?<=[.!?])\s+', cuerpo.strip(), maxsplit=1)[0].rstrip(' .')
    if len(texto) > 125:
        texto = texto[:122].rsplit(' ', 1)[0] + '…'
    return texto[:1].upper() + texto[1:] if texto else ''


def frases_con_cifras(texto):
    return [
        parte.strip()
        for parte in re.split(r'(?<=[.!?])\s+', texto)
        if re.search(r'\d', parte) and re.search(r'%|€|euros?|mill[oó]nes?|d[ií]as?|a[ñn]os?|meses?', parte, re.I)
    ][:3]


def parrafos(pdf_path):
    """Return (page, text) for each paragraph, in reading order. Page footers are dropped."""
    documento = fitz.open(pdf_path)
    resultado = []
    for numero, pagina in enumerate(documento, start=1):
        for bloque in re.split(r'\n\s*\n', pagina.get_text()):
            texto = normalize(bloque)
            if texto and not PIE_RE.match(texto) and not FECHA_RE.match(texto):
                resultado.append((numero, texto))
    return documento, resultado


def extraer(pdf_path):
    documento, bloques = parrafos(pdf_path)
    prefacio = []
    capitulos = []
    cap = None
    siguiente = 1
    i = 0
    while i < len(bloques):
        pagina, texto = bloques[i]
        capitulo = CAPITULO_RE.match(texto)
        if (
            capitulo
            and int(capitulo.group(1)) == siguiente
            and siguiente <= NUM_CAPITULOS
            and not INDICE_RE.search(texto)
            and es_mayusculas(capitulo.group(2).split(' ')[0])
        ):
            # El título son las palabras en mayúsculas al principio; el resto es el primer párrafo.
            palabras = capitulo.group(2).split(' ')
            titulo_palabras = []
            while palabras and es_mayusculas(palabras[0]):
                titulo_palabras.append(palabras.pop(0))
            resto = ' '.join(palabras).strip()
            cap = {
                'num': siguiente,
                'titulo': ' '.join(titulo_palabras),
                'pagina': pagina,
                'parrafos': [(pagina, resto)] if resto else [],
            }
            capitulos.append(cap)
            siguiente += 1
            i += 1
            continue
        if cap is None:
            prefacio.append((pagina, texto))
        else:
            cap['parrafos'].append((pagina, texto))
        i += 1
    if len(capitulos) != NUM_CAPITULOS:
        raise ValueError(f'Se esperaban {NUM_CAPITULOS} capítulos; se encontraron {len(capitulos)}')
    return documento, prefacio, capitulos


def construir(pdf_path):
    documento, prefacio, capitulos = extraer(pdf_path)

    # El índice y la portada están antes del primer capítulo; solo cuenta el texto de presentación.
    prefacio_texto = ' '.join(texto for pagina, texto in prefacio if pagina >= 3)

    bloques = []
    secciones = []
    medidas = []
    n = 0
    for cap in capitulos:
        bid = cap['num']
        if not cap['parrafos']:
            raise ValueError(f'Capítulo {bid} sin párrafos')
        if bid in CAPITULOS_SIN_INTRO:
            intro = ''
            medidas_cap = cap['parrafos']
        else:
            _, intro = cap['parrafos'][0]
            medidas_cap = cap['parrafos'][1:]
        titulo_bloque = capitalizar(cap['titulo'])
        bloques.append({
            'id': bid,
            'titulo': titulo_bloque,
            'tituloMayus': cap['titulo'],
            'lema': '',
            'cita': '',
            'intro': intro,
            'pagina': cap['pagina'],
        })
        secciones.append({
            'id': str(bid),
            'bloque': bid,
            'titulo': titulo_bloque,
            'tituloFrase': titulo_bloque,
            'intro': '',
            'pagina': cap['pagina'],
            'subapartados': [],
        })
        for pagina, texto in medidas_cap:
            n += 1
            completo = texto
            medidas.append({
                'n': n,
                'bloque': bid,
                'seccion': str(bid),
                'pagina': pagina,
                'subapartado': None,
                'titulo': frase(texto),
                'tituloFrase': frase(texto),
                'texto': texto,
                'oculta': False,
                'categoria': CATEGORIA_POR_CAPITULO[bid],
                'colectivos': coincidencias(completo, COLECTIVOS),
                'palancas': coincidencias(completo, PALANCAS),
                'territorios': coincidencias(completo, TERRITORIOS),
                'cifras': frases_con_cifras(texto),
                # find_deadline da falsos positivos en este PDF (criterios, condiciones y retrasos pasados).
                # Ninguna cifra de tiempo es aquí un plazo que el partido se compromete a cumplir.
                'plazo': None,
                'deroga': None,
            })

    plazos = [
        {'plazo': m['plazo'], 'texto': m['tituloFrase'], 'medida': m['n']}
        for m in medidas if m['plazo']
    ]
    cifras = [
        {
            'valor': numero.group(0),
            'unidad': '%' if '%' in numero.group(0) else '€',
            'texto': medida['tituloFrase'],
            'medida': medida['n'],
        }
        for medida in medidas
        if (numero := re.search(r'\d[\d.,]*\s*(?:%|€)', medida['texto']))
    ][:8]

    return {
        'id': ID,
        'partido': 'Soria ¡Ya!',
        'siglas': 'SY',
        'comunidad': 'Castilla y León',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Programa Soria ¡Ya! 2026',
        'subtitulo': 'Programa electoral de Soria ¡Ya! para las elecciones generales del 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {
            'titulo': 'Presentación',
            'texto': prefacio_texto,
        },
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': list(dict.fromkeys(p['plazo'] for p in plazos)),
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
    print('plazos', [(m['n'], m['plazo']) for m in programa['medidas'] if m['plazo']])


if __name__ == '__main__':
    main()
