"""Build the JSON of the Alhora program from the saved text of its web pages (in Catalan).

The program is a web page (no PDF, no date). It has six policies. Each policy page has four parts:
Diagnòstic, Urgències, Distraccions and Solucions. Only the Solucions are measures (41 in total).
The texts stay in Catalan: they are not translated.

The page text was saved to .cache/2026/generales/alhora/ (one .txt per page). The titles are the lines
where each solution starts. Their line numbers are fixed below, and the script checks that each line
exists and that the text is not empty.

Usage: python scripts/extract_alhora.py src/data/2026/generales/programas/alhora.json
"""
import json
import re
import sys
import unicodedata
from pathlib import Path
from clasificacion import completar


CARPETA = Path('.cache/2026/generales/alhora')
PAGINA_BASE = 'https://alhora.cat/politiques/'

# slug de la página, nombre del bloque, líneas de los títulos de las soluciones y categorías (en el mismo orden).
POLITICAS = [
    {'slug': 'independencia', 'titulo': 'Independència',
     'lineas': [91, 97, 103, 107, 113],
     # La línea 97 empieza por «és»: la «Ú» inicial va en otro elemento de la página.
     'titulos': {1: 'Ús estratègic de les institucions per a la independència'},
     'categorias': ['democracia', 'democracia', 'democracia', 'democracia', 'democracia']},
    {'slug': 'llengua-i-educacio', 'titulo': 'Llengua i educació',
     'lineas': [92, 98, 104, 110, 116],
     'categorias': ['educacion', 'educacion', 'identidad', 'identidad', 'identidad']},
    {'slug': 'model-economic', 'titulo': 'Model econòmic',
     'lineas': [93, 97, 101, 105, 115, 119, 123, 127],
     'categorias': ['innovacion', 'innovacion', 'educacion', 'empleo', 'fiscalidad', 'energia', 'empleo', 'administracion']},
    {'slug': 'immigracio', 'titulo': 'Immigració',
     'lineas': [103, 109, 115, 121, 126, 130, 134],
     'categorias': ['inmigracion', 'innovacion', 'educacion', 'identidad', 'inmigracion', 'inmigracion', 'familia']},
    {'slug': 'habitatge', 'titulo': 'Habitatge',
     'lineas': [118, 134, 140, 143, 149, 156, 162, 170],
     'categorias': ['vivienda', 'vivienda', 'vivienda', 'vivienda', 'infraestructuras', 'vivienda', 'innovacion', 'vivienda']},
    {'slug': 'mobilitat-i-territori', 'titulo': 'Mobilitat i territori',
     'lineas': [95, 99, 107, 111, 117, 121, 125, 129],
     'categorias': ['infraestructuras', 'infraestructuras', 'infraestructuras', 'infraestructuras',
                    'infraestructuras', 'infraestructuras', 'territorio', 'infraestructuras']},
]

PARADAS = ('Aquí en parlem', 'Tots els continguts', 'Vols fer', 'Fes-te militant', 'La independència és possible',
           'Ja som més', 'Podcast', 'De ', 'Fes-te')


def normalizar(texto):
    texto = unicodedata.normalize('NFC', texto)
    texto = re.sub(r'\s+', ' ', texto).strip()
    return re.sub(r'\s+([,.;:!?)»])', r'\1', re.sub(r'([(«])\s+', r'\1', texto))


def leer(slug):
    ruta = CARPETA / f'alhora-{slug}.txt'
    return ruta.read_text(encoding='utf-8').splitlines()


def medidas_de(politica):
    lineas = leer(politica['slug'])
    medidas = []
    fin_solucions = next((k for k, l in enumerate(lineas) if l.startswith(PARADAS[:2])), len(lineas))
    for orden, inicio in enumerate(politica['lineas']):
        titulo = politica.get('titulos', {}).get(orden, lineas[inicio].strip())
        if not titulo:
            raise SystemExit(f'{politica["slug"]}: línea {inicio} vacía')
        siguiente = politica['lineas'][orden + 1] if orden + 1 < len(politica['lineas']) else fin_solucions
        cuerpo = []
        for linea in lineas[inicio + 1:siguiente]:
            if linea.strip().startswith(PARADAS):
                break
            cuerpo.append(linea.strip())
        texto = normalizar(' '.join(cuerpo))
        if not texto:
            raise SystemExit(f'{politica["slug"]}: la solución «{titulo}» no tiene texto')
        medidas.append({'titulo': titulo, 'texto': texto, 'categoria': politica['categorias'][orden]})
    return medidas


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Uso: python scripts/extract_alhora.py src/data/2026/generales/programas/alhora.json')
    ruta = sys.argv[1]
    with open(ruta, encoding='utf-8') as entrada:
        previo = json.load(entrada)

    bloques, secciones, medidas = [], [], []
    for indice, politica in enumerate(POLITICAS, start=1):
        bloques.append({'id': indice, 'titulo': politica['titulo'], 'lema': '', 'cita': '', 'intro': ''})
        secciones.append({'id': politica['slug'], 'bloque': indice, 'titulo': politica['titulo'],
                          'tituloFrase': politica['titulo'], 'intro': '', 'subapartados': []})
        for medida in medidas_de(politica):
            numero = len(medidas) + 1
            medidas.append({
                'n': numero,
                'bloque': indice,
                'seccion': politica['slug'],
                'subapartado': None,
                'titulo': medida['titulo'],
                'tituloFrase': medida['titulo'],
                'texto': medida['texto'],
                'oculta': False,
                'categoria': medida['categoria'],
                'colectivos': [],
                'palancas': [],
                'territorios': ['Cataluña'],
                'cifras': [],
                'plazo': None,
                'deroga': None,
                'fuente': PAGINA_BASE + politica['slug'] + '/',
            })

    if len(medidas) != 41:
        raise SystemExit(f'Se esperaban 41 soluciones; hay {len(medidas)}')

    programa = {
        'id': 'alhora',
        'partido': previo['partido'],
        'siglas': previo['siglas'],
        'comunidad': previo.get('comunidad', 'Cataluña'),
        'observaciones': [
            'Programa publicado en la web del partido, en catalán. Los textos se mantienen en catalán: no están traducidos.',
            'No tiene PDF ni fecha de publicación. Las medidas son las «Solucions» de las seis políticas (41). Los diagnósticos, las urgencias y las distracciones no son medidas.',
            'Los títulos son las frases en negrita de la página. Las categorías las asigna el equipo a mano y son aproximadas.',
        ],
        'color': previo['color'],
        'colorClaro': previo['colorClaro'],
        'programa': 'Programa per a Catalunya',
        'subtitulo': 'Les nostres propostes',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PAGINA_BASE,
        'fuentePdf': PAGINA_BASE,
        'tipoDocumento': 'web',
        'origenMedidas': 'web',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {
            'titulo': 'Programa per a Catalunya: les nostres propostes',
            'texto': 'Aquests posicionaments són el resultat de trobades, grups de debat, jornades de formació, congressos, assemblees, pòdcasts i articles fets pels militants d\'Alhora en contacte amb especialistes i investigadors. Com tot en política, és un treball en procés de millora i evolució.',
        },
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }
    for medida in programa['medidas']:
        completar(medida)
    with open(ruta, 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(medidas)} medidas, {len(secciones)} políticas')


if __name__ == '__main__':
    main()
