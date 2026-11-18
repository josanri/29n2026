"""Extrae el programa de Junts per Catalunya (Eleccions generals 2026) al esquema compartido.

Estructura del PDF (90 páginas, InDesign, en catalán; tipografías Archivo y Archivo Extra Condensed; dos columnas
de texto, columna izquierda x ≈ 55 y derecha x ≈ 330):
- Página 1: portada. Página 2: «Índex» (solo el título; el índice real está en la página 3).
- Páginas 4-5: «Introducció» (tres principios) y su texto.
- Páginas 6-7: «Retiment de comptes: la feina feta aquesta legislatura». Balance de lo hecho: no son propuestas.
- Páginas 8-10: «Catalunya al centre», el modelo de sociedad de Junts, en prosa. Tampoco son propuestas.
- Cuerpo (páginas 11-86): tres bloques («Bloc I», «Bloc II», «Bloc III», en una página de separación con letras
  blancas de 120-125 pt) y 26 capítulos. Cada capítulo empieza con su título (Archivo Extra Condensed 28 pt,
  teal #00c3b2) y una introducción en prosa (Regular 10 pt, #231f20), y sigue con cuatro apartados (Extra Condensed
  22 pt): «2. Competències» (a proteger y a reclamar), «3. Objectius» y «4. Punts de programa». Los puntos de
  programa se agrupan en «Objectiu N: …» (Extra Condensed 17 pt) y cada punto es «N.M. Texto» (el número en
  Extra Condensed 22 pt y el texto en Regular 10 pt, a veces todo en Regular 10 pt).
- Páginas 87-90: «Annex. Principals iniciatives de la legislatura»: lo ya hecho, en viñetas. No son propuestas.
- Pie: el número de página (blanco) y «Junts per Catalunya» / «PROGRAMA ELECTORAL 29-N» (Regular 9 pt, teal).

Niveles → esquema:
- Bloc I, II, III → bloques (el PDF no les da introducción).
- Capítulo (26) → sección («<bloque>.<orden>»). Su prosa → introducción de la sección.
- «Objectiu N» → subapartado de la sección (con el título del objetivo).
- Cada punto «N.M.» de «4. Punts de programa» → una propuesta, numerada de forma correlativa. El PDF da a cada
  punto un código («1.1.») que se repite en cada capítulo, así que la numeración global es nuestra. El punto no
  tiene título propio: el título es la primera frase y el texto, el resto.
- «2. Competències» y «3. Objectius» describen el marco competencial y los fines de cada capítulo; no se cuentan
  como propuestas (los puntos de programa los concretan). El balance de la legislatura (páginas 6-7 y anexo)
  tampoco: describe lo hecho, no lo que se promete.

Orden de lectura: en cada página, la columna izquierda entera y después la derecha. Las líneas se agrupan por la
línea base de cada pieza, no por su caja, porque el número del punto (22 pt) y su texto (10 pt) tienen cajas a
distinta altura pero la misma línea base.

Uso: python scripts/extract_junts.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'jxcat'
PDF_PUBLICO = '/programas/junts-programa-electoral-29n-2026.pdf'
FUENTE = 'https://www.tualcentre.cat/app/uploads/2026/11/PROGRAMA-ELECTORAL_JUNTS_29N.pdf'
FECHA_PDF = '2026-11-18'
COLOR = '#1f7a8c'
COLOR_CLARO = '#9ac3cb'
PAGINAS = 90
TEAL = 0x00C3B2
PRIMERA_PAGINA_CUERPO = 12
ULTIMA_PAGINA_CUERPO = 86
CAPITULOS = 26
PUNTOS = None  # se fija al leer el PDF por primera vez y se comprueba contra el recuento de líneas «N.M.»

# Páginas de separación de cada bloque (el cuerpo empieza en la siguiente).
PAGINAS_BLOQUE = {1: 11, 2: 43, 3: 66}

BLOQUES = {
    1: ('Els drets i les llibertats al centre', 'Bloc I. Els drets i les llibertats al centre'),
    2: ('El benestar dels catalans al centre', 'Bloc II. El benestar dels catalans al centre'),
    3: ('Les estructures i el model productiu al centre', 'Bloc III. Les estructures i el model productiu al centre'),
}

# Categoría de cada capítulo (sección). Las excepciones, punto a punto, en `CATEGORIA_MEDIDA`.
# Criterios: la taxonomía común no tiene una categoría de protección animal ni de deporte. El capítulo de animales
# va a «social» por defecto y cada punto a la categoría más cercana (derecho penal → «justicia», impuestos →
# «fiscalidad», ganadería y alimentación → «rural»); el deporte, a «identidad» (lengua, cultura), como en el PP y VOX.
# Los traspasos de competencias y la financiación territorial → «territorio»; la violencia machista → «seguridad»;
# la transparencia y la reforma electoral → «democracia»; las deducciones y los tipos de IVA → «fiscalidad».
CATEGORIA_SECCION = {
    '1.1': 'justicia', '1.2': 'vivienda', '1.3': 'identidad', '1.4': 'seguridad', '1.5': 'identidad',
    '1.6': 'exterior', '1.7': 'administracion', '1.8': 'social', '1.9': 'social', '1.10': 'social',
    '1.11': 'social',
    '2.1': 'social', '2.2': 'inmigracion', '2.3': 'sanidad', '2.4': 'educacion', '2.5': 'social',
    '2.6': 'empleo', '2.7': 'identidad',
    '3.1': 'empleo', '3.2': 'infraestructuras', '3.3': 'rural', '3.4': 'energia', '3.5': 'innovacion',
    '3.6': 'energia', '3.7': 'territorio', '3.8': 'rural',
}


def _rango(categoria, *numeros):
    """Una categoría para una lista de números y rangos («(200, 203)» es del 200 al 203)."""
    resultado = {}
    for item in numeros:
        for n in (range(item[0], item[1] + 1) if isinstance(item, tuple) else [item]):
            resultado[n] = categoria
    return resultado


# Excepciones a la categoría del capítulo, por número de propuesta (leídas una a una).
CATEGORIA_MEDIDA = {}
for _categoria, _numeros in {
    'territorio': [1, 44, 144, 146, 180, 214, 215, 218, 229, 283, 284, 285, 304, 305, 306, 308, 422, 443, 444,
                   (446, 448), 594, 607, 617],
    'identidad': [4, 31, 32, 33, 34, 46, 47, 147, 182, 185, 186, 225, 226, 272, 366],
    'seguridad': [5, 35, 156, 200, 201, 202, 203, 209, 210, 211, 213, 323, 325, 327, 560, 602, 603],
    'democracia': [6, 9, 10, 26, 29, 30, 162, (171, 175), (190, 194), 252, 380, (419, 421)],
    'vivienda': [36, 262, (395, 398), 400, 604, 605],
    'familia': [40, 41, 198, 204, 205, 207, 297, 298, 299, 301, 302, 303, (415, 418)],
    'empleo': [42, 195, 197, 208, 233, 256, 257, 258, 270, 608],
    'administracion': [43, 254, 263, 286, 296, 307, 404, 567, 595],
    'inmigracion': [97, 238, 239, 240, (596, 601)],
    'justicia': [101, 220, 222, 224, 227, 265, 266, 267],
    'emergencias': [(110, 114)],
    'defensa': [115, 117, 118, 119, 152, 153],
    'fiscalidad': [(135, 137), 268, 269, 386, 388, 390, 409, (428, 431), (436, 438), (449, 465), 468, 469, 492,
                   (515, 522), 534, 535, 548],
    'infraestructuras': [159, 253, 280, 375, 482, 486, 550, 558, 559, 571, 572, 573, 574, 591, (614, 616)],
    'energia': [160, 279, 384, 565, 613],
    'exterior': [217, 228, 242],
    'innovacion': [177, 179, 282, 343, 344, 345, 347, (355, 363), 374, 483, 484, 612],
    'sanidad': [230, 231, 236, 261, 277, 291, 370, 371, 372, 373, 389, 423, 424, 494, 495],
    'educacion': [232, 320, 333, 392, 393, 394, 399],
    'rural': [274, 275, 276, 278, 281, 414],
    'social': [432, 434, 488, 489, 490, 555, 606],
}.items():
    CATEGORIA_MEDIDA.update(_rango(_categoria, *_numeros))

# Derogaciones explícitas, por número de propuesta. Se comprueba que la propuesta dice «derog».
DEROGA = {
    2: 'Artículo 384 bis de la Ley de Enjuiciamiento Criminal',
    3: 'Delitos del Código Penal sobre expresión política, protesta y crítica institucional',
    9: 'Ley franquista de secretos oficiales',
    10: 'Ley de seguridad ciudadana («ley mordaza»)',
    29: 'Inelegibilidad sobrevenida de los artículos 6.2.b y 6.4 de la LOREG',
    39: 'Prisión permanente revisable y restricción estatal de la justicia universal',
    102: 'Ley Orgánica de protección de la seguridad ciudadana',
    272: 'Declaración de la tauromaquia como patrimonio cultural',
    396: 'Artículos de la Ley 12/2023 por el derecho a la vivienda que invaden la competencia catalana',
    592: 'Ley de racionalización y sostenibilidad de la Administración local (LRSAL)',
}

# Cifras: solo compromisos cuantificados. (valor, unidad, texto, número de propuesta, prueba literal)
CIFRAS = [
    ('48 h', 'para desalojar una ocupación ilegal', 'con juicio inmediato', 48, 'en un màxim de 48 hores'),
    ('15 %', 'deducción en el IRPF', 'por el alquiler de la vivienda habitual', 53, 'deducció del 15%'),
    ('15 %', 'deducción en el IRPF', 'por las cuotas de la hipoteca de la vivienda habitual', 54, 'deducció del 15%'),
    ('5 %', 'IVA de la vivienda nueva', 'baja del 10 % al 5 % para residencia habitual, con límites de superficie, precio y renta',
     56, 'Reduir del 10% al 5%'),
    ('2.000 M€', 'en avales del Estado', 'para vivienda social o asequible, más 280 millones para construcción industrializada',
     64, 'fins a 2.000 milions d’euros'),
    ('26.800', 'agentes de los Mossos d’Esquadra', 'en 2032, con el control de puertos y aeropuertos', 325,
     'fins a 26.800 agents el 2032'),
    ('8 %', 'del PIB en sanidad pública', 'objetivo del gasto sanitario, con el 25 % del presupuesto de salud en atención primaria',
     330, 'del 8 % del PIB en despesa sanitària pública'),
    ('0,6 %', 'del PIB en universidades', 'subir desde el 0,40 % actual en cinco años', 355,
     'fins al 0,6 % del PIB en cinc anys'),
    ('100 %', 'del IVA de la investigación', 'devolverlo, como fija la normativa europea', 357,
     'Retornar el 100 % de l’IVA de la recerca'),
    ('1.400 €', 'pensión mínima al mes', 'igualar las mínimas y de viudedad al salario mínimo catalán, en 14 pagas', 385,
     '1.400 euros mensuals en 14 pagues'),
    ('75 %', 'de reducción del IRPF para jóvenes', 'el segundo año de actividad, tras la exención total del primero', 409,
     'reducció del 75 %'),
    ('0 €', 'cuota de autónomo joven', 'durante los 3 primeros años, hasta los 35 años', 410,
     'durant els 3 primers anys d’activitat'),
    ('100 %', 'de deducción en Sociedades', 'por el patrocinio a clubes y federaciones deportivas', 438,
     'deducció del 100%'),
    ('100 %', 'de condonación', 'de la deuda de la Generalitat con el Fondo de Liquidez Autonómico', 448,
     'condonació del 100%'),
    ('2 M€', 'exención del IAE', 'subir el umbral de facturación exento', 452, 'Elevar a dos milions d’euros'),
    ('0 %', 'impuesto sobre la producción eléctrica', 'cuando el sistema eléctrico no genere déficit de tarifa', 453,
     'tipus del 0%'),
    ('85.000 €', 'IVA franquiciado voluntario', 'para autónomos y pequeñas empresas con esa facturación anual', 456,
     'fins a 85.000 euros'),
    ('10 %', 'IVA de la luz y el gas natural', 'garantizando que la rebaja llegue a la factura', 457,
     'Reduir al 10% l’IVA de la llum'),
    ('10 %', 'IVA de las peluquerías', 'baja desde el 21 %', 459, 'del 21% al 10%'),
    ('5.000 €', 'gastos de difícil justificación', 'subir el límite deducible de los autónomos', 468,
     'fins a 5.000 euros'),
    ('2 M€', 'facturación para el IVA de caja', 'autónomos y empresas por debajo ingresan el IVA al cobrar', 469,
     'inferior a dos milions d’euros'),
    ('3 %', 'del PIB en I+D', 'objetivo de inversión total', 484, 'del 3% del PIB'),
    ('60 %', 'del salario medio catalán', 'meta del salario mínimo catalán, de forma progresiva', 487,
     'cap al 60% del salari mitjà'),
    ('100 %', 'de Rodalies y Media Distancia', 'traspaso inmediato e incondicional', 501, 'del 100% de Rodalies'),
    ('100 km', 'radio del autoconsumo', 'ampliar el límite actual de 5 km', 541, 'a 100 km'),
    ('10 %', 'pérdidas en las redes de agua', 'reducirlas por debajo de ese nivel', 571, 'per sota del 10%'),
    ('30 %', 'del parque de vivienda rural', 'objetivo de rehabilitación en una década', 605,
     'contribuir al 30% del parc rehabilitat'),
]

# Plazos: solo cuándo se aplica la propuesta. (número, plazo, texto, prueba literal)
PLAZOS = [
    (47, 'De inmediato', 'Abrir los archivos militares sobre los abusos y muertes de la mili obligatoria',
     'obertura immediata'),
    (180, 'De inmediato', 'Traspaso a la Generalitat de la gestión de secretarios e interventores municipales',
     'immediatament efectiu'),
    (594, 'De inmediato', 'Traspaso a la Generalitat de la gestión de secretarios e interventores municipales',
     'immediatament efectiu'),
    (333, 'De inmediato', 'Eliminar el distrito universitario único del Estado', 'eliminació immediata'),
    (395, 'De inmediato', 'Traspaso de las viviendas y el suelo de la SAREB y Casa 47 en Cataluña',
     'traspàs immediat'),
    (501, 'De inmediato', 'Traspaso del 100 % de Rodalies y Media Distancia', 'traspàs immediat'),
    (502, 'De inmediato', 'Plan de choque contra los retrasos y las averías de Rodalies', 'inversions immediates'),
    (512, 'De inmediato', 'Traspaso de las competencias agrarias, ganaderas, forestales y de pesca',
     'traspàs immediat'),
    (522, 'De inmediato', 'Rebajar los impuestos de los carburantes agrícolas', 'de manera urgent'),
    (244, '2027', 'Desplegar los reglamentos pendientes de la ley estatal de discapacidad', 'dins del 2027'),
    (60, '2028', 'Prohibir que entidades financieras y fondos compren vivienda', 'fins al 2028'),
    (355, '5 años', 'Subir la inversión en universidades al 0,6 % del PIB', 'en cinc anys'),
    (325, '2032', 'Mossos d’Esquadra hasta 26.800 agentes', 'el 2032'),
    (605, '10 años', 'Rehabilitar el 30 % del parque de vivienda rural', 'en una dècada'),
]
ORDEN_PLAZOS = ['De inmediato', '2027', '2028', '5 años', '2032', '10 años']

COLECTIVOS = {
    'empresas': r'\bempres(?:a|es|arial|arials|aris)\b|\bind[uú]stri(?:a|es|al|als)\b',
    'familias': r'\bfam[ií]l(?:ia|ies)\b|\bconciliaci[oó]\b|\bnatalitat\b',
    'infancia': r'\binf[aà]n(?:cia|ts?)\b|\badolesc[eè]n(?:cia|ts?)\b|\balumnat\b|\bmenors\b|\bnens\b|\bnenes\b',
    'inmigrantes': r'\bimmigra(?:ci[oó]|nts?)\b|\bmigra(?:ci[oó]|nts?|tori[ae]?s?)\b|\brefugiats?\b|\bnouvinguts?\b|\basil\b',
    'jovenes': r'\bjov(?:e|es|entut)\b',
    'rural': r'\bpages(?:ia|os)\b|\bagr[aà]ri(?:a|es|s)?\b|\bpesca(?:dors)?\b|\bpesquer\w*|\bramader\w*|\bm[oó]n rural\b|\bsector primari\b|\bagricultors?\b|\bramaders?\b',
    'autonomos': r'\baut[oò]noms?\b|\btreball aut[oò]nom\b|\bpimes?\b|\bmicropimes?\b|\bemprenedor\w*',
    'agentes': r'\bMossos d[\'’]Esquadra\b|\bpolici(?:a|es)\b|\bcossos policials\b|\bGu[aà]rdia Civil\b|\bagents rurals\b|\bbombers\b|\bmilitars?\b',
    'mayores': r'\bgent gran\b|\bpersones grans\b|\bpensionistes?\b|\bpensions?\b|\bjubilaci[oó]\b',
    'discapacidad': r'\bdiscapacitat\w*|\bdepend[eè]ncia\b|\bELA\b',
    'mujeres': r'\bdones?\b|\bviol[eè]ncia (?:masclista|de g[eè]nere)\b|\bigualtat entre dones\b',
    'victimas': r'\bv[ií]ctimes?\b',
    'pacientes': r'\bpacients?\b|\bllistes d[\'’]espera\b',
    'funcionarios': r'\bfuncionari\w*|\bdocents?\b|\bprofessorat\b|\bmestres\b|\bprofessionals sanitaris\b|\bpersonal sanitari\b',
}

PALANCAS = {
    'ley': r'\bllei\b|\blleis\b|\bderog\w*|\breforma\b|\bmodificaci[oó]\b|\bnormativ\w*|\blegisla\w*|\bEstatut\b|\bLlei Org[aà]nica\b|\bCodi Penal\b',
    'impuestos': r'\bfiscal\w*|\bimpostos?\b|\btribut\w*|\bIVA\b|\bIRPF\b|\bdesgrava\w*|\bdeducci\w*|\bbonificaci\w*|\bexempci\w*|\bcotitzaci\w*|\bquotes?\b',
    'gasto': r'\bfinan[cç]a\w*|\binversi(?:[oó]|ons)\b|\bpressupost\w*|\bajuts?\b|\bsubvenci\w*|\bfons\b|\bdotaci[oó]\b|\bdotar\b|\bmilions\b',
    'organizacion': r'\bcrear\w*|\bcreaci[oó]\b|\bag[eè]ncia\b|\borganisme\b|\boficina\b|\bautoritat\b|\bconsell\b|\bcentre\b|\btrasp[aà]s\w*|\bdelegaci[oó]\b|\bcompet[eè]ncies\b|\btransfer[eè]ncia\b|\bassumir\b|\bgestionar\b',
    'plan': r'\bpla\b|\bplans\b|\bestrat[eè]gi(?:a|es)\b|\bprogram(?:a|es)\b|\bpacte\b|\bacords?\b',
}

TERRITORIOS = {
    'Cataluña': r'\bCatalunya\b|\bGeneralitat\b|\bcatalan[ae]?s?\b',
    'España': r'\bEspanya\b|\bEstat espanyol\b|\bl[\'’]Estat\b',
    'Unión Europea': r'\bUni[oó] Europea\b|\bUE\b|\binstitucions europees\b|\bPAC\b',
    'Val d’Aran': r'\bAran\b',
    'Comunidad Valenciana': r'\bvalenci[aà]\b|\bPa[ií]sos Catalans\b',
}

NO_VERBOS = set()

CAPITULO_RE = re.compile(r'^\s*([234])\.\s*(Compet[eè]ncies|Objectius|Punts de programa)\s*$')
OBJETIVO_RE = re.compile(r'^Objectiu\s+(\d+)\s*[:.]\s*(.*)$')
BULLET_RE = re.compile(r'^[•·▪●]\s*')
GRUPO_RE = re.compile(r'^Bloc\s+\d+\.')
PUNTO_RE = re.compile(r'^(\d{1,2})\.(\d{1,2})(?!\d)\.?\s*(.*)$')


def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    texto = texto.replace(' ', ' ').replace('­', '').replace('\t', ' ')
    return re.sub(r'\s+', ' ', texto).strip()


def unir(piezas):
    """Une líneas. El PDF no divide palabras en sílabas: un guion al final de línea es siempre un guion real
    («aprovar-» + «ne» → «aprovar-ne», «LGTBI-» + «fòbia»). Se conserva y se une sin espacio."""
    resultado = ''
    for pieza in piezas:
        pieza = pieza.strip()
        if not pieza:
            continue
        if re.search(r'[A-Za-zÀ-ÿ]-$', resultado) and pieza[:1].islower():
            resultado = resultado + pieza
        else:
            resultado = f'{resultado} {pieza}'.strip()
    return limpiar(resultado)


def texto_linea(spans):
    """Las piezas de una línea, de izquierda a derecha, con un espacio donde hay hueco."""
    spans = sorted(spans, key=lambda s: s['bbox'][0])
    texto = ''
    for anterior, span in zip([None] + spans[:-1], spans):
        hueco = anterior is not None and span['bbox'][0] - anterior['bbox'][2] > 1
        if hueco and not texto.endswith(' ') and not span['text'].startswith(' '):
            texto += ' '
        texto += span['text']
    return texto


def lineas_pagina(pagina, numero):
    """Las líneas de una página en orden de lectura (columna izquierda y después derecha).

    Cada línea lleva su texto, el tamaño y el color de su primera pieza, su columna y su altura."""
    piezas = []
    for bloque in pagina.get_text('dict')['blocks']:
        for linea in bloque.get('lines', []):
            for span in linea['spans']:
                if not span['text'].strip():
                    continue
                if span['color'] == 0xFFFFFF:
                    continue  # número de página y letras de las páginas de separación
                if span['size'] <= 9.5:
                    continue  # cabecera y pie («PROGRAMA ELECTORAL 29-N», «Junts per Catalunya»)
                piezas.append(span)
    filas = []
    for span in sorted(piezas, key=lambda s: (0 if s['bbox'][0] < 300 else 1, s['origin'][1], s['bbox'][0])):
        columna = 0 if span['bbox'][0] < 300 else 1
        base = span['origin'][1]
        if filas and filas[-1]['columna'] == columna and abs(filas[-1]['base'] - base) < 2.5:
            filas[-1]['spans'].append(span)
        else:
            filas.append({'columna': columna, 'base': base, 'spans': [span]})
    resultado = []
    for fila in filas:
        primero = min(fila['spans'], key=lambda s: s['bbox'][0])
        resultado.append({
            'pagina': numero,
            'columna': fila['columna'],
            'y': fila['base'],
            'x': primero['bbox'][0],
            'size': primero['size'],
            'color': primero['color'],
            'texto': limpiar(texto_linea(fila['spans'])),
        })
    return resultado


def parrafos(lineas):
    """Párrafos de prosa a partir de líneas en orden de lectura."""
    resultado = []
    actual = []
    anterior = None
    for linea in lineas:
        corte = False
        if anterior is not None:
            if (linea['size'] >= 15.5) != (anterior['size'] >= 15.5):
                corte = True
            elif linea['size'] >= 15.5:
                corte = False
            elif (linea['pagina'], linea['columna']) == (anterior['pagina'], anterior['columna']):
                corte = linea['y'] - anterior['y'] > 14
            else:
                corte = bool(re.search(r'[.:;!?»”]$', anterior['texto']))
        if corte and actual:
            resultado.append(unir(actual))
            actual = []
        actual.append(linea['texto'])
        anterior = linea
    if actual:
        resultado.append(unir(actual))
    return [p for p in resultado if p]


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    # Índice (página 3): bloques y capítulos, para comprobar el cuerpo.
    indice = []
    for linea in lineas_pagina(documento[2], 3):
        texto = linea['texto']
        if texto.startswith('•'):
            indice.append(('capitulo', limpiar(texto.lstrip('•'))))
        elif re.match(r'^(Bloc [I]+\.|Annex\.|Introducci)', texto):
            indice.append(('bloque', texto))
    titulos_indice = [t for tipo, t in indice if tipo == 'capitulo']
    # Los dos primeros son «Retiment de comptes» y «Catalunya al centre»: no son capítulos del cuerpo.
    titulos_indice = titulos_indice[2:]
    if len(titulos_indice) != CAPITULOS:
        raise ValueError(f'El índice tiene {len(titulos_indice)} capítulos; se esperaban {CAPITULOS}')

    presentacion = parrafos([l for l in lineas_pagina(documento[4], 5)])

    secciones, medidas, bloques_vistos = [], [], []
    capitulo = None   # sección abierta
    estado = None     # 'titulo', 'intro', 'comp', 'obj', 'punts'
    objetivo = None   # número del objetivo abierto
    siguiente = 0     # siguiente número de punto esperado dentro del objetivo
    actual = None     # punto abierto
    lineas_intro = []
    grupo = None      # grupo de objetivos abierto («Bloc 1. …»)

    def cerrar_punto():
        nonlocal actual
        if actual:
            medidas.append(actual)
            actual = None

    def cerrar_capitulo():
        nonlocal lineas_intro
        cerrar_punto()
        if capitulo is not None:
            capitulo['intro'] = '\n\n'.join(parrafos(lineas_intro))
            if estado != 'punts':
                raise ValueError(f'El capítulo «{capitulo["titulo"]}» no llega a «Punts de programa»')
            if not capitulo['objetivos']:
                raise ValueError(f'El capítulo «{capitulo["titulo"]}» no tiene objetivos')
        lineas_intro = []

    for numero in range(PRIMERA_PAGINA_CUERPO, ULTIMA_PAGINA_CUERPO + 1):
        for linea in lineas_pagina(documento[numero - 1], numero):
            texto = linea['texto']
            if linea['size'] >= 27 and linea['color'] == TEAL:
                # Título de capítulo; puede ocupar dos líneas.
                if estado == 'titulo':
                    capitulo['titulo'] = unir([capitulo['titulo'], texto])
                    continue
                cerrar_capitulo()
                bloque = 1 if numero < PAGINAS_BLOQUE[2] else 2 if numero < PAGINAS_BLOQUE[3] else 3
                if bloque not in bloques_vistos:
                    bloques_vistos.append(bloque)
                orden = sum(1 for s in secciones if s['bloque'] == bloque) + 1
                capitulo = {'id': f'{bloque}.{orden}', 'bloque': bloque, 'titulo': texto, 'pagina': numero,
                            'objetivos': [], 'intro': ''}
                secciones.append(capitulo)
                estado = 'titulo'
                objetivo, siguiente = None, 0
                continue
            if capitulo is None:
                continue
            cabecera = CAPITULO_RE.match(texto) if linea['size'] >= 21 else None
            if cabecera:
                parte = cabecera.group(2)
                esperado = {'Competències': 'intro', 'Objectius': 'comp', 'Punts de programa': 'obj'}
                clave = 'Compet' if parte.startswith('Compet') else parte
                previo = {'Compet': 'intro', 'Objectius': 'comp', 'Punts de programa': 'obj'}[clave]
                if estado not in (previo, 'titulo' if previo == 'intro' else previo):
                    raise ValueError(f'«{texto}» fuera de orden en la página {numero} (estado {estado})')
                estado = {'Compet': 'comp', 'Objectius': 'obj', 'Punts de programa': 'punts'}[clave]
                continue
            if estado == 'titulo':
                estado = 'intro'
            if estado == 'intro':
                lineas_intro.append(linea)
                continue
            if estado in ('comp', 'obj'):
                continue
            # estado == 'punts'
            if linea['size'] >= 16.5 and linea['size'] < 21 and linea['color'] == TEAL:
                coincide = OBJETIVO_RE.match(texto)
                if coincide:
                    cerrar_punto()
                    n_obj = int(coincide.group(1))
                    if n_obj != len(capitulo['objetivos']) + 1:
                        raise ValueError(f'Objetivo {n_obj} fuera de orden en la página {numero}: {texto}')
                    # El título de un grupo termina cuando empieza el primer objetivo.
                    intro_grupo = ''
                    if grupo is not None and grupo['abierto']:
                        grupo['abierto'] = False
                        intro_grupo = grupo['titulo']
                    capitulo['objetivos'].append({'titulo': coincide.group(2), 'numero': n_obj,
                                                  'grupo': intro_grupo})
                    objetivo, siguiente = n_obj, 1
                elif GRUPO_RE.match(texto):
                    # «Bloc 1. Mesures d’emergència.» agrupa los objetivos siguientes (capítulo de vivienda).
                    cerrar_punto()
                    grupo = {'titulo': texto, 'abierto': True}
                else:
                    if grupo is not None and grupo['abierto']:
                        grupo['titulo'] = unir([grupo['titulo'], texto])
                    elif capitulo['objetivos']:
                        capitulo['objetivos'][-1]['titulo'] = unir([capitulo['objetivos'][-1]['titulo'], texto])
                    else:
                        raise ValueError(f'Título de objetivo sin «Objectiu N:» en la página {numero}: {texto}')
                continue
            coincide = PUNTO_RE.match(texto)
            if coincide and objetivo is not None and int(coincide.group(1)) == objetivo \
                    and int(coincide.group(2)) == siguiente:
                cerrar_punto()
                actual = {'seccion': capitulo['id'], 'bloque': capitulo['bloque'], 'pagina': numero,
                          'subapartado': objetivo - 1, 'codigo': f'{objetivo}.{siguiente}',
                          'parrafos': [[coincide.group(3)]]}
                siguiente += 1
                continue
            if actual is None:
                raise ValueError(f'Texto fuera de un punto en la página {numero}: {texto[:80]}')
            viñeta = BULLET_RE.match(texto)
            if viñeta:
                actual['parrafos'].append(['– ' + texto[viñeta.end():]])
            else:
                actual['parrafos'][-1].append(texto)
    cerrar_capitulo()

    if len(secciones) != CAPITULOS:
        raise ValueError(f'El cuerpo tiene {len(secciones)} capítulos; el índice, {CAPITULOS}')
    if bloques_vistos != [1, 2, 3]:
        raise ValueError(f'Bloques vistos: {bloques_vistos}')
    # Cada capítulo del cuerpo debe coincidir con el del índice, en el mismo orden.
    def norma(t):
        return re.sub(r'\W+', '', t.lower().replace('.', ''))
    for seccion, esperado in zip(secciones, titulos_indice):
        if norma(seccion['titulo']) != norma(esperado):
            raise ValueError(f'Capítulo «{seccion["titulo"]}» no coincide con el índice «{esperado}»')

    # Recuento independiente: cada «N.M.» al inicio de una línea de punto, página a página.
    return documento, presentacion, secciones, medidas


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def frase(titulo):
    texto = titulo.strip().rstrip(' .')
    if len(texto) > 125:
        texto = texto[:122].rsplit(' ', 1)[0] + '…'
    return texto


def titulo_y_texto(texto):
    """La primera frase es el título; el resto, el texto. Un punto en una abreviatura no corta la frase."""
    for corte in re.finditer(r'(?<=[.!?:])\s+(?=[A-ZÀ-Ú«“"(])', texto):
        antes = texto[:corte.start()]
        if re.search(r'\b(?:p\.ex|etc|Sr|Sra|núm|art|Dr|Dra)\.$', antes):
            continue
        return antes.strip(), texto[corte.end():].strip()
    return texto.strip(), ''


def frase_con(texto, prueba):
    for parte in re.split(r'(?<=[.!?])\s+', texto):
        if prueba in parte:
            return parte.strip()
    return prueba


def crear_programa(pdf):
    documento, presentacion, secciones_raw, medidas_raw = extraer(pdf)
    bloques = [{
        'id': n,
        'titulo': BLOQUES[n][0],
        'lema': BLOQUES[n][1],
        'cita': '',
        'intro': '',
        'pagina': PAGINAS_BLOQUE[n],
    } for n in (1, 2, 3)]
    secciones = [{
        'id': s['id'],
        'bloque': s['bloque'],
        'titulo': s['titulo'].rstrip(' .'),
        'tituloFrase': frase(s['titulo']),
        'intro': s['intro'],
        'pagina': s['pagina'],
        'subapartados': [{'titulo': f"Objectiu {o['numero']}: {o['titulo'].rstrip(' .')}", 'intro': o['grupo']}
                         for o in s['objetivos']],
    } for s in secciones_raw]

    medidas = []
    for n, raw in enumerate(medidas_raw, start=1):
        parrafos_punto = [unir(p) for p in raw['parrafos']]
        parrafos_punto = [p for p in parrafos_punto if p and p != '–']
        completo = ' '.join(parrafos_punto)
        if not completo:
            raise ValueError(f'El punto {raw["seccion"]} {raw["codigo"]} (página {raw["pagina"]}) no tiene texto')
        titulo, resto = titulo_y_texto(parrafos_punto[0])
        texto = '\n\n'.join(([resto] if resto else []) + parrafos_punto[1:])
        seccion = raw['seccion']
        categoria = CATEGORIA_MEDIDA.get(n) or CATEGORIA_SECCION.get(seccion)
        if CATEGORIA_SECCION and not categoria:
            raise ValueError(f'Falta la categoría de la sección {seccion}')
        medida = {
            'n': n,
            'bloque': raw['bloque'],
            'seccion': seccion,
            'pagina': raw['pagina'],
            'subapartado': raw['subapartado'],
            'titulo': titulo,
            'tituloFrase': frase(titulo),
            'texto': texto,
            'oculta': False,
            'categoria': categoria or '',
            'colectivos': coincidencias(completo, COLECTIVOS),
            'palancas': coincidencias(completo, PALANCAS),
            'territorios': coincidencias(completo, TERRITORIOS),
            'cifras': [],
            'plazo': None,
            'deroga': None,
        }
        if n in DEROGA:
            if not re.search(r'derog', completo, re.I):
                raise ValueError(f'La propuesta {n} no dice «derogar»')
            medida['deroga'] = DEROGA[n]
        medidas.append(medida)

    por_numero = {m['n']: m for m in medidas}
    for clave in list(CATEGORIA_MEDIDA) + list(DEROGA):
        if clave not in por_numero:
            raise ValueError(f'La propuesta {clave} no existe')

    cifras = []
    for valor, unidad, texto, n, prueba in CIFRAS:
        medida = por_numero[n]
        cuerpo = f"{medida['titulo']} {medida['texto']}"
        if prueba not in cuerpo:
            raise ValueError(f'La cifra «{valor}» no aparece en la propuesta {n}: «{prueba}»')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': n})
        frase_cifra = frase_con(cuerpo, prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)

    plazos = []
    for n, plazo, texto, prueba in PLAZOS:
        medida = por_numero[n]
        if prueba not in f"{medida['titulo']} {medida['texto']}":
            raise ValueError(f'El plazo «{plazo}» no aparece en la propuesta {n}: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': n})

    return {
        'id': ID,
        'partido': 'Junts per Catalunya',
        'siglas': 'JxCat',
        'comunidad': 'Cataluña',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Programa electoral 29N',
        'subtitulo': 'Catalunya al centre. L’agenda catalana de Junts per Catalunya',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'El programa está en catalán. El PDF no numera las propuestas de forma global: cada capítulo tiene '
            'puntos de programa con un código propio («1.1.», «5.3.»), que se repite en cada capítulo. El número de '
            'propuesta es correlativo, en el orden del documento.',
            'Solo cuentan como propuestas los «Punts de programa» de cada capítulo. Los apartados «Competències» '
            '(lo que Junts quiere proteger y reclamar) y «Objectius» describen el marco de cada capítulo y los '
            'puntos de programa lo concretan. El «Retiment de comptes» y el anexo «Principals iniciatives de la '
            'legislatura» son un balance de lo hecho y no se cuentan.',
            'Cada punto de programa no tiene título propio: el título es su primera frase y el texto, el resto.',
            'La taxonomía común no tiene una categoría de protección animal ni de deporte. Los animales van a la '
            'categoría más cercana (Código Penal → Justicia, impuestos → Impuestos, ganadería y alimentación → '
            'Campo, mar y mundo rural) y el deporte a Lengua, cultura y memoria.',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {'titulo': 'Introducció', 'texto': '\n\n'.join(presentacion)},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def main():
    pdf, salida = sys.argv[1], sys.argv[2]
    programa = crear_programa(pdf)
    with open(salida, 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    if '--depurar' in sys.argv:
        volcado = sys.argv[sys.argv.index('--depurar') + 1]
        secciones = {s['id']: s for s in programa['secciones']}
        with open(volcado, 'w', encoding='utf-8') as archivo:
            seccion = None
            subapartado = None
            for medida in programa['medidas']:
                if medida['seccion'] != seccion:
                    seccion, subapartado = medida['seccion'], None
                    s = secciones[seccion]
                    archivo.write(f"\n######## {seccion} p.{s['pagina']} {s['titulo']}\n{s['intro']}\n")
                if medida['subapartado'] != subapartado:
                    subapartado = medida['subapartado']
                    archivo.write(f"\n=== {secciones[seccion]['subapartados'][subapartado]['titulo']}\n")
                archivo.write(f"\n### {medida['n']} p.{medida['pagina']} {medida['categoria']} | {medida['titulo']}\n")
                if medida['texto']:
                    archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'secciones', len(programa['secciones']),
          'propuestas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
