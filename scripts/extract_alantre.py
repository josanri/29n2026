"""Build the JSON of the Alantre program from its web page (https://ya-toca.com/programa/).

The program is a web page with twelve commitments ("doce compromisos"). There is no PDF.
The texts of the twelve commitments were copied literally from the page (each one, without the «Leer más» link).

Usage: python scripts/extract_alantre.py src/data/2026/generales/programas/alantre.json
"""
import json
import sys

from clasificacion import completar

PAGINA = 'https://ya-toca.com/programa/'
FECHA_CONSULTA = '2026-11-18'
TOTAL_PAGINA = 12

# (título, texto, categoría, palancas, plazo)
COMPROMISOS = [
    ('Autonomía leonesa',
     'Nuestro autogobierno será la principal reivindicación que llevaremos al Congreso. La voluntad de la ciudadanía, '
     'expresada en mociones a favor de la autonomía de 70 juntas vecinales y más de 80 municipios que representan al '
     '60% de la población, junto a la moción aprobada por la Diputación de León, tiene que ser el centro del debate '
     'político. Alantre será la voz para que ese sentir democrático sea atendido por las instituciones del Estado.',
     'territorio', ['organizacion'], None),
    ('Defensa de nuestro territorio',
     'La energía, infraestructuras y recursos naturales deben servir a las personas que viven y trabajan en nuestros '
     'pueblos. Alantre defiende un modelo de transición ecológica justa, donde la protección del medioambiente, la '
     'salud ambiental y la sostenibilidad territorial se integren con la justicia social y económica. Nuestra tierra '
     'no es una «zona de sacrificio» para el beneficio de otras partes del Estado y Europa',
     'energia', ['plan'], None),
    ('Blindaje de los servicios públicos',
     'Garantizar servicios públicos universales y gratuitos es indispensable para combatir las desigualdades '
     'sociales, educativas, sanitarias y laborales que atraviesan de forma estructural nuestro territorio, '
     'especialmente en las comarcas rurales, envejecidas y castigadas por la despoblación. No hay justicia social '
     'sin justicia territorial y la sanidad, educación, vivienda y cuidados tienen que ser la base para alcanzarla.',
     'social', ['gasto'], None),
    ('Protección de los derechos y libertades conseguidas',
     'Defenderemos los avances en derechos laborales y civiles contra involuciones, especialmente los conseguidos '
     'por mujeres, gente LGTBIQ+ y otros colectivos. Apoyaremos todas aquellas medidas que eviten un posible '
     'retroceso democrático. Creemos en un País Leonés plural y diverso y en la normalización y consolidación de una '
     'sociedad leonesa solidaria, inclusiva y con memoria. Ni un paso atrás.',
     'democracia', ['ley'], None),
    ('Realización de todas las infraestructuras pendientes',
     'Exigiremos las inversiones necesarias para nuestro desarrollo: Torneros, Lazo del Manzanal, Vía de la Plata, '
     'terminal de mercancías en el aeropuerto, integración de FEVE, soterramiento en Trobajo del Camino, las '
     'autovías de Braganza, Bierzo-Ourense y León-Valladolid, así como la ejecución inmediata de la red del '
     'Corredor Atlántico de ferrocarril y por carretera, para comunicar con los puertos de Oporto, Lisboa, Vigo y '
     'Xixón.',
     'infraestructuras', ['gasto'], ('De inmediato', 'ejecución inmediata')),
    ('Elaboración de un Plan de desarrollo y vertebración',
     'Reclamaremos un plan estatal específico para León, Zamora y Salamanca, así como el reconocimiento de El Bierzo '
     'como comarca estratégica. No basta con ejecutar los proyectos aplazados durante años, también es necesario '
     'revertir las tendencias negativas de población y actividad económica, con inversiones que aprovechen nuestra '
     'situación como cruce de caminos y centro del noroeste.',
     'territorio', ['plan', 'gasto'], None),
    ('Plan Estratégico de Movilidad y Transporte',
     'Que será consensuado entre las diferentes administraciones, basado en la eficiencia energética y la '
     'sostenibilidad ambiental. La conexión de nuestra estructura de pueblos y comarcas tiene que priorizar una red '
     'en malla interconectada. No queremos ser ciudadanos de segunda con una movilidad deficiente y desestructurada. '
     'Exigiremos la supresión de los peajes de las autopistas del Huerna y Astorga-León.',
     'infraestructuras', ['plan', 'impuestos'], None),
    ('Protección de nuestras lenguas y cultura',
     'Pediremos el cumplimiento de las Recomendaciones del Consejo de Europa, así como de la Carta Europea de las '
     'Lenguas regionales o Minoritarias firmada por el Estado español. Las lenguas propias del territorio, el leonés '
     'y el gallego, forman parte del patrimonio cultural inmaterial y deben ocupar un lugar prioritario en las '
     'políticas culturales. Del mismo modo, reclamaremos una protección efectiva de nuestro patrimonio cultural.',
     'identidad', ['ley'], None),
    ('Recuperación de nuestras juntas vecinales',
     'Plantearemos las reformas legislativas para recuperar juntas vecinales perdidas, proteger el Concejo Abierto, '
     'reforzar la autonomía de las entidades locales menores y asegurar la defensa de los bienes comunales, '
     'garantizando que la gestión de lo público se mantenga en manos de quienes mejor conocen el territorio.',
     'territorio', ['ley'], None),
    ('Una agricultura y ganadería fuertes',
     'Apoyar una explotación extensiva y familiar, junto con la creación de pequeñas y medianas empresas '
     'industriales y de servicios. La población rural debe decidir cómo se utiliza su territorio y cómo se gestiona '
     'su riqueza natural, para fijar población manteniendo vivos los entornos rurales. Apoyaremos a agricultores y '
     'ganaderos frente a la industria agroalimentaria y la gran distribución.',
     'rural', ['gasto'], None),
    ('Un modelo de vivienda adaptado a nuestra realidad',
     'La vivienda es un derecho, no una mercancía. En una provincia que ha perdido 80 000 habitantes y en la que hay '
     '90 000 casas vacías, cualquier Plan de Vivienda debe estar adaptado a nuestras características. Rehabitar el '
     'País es una cuestión de justicia social y equilibrio ambiental. Frente a los desahucios y la despoblación, un '
     'modelo adaptado a nuestra realidad: rehabilitación de viviendas vacías, alquiler asequible y el acceso a un '
     'hogar digno.',
     'vivienda', ['plan'], None),
    ('Una voz política propia',
     'Toca hablar de nuestras problemáticas desde un punto de vista centrado en nuestra propia realidad. Defendemos '
     'una representación progresista y leonesista que anteponga los intereses de León a las directrices de los '
     'grandes partidos estatales. Nuestro derecho al autogobierno aquí no es la opción minoritaria, ha estado en la '
     'agenda del país durante los últimos cincuenta años y cuenta con una amplia mayoría social. Es hora de hacernos '
     'valer.',
     'territorio', ['organizacion'], None),
]



def main():
    if len(sys.argv) != 2:
        raise SystemExit('Uso: python scripts/extract_alantre.py src/data/2026/generales/programas/alantre.json')
    ruta = sys.argv[1]
    with open(ruta, encoding='utf-8') as entrada:
        previo = json.load(entrada)

    medidas, plazos = [], []
    for numero, (titulo, texto, categoria, palancas, plazo) in enumerate(COMPROMISOS, start=1):
        if plazo and plazo[1] not in texto:
            raise ValueError(f'El plazo «{plazo[1]}» no está en el compromiso {numero}')
        medidas.append({
            'n': numero,
            'bloque': 1,
            'seccion': 'compromisos',
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [],
            'palancas': palancas,
            'territorios': ['Castilla y León'],
            'cifras': [],
            'plazo': plazo[0] if plazo else None,
            'deroga': None,
            'fuente': PAGINA,
        })
        if plazo:
            plazos.append({'plazo': plazo[0], 'texto': 'Ejecutar la red del Corredor Atlántico de ferrocarril y por carretera',
                           'medida': numero})

    programa = {
        'id': 'alantre',
        'partido': previo['partido'],
        'siglas': previo['siglas'],
        'comunidad': previo.get('comunidad', 'Castilla y León'),
        'observaciones': [
            f'La página del programa tiene {TOTAL_PAGINA} compromisos y aquí están los {len(COMPROMISOS)}, con el texto literal de la página.',
            'El programa solo se publica como página web, sin PDF. Cada compromiso es una medida, con el título de la página.',
            'La página enlaza una versión en llionés (https://ya-toca.com/programa-lli/) y otra en gallego '
            '(https://ya-toca.com/programa-gl/). Aquí solo se recoge la versión en castellano.',
            'Alantre se presenta solo en la provincia de León.',
        ],
        'color': previo['color'],
        'colorClaro': previo['colorClaro'],
        'programa': 'Doce compromisos para el Congreso',
        'subtitulo': 'Las reivindicaciones que Alantre llevará al Congreso',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PAGINA,
        'fuentePdf': PAGINA,
        'tipoDocumento': 'web',
        'origenMedidas': 'web',
        'fechaFuente': FECHA_CONSULTA,
        'unidadMedida': 'compromiso',
        'unidadMedidas': 'compromisos',
        'presentacion': {
            'titulo': 'Programa',
            'texto': 'Estos son los doce compromisos de nuestro programa, las reivindicaciones que llevaremos al Congreso. '
                     'Puedes leerlos también en llionés y galego.',
        },
        'cifras': [],
        'plazos': plazos,
        'ordenPlazos': ['De inmediato'] if plazos else [],
        'verbos': [],
        'bloques': [{'id': 1, 'titulo': 'Doce compromisos', 'lema': 'Los compromisos de Alantre', 'cita': '', 'intro': ''}],
        'secciones': [{'id': 'compromisos', 'bloque': 1, 'titulo': 'Compromisos', 'tituloFrase': 'Compromisos',
                       'intro': '', 'subapartados': []}],
        'medidas': medidas,
    }
    for medida in programa['medidas']:
        completar(medida)
    with open(ruta, 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    if len(medidas) != TOTAL_PAGINA:
        raise ValueError(f'La página tiene {TOTAL_PAGINA} compromisos y el script {len(medidas)}')
    print(f'{len(medidas)} compromisos de {TOTAL_PAGINA}')


if __name__ == '__main__':
    main()
