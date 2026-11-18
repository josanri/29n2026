"""Build the JSON of the FIA program from its two posters (images, no PDF, no text layer).

The party made two posters for 29N, one for Zaragoza and one for Huesca. Their lists are not the same.
Both lists are published: block 1 is the Zaragoza poster, block 2 is the Huesca poster.
The texts were typed from the poster images (nuevos-partidos/fia/zaragoza_1.jpg, zaragoza_2.jpg, huesca.jpg).
The images are low resolution. The words marked as uncertain are listed in the observations.
The poster has no measure titles on the Huesca list: its title and text are the same sentence.

Usage: python scripts/extract_fia.py src/data/2026/generales/programas/fia.json
"""
import json
import sys
from clasificacion import completar


PAGINA = 'https://www.fia-independientes.es/ELECCIONES-29N/'

BLOQUES = [
    {'id': 1, 'titulo': 'Nuestros 10 compromisos para Aragón', 'lema': 'Cartel de Zaragoza',
     'cita': '', 'intro': 'Cartel de la provincia de Zaragoza. Lista de diez compromisos.'},
    {'id': 2, 'titulo': 'Programa político', 'lema': 'Cartel de Huesca',
     'cita': '', 'intro': 'Cartel de la provincia de Huesca. Lista de diez puntos.'},
]

# (bloque, título, texto, categoría, palancas)
MEDIDAS = [
    (1, 'Salarios y Pensiones',
     'Recuperación del poder adquisitivo, garantizando salarios y pensiones dignas. Subida de salarios, subida de pensiones y bajada de impuestos.',
     'social', ['gasto', 'impuestos']),
    (1, 'Vivienda Asequible',
     'Construcción de vivienda social para alquiler con derecho a compra.', 'vivienda', ['gasto']),
    (1, 'Reforma de la Sanidad Pública',
     'Apoyo a la Sanidad Pública. Eliminación de las listas de espera.', 'sanidad', ['gasto']),
    (1, 'Creación de Empleo y Apuesta por la Investigación y Desarrollo (I+D)',
     'Creación de empleo estable y de calidad en Aragón. Inversión en Investigación y Desarrollo.', 'empleo', ['gasto']),
    (1, 'Educación de Calidad Orientada al Empleo',
     'Reforma del sistema educativo para orientarlo hacia las necesidades reales del mercado laboral, fomentando la Formación Profesional.', 'educacion', ['ley', 'gasto']),
    (1, 'Apoyo al Campo y Equilibrio Territorial',
     'Defensa y ayuda directa a la agricultura y la ganadería aragonesas. Infraestructuras modernas y medidas reales contra la despoblación para vertebrar Aragón.', 'rural', ['gasto']),
    (1, 'Reforma de Leyes e Igualdad de derechos entre Personas',
     'Reforma de la Ley del Menor. Reforma de la ley «solo sí es sí». Dureza ante denuncias falsas demostradas. Igualdad real ante la ley para todas las personas. Derogación de la ley okupa, garantizando el derecho a la propiedad privada. Derogación del reciente Real Decreto-ley referido al alquiler de viviendas.',
     'justicia', ['ley']),
    (1, 'Eliminación de Subvenciones Públicas',
     'Eliminación de las subvenciones públicas a partidos políticos, sindicatos y patronal.', 'administracion', ['gasto']),
    (1, 'Administración Pública Eficiente y con Menos Burocracia al Servicio del Ciudadano',
     'Mantenimiento de la cita presencial, y eliminación de la obligatoriedad de la cita previa.', 'administracion', ['organizacion']),
    (1, 'Regeneración Democrática y Transparencia',
     'Gestión profesional y transparente de lo público, con exigencia de responsabilidad directa a los gestores.',
     'democracia', ['ley']),
    (2, 'Construcción de viviendas municipales en alquiler.',
     'Construcción de viviendas municipales en alquiler.', 'vivienda', ['gasto']),
    (2, 'Aumento del salario mínimo. Sueldos y pensiones con el IPC.',
     'Aumento del salario mínimo. Sueldos y pensiones con el IPC.', 'empleo', ['gasto']),
    (2, 'Utilizar el aeropuerto de Huesca para tráfico de mercancías.',
     'Utilizar el aeropuerto de Huesca para tráfico de mercancías.', 'infraestructuras', ['gasto']),
    (2, 'Terminación autovía del Pirineo.',
     'Terminación autovía del Pirineo.', 'infraestructuras', ['gasto']),
    (2, 'Industrializar ciudad de Huesca.',
     'Industrializar ciudad de Huesca.', 'innovacion', ['gasto']),
    (2, 'Apoyar el campo. Negociar aumento PAC.',
     'Apoyar el campo. Negociar aumento PAC.', 'rural', ['gasto']),
    (2, 'Apoyar la sanidad pública. Reducción listas de espera.',
     'Apoyar la sanidad pública. Reducción listas de espera.', 'sanidad', ['gasto']),
    (2, 'Reducción cuotas fiscales a los autónomos.',
     'Reducción cuotas fiscales a los autónomos.', 'fiscalidad', ['impuestos']),
    (2, 'Potenciar empresas del Aragón oriental.',
     'Potenciar empresas del Aragón oriental.', 'empleo', ['gasto']),
    (2, 'Eliminar subvenciones a los partidos políticos.',
     'Eliminar subvenciones a los partidos políticos.', 'democracia', ['gasto']),
]


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Uso: python scripts/extract_fia.py src/data/2026/generales/programas/fia.json')
    ruta = sys.argv[1]
    with open(ruta, encoding='utf-8') as entrada:
        previo = json.load(entrada)

    secciones = [
        {'id': 'zaragoza', 'bloque': 1, 'titulo': 'Nuestros 10 compromisos para Aragón',
         'tituloFrase': 'Nuestros 10 compromisos para Aragón', 'intro': '', 'subapartados': []},
        {'id': 'huesca', 'bloque': 2, 'titulo': 'Programa político',
         'tituloFrase': 'Programa político', 'intro': '', 'subapartados': []},
    ]
    seccion_de = {1: 'zaragoza', 2: 'huesca'}

    medidas = []
    for numero, (bloque, titulo, texto, categoria, palancas) in enumerate(MEDIDAS, start=1):
        medidas.append({
            'n': numero,
            'bloque': bloque,
            'seccion': seccion_de[bloque],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [],
            'palancas': palancas,
            'territorios': ['Aragón'],
            'cifras': [],
            'plazo': None,
            'deroga': None,
            'fuente': PAGINA,
        })

    programa = {
        'id': 'fia',
        'partido': previo['partido'],
        'siglas': 'FIA',
        'comunidad': previo.get('comunidad', 'Aragón'),
        'observaciones': [
            'Hay dos carteles para 29N: uno de Zaragoza (diez compromisos) y otro de Huesca (diez puntos). Sus listas no coinciden. Se publican las dos.',
            'Los textos se escribieron a partir de imágenes de baja resolución (nuevos-partidos/fia/). No hay PDF ni texto extraíble.',
            'Palabras inciertas en el cartel de Zaragoza: «okupa» en la medida 7 y la frase final de la medida 10 («Menos promesas. Más compromisos»).',
            'Los carteles del Huesca no tienen título: el título y el texto de cada medida son la misma frase.',
        ],
        'color': previo['color'],
        'colorClaro': previo['colorClaro'],
        'programa': 'Menos promesas. Más compromisos.',
        'subtitulo': 'Diez compromisos para Aragón y programa político de Huesca',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PAGINA,
        'fuentePdf': PAGINA,
        'tipoDocumento': 'web',
        'origenMedidas': 'web',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {
            'titulo': 'Un proyecto real para gestionar nuestra tierra',
            'texto': 'Un proyecto real para gestionar nuestra tierra con sentido común, eficacia y rigor profesional.',
        },
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': BLOQUES,
        'secciones': secciones,
        'medidas': medidas,
    }
    for medida in programa['medidas']:
        completar(medida)
    with open(ruta, 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(medidas)} medidas, {len(BLOQUES)} carteles')


if __name__ == '__main__':
    main()
