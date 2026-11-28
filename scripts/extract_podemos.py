"""Extract and categorize the 442 measures in the Podemos program «Así de básico: Paz, casa y trabajo» (29N 2026).

The PDF (A4, 141 pages, InDesign) is set in Barlow:
- «N.» + title in Barlow-ExtraBold 13 pt, colour 15222288 (the dropped capital or the full stop can be a
  15493700 span); the body goes on in Barlow-Regular 13 pt. Inside the body, Barlow-ExtraBold with the
  body colour (5723990) is only emphasis, not a title.
- Bullet points start with «•» (Barlow-Bold) or «⮡» (PPNeueMontreal) and are indented.
- Block headings are BarlowCondensed-Bold 26-28 pt. The fifth block has three sections whose headings are
  BarlowCondensed-ExtraBold 16 pt («VIDAS QUE MEREZCAN LA PENA SER VIVIDAS», …).
- Every page repeats «PROGRAMA ELECTORAL» (BarlowCondensed-Bold 12 pt) and ends with its page number
  (Barlow-Regular 12 pt). Pages 6, 15, 25, 39, 49 and 125 are block covers; page 140 is blank, 141 the back cover.
- The measures are numbered 1-442 without a gap. Measures 10-14 and 393 only point to another measure
  («Ver en apartado de los precios tienen que bajar»).

Usage: python scripts/extract_podemos.py public/2026/generales/programas/podemos-paz-casa-y-trabajo-2026.pdf src/data/2026/generales/programas/podemos.json
       python scripts/extract_podemos.py PDF JSON --depurar volcado.txt   (readable dump of every measure)
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

PAGINAS = 141
TOTAL_MEDIDAS = 442
# Official copy from the party's own site (podemos.info).
FUENTE_PDF = 'https://podemos.info/wp-content/uploads/2026/11/29N-programa-Podemos.-Paz-casa-y-trabajo.pdf'
OBSERVACIONES = [
    'El PDF procede de la web oficial de Podemos (podemos.info).',
    'La taxonomía común no tiene categoría de protección animal: las medidas 394 a 405 van a la más cercana (legislación a Justicia, ganadería y fauna a Campo, mar y mundo rural, tauromaquia y espectáculos a Lengua, cultura y memoria, y ciencia sin animales a Productividad e innovación).',
    'Las medidas 10 a 14 y la 393 solo dicen «Ver en apartado…» y remiten al bloque «Los precios tienen que bajar»: por su título repiten las medidas 54, 56, 57 y 58, 55, 53 y 43. Se cuentan como medidas porque el PDF las numera.',
]

# (title in the PDF, page where the heading is, base category)
BLOQUES = [
    ('Las casas son para vivir', 7, 'vivienda'),
    ('Los precios tienen que bajar', 16, 'fiscalidad'),
    ('Paz. Parar las guerras', 26, 'exterior'),
    ('Trabajar menos para vivir mejor', 40, 'empleo'),
    ('Vida solo hay una. Planeta solo hay uno', 50, 'social'),
    ('España, república plurinacional', 126, 'democracia'),
]

# Sections of block 5 (the only one that has them): (id, title in the PDF, base category)
SECCIONES_5 = [
    ('5.1', 'Vidas que merezcan la pena ser vividas', 'social'),
    ('5.2', 'Servicios públicos para garantizar vidas dignas', 'sanidad'),
    ('5.3', 'Planeta solo hay uno', 'energia'),
]

# Category chosen by reading each measure when it differs from its block's (or section's) base category.
POR_CATEGORIA = {
    # Block 1 (base: vivienda)
    'fiscalidad': [10, 11, 12, 13, 14, 393],
    'energia': [27, 28, 29, 36, 37, 38, 39],
    # Block 2 (base: fiscalidad)
    'administracion': [32, 33, 34, 62, 114],
    'innovacion': [35, 298, 402],
    'infraestructuras': [40, 336, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357,
                         359, 360, 361],
    'social': [46, 137, 115, 116, 126, 127, 128, 129, 130, 131, 132, 133, 135, 268],
    'empleo': [64, 66, 67, 68, 69, 252, 273, 276, 322],
    # Block 3 (base: exterior)
    'defensa': [70, 71, 72, 73, 74, 76, 78, 110],
    'inmigracion': [86, 87, 88, 89, 90, 91, 103, 159] + [n for n in range(205, 222) if n != 214],
    # Block 4 (base: empleo)
    'familia': [140, 149, 162, 165, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 192, 194, 197, 200, 432],
    'rural': [141, 358] + list(range(362, 383)) + [399, 400, 401, 403],
    # Block 5.1 (base: social)
    'seguridad': [145, 214, 147, 148, 151, 152, 153, 154, 157, 158, 163, 423, 424, 427, 429],
    'sanidad': [146, 164, 166, 167, 177],
    'justicia': [155, 156, 201, 394, 395, 396, 398, 409, 414, 415, 416, 417, 418, 419, 420, 421, 422, 428],
    'democracia': [161, 170, 172, 173, 222, 223],
    'vivienda': [226, 229, 397],
    # Block 5.2 (base: sanidad)
    'educacion': list(range(278, 298)),
    # Block 5.3 (base: energia) and block 6 (base: democracia)
    'emergencias': [320, 321, 323, 387, 388, 389, 390, 391, 392],
    'identidad': [144, 299, 404, 405, 431, 433, 434, 435, 436, 437, 438, 439, 440] + [n for n in range(230, 278) if n not in (252, 268, 273, 276)],
}
CATEGORIA_MEDIDA = {n: categoria for categoria, numeros in POR_CATEGORIA.items() for n in numeros}

# Laws and measures the program names explicitly as repealed or abolished («Derogar…», «derogaremos…»).
DEROGA = {
    51: 'Ley Beckham',
    62: 'Reforma del artículo 135 de la Constitución',
    86: 'Pacto Europeo de Migración y Asilo',
    117: 'Efectos de las reformas laborales de 2010 y 2012',
    124: 'Real Decreto 17/1977 sobre el derecho de huelga',
    205: 'Ley de Extranjería',
    300: 'Ley 15/1997 y las leyes privatizadoras de la sanidad',
    404: 'Ley 18/2013 de la tauromaquia',
    421: 'Ley Orgánica 1/2014 de justicia universal',
    427: 'Ley Mordaza',
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]ven(?:es)?\b|juventud|emancipaci',
    'mayores': r'\bmayores\b|pensionistas?|pensiones?|jubilaci|vejez',
    'mujeres': r'\bmujer(?:es)?\b|madres?\b|embarazad|feminis|machista|monomarental',
    'familias': r'\bfamilias?\b|conciliaci[oó]n|crianza|natalidad',
    'infancia': r'\binfancia\b|infantil|niñ[oa]s?\b|menores\b|hij[oa]s?\b|alumnos?|estudiantes',
    'autonomos': r'\baut[oó]nom[oa]s\b|\bpymes?\b|pequeñ[oa]s? empres|emprendedor',
    'empresas': r'\bempresas?\b|industria|empresari',
    'rural': r'\brural(?:es)?\b|agricultor|ganader|pescador|agrari|campesin|jornaler|\bcampo\b|despoblaci',
    'agentes': r'Fuerzas y Cuerpos|Guardia Civil|Polic[ií]a|Fuerzas Armadas|militares\b|\btropa\b|bomberos',
    'funcionarios': r'\bfuncionari[oa]s?\b|empleados p[uú]blicos|personal (?:del sector )?p[uú]blico|profesorado|docentes',
    'discapacidad': r'\bdiscapacidad\b|dependencia\b|capacitista',
    'victimas': r'\bv[ií]ctimas?\b|supervivientes',
    'inmigrantes': r'\binmigra|migrante|extranjer|asilo|refugiad|racializad|\bmigracion',
    'pacientes': r'\bpacientes?\b|listas de espera|sanitari|salud\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|reforma\b|reformar|reformaremos|norma|legislaci[oó]n|derog|prohib|C[oó]digo Penal|Constituci[oó]n|ilegaliz',
    'impuestos': r'\bIRPF\b|\bIVA\b|\bIBI\b|fiscal|impuesto|tribut|deducci[oó]n|bonificaci[oó]n|\btasas?\b|cotizaci|gravamen',
    'gasto': r'\bfinanciaci[oó]n|financiar|inversi[oó]n|invertir|fondos?\b|ayudas?\b|recursos\b|subvenci|presupuest|\bgasto|partida|cheque|prestaci',
    'organizacion': r'\bcrear\b|creaci[oó]n|crearemos|agencia|organismo|oficina|instituto|inspecci[oó]n|suprimir|supresi[oó]n|eliminar|cierre|auditor|registro|empresa p[uú]blica|banca p[uú]blica|nacionaliz',
    'plan': r'\bplan(?:es)?\b|programa\b|estrategia|convenio|acuerdo|pacto',
}

TERRITORIOS = {
    'Ceuta': r'\bCeuta\b|ceut[ií]',
    'Melilla': r'\bMelilla\b',
    'Canarias': r'\bCanarias\b|canari[oa]\b',
    'Baleares': r'\bBaleares\b|\bMallorca\b|\bMenorca\b|\bIbiza\b|\bEivissa\b',
    'Cataluña': r'\bCatalu[ñn]a\b',
    'País Vasco': r'\bPa[ií]s Vasco\b|\bEuskadi\b',
    'Navarra': r'\bNavarra\b',
    'Galicia': r'\bGalicia\b',
    'Andalucía': r'\bAndaluc[ií]a\b|\bDoñana\b|\bAlgeciras\b',
    'Región de Murcia': r'\bMar Menor\b|\bMurcia\b',
    'Castilla-La Mancha': r'\bTablas de Daimiel\b',
    'Gibraltar': r'\bGibraltar\b',
    'Sáhara': r'\bS[aá]hara\b|República Árabe Saharaui',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bBruselas\b',
}

# Autonomous territories count only when the title names them (a passing mention is not a territorial measure).
ESPAÑOLES = {'Ceuta', 'Melilla', 'Canarias', 'Baleares', 'Cataluña', 'País Vasco', 'Navarra', 'Galicia', 'Andalucía',
             'Región de Murcia', 'Castilla-La Mancha'}

# Key figures, chosen by reading the program. Each proof string must appear in the text of its measure.
CIFRAS = [
    ('40 %', 'rebaja del alquiler', 'reducción extraordinaria de los precios, en contratos vigentes y nuevos', 1, 'reducción extraordinaria del 40 % de los precios del alquiler'),
    ('30 %', 'de los ingresos', 'tope del coste conjunto de alquiler y suministros en vivienda pública', 16, 'no supere el 30 % de los ingresos de la unidad de convivencia'),
    ('300 €', 'cheque energético anual', 'para hogares con ingresos por debajo del SMI por miembro', 28, 'cheque energético anual de 300 euros'),
    ('50 %', 'de los beneficios de la banca', 'revertirían a las arcas públicas con un impuesto permanente a los beneficios extraordinarios', 31, 'al menos el 50 % de sus beneficios'),
    ('21 %', 'IVA', 'de los pisos turísticos', 53, 'elevaremos al 21 % el IVA'),
    ('19 %', 'tipo efectivo mínimo', 'en el impuesto de sociedades, hoy del 15 %', 47, 'del 15 % al 19 %'),
    ('1.800 €', 'salario mínimo', 'al mes, en una legislatura', 111, 'hasta los 1.800 euros al mes en una legislatura'),
    ('30 h', 'semanales', 'jornada laboral durante la legislatura, empezando por 35 horas', 113, 'a 30 horas semanales durante la legislatura'),
    ('63 años', 'edad ordinaria de jubilación', 'financiada con los Presupuestos Generales del Estado', 116, 'a los 63 años'),
    ('45 días', 'de indemnización por año', 'en los despidos ilegales, con derecho a elegir la readmisión', 118, '45 días por año trabajado'),
    ('1.000 millones', 'de euros', 'fondo de contingencia contra la violencia machista', 145, 'mil millones de euros'),
    ('26 semanas', 'de permiso por progenitor', 'por nacimiento, adopción y acogimiento, intransferible y remunerado', 178, '26 semanas por progenitor'),
    ('15 %', 'del SMI por hija o hijo', 'prestación mensual por crianza hasta los 21 años', 179, 'equivalente al 15 % del Salario Mínimo Interprofesional'),
    ('7 %', 'del PIB', 'inversión pública en educación durante la próxima legislatura', 281, 'equivalente al 7 % del PIB'),
    ('2 %', 'del PIB', 'inversión pública en ciencia e innovación', 298, 'hasta alcanzar el 2 % del PIB'),
    ('2.900 €', 'por habitante y año', 'financiación del Sistema Nacional de Salud, frente a los 2.247 euros actuales', 302, '2.900 euros por habitante y año'),
    ('55 %', 'menos emisiones', 'respecto a 1990 en 2030, con la ambición de llegar al 65 %', 316, 'al menos un 55 % para 2030'),
    ('20.000 millones', 'de euros al año', 'inversión ferroviaria, frente a los 5.000 actuales', 343, '20.000 millones al año'),
    ('16 años', 'edad de voto', 'derecho al sufragio a partir de los 16 años', 413, 'a partir de los 16 años'),
]

# Other quantified commitments of a measure (fragment that must appear in it). The measure keeps the whole sentence
# that holds the fragment; context data about the present («el 70 % de la evasión…») is not listed.
CIFRAS_MEDIDA = {
    8: ['30 % de la renta media'], 38: ['40 €/MWh'], 39: ['25%'], 111: ['75%'], 207: ['reducirá a un año'], 299: ['Duplicaremos'],
    307: ['hasta el 100%'], 381: ['en un 50%'], 343: ['100 %'], 302: ['Al menos el 30%'], 16: ['al menos el 50%'], 23: ['0,15 %', 'no supere el 30 %'], 29: ['hasta el 60 %', 'supere el 30%'],
    38: ['en más de un 5 %'], 41: ['entre el 7 y el 15 %'], 42: ['al 10 %'], 43: ['al 10%'], 44: ['IVA al 5%'], 46: ['700 euros'],
    48: ['al 9 %'], 115: ['40 años'], 122: ['por cada 2 meses cotizados'], 127: ['80% del SMI'],
    137: ['100 % del SMI'], 141: ['50 % del SMI'], 142: ['más de 30 días'], 151: ['durante 6 meses'], 180: ['10 semanas'],
    181: ['hasta 7 días'], 183: ['hasta 7 días'], 186: ['10 días hábiles'], 196: ['pública y directa al 100%'],
    230: ['Multiplicar por dos'], 280: ['máximo de 3 bebés'], 282: ['Incrementaremos un 30 %'], 283: ['22 horas'],
    294: ['800 euros mensuales'], 297: ['mínima del 30 %'], 303: ['subida del 20%'], 305: ['700 euros por habitante'],
    322: ['entre las 12 y las 18 horas'], 326: ['más del 90 %'], 328: ['al 50 %'], 329: ['100%'], 333: ['mínimo del 30%'],
    346: ['15 % en 2028'], 373: ['reducción del 85%'], 390: ['365 días'], 426: ['máximo de 20 años'], 427: ['48 horas'],
}

# Deadlines: when a measure is to be applied («de forma inmediata», «en la primera semana»). (plazo, texto, medida, prueba)
PLAZOS = [
    ('De forma inmediata', 'Regular el alquiler de temporada y por habitaciones en la LAU', 15, 'de forma inmediata'),
    ('De forma inmediata', 'Aprobar la Ley de Familias', 188, 'de forma inmediata'),
    ('De forma inmediata', 'Reformas de accesibilidad en las instituciones de representación', 173, 'de forma inmediata todas las reformas'),
    ('De forma inmediata', 'Reforzar los recursos de extranjería, asilo y nacionalidad', 207, 'Refuerzo inmediato de todos los recursos humanos'),
    ('De forma inmediata', 'Más personal y financiación de mantenimiento en el sistema ferroviario', 344, 'aumento inmediato de personal'),
    ('De forma inmediata', 'Paralizar nuevos derechos de riego a regadíos hiperintensivos', 358, 'de forma inmediata la concesión'),
    ('De forma inmediata', 'Desarrollar lo pendiente de la Ley de Memoria Democrática', 439, 'de forma inmediata todos los aspectos pendientes'),
    ('Durante la legislatura', 'Congelar el gasto militar', 72, 'durante toda la legislatura'),
    ('Durante la legislatura', 'Ley orgánica para adaptar la legislación a la Convención de la ONU sobre discapacidad', 174, 'a lo largo de la legislatura'),
    ('Durante la legislatura', 'Estabilización del personal investigador', 297, 'durante una legislatura'),
    ('Durante la legislatura', 'Duplicar el presupuesto del deporte femenino, inclusivo y de base', 299, 'durante la próxima legislatura'),
    ('En una legislatura', 'Equiparar los tipos del IRPF de las rentas del capital y del trabajo', 49, 'plazo máximo de una legislatura'),
    ('En una legislatura', 'Reducir un 50 % el desperdicio alimentario', 381, 'en una legislatura'),
    ('En dos años', 'Legislación autonómica de coordinación en emergencias', 392, 'plazo máximo de dos años'),
    ('En 2028', 'Transporte ferroviario de mercancías al 15 %', 346, 'en 2028'),
    ('Durante la legislatura', 'Jornada laboral de 30 horas semanales, empezando por 35', 113, 'durante la legislatura'),
    ('En una legislatura', 'Salario mínimo de 1.800 euros al mes', 111, 'en una legislatura'),
    ('En una legislatura', 'Multiplicar por dos la partida de Cultura', 230, 'en una legislatura'),
    ('En la próxima legislatura', 'Inversión pública en educación del 7 % del PIB', 281, 'durante la próxima legislatura'),
    ('En la próxima legislatura', 'Gratuidad total de las tasas de las universidades públicas', 294, 'durante la próxima legislatura'),
    ('En cuatro años', 'Plazas públicas gratuitas de educación infantil de 0 a 3 años', 281, 'plazo máximo de cuatro años'),
    ('Antes de 2030', 'Conexión ferroviaria en todos los municipios de más de 20.000 habitantes', 343, 'antes de 2030'),
    ('En 2030', 'Reducir al 50 % la energía primaria fósil', 328, 'en 2030'),
    ('En 2030', 'Transporte ferroviario de mercancías al 18 %', 346, 'en 2030'),
    ('En 2030', 'Reducir un 55 % las emisiones respecto a 1990', 316, 'para 2030'),
    ('En 2035', '95 % de generación eléctrica renovable', 328, 'en 2035'),
    ('Antes de 2040', 'Neutralidad climática del transporte', 351, 'antes de 2040'),
    ('En 2040', 'Neutralidad climática', 316, 'a 2040'),
    ('En 2040', 'Sistema eléctrico completamente descarbonizado', 328, 'en 2040'),
]
ORDEN_PLAZOS = ['De forma inmediata', 'En 2028', 'Durante la legislatura', 'En una legislatura', 'En la próxima legislatura',
                'En dos años', 'En cuatro años', 'Antes de 2030', 'En 2030', 'En 2035', 'Antes de 2040', 'En 2040']

PRESENTACION_TITULO = 'Así de básico: paz, casa y trabajo'

NUMERO_RE = re.compile(r'^\s*(\d{1,3})\.\t')
CABECERA = 'PROGRAMA ELECTORAL'
GUIONES = '­'
COLORES_TITULO = {15222288, 15493700}
PAGINAS_PORTADA = {6, 15, 25, 39, 49, 125, 140, 141}


def limpiar(texto):
    texto = texto.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace(' ', ' ')
    return unicodedata.normalize('NFC', texto)


def unir(piezas):
    """Join pieces of text; '\\n' marks a line end. Removes the soft hyphens InDesign leaves where it breaks a word."""
    lineas = ''.join(piezas).replace('\t', ' ').split('\n')
    resultado = ''
    for linea in lineas:
        linea = linea.strip()
        if not linea:
            continue
        if resultado.endswith(GUIONES):
            resultado = resultado[:-1] + linea
        else:
            resultado = f'{resultado} {linea}'.strip()
    resultado = resultado.replace(GUIONES, '')
    return re.sub(r'\s+', ' ', resultado).strip()


def es_titulo(span):
    return 'ExtraBold' in span['font'] and span['color'] in COLORES_TITULO


def lineas_pdf(documento):
    """Yield (page, y, kind, spans) for every text line in reading order.

    kinds: 'bloque' (block heading), 'seccion' (section heading), 'vineta' (starts with a bullet), 'linea'."""
    for indice, pagina in enumerate(documento, start=1):
        if indice in PAGINAS_PORTADA:
            continue
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip()]
                if not spans:
                    continue
                texto = limpiar(''.join(s['text'] for s in spans)).strip()
                primero = spans[0]
                fuente, tamano = primero['font'], round(primero['size'], 1)
                y = linea['bbox'][1]
                if texto == CABECERA and 'Condensed' in fuente:
                    continue
                if 'Barlow-Regular' in fuente and tamano == 12.0 and texto.isdigit():
                    continue  # folio
                if 'Condensed' in fuente and tamano >= 26:
                    yield indice, y, 'bloque', [primero]
                elif 'BarlowCondensed-ExtraBol' in fuente and tamano == 16.0:
                    yield indice, y, 'seccion', [primero]
                elif texto[:1] in ('•', '⮡'):
                    yield indice, y, 'vineta', [s for s in linea['spans'] if s['text'].strip() not in ('•', '⮡')]
                else:
                    yield indice, y, 'linea', linea['spans']


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    medidas = []
    bloques_vistos = []  # (title, page)
    secciones_vistas = []  # (title, page, block)
    intros = {}  # block number -> list of paragraphs (text before the first measure of the block)
    actual = None
    parrafo = None
    en_titulo = False
    y_anterior = None
    pagina_anterior = None

    def cerrar_parrafo():
        nonlocal parrafo
        if parrafo and parrafo['lineas']:
            destino = actual['parrafos'] if actual is not None and actual['bloque'] == len(bloques_vistos) \
                else intros.setdefault(len(bloques_vistos), [])
            destino.append(parrafo)
        parrafo = None

    titulo_bloque = []
    for pagina, y, tipo, spans in lineas_pdf(documento):
        if pagina < 7:
            continue  # cover, index and presentation (read apart)
        if tipo == 'bloque':
            cerrar_parrafo()
            en_titulo = False
            texto = limpiar(''.join(s['text'] for s in spans)).strip()
            if bloques_vistos and bloques_vistos[-1][1] == pagina:
                bloques_vistos[-1] = (bloques_vistos[-1][0] + ' ' + texto, pagina)
            else:
                bloques_vistos.append((texto, pagina))
            actual = None
            continue
        if tipo == 'seccion':
            cerrar_parrafo()
            en_titulo = False
            texto = limpiar(''.join(s['text'] for s in spans)).strip()
            secciones_vistas.append((texto, pagina, len(bloques_vistos)))
            continue
        nueva_linea = y_anterior is not None and pagina == pagina_anterior and (y - y_anterior) > 20
        y_anterior, pagina_anterior = y, pagina
        if tipo == 'vineta':
            cerrar_parrafo()
            en_titulo = False
            parrafo = {'vineta': True, 'lineas': []}
            runs = [limpiar(s['text']) for s in spans]
            parrafo['lineas'].append(''.join(runs) + '\n')
            continue
        primera = spans[0]
        numero = NUMERO_RE.match(limpiar(primera['text'])) if es_titulo(primera) else None
        if numero:
            cerrar_parrafo()
            actual = {
                'n': int(numero.group(1)),
                'bloque': len(bloques_vistos),
                'seccion': len(secciones_vistas) if bloques_vistos and bloques_vistos[-1][1] == 50 else None,
                'pagina': pagina,
                'titulo': [],
                'parrafos': [],
            }
            medidas.append(actual)
            en_titulo = True
            spans = [dict(primera, text=limpiar(primera['text'])[numero.end():])] + list(spans[1:])
        for s in spans:
            texto = limpiar(s['text'])
            if en_titulo:
                if es_titulo(s) or not texto.strip():
                    actual['titulo'].append(texto)
                    continue
                en_titulo = False
                actual['titulo'].append('\n')
            if parrafo is None:
                parrafo = {'vineta': False, 'lineas': []}
            elif nueva_linea and not parrafo['vineta'] and parrafo['lineas'] and re.search(r'[.:;!?»)]\s*$', ''.join(parrafo['lineas'])) \
                    and s is spans[0]:
                # a gap larger than the line spacing after a finished sentence is a paragraph break
                cerrar_parrafo()
                parrafo = {'vineta': False, 'lineas': []}
            parrafo['lineas'].append(texto)
        if en_titulo:
            actual['titulo'].append('\n')
        elif parrafo is not None:
            parrafo['lineas'].append('\n')
    cerrar_parrafo()

    numeros = [m['n'] for m in medidas]
    if numeros != list(range(1, TOTAL_MEDIDAS + 1)):
        raise ValueError(f'La numeración no es 1-{TOTAL_MEDIDAS}: {numeros}')
    if len(bloques_vistos) != len(BLOQUES):
        raise ValueError(f'Se esperaban {len(BLOQUES)} bloques; hay {len(bloques_vistos)}: {bloques_vistos}')
    for (titulo_pdf, pagina), (titulo, pagina_esperada, _) in zip(bloques_vistos, BLOQUES):
        if unicodedata.normalize('NFC', titulo_pdf).upper().rstrip('.') != titulo.upper().rstrip('.') or pagina != pagina_esperada:
            raise ValueError(f'Bloque inesperado: {titulo_pdf!r} (p. {pagina}) en lugar de {titulo!r} (p. {pagina_esperada})')
    if len(secciones_vistas) != len(SECCIONES_5):
        raise ValueError(f'Se esperaban {len(SECCIONES_5)} secciones; hay {len(secciones_vistas)}: {secciones_vistas}')
    for (titulo_pdf, _, _), (_, titulo, _) in zip(secciones_vistas, SECCIONES_5):
        if titulo_pdf.upper() != titulo.upper():
            raise ValueError(f'Sección inesperada: {titulo_pdf!r} en lugar de {titulo!r}')
    return documento, bloques_vistos, secciones_vistas, intros, medidas


def presentacion(documento):
    """Introduction of the program (pages 4-5), literal: paragraphs split where the line spacing grows."""
    parrafos, actual, y_anterior = [], [], None
    for numero in (4, 5):
        for bloque in documento[numero - 1].get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip()]
                if not spans:
                    continue
                texto = limpiar(''.join(s['text'] for s in linea['spans'])).strip()
                fuente, tamano = spans[0]['font'], round(spans[0]['size'], 1)
                if texto == CABECERA or ('Barlow-Regular' in fuente and tamano == 12.0 and texto.isdigit()) or tamano >= 20:
                    continue
                y = linea['bbox'][1]
                if actual and y_anterior is not None and y - y_anterior > 20 and re.search(r'[.:;!?»)]$', actual[-1].strip()):
                    parrafos.append(unir(actual))
                    actual = []
                actual.append(texto + '\n')
                y_anterior = y
    if actual:
        parrafos.append(unir(actual))
    return '\n\n'.join(p for p in parrafos if p)


def separar_titulo(medida):
    """The bold run is the title. When it holds several sentences, the first one is the title and the rest opens the text."""
    negrita = unir(medida['titulo'])
    if not negrita:
        raise ValueError(f'La medida {medida["n"]} no tiene título')
    titulo, resto = negrita, ''
    partes = re.split(r'(?<=[.:])\s+(?=[A-ZÁÉÍÓÚÑ¿«])', negrita, maxsplit=1)
    if len(partes) == 2:
        titulo, resto = partes
    return negrita, limpiar_titulo(titulo), resto.strip()


def limpiar_titulo(titulo):
    titulo = titulo.strip().rstrip(',:;').strip()
    if titulo.endswith('.') and not titulo.endswith('etc.'):
        titulo = titulo[:-1]
    return titulo


def componer_texto(negrita, resto, parrafos):
    """Text of the measure: the rest of the bold run and the paragraphs; each bullet starts with «– »."""
    textos = [(p['vineta'], unir(p['lineas'])) for p in parrafos]
    textos = [(v, t) for v, t in textos if t]
    if textos and not textos[0][0]:
        primero = textos[0][1]
        if re.match(r'^[a-záéíóúñ,;(]', primero):
            separador = '' if primero[0] in ',;' else ' '
            textos[0] = (False, f'{negrita}{separador}{primero}')
            resto = ''
        elif primero.startswith('.'):
            textos[0] = (False, primero[1:].strip())
        if resto:
            textos[0] = (False, f'{resto} {textos[0][1]}'.strip())
            resto = ''
    salida = [resto] if resto else []
    salida += [f'– {t}' if v else t for v, t in textos if t]
    return '\n\n'.join(salida)


def territorios_de(titulo, texto):
    return [
        nombre for nombre, patron in TERRITORIOS.items()
        if re.search(patron, titulo, re.I) or (nombre not in ESPAÑOLES and re.search(patron, texto))
    ]


def frase(titulo):
    return titulo[:1].upper() + titulo[1:]


def base_categoria(extraida):
    if extraida['seccion'] is not None:
        return SECCIONES_5[extraida['seccion'] - 1][2]
    return BLOQUES[extraida['bloque'] - 1][2]


def crear_programa(documento, bloques_vistos, secciones_vistas, intros, extraidas):
    bloques, secciones, medidas = [], [], []
    for bloque_id, (titulo, pagina, _) in enumerate(BLOQUES, start=1):
        intro = '\n\n'.join(unir(p['lineas']) for p in intros.get(bloque_id, []))
        bloques.append({
            'id': bloque_id, 'titulo': titulo, 'tituloMayus': titulo.upper(),
            'lema': '', 'cita': '', 'intro': intro, 'pagina': pagina,
        })
        if bloque_id == 5:
            for (seccion_id, titulo_seccion, _), (_, pagina_seccion, _) in zip(SECCIONES_5, secciones_vistas):
                secciones.append({
                    'id': seccion_id, 'bloque': bloque_id, 'titulo': titulo_seccion, 'tituloFrase': titulo_seccion,
                    'intro': '', 'pagina': pagina_seccion, 'subapartados': [],
                })
        else:
            secciones.append({
                'id': str(bloque_id), 'bloque': bloque_id, 'titulo': titulo, 'tituloFrase': titulo,
                'intro': '', 'pagina': pagina, 'subapartados': [],
            })

    for extraida in extraidas:
        numero = extraida['n']
        negrita, titulo, resto = separar_titulo(extraida)
        texto = componer_texto(negrita, resto, extraida['parrafos'])
        completo = f'{titulo}. {texto}'
        categoria = CATEGORIA_MEDIDA.get(numero, base_categoria(extraida))
        seccion = SECCIONES_5[extraida['seccion'] - 1][0] if extraida['seccion'] is not None else str(extraida['bloque'])
        medidas.append({
            'n': numero,
            'bloque': extraida['bloque'],
            'seccion': seccion,
            'pagina': extraida['pagina'],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': frase(titulo),
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [n for n, p in COLECTIVOS.items() if re.search(p, completo, re.I)],
            'palancas': [n for n, p in PALANCAS.items() if re.search(p, completo, re.I)],
            'territorios': territorios_de(titulo, texto),
            'cifras': [],
            'plazo': None,
            'deroga': DEROGA.get(numero),
        })

    textos = {m['n']: f"{m['titulo']}. {m['texto']}" for m in medidas}
    por_numero = {m['n']: m for m in medidas}
    def frase_con(numero, fragmento):
        for parte in re.split(r'(?<=[.!?])\s+|\n\n', textos[numero]):
            if fragmento in parte:
                return parte.strip().lstrip('– ').strip()
        raise ValueError(f'«{fragmento}» no aparece en la medida {numero}')

    for numero, fragmentos in CIFRAS_MEDIDA.items():
        for fragmento in fragmentos:
            frase_cifra = frase_con(numero, fragmento)
            if frase_cifra not in por_numero[numero]['cifras']:
                por_numero[numero]['cifras'].append(frase_cifra)
    cifras = []
    for valor, unidad, texto, numero, prueba in CIFRAS:
        if prueba not in textos[numero]:
            raise ValueError(f'La cifra «{valor}» no aparece en la medida {numero}')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': numero})
        frase_cifra = frase_con(numero, prueba)
        if frase_cifra not in por_numero[numero]['cifras']:
            por_numero[numero]['cifras'].append(frase_cifra)
    plazos = []
    for plazo, texto, numero, prueba in PLAZOS:
        if prueba not in textos[numero]:
            raise ValueError(f'El plazo «{plazo}» no aparece en la medida {numero}')
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': numero})
        por_numero[numero]['plazo'] = plazo
    for numero, ley in DEROGA.items():
        if 'derog' not in textos[numero].lower():
            raise ValueError(f'La medida {numero} no dice «derog»: {ley}')

    return {
        'id': 'podemos',
        'partido': 'Podemos',
        'siglas': 'PODEMOS',
        'color': '#9269F5',
        'colorClaro': '#CEBCFA',
        'programa': 'Paz, casa y trabajo',
        'subtitulo': f'{len(medidas)} medidas en 6 bloques para las elecciones generales',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': OBSERVACIONES,
        'pdf': '/programas/podemos-paz-casa-y-trabajo-2026.pdf',
        'fuentePdf': FUENTE_PDF,
        'paginas': len(documento),
        'fechaPdf': '2026-11-17',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': PRESENTACION_TITULO, 'texto': presentacion(documento)},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def depurar(programa, archivo):
    categorias = {}
    with open(archivo, 'w', encoding='utf-8') as salida:
        for m in programa['medidas']:
            salida.write(f"#{m['n']} [{m['bloque']}/{m['seccion']}] p.{m['pagina']} {m['categoria']} | {m['titulo']}\n{m['texto']}\n\n")
            categorias.setdefault(m['categoria'], 0)
            categorias[m['categoria']] += 1


def main():
    documento, bloques_vistos, secciones_vistas, intros, extraidas = extraer(sys.argv[1])
    programa = crear_programa(documento, bloques_vistos, secciones_vistas, intros, extraidas)
    if '--depurar' in sys.argv:
        depurar(programa, sys.argv[sys.argv.index('--depurar') + 1])
    with open(sys.argv[2], 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
        archivo.write('\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
