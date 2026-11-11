"""Extrae el programa del Partido Humanista (Elecciones generales 2026) al esquema compartido.

Capítulos numerados (1-11) → bloques. Cada «Propuesta N:» → medida.
Uso: python scripts/extract_humanista.py <pdf> <salida.json>
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


ID = 'ph'
PDF_PUBLICO = '/programas/partido-humanista-2026.pdf'
FUENTE = 'https://www.partidohumanista.es/Documentos/Programas/Programa%20Generales%202026.pdf'
FECHA_PDF = '2026-11-09'
COLOR = '#ea5b1f'
COLOR_CLARO = '#f8a57a'
NUM_CAPITULOS = 11

# Categoría por capítulo; una propuesta puede cambiar la suya en CATEGORIA_POR_MEDIDA.
CATEGORIA_POR_CAPITULO = {
    1: 'empleo',
    2: 'vivienda',
    3: 'sanidad',
    4: 'educacion',
    5: 'democracia',
    6: 'defensa',
    7: 'inmigracion',
    8: 'energia',
    9: 'innovacion',
    10: 'territorio',
    11: 'identidad',
}
CATEGORIA_POR_MEDIDA = {
    2: 'social',
    14: 'social',
    23: 'justicia',
    28: 'social',
    33: 'infraestructuras',
    34: 'rural',
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes?\b|\bjuventud\b',
    'mayores': r'\bpersonas mayores\b|\bmayores\b|\bpensionistas?\b|\bpensiones?\b',
    'mujeres': r'\bmujeres?\b|\bfeminis\w*|\bviolencia machista\b|\bviolencia de g[eé]nero\b',
    'familias': r'\bfamilias?\b',
    'infancia': r'\binfancia\b|\bmenores\b|\bni[ñn][oa]s?\b',
    'autonomos': r'\baut[oó]nom[oa]s?\b|\bpymes?\b|\bemprendedor\w*',
    'empresas': r'\bempresas?\b|\bindustria\b',
    'rural': r'\bagricultur\w*|\bagrari\w*|\bpesca\b|\bpesquer\w*|\bganader\w*|\brural\b',
    'funcionarios': r'\bfuncionari\w*|\bempleados? p[uú]blicos?\b',
    'discapacidad': r'\bdependencia\b|\bdiscapacidad\w*',
    'victimas': r'\bv[ií]ctimas?\b',
    'inmigrantes': r'\binmigrantes?\b|\bemigrantes?\b|\bmigraci[oó]n\b|\basilo\b|\brefugiad\w*',
    'pacientes': r'\bpacientes?\b|\benfermos?\b|\bsalud\b|\bsanidad\b',
    'agentes': r'\bpolic[ií]as?\b|\bfuerzas de seguridad\b',
}

PALANCAS = {
    'ley': r'\bley\w*|\bderog\w*|\breform\w*|\blegislaci[oó]n\b|\bdecreto\b|\bnormativa\b|\bconstituci[oó]n\b',
    'impuestos': r'\bfiscal\w*|\bimpuestos?\b|\btribut\w*|\bIRPF\b|\bIVA\b|\bfortunas?\b',
    'gasto': r'\binversi[oó]n\w*|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b|\brecursos\b|\bdotaci[oó]n\b|\bayudas?\b',
    'organizacion': r'\bcreaci[oó]n\b|\bcrear\b|\bagencia\b|\borganismo\b|\boficina\b|\bobservatorio\b|\bregistro\b',
    'plan': r'\bplan\b|\bplanes\b|\bestrategia\b|\bprograma\b|\bpacto\b',
}

TERRITORIOS = {
    'España': r'\bEspaña\b|\bEstado espa[ñn]ol\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bUE\b',
    'Cataluña': r'\bCataluña\b',
    'Galicia': r'\bGalicia\b',
    'Andalucía': r'\bAndaluc[ií]a\b',
    'País Vasco': r'\bPa[ií]s Vasco\b|\bEuskadi\b',
    'Canarias': r'\bCanarias\b',
    'Comunidad Valenciana': r'\bComunidad Valenciana\b',
}

CAPITULO_RE = re.compile(r'^(\d{1,2})\.\s+(.+)$')
PROPUESTA_RE = re.compile(r'^Propuesta\s+(\d+)\s*:\s*(.*)$', re.IGNORECASE)
PIE_RE = re.compile(r'^(?:[IVXLivxl]{1,6}|\d{1,3})$')
FIN_RE = re.compile(r'^MEMORIA DE FINANCIACI', re.IGNORECASE)


def es_mayusculas(texto):
    return not re.search(r'[a-záéíóúñü]', texto)


def normalize(text):
    text = text.replace('­', '').replace('ﬁ', 'fi').replace('ﬂ', 'fl')
    text = text.replace(' ', ' ')
    text = re.sub(r'[●○•]\s*', '', text)
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
    return texto[:1].upper() + texto[1:].lower() if texto else ''


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def frase(titulo, cuerpo):
    texto = titulo.strip() or re.split(r'(?<=[.!?])\s+', cuerpo.strip(), maxsplit=1)[0]
    texto = texto.rstrip(' .')
    if len(texto) > 125:
        texto = texto[:122].rsplit(' ', 1)[0] + '…'
    return texto[:1].upper() + texto[1:] if texto else ''


def frases_con_cifras(texto):
    return [
        parte.strip()
        for parte in re.split(r'(?<=[.!?])\s+', texto)
        if re.search(r'\d', parte) and re.search(r'%|€|euros?|mill[oó]nes?|d[ií]as?|a[ñn]os?|meses?', parte, re.I)
    ][:3]


def leer_lineas(pdf_path):
    documento = fitz.open(pdf_path)
    lineas = []
    for numero, pagina in enumerate(documento, start=1):
        for bruta in pagina.get_text().splitlines():
            linea = bruta.replace(' ', ' ').strip()
            if not linea or PIE_RE.match(linea):
                continue
            lineas.append((linea, numero))
    return documento, lineas


def extraer(pdf_path):
    documento, lineas = leer_lineas(pdf_path)
    prefacio = []
    capitulos = []
    cap = None
    prop = None
    siguiente = 1
    i = 0

    def cerrar_propuesta():
        nonlocal prop
        if prop is not None:
            prop['cuerpo'] = normalize('\n'.join(prop['lineas']))
            prop = None

    while i < len(lineas):
        linea, pagina = lineas[i]
        if FIN_RE.match(linea):
            break

        capitulo = CAPITULO_RE.match(linea)
        if (
            capitulo
            and siguiente <= NUM_CAPITULOS
            and int(capitulo.group(1)) == siguiente
            and es_mayusculas(capitulo.group(2))
        ):
            cerrar_propuesta()
            titulo = [capitulo.group(2)]
            i += 1
            while i < len(lineas) and es_mayusculas(lineas[i][0]) and not PROPUESTA_RE.match(lineas[i][0]):
                titulo.append(lineas[i][0])
                i += 1
            lema = ''
            if i < len(lineas) and not es_mayusculas(lineas[i][0]):
                lema = lineas[i][0]
                i += 1
            cap = {
                'num': siguiente,
                'titulo': ' '.join(titulo).strip(),
                'lema': lema,
                'pagina': pagina,
                'intro': [],
                'propuestas': [],
            }
            capitulos.append(cap)
            siguiente += 1
            continue

        propuesta = PROPUESTA_RE.match(linea)
        if propuesta and cap is not None:
            cerrar_propuesta()
            titulo = [propuesta.group(2)]
            i += 1
            # El título sigue en la línea siguiente si empieza por «(» o en minúscula, hasta el punto final.
            while (
                i < len(lineas)
                and not ' '.join(titulo).rstrip().endswith('.')
                and (lineas[i][0].startswith('(') or lineas[i][0][:1].islower())
                and not PROPUESTA_RE.match(lineas[i][0])
            ):
                titulo.append(lineas[i][0])
                i += 1
            prop = {
                'pagina': pagina,
                'titulo': normalize(' '.join(titulo)),
                'lineas': [],
            }
            cap['propuestas'].append(prop)
            continue

        if prop is not None:
            prop['lineas'].append(linea)
        elif cap is not None:
            cap['intro'].append(linea)
        else:
            prefacio.append((linea, pagina))
        i += 1

    cerrar_propuesta()
    if len(capitulos) != NUM_CAPITULOS:
        raise ValueError(f'Se esperaban {NUM_CAPITULOS} capítulos; se encontraron {len(capitulos)}')
    return documento, prefacio, capitulos


def construir(pdf_path):
    documento, prefacio, capitulos = extraer(pdf_path)

    prefacio_lineas = [linea for linea, pagina in prefacio if pagina >= 2]
    prefacio_texto = normalize('\n'.join(prefacio_lineas))
    prefacio_texto = re.sub(r'^EL SENTIDO DE NUESTRA PROPUESTA POL[ÍI]TICA\s*', '', prefacio_texto)

    bloques = []
    secciones = []
    medidas = []
    n = 0
    for cap in capitulos:
        bid = cap['num']
        intro = normalize('\n'.join(cap['intro']))
        bloques.append({
            'id': bid,
            'titulo': capitalizar(cap['titulo']),
            'tituloMayus': cap['titulo'],
            'lema': cap['lema'],
            'cita': '',
            'intro': intro,
            'pagina': cap['pagina'],
        })
        secciones.append({
            'id': str(bid),
            'bloque': bid,
            'titulo': capitalizar(cap['titulo']),
            'tituloFrase': capitalizar(cap['titulo']),
            'intro': '',
            'pagina': cap['pagina'],
            'subapartados': [],
        })
        for prop in cap['propuestas']:
            n += 1
            titulo = prop['titulo'].rstrip('.')
            texto = prop['cuerpo']
            completo = f'{titulo} {texto}'
            medidas.append({
                'n': n,
                'bloque': bid,
                'seccion': str(bid),
                'pagina': prop['pagina'],
                'subapartado': None,
                'titulo': titulo,
                'tituloFrase': frase(titulo, texto),
                'texto': texto,
                'oculta': False,
                'categoria': CATEGORIA_POR_MEDIDA.get(n, CATEGORIA_POR_CAPITULO[bid]),
                'colectivos': coincidencias(completo, COLECTIVOS),
                'palancas': coincidencias(completo, PALANCAS),
                'territorios': coincidencias(completo, TERRITORIOS),
                'cifras': frases_con_cifras(texto),
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
        if (numero := re.search(r'\d[\d.,]*\s*(?:%|€)', medida['texto']))
    ][:8]

    return {
        'id': ID,
        'partido': 'Partido Humanista',
        'siglas': 'PH',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Lo primero es la gente',
        'subtitulo': 'Programa electoral del Partido Humanista para las elecciones generales del 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {
            'titulo': 'El sentido de nuestra propuesta política',
            'texto': prefacio_texto,
        },
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
