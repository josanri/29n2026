"""Adapt the extracted BNG program to the site's shared program schema."""
import json
import re
import sys
from collections import Counter


raw = json.load(open(sys.argv[1], encoding='utf-8'))

CATEGORIA_POR_SECCION = {
    '1': 'territorio',
    '2.1': 'vivienda',
    '2.2': 'empleo',
    '2.3': 'social',
    '2.4': 'social',
    '2.5': 'inmigracion',
    '2.6': 'social',
    '2.7': 'social',
    '2.8': 'democracia',
    '3.1': 'educacion',
    '3.2': 'sanidad',
    '3.3': 'social',
    '3.4': 'democracia',
    '3.5': 'administracion',
    '4.1': 'fiscalidad',
    '4.2': 'innovacion',
    '4.3': 'rural',
    '4.4': 'empleo',
    '4.5': 'innovacion',
    '4.6': 'energia',
    '5.1': 'infraestructuras',
    '5.2': 'infraestructuras',
    '5.3': 'infraestructuras',
    '6': 'energia',
    '7': 'identidad',
    '8.1': 'innovacion',
    '8.2': 'democracia',
    '8.3': 'identidad',
    '8.4': 'innovacion',
    '8.5': 'innovacion',
    '8.6': 'democracia',
    '8.7': 'fiscalidad',
    '8.8': 'energia',
    '8.9': 'infraestructuras',
    '9': 'empleo',
    '10': 'identidad',
    '11': 'exterior',
}

COLECTIVOS = {
    'jovenes': r'\bx[uó]ventud(?:e|es)?\b|\bx[oó]ven(?:e|es)?\b|\bmozos?\b',
    'mayores': r'\bmaiores\b|\bpensionistas?\b|\bpensi[oó]ns?\b',
    'mujeres': r'\bmulleres?\b|\bfeminist\w*|\bnenas?\b|\bviolencia machista\b',
    'familias': r'\bfamilias?\b|\bfamiliares?\b|\bnatalidade\b',
    'infancia': r'\binfancia\b|\bmenores?\b|\bnenos?\b|\bn[eé]s\b',
    'autonomos': r'\baut[oó]nom[oa]s?\b|\bpemes?\b|\bemprendedor\w*',
    'empresas': r'\bempresas?\b|\bindustria\b|\bsector industrial\b',
    'rural': r'\bagricultur\w*|\bagrari\w*|\bpesca\b|\bpesqueir\w*|\bganad\w*|\bcampo\b',
    'funcionarios': r'\bfuncionari\w*|\bempregad[oa]s? p[uú]blic[oa]s?\b',
    'discapacidad': r'\bdependencia\b|\bdiscapacidade\b|\bdiversidade funcional\b',
    'victimas': r'\bv[ií]timas?\b',
    'inmigrantes': r'\binmigrantes?\b|\bemigrantes?\b|\bmigraci[oó]n\b|\basilo\b',
    'pacientes': r'\bpacientes?\b|\benferm\w*|\bsa[uú]de\b|\bsanidade\b',
}

PALANCAS = {
    'ley': r'\blei\b|\blexislaci[oó]n\b|\bdecreto\b|\breform\w*|\bderog\w*|\bnormativa\b',
    'impuestos': r'\bfiscalidade\b|\bimpost\w*|\btribut\w*|\btributaci[oó]n\b|\birpf\b|\biva\b',
    'gasto': r'\binvest\w*|\bfinanci\w*|\bfondos?\b|\brecursos\b|\bdotaci[oó]n\b|\baxudas?\b',
    'organizacion': r'\bcreaci[oó]n\b|\baxencia\b|\borganismo\b|\boficina\b|\bobservatorio\b|\bregistro\b',
    'plan': r'\bplans?\b|\bestratex\w*|\bprogramas?\b|\bpacto\b',
}

TERRITORIOS = {
    'Galicia': r'\bGaliza\b|\bGalicia\b|\bgaleg[oa]s?\b',
    'España': r'\bEstado español\b|\bEstado\b|\bEspaña\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bUE\b',
    'Portugal': r'\bPortugal\b|\bportugu[eé]s(?:a|es)?\b',
}


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.I)]


def frase(titulo, corpo):
    texto = titulo.strip() or re.split(r'(?<=[.!?])\s+', corpo.strip(), maxsplit=1)[0]
    texto = texto.rstrip(' .')
    if len(texto) > 125:
        texto = texto[:122].rsplit(' ', 1)[0] + '…'
    return texto[:1].upper() + texto[1:] if texto else ''


def frases_con_cifras(texto):
    return [
        parte.strip()
        for parte in re.split(r'(?<=[.!?])\s+', texto)
        if re.search(r'\d', parte) and re.search(r'%|€|euros?|mill[oó]ns?|km\b|d[ií]as?|anos?|meses?', parte, re.I)
    ][:3]


medidas = []
bloques = []
secciones = []

for bloque_raw in raw['blocks']:
    bid = int(bloque_raw['num'])
    bloques.append({
        'id': bid,
        'titulo': bloque_raw['title'],
        'tituloMayus': bloque_raw['title'],
        'lema': '',
        'cita': '',
        'intro': bloque_raw['intro'],
        'pagina': bloque_raw['page'],
    })
    for seccion in bloque_raw['sections']:
        sid = seccion['num']
        categoria = CATEGORIA_POR_SECCION.get(sid)
        if categoria is None:
            raise ValueError(f'No hay categoría asignada para la sección {sid}')
        secciones.append({
            'id': sid,
            'bloque': bid,
            'titulo': seccion['title'],
            'tituloFrase': seccion['title'].strip().capitalize(),
            'intro': seccion['intro'],
            'pagina': seccion['page'],
            'subapartados': [
                {'titulo': grupo['label'], 'intro': grupo['intro']}
                for grupo in seccion['groups']
            ],
        })
        for medida in seccion['measures']:
            titulo = medida['title'].rstrip('.')
            texto = medida['body']
            completo = f'{titulo} {texto}'
            medidas.append({
                'n': medida['n'],
                'bloque': bid,
                'seccion': sid,
                'pagina': medida['page'],
                'subapartado': medida['group'],
                'titulo': titulo,
                'tituloFrase': frase(titulo, texto),
                'texto': texto,
                'oculta': medida['hidden'],
                'categoria': categoria,
                'colectivos': coincidencias(completo, COLECTIVOS),
                'palancas': coincidencias(completo, PALANCAS),
                'territorios': coincidencias(completo, TERRITORIOS),
                'cifras': frases_con_cifras(texto),
                'plazo': None,
                'deroga': None,
            })

medidas.sort(key=lambda medida: medida['n'])

numeros = [
    dict(
        valor=numero.group(0),
        unidad='%',
        texto=medida['tituloFrase'],
        medida=medida['n'],
    )
    for medida in medidas
    if (numero := re.search(r'\d+(?:[.,]\d+)?\s*%', medida['texto']))
][:8]

salida = {
    'id': 'bng',
    'partido': 'Bloque Nacionalista Galego',
    'siglas': 'BNG',
    'comunidad': 'Galicia',
    'color': '#1476a8',
    'colorClaro': '#59cbe8',
    'programa': 'A forza de Galiza',
    'subtitulo': 'Programa electoral do BNG para as eleccións xerais do 29N',
    'elecciones': 'Eleccións xerais · 29 de novembro de 2026',
    'pdf': '/programas/bng-xerais-2026.pdf',
    'fuentePdf': 'https://www.bng.gal/media/bnggaliza/files/2026/11/03/26_bng_xerais_documentos_programa_electoral.pdf',
    'paginas': 91,
    'fechaPdf': '2026-11-03',
    'presentacion': {
        'titulo': 'O BNG, a forza de Galiza',
        'texto': raw['presentacion'],
    },
    'cifras': numeros,
    'plazos': [],
    'ordenPlazos': [],
    'verbos': [],
    'bloques': bloques,
    'secciones': secciones,
    'medidas': medidas,
}

with open(sys.argv[2], 'w', encoding='utf-8') as archivo:
    json.dump(salida, archivo, ensure_ascii=False, indent=1)

print('bloques', len(bloques), 'secciones', len(secciones), 'medidas', len(medidas))
print('categorías', Counter(medida['categoria'] for medida in medidas).most_common())
