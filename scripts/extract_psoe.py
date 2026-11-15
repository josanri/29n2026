"""Extrae el programa del PSOE («La fuerza de seguir avanzando», elecciones generales 2026) al esquema compartido.

Estructura del PDF (114 páginas, A4, exportado desde Word con Acrobat PDFMaker; Geomanist y Arial):
- Página 1: portada. Páginas 2-4: índice (Geomanist-Medium 10 pt rojo, los capítulos; Arial 10 pt, las secciones
  en x = 83 y los apartados en x = 94). El índice es la referencia: el script para si un capítulo o una sección
  del índice no está en el cuerpo o al revés.
- Páginas 6-10: «La fuerza de seguir avanzando», la presentación, sin medidas.
- Cada capítulo abre con una página de imagen (el lema en Geomanist-Black blanco, que se ignora) y su título en
  Geomanist-Medium 22 pt rojo, con una introducción en Arial 11 pt (x = 72).
- Secciones: Geomanist-Regular 18 pt rojo, con su introducción. Apartados: Arial-Italic 13,9 pt rojo (los del
  índice) o Geomanist-Medium 11 pt rojo (encabezados menores, como «En la compra de vivienda»). La etiqueta
  «Compromisos» (Geomanist-Medium 10,9-11 pt) separa la introducción de las medidas.
- Medidas: numeradas del 1 al 500 sin saltos. El número («1.») va en Geomanist-Bold 11 pt rojo (x = 86) y el
  texto en Arial 11 pt (x = 115); la primera frase, en negrita (Arial-Bold), es el título. Las listas internas
  usan «o» (Courier New, x = 108) o «a.», «b.» (x = 144).
- Pie: el número de página (Geomanist-Regular 12 pt rojo, y > 770). Los círculos blancos con números son adorno.

Esquema: cada capítulo es un bloque; cada sección (18 pt), una sección; los apartados, subapartados de su
sección. `n` es el número del PDF. Las tablas de este script usan ese número.

Uso: python scripts/extract_psoe.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'psoe'
PDF_PUBLICO = '/programas/psoe-la-fuerza-de-seguir-avanzando-2026.pdf'
FUENTE = 'https://www.psoe.es/media-content/2026/11/PROGRAMAPSOE29N26.pdf'
FECHA_PDF = '2026-11-15'  # modDate de los metadatos (el PDF se creó el 14 y se modificó el 15)
PAGINAS = 114
TOTAL_MEDIDAS = 500
ROJO = 0xEE0000
BLANCO = 0xFFFFFF
PRIMERA_PAGINA_CUERPO = 6

# Categoría de cada sección (la base), por su id «capítulo.sección», y excepciones medida a medida.
CATEGORIA_SECCION = {
    '1.1': 'innovacion', '1.2': 'innovacion', '1.3': 'innovacion', '1.4': 'infraestructuras', '1.5': 'innovacion',
    '2.1': 'vivienda', '2.2': 'vivienda', '2.3': 'vivienda', '2.4': 'vivienda', '2.5': 'vivienda', '2.6': 'vivienda',
    '2.7': 'vivienda', '2.8': 'vivienda',
    '3.1': 'social', '3.2': 'social', '3.3': 'empleo',
    '4.1': 'administracion', '4.2': 'fiscalidad', '4.3': 'sanidad', '4.4': 'educacion', '4.5': 'educacion',
    '4.6': 'educacion', '4.7': 'identidad', '4.8': 'social', '4.9': 'social', '4.10': 'territorio',
    '5.1': 'energia', '5.2': 'emergencias', '5.3': 'rural', '5.4': 'rural', '5.5': 'energia',
    '6.1': 'empleo', '6.2': 'familia', '6.3': 'sanidad', '6.4': 'seguridad', '6.5': 'seguridad', '6.6': 'democracia',
    '7.1': 'democracia', '7.2': 'empleo', '7.3': 'territorio', '7.4': 'inmigracion', '7.5': 'social',
    '7.6': 'innovacion', '7.7': 'social', '7.8': 'identidad', '7.9': 'seguridad', '7.10': 'justicia',
    '7.11': 'administracion', '7.12': 'democracia', '7.13': 'identidad',
    '8.1': 'exterior', '8.2': 'exterior', '8.3': 'exterior', '8.4': 'exterior', '8.5': 'exterior', '8.6': 'exterior',
    '8.7': 'defensa',
}
# Apartados con otra categoría que su sección: (sección, índice del apartado).
CATEGORIA_APARTADO = {
    ('4.8', 0): 'familia',           # Infancia, adolescencia y familias
    ('5.2', 1): 'infraestructuras',  # Agua garantizada
    ('5.3', 2): 'infraestructuras',  # Movilidad sostenible
    ('7.6', 0): 'familia',           # Proteger a la infancia y la juventud en los entornos digitales
}
CATEGORIA_MEDIDA = {
    5: 'territorio', 7: 'administracion', 19: 'administracion', 20: 'infraestructuras', 33: 'energia', 73: 'fiscalidad',
    87: 'empleo', 88: 'fiscalidad', 90: 'empleo', 91: 'empleo', 92: 'empleo', 94: 'fiscalidad',
    95: 'innovacion', 105: 'familia', 112: 'justicia', 127: 'fiscalidad', 128: 'infraestructuras', 129: 'territorio',
    157: 'familia', 164: 'energia', 165: 'identidad', 194: 'justicia', 200: 'inmigracion', 210: 'sanidad',
    216: 'vivienda', 223: 'justicia', 224: 'educacion', 227: 'empleo', 233: 'rural', 241: 'fiscalidad',
    243: 'innovacion', 244: 'empleo', 248: 'administracion', 253: 'energia', 256: 'vivienda', 275: 'territorio',
    294: 'innovacion', 298: 'emergencias', 301: 'emergencias', 310: 'innovacion', 311: 'educacion', 313: 'educacion',
    314: 'social', 315: 'social', 317: 'rural', 319: 'empleo', 340: 'sanidad', 344: 'educacion',
    345: 'educacion', 347: 'familia', 354: 'innovacion', 356: 'familia', 358: 'familia', 361: 'administracion',
    365: 'social', 369: 'social', 370: 'familia', 373: 'justicia', 374: 'democracia', 375: 'democracia',
    376: 'democracia', 378: 'educacion', 379: 'sanidad', 380: 'identidad', 381: 'vivienda', 385: 'identidad',
    409: 'empleo', 416: 'sanidad', 417: 'educacion', 418: 'exterior', 430: 'emergencias', 438: 'vivienda',
    457: 'fiscalidad', 458: 'fiscalidad', 466: 'energia', 474: 'territorio', 478: 'innovacion', 479: 'inmigracion',
    482: 'defensa', 489: 'democracia', 492: 'democracia', 498: 'emergencias',
}

# Derogaciones explícitas, por número. Se comprueba que la medida dice «derog».
DEROGA = {}

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes\b|\bjuventud\b',
    'mayores': r'\bpersonas mayores\b|\bpensionistas?\b|\blongevidad\b|\bresidencias\b',
    'mujeres': r'\bmujer(?:es)?\b|violencia machista|violencia de g[eé]nero|\bmaternidad\b',
    'familias': r'\bfamilias?\b|conciliaci[oó]n|\bcrianza\b',
    'infancia': r'\binfancia\b|\bniñ[oa]s\b|\bmenores\b|\balumnado\b|\badolescen\w*',
    'autonomos': r'\baut[oó]nom[oa]s\b|\bpymes\b|emprendedor\w*|\bemprendimiento\b',
    'empresas': r'\bempresas?\b|\bindustria\b',
    'rural': r'\bmundo rural\b|\bmedio rural\b|\bagricultor\w*|\bganader\w*|despoblaci[oó]n|\bpesca\b|\breto demogr[aá]fico\b',
    'funcionarios': r'\bempleados? p[uú]blicos?\b|\bempleo p[uú]blico\b|\bfuncionari\w*',
    'discapacidad': r'\bdiscapacidad\b|\bdependencia\b',
    'victimas': r'\bv[ií]ctimas\b',
    'inmigrantes': r'\bmigrantes?\b|\binmigra\w*|\brefugiad\w*|\basilo\b|\bextranjer\w*',
    'pacientes': r'\bpacientes\b|\bsanidad p[uú]blica\b|\bSistema Nacional de Salud\b|\blistas de espera\b',
    'agentes': r'\bFuerzas y Cuerpos de Seguridad\b|\bGuardia Civil\b|\bPolic[ií]a Nacional\b|\bpolic[ií]as?\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|\bderog\w*|\breform\w*|\blegislaci[oó]n\b|\bprohibi\w*|C[oó]digo Penal|\bnormativa\b|\bregulaci[oó]n\b',
    'impuestos': r'\bIVA\b|\bIRPF\b|\bfiscal\w*|\bimpuestos?\b|\bdeducci\w*|\btribut\w*',
    'gasto': r'\binversi[oó]n\b|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b|\bayudas?\b|\bsubvenci\w*|\bdotaci[oó]n\b',
    'organizacion': r'\bcrearemos\b|\bcreaci[oó]n\b|\bagencia\b|\borganismo\b|\bobservatorio\b|\bautoridad\b|\bregistro\b|\bventanilla\b',
    'plan': r'\bplan(?:es)?\b|\bestrategia\b|\bprogramas?\b|\bpacto\b|\bcampañas?\b|\bprotocolos?\b',
}

TERRITORIOS = {
    'Unión Europea': r'\bUni[oó]n Europea\b|\beurope[oa]s?\b|\bUE\b|\bBruselas\b',
    'Canarias': r'\bCanarias\b',
    'Illes Balears': r'\bBaleares\b|\bIlles Balears\b',
    'Ceuta': r'\bCeuta\b',
    'Melilla': r'\bMelilla\b',
    'Cataluña': r'\bCatalu[ñn]a\b',
    'Valencia': r'\bDANA\b|\bValencia\b',
    'Iberoamérica': r'\bIberoam[eé]rica\b|\bAm[eé]rica Latina\b|\bLatinoam[eé]rica\b',
    'Palestina': r'\bPalestina\b|\bGaza\b',
    'Ucrania': r'\bUcrania\b',
}

# Cifras: solo compromisos cuantificados. (valor, unidad, texto, número de medida, prueba literal)
CIFRAS = [
    ('1,5 %', 'del PIB en I+D', 'Inversión pública en I+D para 2035', 8, 'aumentando la ambición en este objetivo hasta el 1,5% del PIB para 2035'),
    ('1 %', 'del PIB al año', 'Para garantizar el acceso a la vivienda', 38, 'Movilizar anualmente un 1% del PIB para garantizar el acceso a la vivienda'),
    ('100.000', 'viviendas', 'Parque público estatal de vivienda', 42, 'Constituir un parque público estatal de 100.000 viviendas'),
    ('60 %', 'del salario medio', 'El SMI, blindado por ley por encima de esa cifra', 87, 'Blindar por ley el SMI por encima del 60% del salario medio'),
    ('30 %', 'pensión de orfandad', 'Del 20 % actual al 30 %', 106, 'Elevar del 20% al 30 % la pensión de orfandad'),
    ('37,5', 'horas semanales', 'Completar la reducción de la jornada', 108, 'Completar la reducción de la jornada a 37,5 horas'),
    ('35 %', 'tipo máximo', 'Para las rentas del capital de más de 300.000 €', 130, 'llegando progresivamente a un tipo máximo del 35% para rentas del capital superiores a 300.000€'),
    ('0,4 %', 'tasa Tobin', 'El impuesto a las transacciones financieras, del 0,2 al 0,4 %', 135, 'aumentando el tipo impositivo del 0,2% al 0,4%'),
    ('7 %', 'del PIB', 'Financiación pública de la sanidad', 136, 'consolidando una financiación pública de la sanidad en torno al 7% del PIB'),
    ('1.000 €', 'al nacer', 'Cuenta pública invertida para cada niño o niña', 193, 'Asignar al nacer a cada niño o niña una cuenta pública de 1.000 euros invertida en fondos públicos'),
    ('83.000 M€', 'de deuda autonómica', 'Que asume el Estado', 231, 'asunción parcial por el Estado de 83.000 millones de euros de deuda autonómica'),
    ('81 %', 'de electricidad renovable', 'Generación eléctrica renovable en 2030', 234, 'para alcanzar el 81% de generación eléctrica en 2030'),
    ('15 €', 'al mes', 'Abono de cine para menores de 25 años', 453, 'Crear un abono de cine de 15 euros al mes para menores de 25 años'),
    ('0,7 %', 'de la RNB', 'Ayuda Oficial al Desarrollo', 459, 'cerrar la brecha con el 0,7 % de la RNB en Ayuda Oficial al Desarrollo'),
]
# Otros compromisos cuantificados que no van en la cabecera. (número, prueba literal)
CIFRAS_MEDIDA = [
    (32, 'con una inversión de 1.629 millones de euros'),
    (32, 'reparar los firmes de 5.000 km de la red estatal en los próximos cuatro años'),
    (40, 'Destinar el 1% de la licitación anual de obra pública a constituir un fondo de adquisición de vivienda protegida y asequible'),
    (41, 'con el objetivo de que supongan al menos la cuarta parte del total de nuevas viviendas'),
    (55, 'Disponer más de 25.000 millones de euros, a través del ICO, para avales, préstamos y financiación para vivienda asequible'),
    (56, 'Destinar más de 4.700 millones de euros del Plan Social del Clima para financiar la construcción o rehabilitación de viviendas sostenibles a precio asequible'),
    (57, 'Destinar 400 millones de euros anuales en el Fondo de Vivienda de Impacto Social'),
    (59, 'para alcanzar, al menos, otras 550.000 viviendas'),
    (101, 'reconociendo además un año adicional de cotización por cada hijo o hija'),
    (102, 'con una prestación del 75 % de la base reguladora desde el inicio de la baja'),
    (105, 'cubra cuatro semanas del permiso parental para el cuidado de hijos menores de ocho años con el 100 % de la base reguladora'),
    (105, 'reconociendo una semana adicional para el segundo progenitor'),
    (108, 'incentivar los avances en la negociación colectiva hacia las 35 horas'),
    (119, 'buscando reducir el 20% de desempleo femenino de larga duración'),
    (124, 'Garantizar el cumplimiento efectivo de la cuota de reserva del 2% de empleo para personas con discapacidad'),
    (128, 'empezando por los 19.000 millones de euros comprometidos con el ferrocarril hasta 2030'),
    (137, 'crearemos una ayuda directa de hasta 200 euros anuales por persona'),
    (143, 'con una primera consulta en un plazo máximo de 30 días'),
    (160, 'Reducir la tasa de abandono escolar temprano por debajo del 10% antes de 2030'),
    (161, 'alcanzando una ratio de un profesional de orientación por cada 250 estudiantes'),
    (178, 'Aseguraremos becas Erasmus al alcance de hasta 1.000 y 1.500€ mensuales, en función de los ingresos.'),
    (229, 'que aporta 21.000 millones de euros adicionales'),
    (246, 'Reducir el vertido de residuos por debajo del 30 % en 2030'),
    (288, 'hasta el 10% de las áreas marinas con protección estricta'),
    (288, 'protegiendo al menos el 30 % de los ecosistemas'),
    (388, 'con una dotación inicial de 500 millones de euros y la colaboración de las administraciones públicas y los agentes sociales'),
    (406, 'con sanciones de hasta 35 millones de euros'),
    (436, 'con un mandato de cinco años para la Fiscalía General del Estado'),
]
# Plazos: solo cuándo se aplica la medida. (número, plazo, texto, prueba literal)
PLAZOS = [
    (8, 'Para 2035', 'Impulsar la innovación para transformar la economía', 'para 2035'),
    (32, 'En cuatro años', 'Renovar la red viaria. Impulsaremos la conservación, modernización y mejora de l', 'en los próximos cuatro años'),
    (98, 'En la próxima legislatura', 'Seguir desplegando las medidas de refuerzo del sistema público de pensiones y de', 'completar su aplicación durante la próxima legislatura'),
    (125, 'En la primavera de 2027', 'Presentar a la Comisión Europea, en la primavera de 2027, un nuevo Plan Fiscal y', 'en la primavera de 2027'),
    (128, 'Hasta 2030', 'Proteger la inversión que sostiene el crecimiento', 'hasta 2030'),
    (160, 'Antes de 2030', 'Reducir la tasa de abandono escolar temprano por debajo del 10% antes de 2030', 'antes de 2030'),
    (234, 'En 2030', 'Impulsar el despliegue de energías renovables', 'para alcanzar el 81% de generación eléctrica en 2030'),
    (240, 'Hasta 2035', 'Mantener el calendario de cierre de las centrales nucleares hasta 2035 y desarro', 'calendario de cierre de las centrales nucleares hasta 2035'),
    (246, 'En 2030', 'Reducir el vertido de residuos por debajo del 30 % en 2030', 'por debajo del 30 % en 2030'),
    (399, 'En el primer año de legislatura', 'Establecer a 16 años la edad mínima para usar redes sociales', 'Aprobar en el primer año de legislatura'),
]
ORDEN_PLAZOS = ['En el primer año de legislatura', 'En la primavera de 2027', 'En cuatro años', 'En la próxima legislatura',
                'Antes de 2030', 'En 2030', 'Hasta 2030', 'Hasta 2035', 'Para 2035']

NUMERO_RE = re.compile(r'^(\d{1,3})\.\s*')


def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    texto = texto.replace('​', '').replace('\xa0', ' ').replace('\xad', '').replace('\t', ' ')
    return re.sub(r'\s+', ' ', texto).strip()


def lineas(documento):
    """Las líneas de cada página con sus piezas (spans) de izquierda a derecha, sin pie ni adornos blancos."""
    for numero, pagina in enumerate(documento, start=1):
        piezas = []
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip() and s['color'] != BLANCO]
                if not spans or linea['bbox'][1] > 770:
                    continue
                piezas.append({'y': linea['bbox'][1], 'spans': spans})
        piezas.sort(key=lambda p: p['y'])
        filas = []
        for pieza in piezas:
            if filas and abs(filas[-1]['y'] - pieza['y']) < 3:
                filas[-1]['spans'].extend(pieza['spans'])
            else:
                filas.append({'y': pieza['y'], 'spans': list(pieza['spans'])})
        for fila in filas:
            spans = sorted(fila['spans'], key=lambda s: s['bbox'][0])
            primero = spans[0]
            yield {
                'pagina': numero,
                'y': round(fila['y'], 1),
                'x': round(primero['bbox'][0]),
                'spans': spans,
                'texto': limpiar(' '.join(s['text'] for s in spans)),
                'fuente': primero['font'],
                'tam': round(primero['size'], 1),
                'rojo': primero['color'] == ROJO,
            }


def es_capitulo(fila):
    return fila['rojo'] and 'Geomanist-Medium' in fila['fuente'] and fila['tam'] > 20


def es_seccion(fila):
    return fila['rojo'] and 'Geomanist-Regular' in fila['fuente'] and 17 < fila['tam'] < 19


def es_apartado(fila):
    if not fila['rojo'] or fila['texto'] == 'Compromisos':
        return False
    italica = 'Italic' in fila['fuente'] and 13 < fila['tam'] < 15 and fila['x'] < 80
    menor = 'Geomanist-Medium' in fila['fuente'] and 10.5 < fila['tam'] < 11.5 and fila['x'] < 80
    return italica or menor


def clave(texto):
    """El texto sin espacios, puntuación ni mayúsculas, para comparar el índice con el cuerpo."""
    texto = unicodedata.normalize('NFD', texto.lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in texto if unicodedata.category(c) != 'Mn'))


def leer_indice(filas):
    """Capítulos, secciones y apartados del índice (páginas 2-4), en orden. Un título largo ocupa dos líneas:
    la primera no tiene puntos de guía."""
    entradas, pendiente = [], None
    for fila in filas:
        if fila['pagina'] not in (2, 3, 4) or fila['tam'] > 11 or re.fullmatch(r'\d+', fila['texto']):
            continue
        nivel = 'capitulo' if fila['rojo'] else ('apartado' if fila['x'] > 90 else 'seccion')
        texto = fila['texto']
        completa = '...' in texto or re.search(r'\s\d{1,3}$', texto)
        texto = re.sub(r'\s*\.{3,}.*$', '', texto)
        texto = re.sub(r'[\s.]+\d{1,3}\s*$', '', texto).strip()  # «… digital . 84»
        if pendiente:
            texto = f"{pendiente['texto']} {texto}"
            nivel = pendiente['nivel']
            pendiente = None
        if not completa:
            pendiente = {'texto': texto, 'nivel': nivel}
            continue
        entradas.append({'nivel': nivel, 'titulo': limpiar(texto)})
    return entradas


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    filas = list(lineas(documento))
    indice = leer_indice(filas)
    cuerpo = [f for f in filas if f['pagina'] >= PRIMERA_PAGINA_CUERPO]

    presentacion = []           # párrafos (título de sección + texto) de la presentación
    capitulos = []              # {titulo, pagina, intro: [parrafos], secciones: [...]}
    medidas = []                # {n, capitulo, seccion, apartado, pagina, piezas: [(texto, negrita)], parrafos}
    destino = presentacion      # lista de párrafos que recibe el texto corrido
    parrafo, previa = [], None
    medida = None
    en_presentacion = True
    i = 0

    def cerrar():
        nonlocal parrafo
        if parrafo:
            destino.append(limpiar(' '.join(parrafo)))
            parrafo = []

    def juntar(condicion):
        nonlocal i
        partes = [cuerpo[i]['texto']]
        while i + 1 < len(cuerpo) and condicion(cuerpo[i + 1]) and cuerpo[i + 1]['pagina'] == cuerpo[i]['pagina']:
            i += 1
            partes.append(cuerpo[i]['texto'])
        return limpiar(' '.join(partes))

    while i < len(cuerpo):
        fila = cuerpo[i]
        if es_capitulo(fila):
            cerrar()
            titulo = juntar(es_capitulo)
            medida = None
            if not capitulos and en_presentacion and fila['pagina'] < 11:
                # «La fuerza de seguir avanzando»: la presentación.
                destino = presentacion
            else:
                en_presentacion = False
                capitulos.append({'titulo': titulo, 'pagina': fila['pagina'], 'intro': [], 'secciones': []})
                destino = capitulos[-1]['intro']
            previa = None
            i += 1
            continue
        if es_seccion(fila):
            cerrar()
            titulo = juntar(es_seccion)
            medida = None
            if en_presentacion:
                destino = presentacion
                presentacion.append(f'§ {titulo}')
            else:
                seccion = {'titulo': titulo, 'pagina': fila['pagina'], 'intro': [], 'apartados': []}
                capitulos[-1]['secciones'].append(seccion)
                destino = seccion['intro']
            previa = None
            i += 1
            continue
        if es_apartado(fila):
            cerrar()
            titulo = juntar(es_apartado)
            medida = None
            seccion = capitulos[-1]['secciones'][-1]
            seccion['apartados'].append({'titulo': titulo, 'intro': []})
            destino = seccion['apartados'][-1]['intro']
            previa = None
            i += 1
            continue
        if fila['texto'] == 'Compromisos':
            cerrar()
            previa = None
            i += 1
            continue

        numero = NUMERO_RE.match(fila['texto']) if (fila['rojo'] and 'Geomanist-Bold' in fila['fuente']
                                                     and 80 < fila['x'] < 95) else None
        if numero:
            cerrar()
            capitulo = capitulos[-1]
            seccion = capitulo['secciones'][-1]
            medida = {
                'n': int(numero.group(1)),
                'capitulo': len(capitulos),
                'seccion': len(capitulo['secciones']),
                'apartado': len(seccion['apartados']) - 1 if seccion['apartados'] else None,
                'pagina': fila['pagina'],
                'parrafos': [],
                'titulo': None,
            }
            medidas.append(medida)
            destino = medida['parrafos']
            # Título: la negrita del principio, sin el número. El resto de la línea ya es texto.
            spans = list(fila['spans'])
            spans[0] = dict(spans[0], text=NUMERO_RE.sub('', spans[0]['text'].lstrip()))
            medida['_piezas'] = [(s['text'], 'Bold' in s['font']) for s in spans]
            previa = fila
            i += 1
            continue

        if medida is not None and fila['x'] >= 80:
            vineta = 'CourierNew' in fila['fuente'] or re.match(r'^[a-z]\.\s', fila['texto'])
            if vineta or (previa is not None and fila['pagina'] == previa['pagina'] and fila['y'] - previa['y'] > 26):
                medida.setdefault('_lineas', []).append(None)  # salto de párrafo
            texto = fila['texto']
            if 'CourierNew' in fila['fuente']:
                texto = '– ' + re.sub(r'^o\s*', '', texto)
            medida.setdefault('_lineas', []).append((texto, fila['spans']))
            previa = fila
            i += 1
            continue

        if medida is not None and fila['x'] < 80:
            # Una viñeta suelta a la altura de la introducción tras una medida (página 71, «●Acercar la
            # Administración…»): el documento le quitó el número. Va con la medida anterior como un punto más.
            medida.setdefault('_lineas', []).append(None)
            medida['_lineas'].append(('– ' + fila['texto'].lstrip('●').strip(), fila['spans']))
            previa = fila
            i += 1
            continue

        # Texto corrido: introducción del capítulo, la sección o el apartado, o la presentación.
        if previa is not None and (fila['pagina'] != previa['pagina'] and re.search(r'[.:;]$', ' '.join(parrafo))
                                   or fila['pagina'] == previa['pagina'] and fila['y'] - previa['y'] > 24):
            cerrar()
        if fila['texto'].startswith('●'):
            cerrar()
            parrafo.append('– ' + fila['texto'].lstrip('●').strip())
        else:
            parrafo.append(fila['texto'])
        previa = fila
        i += 1
    cerrar()

    # Título y texto de cada medida: la negrita inicial es el título.
    for medida in medidas:
        piezas = list(medida.pop('_piezas'))
        lineas_medida = medida.pop('_lineas', [])
        titulo, texto, en_titulo = [], [], True
        for texto_pieza, negrita in piezas:
            if en_titulo and (negrita or not texto_pieza.strip()):
                titulo.append(texto_pieza)
            else:
                en_titulo = False
                texto.append(texto_pieza)
        parrafos, actual = [], [' '.join(texto)]
        for linea in lineas_medida:
            if linea is None:
                parrafos.append(actual)
                actual = []
                continue
            texto_linea, spans = linea
            if en_titulo and all('Bold' in s['font'] for s in spans) and not texto_linea.startswith('–'):
                titulo.append(texto_linea)
                continue
            if en_titulo and not texto_linea.startswith('–'):
                # La negrita termina a mitad de línea: lo que va en negrita al principio aún es título.
                resto = []
                for span in spans:
                    if en_titulo and 'Bold' in span['font']:
                        titulo.append(span['text'])
                    else:
                        en_titulo = False
                        resto.append(span['text'])
                actual.append(' '.join(resto))
                continue
            en_titulo = False
            actual.append(texto_linea)
        parrafos.append(actual)
        medida['titulo'] = limpiar(' '.join(titulo))
        medida['texto'] = '\n\n'.join(p for p in (limpiar(' '.join(x)) for x in parrafos) if p)

    # Comprobaciones: 500 medidas seguidas y el mismo índice que el cuerpo.
    numeros = [m['n'] for m in medidas]
    if numeros != list(range(1, TOTAL_MEDIDAS + 1)):
        raise ValueError(f'La numeración no va del 1 al {TOTAL_MEDIDAS} sin saltos')
    del_cuerpo = []
    for capitulo in capitulos:
        del_cuerpo.append(('capitulo', clave(capitulo['titulo'])))
        for seccion in capitulo['secciones']:
            del_cuerpo.append(('seccion', clave(seccion['titulo'])))
            for apartado in seccion['apartados']:
                del_cuerpo.append(('apartado', clave(apartado['titulo'])))
    del_indice = [(e['nivel'], clave(e['titulo'])) for e in indice]
    # El índice no recoge los encabezados menores (Geomanist-Medium 11 pt): solo se comparan los que tiene.
    del_cuerpo_filtrado = [e for e in del_cuerpo if e in del_indice or e[0] != 'apartado']
    presentacion_indice = [e for e in del_indice[:4]]
    if del_indice[4:] != del_cuerpo_filtrado:
        faltan = [e for e in del_indice[4:] if e not in del_cuerpo_filtrado]
        sobran = [e for e in del_cuerpo_filtrado if e not in del_indice]
        raise ValueError(f'El índice y el cuerpo no coinciden. Faltan: {faltan}. Sobran: {sobran}')
    return documento, presentacion, presentacion_indice, capitulos, medidas


def coincidencias(texto, patrones):
    return [clave_ for clave_, patron in patrones.items() if re.search(patron, texto)]


def frase_con(texto, prueba):
    for parte in re.split(r'(?<=[.!?])\s+|\n\n', texto):
        if prueba in parte:
            return parte.strip().lstrip('– ').strip()
    return prueba


def frase_corta(texto):
    texto = texto.strip().rstrip(' .')
    if len(texto) > 125:
        texto = texto[:122].rsplit(' ', 1)[0] + '…'
    return texto


def crear_programa(pdf):
    documento, presentacion, _, capitulos, piezas = extraer(pdf)
    bloques, secciones = [], []
    for b, capitulo in enumerate(capitulos, start=1):
        bloques.append({
            'id': b,
            'titulo': capitulo['titulo'],
            'tituloMayus': capitulo['titulo'].upper(),
            'lema': '',
            'cita': '',
            'intro': '\n\n'.join(capitulo['intro']),
            'pagina': capitulo['pagina'],
        })
        for s, seccion in enumerate(capitulo['secciones'], start=1):
            secciones.append({
                'id': f'{b}.{s}',
                'bloque': b,
                'titulo': seccion['titulo'],
                'tituloFrase': frase_corta(seccion['titulo']),
                'intro': '\n\n'.join(seccion['intro']),
                'pagina': seccion['pagina'],
                'subapartados': [{'titulo': a['titulo'], 'intro': '\n\n'.join(a['intro'])} for a in seccion['apartados']],
            })

    medidas, por_numero = [], {}
    for pieza in piezas:
        seccion_id = f"{pieza['capitulo']}.{pieza['seccion']}"
        apartado = (seccion_id, pieza['apartado'])
        categoria = CATEGORIA_MEDIDA.get(pieza['n']) or CATEGORIA_APARTADO.get(apartado) or CATEGORIA_SECCION.get(seccion_id)
        if not categoria:
            raise ValueError(f'Falta la categoría de la sección {seccion_id} (medida {pieza["n"]})')
        # La negrita es el título solo cuando es una frase entera («Impulsar una nueva política industrial…»).
        # Cuando acaba a mitad de frase (el texto sigue con «, el hidrógeno…» o en minúscula), la medida se lee
        # entera como texto y la negrita queda como título corto. Sin negrita, el título corto es la primera frase.
        titulo, texto = pieza['titulo'], pieza['texto']
        if titulo and texto.startswith('.'):
            # La negrita acaba justo antes del punto: el punto cierra el título.
            titulo, texto = f'{titulo}.', texto[1:].strip()
        frase_titulo = None
        if titulo and (not texto or not re.search(r'[.:!?]$', titulo) or re.match(r'^[,;:)a-záéíóúñ]', texto)):
            frase_titulo = titulo.rstrip(' .:,;')
            separador = '' if re.match(r'^[,;:.)]', texto) else ' '
            texto = f'{titulo}{separador}{texto}'.strip() if texto else titulo
            titulo = ''
        primera = re.split(r'(?<=[.!?])\s+', texto.replace('\n\n', ' '), maxsplit=1)[0]
        pieza = dict(pieza, titulo=titulo, texto=texto, frase=frase_titulo or titulo or primera)
        completo = f"{titulo} {texto}"
        medida = {
            'n': pieza['n'],
            'bloque': pieza['capitulo'],
            'seccion': seccion_id,
            'pagina': pieza['pagina'],
            'subapartado': pieza['apartado'],
            'titulo': pieza['titulo'],
            'tituloFrase': frase_corta(pieza['frase']),
            'texto': pieza['texto'],
            'oculta': False,
            'categoria': categoria,
            'colectivos': coincidencias(completo, COLECTIVOS),
            'palancas': coincidencias(completo, PALANCAS),
            'territorios': coincidencias(completo, TERRITORIOS),
            'cifras': [],
            'plazo': None,
            'deroga': None,
        }
        if pieza['n'] in DEROGA:
            if not re.search(r'derog', completo, re.I):
                raise ValueError(f'La medida {pieza["n"]} no dice «derogar»')
            medida['deroga'] = DEROGA[pieza['n']]
        medidas.append(medida)
        por_numero[pieza['n']] = medida

    cifras = []
    for valor, unidad, texto, n, prueba in CIFRAS:
        medida = por_numero[n]
        cuerpo = f"{medida['titulo']} {medida['texto']}"
        if prueba not in cuerpo:
            raise ValueError(f'La cifra «{valor}» no aparece en la medida {n}: «{prueba}»')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': n})
        frase_cifra = frase_con(cuerpo, prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)
    for n, prueba in CIFRAS_MEDIDA:
        medida = por_numero[n]
        cuerpo = f"{medida['titulo']} {medida['texto']}"
        if prueba not in cuerpo:
            raise ValueError(f'La cifra de la medida {n} no aparece en su texto: «{prueba}»')
        frase_cifra = frase_con(cuerpo, prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)

    plazos = []
    for n, plazo, texto, prueba in PLAZOS:
        medida = por_numero[n]
        if prueba not in f"{medida['titulo']} {medida['texto']}":
            raise ValueError(f'El plazo «{plazo}» no aparece en la medida {n}: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': n})

    # Los compromisos empiezan en infinitivo («Impulsar…», «Reforzar…»): la web calcula la lista de verbos
    # (src/lib/verbs.ts). El futuro («impulsaremos») aparece en el desarrollo, mucho menos.
    # La presentación: los párrafos con «§ » son sus títulos.
    texto_presentacion = '\n\n'.join(p[2:] if p.startswith('§ ') else p for p in presentacion)
    return {
        'id': ID,
        'partido': 'Partido Socialista Obrero Español',
        'siglas': 'PSOE',
        'color': '#e30613',
        'colorClaro': '#f2a4a9',
        'programa': 'La fuerza de seguir avanzando',
        'subtitulo': f'{len(medidas)} compromisos en {len(bloques)} capítulos',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'La web del partido protege sus archivos frente a las descargas automáticas: el PDF se obtuvo de una '
            'copia facilitada a la redacción, idéntica a la publicada en psoe.es.',
            'En la página 71, un punto sin número («Acercar la Administración General del Estado a la '
            'ciudadanía…») sigue a la medida 279: va con ella, como un punto más.',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'compromiso',
        'unidadMedidas': 'compromisos',
        'presentacion': {'titulo': 'La fuerza de seguir avanzando', 'texto': texto_presentacion},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': [p for p in ORDEN_PLAZOS if any(x['plazo'] == p for x in plazos)],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }, por_numero


def main():
    pdf, salida = sys.argv[1], sys.argv[2]
    programa, por_numero = crear_programa(pdf)
    with open(salida, 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    if '--depurar' in sys.argv:
        volcado = sys.argv[sys.argv.index('--depurar') + 1]
        secciones = {s['id']: s for s in programa['secciones']}
        with open(volcado, 'w', encoding='utf-8') as archivo:
            actual = None
            for medida in programa['medidas']:
                if medida['seccion'] != actual:
                    actual = medida['seccion']
                    archivo.write(f"\n## {actual} {secciones[actual]['titulo']}\n")
                apartado = medida['subapartado']
                sub = f" [{secciones[actual]['subapartados'][apartado]['titulo']}]" if apartado is not None else ''
                archivo.write(f"\n### {medida['n']} p.{medida['pagina']} {medida['categoria']}{sub} | {medida['titulo']}\n")
                archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
