"""Build the JSON of the Eguzkilore program from the saved copy of its web page.

The program is a web page (no PDF). Its list structure:
- A numbered item (<ol>) that has bullets (<ul>) under it is a section heading. Its bullets are the measures.
- A numbered item with no bullets under it is a measure, in the section «Otras propuestas».
- A numbered item can hold two numbers after a line break ("<br>6. La jornada..."): the script splits it.
- The page has no measure titles. The title is the first sentence of the text.
- The category comes from keyword rules (CATEGORIAS). It is approximate, and the method note says so.

Usage: python scripts/extract_eguzkilore.py nuevos-partidos/eguzkilore/elecciones.txt src/data/2026/generales/programas/eguzkilore.json
"""
import html
import json
import re
import sys
import unicodedata


PAGINA = 'https://www.eguzkilore-na.org/sample-page/'

TOKEN_RE = re.compile(r'<(ol|ul)\b[^>]*>|</(ol|ul)>|<li\b[^>]*>(.*?)</li>', re.S | re.I)
BR_RE = re.compile(r'<br\s*/?>', re.I)
NUMERO_RE = re.compile(r'^\d+\.\s+')

CATEGORIAS = [
    ('sanidad', r'sanidad|salud|parir|parto|lactancia|psicoterap|psicofárm|homeopat|herbolario|terapias|vacun|mascarilla|pasaporte|cáncer|médic|acompañar partos|consentimiento'),
    ('familia', r'infancia|bebé|madre|padres|progenitor|excedencia|prematuro|hijos|criaturas|niñ|peques|conciliar|flexibilidad laboral para la mujer embarazada|enfermedades leves|enferma/o'),
    ('educacion', r'educa|aulas|ratios|alumn|profesor|maestr|tareas|escuela|centros educativos|educadoras'),
    ('social', r'mayores|residencia|personas mayores|jubilación|dependencia|prostitución|niñas/os|ocupación|mujer'),
    ('vivienda', r'vivienda|alquiler|inquilin|pisos|VPO|propietario|viviendas|expulsa|desahucio|casas compartidas|casa'),
    ('empleo', r'jornada|laboral|horas|trabajo|sueldo|salario|autónomo|convenio|cooperativas? comunitari|ganadería pequeña|formación personal'),
    ('fiscalidad', r'impuestos|\bIVA\b|paraísos fiscales|deducciones|caja de ahorro|moneda|G1'),
    ('energia', r'energ|electricidad|luz|renovable|molinos|fotovoltaic|presas|azudes|geoingenier|aire|cielos|cannabis|5G|telefonía|geobiológicos|bioclim|bioconstrucción'),
    ('infraestructuras', r'transporte|tren|agua|ferroc|carretera|conectividad|guagua|alta velocidad|CHE'),
    ('rural', r'ganader|agricult|cultivo|km0|pueblos|huerto|macro-granjas|rural|tierra'),
    ('exterior', r'Unión Europea|Europa|OTAN|EEUU|BRICS|Rusia|Mercosur|tratado|Esenciales|Amnist'),
    ('defensa', r'Bardenas|polígono de tiro|Ministerio de Defensa|militar'),
    ('democracia', r'democracia|Parlamento|mordaza|aforamiento|sueldos vitalicios|separación de poderes|independientes|candidatura|consulta|objeción|comunicación no violenta|lobbies|subvenciones a los sindicatos|carta pagada|Gobierno de Navarra'),
    ('identidad', r'lengua|euskera|castellano|Nabarra|bilingü|espectáculos|animales'),
    ('justicia', r'ocupación|ley|derechos|prostitución|desaparición'),
]


def limpiar(fragmento):
    texto = re.sub(r'<[^>]+>', ' ', fragmento)
    texto = html.unescape(texto).replace('\xa0', ' ')
    texto = re.sub(r'\s+', ' ', texto).strip()
    return re.sub(r'\s+([.,;:])', r'\1', texto)


def categoria_de(texto):
    for categoria, patron in CATEGORIAS:
        if re.search(patron, texto, re.I):
            return categoria
    return 'democracia'


def slug(texto):
    sin_acentos = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', '-', sin_acentos.lower()).strip('-')


def leer_elementos(pagina):
    """Return the list items in order as (tipo, texto), tipo is 'ol' or 'ul'."""
    elementos = []
    pila = []
    for coincidencia in TOKEN_RE.finditer(pagina):
        if coincidencia.group(1):
            pila.append(coincidencia.group(1).lower())
        elif coincidencia.group(2):
            if pila:
                pila.pop()
        else:
            tipo = pila[-1] if pila else 'ul'
            for pedazo in BR_RE.split(coincidencia.group(3)):
                texto = limpiar(pedazo)
                if not texto:
                    continue
                if tipo == 'ol' and NUMERO_RE.match(texto):
                    texto = NUMERO_RE.sub('', texto)
                elementos.append((tipo, texto))
    return elementos


def extraer(ruta):
    with open(ruta, encoding='utf-8') as entrada:
        pagina = entrada.read()

    bloque_texto = re.search(r'Para transformar la sociedad(.*?)</p>', pagina, re.S)
    presentacion = limpiar('Para transformar la sociedad ' + bloque_texto.group(1)) if bloque_texto else ''

    elementos = leer_elementos(pagina)
    secciones = []
    medidas = []
    seccion_actual = None
    otras = None

    def seccion_otras():
        nonlocal otras
        if otras is None:
            otras = {'id': 'otras-propuestas', 'titulo': 'Otras propuestas', 'pagina': None}
            secciones.append(otras)
        return otras

    for indice, (tipo, texto) in enumerate(elementos):
        siguiente = elementos[indice + 1][0] if indice + 1 < len(elementos) else None
        if tipo == 'ol' and siguiente == 'ul':
            seccion_actual = {'id': f'{len(secciones) + 1}-{slug(texto)[:50]}', 'titulo': texto, 'pagina': None}
            secciones.append(seccion_actual)
            continue
        if tipo == 'ul' and seccion_actual is not None:
            seccion = seccion_actual
        else:
            seccion = seccion_otras()
        medidas.append({'texto': texto, 'seccion': seccion})

    secciones_ordenadas = secciones
    salida_medidas = []
    for n, medida in enumerate(medidas, start=1):
        texto = medida['texto']
        titulo = re.split(r'(?<=\.)\s', texto, maxsplit=1)[0]
        salida_medidas.append({
            'n': n,
            'bloque': 1,
            'seccion': medida['seccion']['id'],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria_de(texto),
            'colectivos': [],
            'palancas': [],
            'territorios': [],
            'cifras': [],
            'plazo': None,
            'deroga': None,
            'fuente': PAGINA,
        })

    return {
        'id': 'eguzkilore',
        'partido': 'Eguzkilore',
        'siglas': 'EGUZKILORE',
        'comunidad': 'Navarra',
        'observaciones': [
            'La web oficial publica estas propuestas sin PDF y sin fecha. Se transcriben tal como están en la página.',
            'La página no pone título a las medidas ni las numera por apartados. El título es la primera frase del texto. Las propuestas sin apartado van en «Otras propuestas».',
            'La categoría sale de palabras clave y es aproximada. La página es una «sample-page» del sitio: conviene confirmar la dirección definitiva.',
        ],
        'color': '#1f7a8c',
        'colorClaro': '#9ac3cb',
        'programa': 'Amor + Conciencia + Armonía',
        'subtitulo': 'Propuestas de la página oficial de Eguzkilore',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PAGINA,
        'fuentePdf': PAGINA,
        'tipoDocumento': 'web',
        'origenMedidas': 'web',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': 'Amor + Conciencia + Armonía', 'texto': presentacion},
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': [{'id': 1, 'titulo': 'Propuestas', 'lema': '', 'cita': '',
                     'intro': 'Propuestas transcritas de la página oficial de Eguzkilore.'}],
        'secciones': [{'id': s['id'], 'bloque': 1, 'titulo': s['titulo'], 'tituloFrase': s['titulo'],
                       'intro': '', 'subapartados': []} for s in secciones_ordenadas],
        'medidas': salida_medidas,
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Uso: python scripts/extract_eguzkilore.py ORIGEN.txt DESTINO.json')
    programa = extraer(sys.argv[1])
    with open(sys.argv[2], 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(programa["medidas"])} medidas, {len(programa["secciones"])} secciones')


if __name__ == '__main__':
    main()
