"""Build the JSON of the Agenda Valenciana program from the saved text of its web page.

The program is a web page (no PDF, no date). It has six axes (01 to 06) and 16 measures.
Each measure has a title (before the colon in the page) and a text (after the colon).
The page does not number the measures: the script numbers them from 1 to 16.
Every measure text is checked against the saved page text (.cache/2026/generales/agenda-valenciana-web.txt).

Usage: python scripts/extract_agenda_valenciana.py .cache/2026/generales/agenda-valenciana-web.txt src/data/2026/generales/programas/agenda-valenciana.json
"""
import json
import re
import sys
import unicodedata


PAGINA = 'https://www.agendavalenciana.org/index.html#programa'

EJES = [
    {'id': 'financiacion', 'titulo': 'Financiación Autonómica y Deuda Histórica',
     'intro': 'Recursos justos para blindar los servicios públicos valencianos', 'categoria': 'territorio'},
    {'id': 'post-dana', 'titulo': 'Reconstrucción post-DANA y Prevención',
     'intro': 'Agilidad administrativa, protección y ayudas reales a los municipios', 'categoria': 'emergencias'},
    {'id': 'movilidad', 'titulo': 'Movilidad e Infraestructuras',
     'intro': 'Cercanías, Metrovalencia y conexiones estratégicas de primer nivel', 'categoria': 'infraestructuras'},
    {'id': 'autogobierno', 'titulo': 'Autogobierno, Derecho Civil e Identidad',
     'intro': 'Marco jurídico propio, seguridad autonómica y lengua valenciana', 'categoria': 'territorio'},
    {'id': 'economia', 'titulo': 'Economía Productiva, Empleo y Territorio',
     'intro': 'Respaldo a pymes, autónomos, comercio local y sector primario', 'categoria': 'empleo'},
    {'id': 'justicia', 'titulo': 'Justicia, Cultura y Regeneración Institucional',
     'intro': 'Transparencia, fin de privilegios y voz libre de vetos en Madrid', 'categoria': 'justicia'},
]

# (eje, título, texto, categoría, palancas)
MEDIDAS = [
    ('financiacion', 'Reforma inmediata del sistema de financiación',
     'Exigir un nuevo modelo para garantizar recursos suficientes en sanidad, educación, dependencia y bienestar social, estableciendo una igualación transitoria mientras llega la reforma definitiva.', 'territorio', ['ley', 'gasto']),
    ('financiacion', 'Compensación de la deuda por infrafinanciación',
     'Reclamar al Estado la asunción y compensación de la deuda valenciana generada por el retraso y la falta de reforma del modelo autonómico.', 'territorio', ['gasto']),
    ('post-dana', 'Agilización legal en el Congreso',
     'Impulsar reformas urgentes para eliminar trabas burocráticas y agilizar la contratación de obras y personal en los ayuntamientos.', 'emergencias', ['ley']),
    ('post-dana', 'Prevención y ayudas directas',
     'Garantizar apoyo efectivo a familias, personas autónomas y empresas, previniendo nuevos daños y acelerando la ejecución de los fondos asignados a los municipios.', 'emergencias', ['gasto']),
    ('movilidad', 'Plan de Cercanías y Metrovalencia',
     'Ampliar frecuencias, capacidad y fiabilidad en las líneas C1, C2, C3 y C6 de Renfe, y mejorar la red de Metrovalencia, prestando especial atención a los municipios de l\'Horta.', 'infraestructuras', ['gasto']),
    ('movilidad', 'Ejes estratégicos y conexión logística',
     'Finalizar las actuaciones en la línea C3, acelerar el corredor ferroviario con Europa y adecuar enlaces viarios y logísticos.', 'infraestructuras', ['gasto']),
    ('movilidad', 'Financiación metropolitana equitativa',
     'Exigir dotaciones presupuestarias estatales equivalentes a las de las áreas metropolitanas de Madrid y Barcelona.', 'territorio', ['gasto']),
    ('autogobierno', 'Recuperación del Derecho Civil Valenciano',
     'Restablecer las competencias y un marco civil propio.', 'territorio', ['ley']),
    ('autogobierno', 'Seguridad y emergencias',
     'Impulsar una Policía Valenciana capacitada y dotada para la respuesta ante emergencias.', 'seguridad', ['organizacion', 'gasto']),
    ('autogobierno', 'Promoción lingüística y autogobierno',
     'Proteger y fomentar activamente el uso de la lengua valenciana y profundizar en el autogobierno autonómico.', 'identidad', ['ley']),
    ('economia', 'Protección del tejido empresarial y pymes',
     'Reducción de cargas administrativas, apoyo prioritario a autónomos, comercio local y empresas familiares frente a abusos de grandes multinacionales.', 'empleo', ['ley']),
    ('economia', 'Sector primario y agua',
     'Garantizar agua suficiente, modernizar regadíos, exigir reciprocidad en las importaciones frente a terceros países y apoyar el relevo generacional en cítricos, arroz, caqui, vid, ganadería y pesca.', 'rural', ['gasto']),
    ('justicia', 'Justicia eficaz',
     'Crear plazas judiciales, reforzar plantillas e infraestructuras tecnológicas para descongestionar juzgados y reducir retrasos procesales.', 'justicia', ['gasto']),
    ('justicia', 'Cultura y medios públicos',
     'Aumentar los canales temáticos de À Punt y equiparar la financiación estatal del Palau de les Arts a la de recintos como el Teatro Real o el Liceu.', 'identidad', ['gasto']),
    ('justicia', 'Regeneración democrática',
     'Reducción drástica de aforamientos, mayor transparencia en la gestión pública y rendición de cuentas directa de los representantes ante los ciudadanos.', 'democracia', ['ley']),
    ('justicia', 'Voz propia y libre de vetos',
     'Negociar y votar en Madrid a favor de cualquier iniciativa que beneficie a los municipios valencianos, con independencia de su origen partidista.', 'democracia', ['organizacion']),
]


def compacto(texto):
    texto = unicodedata.normalize('NFC', texto)
    return re.sub(r'\s+', '', texto)


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Uso: python scripts/extract_agenda_valenciana.py ORIGEN.txt DESTINO.json')
    with open(sys.argv[1], encoding='utf-8') as entrada:
        fuente = compacto(entrada.read())

    for _, titulo, texto, _, _ in MEDIDAS:
        if compacto(texto) not in fuente:
            raise SystemExit(f'El texto no está en la página: {titulo}')
        if compacto(titulo) not in fuente:
            raise SystemExit(f'El título no está en la página: {titulo}')
    for eje in EJES:
        if compacto(eje['titulo']) not in fuente or compacto(eje['intro']) not in fuente:
            raise SystemExit(f'El eje no está en la página: {eje["titulo"]}')

    with open(sys.argv[2], encoding='utf-8') as cabecera:
        previo = json.load(cabecera)

    bloques = []
    for indice, eje in enumerate(EJES, start=1):
        bloques.append({'id': indice, 'titulo': eje['titulo'], 'lema': eje['intro'], 'cita': '',
                        'intro': ''})
    secciones = [{'id': eje['id'], 'bloque': indice, 'titulo': eje['titulo'], 'tituloFrase': eje['titulo'],
                  'intro': eje['intro'], 'subapartados': []}
                 for indice, eje in enumerate(EJES, start=1)]
    bloque_de = {eje['id']: indice for indice, eje in enumerate(EJES, start=1)}

    medidas = []
    for numero, (eje, titulo, texto, categoria, palancas) in enumerate(MEDIDAS, start=1):
        medidas.append({
            'n': numero,
            'bloque': bloque_de[eje],
            'seccion': eje,
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [],
            'palancas': palancas,
            'territorios': ['Comunidad Valenciana'] if 'valenciana' in texto.lower() or 'valencianos' in texto.lower() else [],
            'cifras': [],
            'plazo': None,
            'deroga': None,
            'fuente': PAGINA,
        })

    programa = {
        'id': 'agenda-valenciana',
        'partido': 'Agenda Valenciana',
        'siglas': 'AV',
        'comunidad': previo.get('comunidad', 'Comunidad Valenciana'),
        'observaciones': [
            'Programa publicado en la web del partido. No tiene PDF ni fecha de publicación. Su web lo enlaza a una noticia de Diari La Veu como fuente.',
            'La página no numera las medidas: se numeran del 1 al 16 en orden. El título es el que la página pone antes de los dos puntos.',
            'Coalición cívica de la circunscripción de Valencia para el Congreso y el Senado. Las medidas son del programa de esa circunscripción.',
        ],
        'color': previo.get('color', '#0088d4'),
        'colorClaro': previo.get('colorClaro', '#b2dbf2'),
        'programa': 'Hoja de Ruta para Valencia',
        'subtitulo': 'Seis ejes estratégicos para defender nuestros municipios con voz propia',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PAGINA,
        'fuentePdf': PAGINA,
        'tipoDocumento': 'web',
        'origenMedidas': 'web',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {
            'titulo': 'Candidatura cívica, municipalista y transversal',
            'texto': 'Seis ejes estratégicos para defender nuestros municipios con voz propia. Propuestas concretas, cercanas y realistas para llevar al Congreso de los Diputados y al Senado las prioridades de las familias, autónomos y municipios valencianos.',
        },
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }
    with open(sys.argv[2], 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(medidas)} medidas, {len(secciones)} ejes')


if __name__ == '__main__':
    main()
