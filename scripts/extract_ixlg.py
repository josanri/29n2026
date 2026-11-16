"""Build the JSON of the IxLG program for the Senate (11 pages, 22 measures).

Structure of the PDF (fonts are not used: the layout is clear in the text):
- Blocks: 4. Each block has a capital-letter heading on its first pages.
- Sections: 7. Each section has an intro sentence (the line numbered 01..06 in the PDF)
  and its measures (the lines numbered 01..04 below it).
- Measures: 22, numbered 1..22 in reading order. The PDF numbers the items inside each
  section, so this script numbers them again in a single sequence.
- Measure title: the first sentence of the text. The PDF has no titles, except
  measure 12 (its title is written in capitals before the colon) and measure 7 (prose).
- Measure 7 is prose: the economy section has no numbered items.

Every text is literal: the script checks that each paragraph appears in the PDF.

Usage: python scripts/extract_ixlg.py public/2026/generales/programas/ixlg-programa-senado-2026.pdf src/data/2026/generales/programas/ixlg.json
"""
import json
import re
import sys
import unicodedata

import fitz


PAGINAS = 11
TOTAL_MEDIDAS = 22

BLOQUES = [
    {'id': 1, 'titulo': 'Compromisos para La Gomera', 'lema': '', 'cita': '', 'intro': '', 'pagina': 3},
    {'id': 2, 'titulo': 'Una economía que te ayude a vivir', 'lema': '', 'cita': '', 'intro': '', 'pagina': 5},
    {'id': 3, 'titulo': 'Una isla habitable, productiva y cuidada', 'lema': '', 'cita': '', 'intro': '', 'pagina': 7},
    {'id': 4, 'titulo': 'Derechos, cuidados y una representación útil', 'lema': '', 'cita': '', 'intro': '', 'pagina': 9},
]

SECCIONES = [
    {'id': 'vivienda', 'bloque': 1, 'titulo': 'Vivienda y derecho a quedarse',
     'intro': 'Que vivir en La Gomera no sea un privilegio ni obligue a marcharse.', 'pagina': 3},
    {'id': 'movilidad', 'bloque': 1, 'titulo': 'Movilidad y coste de la insularidad',
     'intro': 'La distancia no puede limitar el acceso a derechos y oportunidades.', 'pagina': 4},
    {'id': 'economia', 'bloque': 2, 'titulo': 'Una economía al servicio de la ciudadanía, no de unos pocos',
     'intro': '', 'pagina': 5},
    {'id': 'pueblos', 'bloque': 3, 'titulo': 'Pueblos vivos, empleo y economía local',
     'intro': 'Recuperar las medianías y asegurar futuro a la actividad productiva.', 'pagina': 7},
    {'id': 'agua', 'bloque': 3, 'titulo': 'Agua, energía y naturaleza protegida',
     'intro': 'Una transición ecológica justa, participativa y al servicio de la población.', 'pagina': 8},
    {'id': 'cuidados', 'bloque': 4, 'titulo': 'Cuidados, salud y servicios cercanos',
     'intro': 'Envejecer con dignidad y poder vivir en el propio pueblo.', 'pagina': 9},
    {'id': 'escano', 'bloque': 4, 'titulo': 'Un escaño cercano y con cuentas claras',
     'intro': 'Compromisos de trabajo parlamentario por La Gomera.', 'pagina': 10},
]

ECONOMIA = [
    'Durante décadas, Canarias ha tenido que reivindicar una y otra vez la aplicación efectiva del Régimen '
    'Económico y Fiscal (REF). Defender el REF es defender un derecho de Canarias y una herramienta para '
    'compensar nuestra lejanía, insularidad y condiciones estructurales.',
    'Pero también debemos preguntarnos para quién está funcionando realmente el REF.',
    'No queremos un REF reducido a una permanente batalla por mantener beneficios fiscales o incentivos a '
    'quienes tienen mayor capacidad para invertir, mientras una parte importante de la ciudadanía continúa '
    'soportando el sobrecoste de vivir en las islas: vivienda, alimentación, transporte, energía, agua o acceso '
    'a servicios.',
    'El REF no puede convertirse en una cuestión reservada a despachos, grandes empresas o determinados intereses '
    'económicos y políticos. Sus beneficios deben traducirse en bienestar para la mayoría social, empleo estable, '
    'actividad productiva, servicios públicos y oportunidades a quienes viven y trabajan en Canarias.',
    'La propia evolución del debate sobre el REF plantea hoy la necesidad de revisar a quién llegan sus '
    'instrumentos y cómo se distribuyen sus beneficios. Existen incentivos dirigidos a la inversión y a la '
    'actividad económica, pero también medidas destinadas directamente a compensar costes y garantizar servicios. '
    'La cuestión es que el conjunto del sistema debe orientarse de forma más clara hacia el interés general.',
    'No cuestionamos el REF. Cuestionamos que durante demasiado tiempo se haya confundido su defensa con la '
    'defensa de determinados intereses.',
    'Queremos un REF que llegue también a autónomos, pequeñas empresas, trabajadores, familias y jóvenes; que '
    'contribuya a reducir los sobrecostes de la insularidad y que genere retornos sociales y territoriales '
    'verificables. Porque el REF no nació para que unos pocos tengan más oportunidades por vivir en Canarias. '
    'Nació para que vivir en Canarias NO suponga tener menos oportunidades.',
    'Y en La Gomera, además debe incorporar de manera efectiva nuestra condición de isla no capitalina y la doble '
    'insularidad, de manera que los beneficios y compensaciones respondan a los costes reales de nuestro '
    'territorio. Defender el REF sí. Pero defenderlo para que cumpla su función: compensar a Canarias y mejorar la '
    'vida de quienes vivimos aquí.',
]

# (sección, texto, título o None, categoría, colectivos, palancas)
MEDIDAS = [
    ('vivienda', 'Impulsar un plan estatal de vivienda para las islas no capitalinas, con financiación específica para La Gomera.',
     None, 'vivienda', [], ['plan', 'gasto']),
    ('vivienda', 'Ampliar el alquiler público permanente mediante construcción en suelo público transformado, adquisición y rehabilitación de viviendas vacías y recuperación de casas tradicionales.',
     None, 'vivienda', [], ['gasto']),
    ('vivienda', 'Reforzar la rehabilitación de viviendas habituales y rurales, la bolsa pública de alquiler asequible y las soluciones residenciales para jóvenes, mayores y trabajadores esenciales. Priorizar el uso residencial frente a la especulación y el alquiler turístico.',
     None, 'vivienda', ['jovenes', 'mayores'], ['gasto']),
    ('movilidad', 'Revisar las compensaciones al transporte aéreo y marítimo y establecer medidas específicas para la doble insularidad, con tarifas asequibles y conexiones compatibles con el trabajo, los estudios y la atención sanitaria.',
     None, 'infraestructuras', [], ['gasto']),
    ('movilidad', 'Exigir frecuencias mínimas, continuidad en fines de semana y festivos y garantías para pacientes y mercancías esenciales; impulsar ayudas de transporte, alojamiento y manutención para quienes deban desplazarse por atención especializada.',
     None, 'infraestructuras', ['pacientes'], ['gasto']),
    ('movilidad', 'Promover una financiación estatal de los servicios esenciales basada en su coste real, no solo en el número de habitantes, y evaluar el impacto de las leyes estatales en las islas menores y en la aplicación del REF.',
     None, 'fiscalidad', [], ['gasto', 'ley']),
    ('economia', ECONOMIA, 'Queremos un REF que llegue también a autónomos, pequeñas empresas, trabajadores, familias y jóvenes',
     'fiscalidad', ['autonomos', 'familias', 'jovenes'], ['ley']),
    ('pueblos', 'Crear un fondo estatal plurianual contra el abandono rural insular para rehabilitación, caminos, redes de agua, transporte a demanda, servicios de proximidad y recuperación de tierras agrícolas.',
     None, 'rural', ['rural'], ['gasto', 'plan']),
    ('pueblos', 'Apoyar la agricultura familiar, la ganadería y la pesca artesanal; facilitar la cesión de fincas abandonadas y promover la compra pública de alimentos locales para comedores, residencias y otros servicios públicos.',
     None, 'rural', ['rural'], ['gasto']),
    ('pueblos', 'Impulsar empleo local ligado a la restauración de bancales, la gestión forestal, la prevención de incendios, el mantenimiento de senderos, la rehabilitación energética y la conservación del patrimonio natural y etnográfico.',
     None, 'empleo', [], ['gasto']),
    ('pueblos', 'Mejorar la conectividad digital en todos los núcleos y facilitar la formación, el teletrabajo y el emprendimiento, con oportunidades para jóvenes y mujeres.',
     None, 'infraestructuras', ['jovenes', 'mujeres'], ['gasto']),
    ('agua', 'FINALIZAR LAS OBRAS HIDRÁULICAS PENDIENTES: Exigiremos la finalización de todas las obras hidráulicas pendientes y la puesta en funcionamiento efectiva de las conexiones ya instaladas entre los distintos depósitos de la isla, garantizando que las infraestructuras construidas cumplan finalmente la función para la que fueron proyectadas. No basta con construir. Hay que terminar, conectar y poner en funcionamiento.',
     'FINALIZAR LAS OBRAS HIDRÁULICAS PENDIENTES', 'infraestructuras', [], ['gasto']),
    ('agua', 'Promover un plan estatal de garantía hídrica para las islas menores: reducir pérdidas en redes, modernizar depósitos y riego, reutilizar agua y proteger acuíferos, manantiales y ecosistemas vinculados.',
     None, 'infraestructuras', [], ['plan', 'gasto']),
    ('agua', 'Favorecer el autoconsumo, las comunidades energéticas y la participación pública y vecinal en los beneficios de las renovables, priorizando cubiertas, aparcamientos y suelos degradados frente a la ocupación de suelo agrario o paisajes protegidos.',
     None, 'energia', [], []),
    ('agua', 'Asegurar financiación estable para la prevención de incendios, la restauración de monteverde, barrancos y laderas, la recuperación de bancales y la adaptación del litoral al cambio climático.',
     None, 'energia', [], ['gasto']),
    ('cuidados', 'Reforzar la financiación estatal de la dependencia, la ayuda a domicilio, la teleasistencia, los centros de día y el respiro familiar, con servicios próximos a los núcleos rurales.',
     None, 'social', ['mayores'], ['gasto']),
    ('cuidados', 'Reclamar atención sanitaria especializada periódica y facilitar transporte accesible a consultas y servicios esenciales. Combatir la soledad no deseada y mantener alternativas presenciales para quienes no pueden depender de trámites digitales.',
     None, 'sanidad', ['mayores', 'pacientes'], ['gasto']),
    ('cuidados', 'Promover empleo estable y formación profesional en cuidados, así como vivienda, trabajo y formación que faciliten el arraigo y el retorno de jóvenes.',
     None, 'empleo', ['jovenes'], ['gasto']),
    ('escano', 'Impulsar en el Senado una ponencia sobre las necesidades de las islas menores, escuchando a ayuntamientos, Cabildo, sectores productivos y colectivos sociales.',
     None, 'democracia', [], ['plan']),
    ('escano', 'Defender partidas estatales para vivienda, transporte, cuidados, agricultura y prevención de incendios; promover iniciativas y preguntas parlamentarias sobre los compromisos pendientes que afecten a la isla.',
     None, 'democracia', [], ['gasto']),
    ('escano', 'Abrir una oficina territorial con atención presencial periódica y publicar cada seis meses un balance de actividad: iniciativas, gestiones, respuestas recibidas y asuntos pendientes.',
     None, 'democracia', [], ['organizacion']),
    ('escano', 'Consultar a la ciudadanía y a los municipios sobre las iniciativas que afecten a La Gomera, evaluar sus resultados y rendir cuentas de forma pública.',
     None, 'democracia', [], []),
]

TERRITORIOS = {
    'La Gomera': r'La Gomera',
    'Canarias': r'Canarias',
}


def normalizar(texto):
    texto = unicodedata.normalize('NFC', texto)
    return re.sub(r'\s+', ' ', texto).strip()


def compacto(texto):
    return re.sub(r'\s+', '', unicodedata.normalize('NFC', texto))


def primera_frase(texto):
    return re.split(r'(?<=\.)\s', texto, maxsplit=1)[0]


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    fuente = compacto(''.join(pagina.get_text() for pagina in documento))

    bloque_de = {seccion['id']: seccion['bloque'] for seccion in SECCIONES}
    medidas = []
    for numero, (seccion, texto, titulo, categoria, colectivos, palancas) in enumerate(MEDIDAS, start=1):
        parrafos = texto if isinstance(texto, list) else [texto]
        for parrafo in parrafos:
            if compacto(parrafo) not in fuente:
                raise ValueError(f'Medida {numero}: el texto no está en el PDF: {parrafo[:60]}')
        cuerpo = '\n\n'.join(normalizar(p) for p in parrafos)
        titulo = titulo or primera_frase(normalizar(parrafos[0]))
        territorios = [nombre for nombre, patron in TERRITORIOS.items() if re.search(patron, cuerpo)]
        pagina = next(s['pagina'] for s in SECCIONES if s['id'] == seccion)
        medidas.append({
            'n': numero,
            'bloque': bloque_de[seccion],
            'seccion': seccion,
            'pagina': pagina,
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': cuerpo,
            'oculta': False,
            'categoria': categoria,
            'colectivos': colectivos,
            'palancas': palancas,
            'territorios': territorios,
            'cifras': [],
            'plazo': None,
            'deroga': None,
        })

    if len(medidas) != TOTAL_MEDIDAS:
        raise ValueError(f'Se esperaban {TOTAL_MEDIDAS} medidas; hay {len(medidas)}')

    secciones = []
    for seccion in SECCIONES:
        secciones.append({
            'id': seccion['id'],
            'bloque': seccion['bloque'],
            'titulo': seccion['titulo'],
            'tituloFrase': seccion['titulo'],
            'intro': seccion['intro'],
            'pagina': seccion['pagina'],
            'subapartados': [],
        })

    return {
        'id': 'ixlg',
        'partido': 'Iniciativa por La Gomera',
        'siglas': 'IxLG',
        'comunidad': 'Canarias',
        'observaciones': [
            'Programa para el Senado: es la candidatura de La Gomera al Senado. No es el programa del Congreso.',
            'El PDF no pone título a las medidas: el título es la primera frase del texto. La medida 12 usa el título en mayúsculas del PDF.',
            'El PDF numera las medidas dentro de cada apartado (01 a 04). Aquí se numeran de 1 a 22 seguidas.',
            'La medida 7 es prosa: el apartado de economía del PDF no tiene medidas numeradas. Su texto es el apartado completo.',
        ],
        'color': '#009C4E',
        'colorClaro': '#DFFAE8',
        'programa': 'Un escaño. Una isla.',
        'subtitulo': 'Programa electoral al Senado de Iniciativa por La Gomera',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/ixlg-programa-senado-2026.pdf',
        'fuentePdf': 'https://iniciativaporlagomera.org/wp-content/uploads/2026/11/programa_electoral_la_gomera_gilam_editable-2.pdf',
        'paginas': PAGINAS,
        'fechaPdf': '2026-11-04',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {
            'titulo': 'El sentido de la candidatura',
            'texto': 'El Senado solo tiene sentido si sirve para llevar a Madrid los problemas reales de La Gomera y de Canarias. No queremos reproducir debates ni consignas estatales alejadas de la vida cotidiana: queremos una representación útil, cercana y sometida a rendición de cuentas. Concurrimos desde una tradición democrática y de justicia social vinculada a nuestra historia. No heredamos cargos ni patrimonio: somos fieles y acreedores de unos principios, de quienes los defendieron y de quienes lucharon por una Gomera más justa. Reconocemos las dificultades de la insularidad y la lejanía, pero no aceptamos que se conviertan en excusa para la falta de resultados. Defender los intereses y las reivindicaciones de la mayoría social de La Gomera es defender también Canarias. La insularidad es una realidad que exige más derechos, no menos.',
        },
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': BLOQUES,
        'secciones': secciones,
        'medidas': medidas,
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Uso: python scripts/extract_ixlg.py ORIGEN.pdf DESTINO.json')
    programa = extraer(sys.argv[1])
    with open(sys.argv[2], 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(programa["medidas"])} medidas, {len(programa["secciones"])} secciones, {len(programa["bloques"])} bloques')


if __name__ == '__main__':
    main()
