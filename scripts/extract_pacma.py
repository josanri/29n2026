"""Extrae el programa de PACMA (Elecciones generales 2026) al esquema compartido.

Estructura del PDF (82 páginas, maquetado en Pages; tipografía Acumin Pro):
- Páginas 2-4: índice. Cada entrada, en Regular 10 pt y color #22d65d, empieza por su código («1.1.8.1»).
  El índice es la referencia: la compilación para si un apartado del índice no está en el cuerpo o al revés.
- Página 5: «Presentación» (Bold 16 pt, verde) y su texto.
- Cuerpo: encabezados en Bold 11 pt verde con el código delante («1.1.», «2.10.Contención…»). El título sigue en
  la misma línea, en una línea negra en negrita a la derecha del código («1.1.1.» + «Ampliación…») o en líneas
  de Bold 12 pt verde debajo. El texto va en Regular 11 pt (con frases en negrita) y las listas en «-» (x = 70,9).
- Pie: el número de página (y ≈ 818). Las letras grandes de la portada usan AcuminVariableConcept: se ignoran.

Niveles de numeración → esquema:
- 1, 2, 3 (los tres compromisos: Animales, Medio Ambiente, Personas) → bloques.
- 1.1 … 3.10 → secciones. Si el apartado tiene subapartados, su texto es la introducción de la sección; si no,
  el apartado entero es una propuesta.
- 1.1.1, 1.1.8.1 … → una propuesta cada uno. Un apartado de tercer nivel con hijos (1.1.8 «Oposición a la caza»,
  3.9.2 «Democracia real y participativa») también es una propuesta: su texto propone algo por sí mismo.
El número de propuesta (`n`) es correlativo (1-102) y el título es el del PDF, sin el código. Las tablas de este
script (categoría, derogaciones, cifras y plazos) usan el código del PDF, que no cambia si se añade un apartado.
Con `--depurar` el script escribe un volcado legible de cada propuesta con su código y su número.

Uso: python scripts/extract_pacma.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'pacma'
PDF_PUBLICO = '/programas/pacma-programa-generales-2026.pdf'
FUENTE = 'https://pacma.es/wp-content/uploads/2026/11/PE_GENERALES_29N26.pdf'
FECHA_PDF = '2026-11-12'
COLOR = '#0BEC52'
COLOR_CLARO = '#91F6B1'
PAGINAS = 82
VERDE = 0x22D65D
PRIMERA_PAGINA_CUERPO = 5

BLOQUES = {
    1: ('Animales', 'Nuestro compromiso con los Animales'),
    2: ('Medio ambiente', 'Nuestro compromiso con el Medio Ambiente'),
    3: ('Personas', 'Nuestro compromiso con las Personas'),
}

# Categoría de cada propuesta, por su código en el PDF. La taxonomía común no tiene una categoría de protección
# animal: cada propuesta va a la más cercana (ver la nota de método y `observaciones`).
# - Ley de Bienestar, maltrato, sanciones, Fiscalía y unidades policiales → «justicia» (marco legal y penal).
# - Caza, ganadería, granjas, pesca, fauna silvestre, montes y biodiversidad → «rural».
# - Tauromaquia, festejos, zoos y espectáculos → «identidad» (cultura y tradiciones).
# - Clima, energía, contaminación, residuos y consumo → «energia».
CATEGORIA = {
    '1.1.1': 'justicia', '1.1.2': 'justicia', '1.1.3': 'justicia', '1.1.4': 'justicia', '1.1.5': 'justicia',
    '1.1.6': 'identidad', '1.1.7': 'identidad', '1.1.8': 'rural', '1.1.8.1': 'rural', '1.1.8.2': 'rural',
    '1.1.9': 'rural', '1.1.10': 'administracion', '1.1.11': 'justicia', '1.1.12': 'fiscalidad',
    '1.1.13': 'justicia', '1.1.14': 'administracion', '1.1.15': 'emergencias', '1.1.16': 'emergencias',
    '1.1.17': 'rural', '1.1.18': 'justicia', '1.1.19': 'administracion', '1.1.20': 'social', '1.1.21': 'sanidad',
    '1.1.22': 'rural', '1.1.23': 'justicia', '1.1.24': 'justicia',
    '1.2.1': 'justicia', '1.2.2': 'justicia', '1.2.3': 'seguridad',
    '1.3': 'educacion',
    '1.4.1': 'rural', '1.4.2': 'rural', '1.4.3': 'rural', '1.4.4': 'rural', '1.4.5': 'rural', '1.4.6': 'rural',
    '1.4.7': 'rural', '1.4.8': 'rural',
    '1.5': 'innovacion', '1.6': 'justicia', '1.7': 'fiscalidad', '1.8': 'justicia',
    '2.1.1': 'energia', '2.1.2': 'energia', '2.1.3': 'infraestructuras', '2.1.4': 'energia',
    '2.2': 'rural', '2.3': 'rural', '2.4': 'rural', '2.5': 'rural', '2.6': 'rural', '2.7': 'rural',
    '2.8': 'energia', '2.9': 'infraestructuras', '2.10': 'rural', '2.11': 'infraestructuras', '2.12': 'rural',
    '2.13': 'rural', '2.14': 'innovacion', '2.15': 'energia',
    '3.1': 'social',
    '3.2.1': 'sanidad', '3.2.2': 'sanidad', '3.2.3': 'sanidad', '3.2.4': 'sanidad', '3.2.5': 'sanidad',
    '3.2.6': 'sanidad', '3.2.7': 'sanidad',
    '3.3.1': 'educacion', '3.3.2': 'educacion', '3.3.3': 'educacion', '3.3.4': 'educacion', '3.3.5': 'educacion',
    '3.3.6': 'identidad', '3.3.7': 'identidad', '3.3.8': 'identidad',
    '3.4.1': 'empleo', '3.4.2': 'familia', '3.4.3': 'empleo', '3.4.4': 'educacion', '3.4.5': 'empleo',
    '3.4.6': 'innovacion', '3.4.7': 'rural', '3.4.8': 'vivienda', '3.4.9': 'empleo',
    '3.5': 'vivienda', '3.6': 'rural', '3.7': 'innovacion', '3.8': 'fiscalidad',
    '3.9.1': 'justicia', '3.9.2': 'democracia', '3.9.2.1': 'democracia', '3.9.2.2': 'democracia',
    '3.9.2.3': 'democracia',
    '3.10.1': 'seguridad', '3.10.2': 'familia', '3.10.3': 'social', '3.10.4': 'social', '3.10.5': 'social',
    '3.10.6': 'inmigracion', '3.10.7': 'social', '3.10.8': 'sanidad',
}

# Derogaciones explícitas («derogar», «derogación»), por código. Se comprueba que la palabra está en el texto.
DEROGA = {
    '1.1.7': 'Ley 18/2013, de la Tauromaquia como patrimonio cultural',
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes\b|\bjuventud\b',
    'mayores': r'\bpersonas mayores\b|\bnuestros/as mayores\b|\bpensionistas?\b|\bresidencias para mayores\b',
    'mujeres': r'\bmujer(?:es)?\b|violencia de g[eé]nero',
    'familias': r'\bfamilias?\b|conciliaci[oó]n',
    'infancia': r'\binfancia\b|\bniñ[oa]s\b|\bmenores de edad\b|\balumnado\b',
    'autonomos': r'\baut[oó]nom[oa]s\b|aut[oó]nomos/as|\bpymes\b|emprendedor',
    'empresas': r'\bempresas?\b|\bindustria\b',
    'rural': r'\bmundo rural\b|\bagricultor\w*|\bganader[oa]s\b|\bmedio rural\b|despoblaci[oó]n',
    'funcionarios': r'\bfuncionari\w*|\bempleados? p[uú]blicos?\b',
    'discapacidad': r'\bdiscapacidad\b|\bdependencia\b',
    'victimas': r'\bv[ií]ctimas\b',
    'inmigrantes': r'\bmigrantes\b|\binmigrantes\b|\brefugiad\w*|\basilo\b',
    'pacientes': r'\bpacientes\b|\bsanidad p[uú]blica\b|\bsistema sanitario\b',
    'agentes': r'\bFuerzas (?:y Cuerpos )?de Seguridad\b|\bGuardia Civil\b|\bpolic[ií]a\b|\bSEPRONA\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|\bderog\w*|\breform\w*|\blegislaci[oó]n\b|\bprohibi\w*|C[oó]digo Penal|\bnormativa\b',
    'impuestos': r'\bIVA\b|\bIRPF\b|\bfiscal\w*|\bimpuestos?\b|\bdeducci\w*|\btribut\w*',
    'gasto': r'\binversi[oó]n\b|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b|\bayudas?\b|\bsubvenci\w*|\bdotaci[oó]n\b',
    'organizacion': r'\bcreaci[oó]n\b|\bcrear\b|\bagencia\b|\borganismo\b|\bDirecci[oó]n General\b|\bunidad(?:es)? especializada|\bregistro\b|\bobservatorio\b',
    'plan': r'\bplan(?:es)?\b|\bestrategia\b|\bprogramas?\b|\bpacto\b|\bcampañas?\b|\bprotocolos?\b',
}

TERRITORIOS = {
    'Unión Europea': r'\bUni[oó]n Europea\b|\bParlamento Europeo\b|\bComisi[oó]n Europea\b',
    'Canarias': r'\bCanarias\b',
    'Doñana': r'\bDoñana\b',
    'Mar Menor': r'\bMar Menor\b',
}

# Cifras clave, elegidas leyendo el programa. Cada prueba debe estar en el texto de su propuesta (por código).
CIFRAS = [
    ('4 %', 'IVA veterinario', 'tipo superreducido para los servicios veterinarios, hoy al 21 %, o incluso su exención', '1.7', 'superreducido del 4%'),
    ('10 %', 'deducción en el IRPF', 'de los gastos veterinarios de las familias con animales, con un límite de renta y un ahorro máximo de 500 € al año', '1.7', 'hasta un 10%'),
    ('30 %', 'del territorio protegido', 'en áreas naturales protegidas para 2030; hoy son el 18 %', '2.10', 'al menos, un 30%'),
    ('5', 'años de prisión', 'o más en el maltrato animal agravado, y sin la multa como pena alternativa', '1.2.1', 'por encima de los cinco años'),
    ('0,7 %', 'del IRPF', 'la casilla de interés social de la Renta, también para la protección animal', '1.1.12', '0,7%'),
    ('100 %', 'bonificación en el IRPF', 'para pequeños propietarios que alquilen un 10 % o un 15 % por debajo del precio de la zona', '3.5', 'bonificaciones del 100% en el IRPF'),
    ('100 %', 'menú vegetal', 'una opción en todos los comedores de los centros educativos', '3.3.1', 'menú 100% vegetal'),
    ('24 h', 'unidades policiales', 'especializadas en violencia machista, los 365 días del año', '3.10.1', 'las 24 horas'),
]

# Plazos: solo cuándo se aplica la propuesta. (código, plazo, texto, prueba literal)
PLAZOS = [
    ('1.1.7', 'De inmediato', 'Retirar toda subvención pública a los espectáculos y festejos con animales', 'la retirada inmediata de toda subvención pública'),
    ('2.10', '2030', 'Áreas naturales protegidas en el 30 % del territorio, como mínimo', 'un 30% para 2030'),
]
ORDEN_PLAZOS = ['De inmediato', '2030']

NO_VERBOS = {'veremos', 'cansaremos'}

CODIGO_RE = re.compile(r'^(\d{1,2}(?:\.\d{1,2}){0,3})\.\s*(.*)$')
INDICE_RE = re.compile(r'^(\d{1,2}(?:\.\d{1,2}){0,3})\s+(.*?)\s*\.{3,}.*$|^(\d{1,2}(?:\.\d{1,2}){0,3})\s+(.*)$')


def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    texto = texto.replace(' ', ' ').replace('­', '').replace('\t', ' ')
    return re.sub(r'\s+', ' ', texto).strip()


def unir(piezas):
    """Une líneas: quita el guion de una palabra cortada al final de línea."""
    resultado = ''
    for pieza in piezas:
        pieza = pieza.strip()
        if not pieza:
            continue
        if re.search(r'[a-záéíóúñ]-$', resultado) and pieza[:1].islower():
            resultado = resultado[:-1] + pieza
        else:
            resultado = f'{resultado} {pieza}'.strip()
    return limpiar(resultado)


def lineas(documento):
    """Las líneas de cada página, con las piezas de la misma altura unidas de izquierda a derecha."""
    for numero, pagina in enumerate(documento, start=1):
        piezas = []
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip() and 'VariableConcept' not in s['font']]
                if not spans:
                    continue
                y = round(linea['bbox'][1], 1)
                if y > 800:  # número de página
                    continue
                piezas.append({'y': y, 'x': linea['bbox'][0], 'spans': spans})
        piezas.sort(key=lambda p: (p['y'], p['x']))
        filas = []
        for pieza in piezas:
            if filas and abs(filas[-1]['y'] - pieza['y']) < 2:
                filas[-1]['spans'].extend(pieza['spans'])
            else:
                filas.append({'y': pieza['y'], 'x': pieza['x'], 'spans': list(pieza['spans'])})
        for fila in filas:
            # De izquierda a derecha: la viñeta «•» (fuente Symbol) queda un poco más baja que su texto.
            spans = sorted(fila['spans'], key=lambda s: s['bbox'][0])
            primero = spans[0]
            texto = ''
            for anterior, span in zip([None] + spans[:-1], spans):
                # Pages no escribe el espacio entre una pieza en negrita y la siguiente: se añade si hay hueco.
                hueco = anterior is not None and span['bbox'][0] - anterior['bbox'][2] > 1
                if hueco and not texto.endswith(' ') and not span['text'].startswith(' '):
                    texto += ' '
                texto += span['text']
            yield {
                'pagina': numero,
                'y': fila['y'],
                'x': fila['x'],
                'texto': texto,
                'negrita': 'Bold' in primero['font'],
                'verde': primero['color'] == VERDE,
                'tam': round(primero['size']),
            }


def leer_indice(filas):
    """Las entradas del índice (páginas 2-4): código, título y nivel, en orden."""
    entradas = []
    for fila in filas:
        if fila['pagina'] < 2 or fila['pagina'] >= PRIMERA_PAGINA_CUERPO or fila['tam'] != 10:
            continue
        texto = re.sub(r'\.{3,}.*$', '', fila['texto']).strip()
        texto = re.sub(r'\s+\d{1,2}$', '', texto).strip()
        coincide = re.match(r'^(\d{1,2}(?:\.\d{1,2}){0,3})\s+(.*)$', texto)
        if fila['verde'] and coincide:
            entradas.append({'codigo': coincide.group(1), 'titulo': limpiar(coincide.group(2))})
        elif entradas and fila['x'] > 55 and texto and not re.fullmatch(r'\d+', texto):
            # segunda línea de un título largo (negra, sangrada como su entrada)
            entradas[-1]['titulo'] = limpiar(f"{entradas[-1]['titulo']} {texto}")
    return entradas


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    filas = list(lineas(documento))
    indice = leer_indice(filas)

    presentacion = []
    apartados = []  # {codigo, titulo, pagina, parrafos}
    actual = None
    parrafo = []
    parrafos_presentacion = []
    previa = None
    i = 0
    cuerpo = [f for f in filas if f['pagina'] >= PRIMERA_PAGINA_CUERPO]

    def destino():
        return actual['parrafos'] if actual is not None else parrafos_presentacion

    def cerrar():
        nonlocal parrafo
        if parrafo:
            destino().append(unir(parrafo))
            parrafo = []

    while i < len(cuerpo):
        fila = cuerpo[i]
        texto = fila['texto'].strip()
        if fila['tam'] == 16:  # «Presentación»
            previa = fila
            i += 1
            continue
        codigo = CODIGO_RE.match(texto) if (fila['verde'] and fila['negrita'] and fila['x'] < 55) else None
        if codigo:
            cerrar()
            titulo = [codigo.group(2)]
            ultima = fila
            i += 1
            # El título sigue en negrita, pegado (menos de 15,5 pt de salto) y sin viñeta.
            while i < len(cuerpo):
                siguiente = cuerpo[i]
                salto = siguiente['y'] - ultima['y']
                if siguiente['pagina'] != ultima['pagina'] or not siguiente['negrita'] or salto > 15.5:
                    break
                if siguiente['texto'].strip().startswith('-') or CODIGO_RE.match(siguiente['texto'].strip()):
                    break
                titulo.append(siguiente['texto'])
                ultima = siguiente
                i += 1
            actual = {'codigo': codigo.group(1), 'titulo': unir(titulo), 'pagina': fila['pagina'], 'parrafos': []}
            apartados.append(actual)
            previa = ultima
            continue

        # Dos tipos de viñeta: «-» (x = 70,9) y «•» (fuente Symbol). Las dos pasan a «– ».
        vineta = (texto.startswith('-') and 65 < fila['x'] < 75) or texto.startswith('•')
        texto = texto.lstrip('-•').strip() if vineta else texto
        nuevo = (
            vineta
            or previa is None
            or (fila['pagina'] == previa['pagina'] and fila['y'] - previa['y'] > 17)
            or (fila['pagina'] != previa['pagina'] and re.search(r'[.:;]$', ' '.join(parrafo).strip() or '.'))
        )
        if nuevo:
            cerrar()
        parrafo.append('– ' + texto if vineta else texto)
        previa = fila
        i += 1
    cerrar()

    # El índice y el cuerpo deben tener los mismos apartados, en el mismo orden.
    codigos_indice = [e['codigo'] for e in indice]
    codigos_cuerpo = [a['codigo'] for a in apartados]
    if codigos_indice != codigos_cuerpo:
        faltan = [c for c in codigos_indice if c not in codigos_cuerpo]
        sobran = [c for c in codigos_cuerpo if c not in codigos_indice]
        raise ValueError(f'El índice y el cuerpo no coinciden. Faltan en el cuerpo: {faltan}. Sobran: {sobran}')
    return documento, parrafos_presentacion, apartados


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def frase(titulo):
    texto = titulo.strip().rstrip(' .')
    if len(texto) > 125:
        texto = texto[:122].rsplit(' ', 1)[0] + '…'
    return texto


def mayus_inicial(texto):
    return texto[:1].upper() + texto[1:]


def frase_con(texto, prueba):
    """La frase (o el punto de una lista) del texto que contiene la prueba de una cifra."""
    for parte in re.split(r'(?<=[.!?])\s+|\n\n', texto):
        if prueba in parte:
            return parte.strip().lstrip('– ').strip()
    return prueba


def crear_programa(pdf):
    documento, presentacion, apartados = extraer(pdf)
    codigos = [a['codigo'] for a in apartados]
    tiene_hijos = {c: any(o.startswith(c + '.') for o in codigos) for c in codigos}

    bloques, secciones, medidas = [], [], []
    por_codigo = {}
    n = 0
    for apartado in apartados:
        codigo = apartado['codigo']
        partes = codigo.split('.')
        bloque = int(partes[0])
        texto = '\n\n'.join(apartado['parrafos'])
        if len(partes) == 1:
            nombre, _ = BLOQUES[bloque]
            bloques.append({
                'id': bloque,
                'titulo': nombre,
                'tituloMayus': nombre.upper(),
                'lema': apartado['titulo'],
                'cita': '',
                'intro': texto,
                'pagina': apartado['pagina'],
            })
            continue
        seccion = '.'.join(partes[:2])
        if len(partes) == 2:
            secciones.append({
                'id': seccion,
                'bloque': bloque,
                'titulo': apartado['titulo'],
                'tituloFrase': frase(apartado['titulo']),
                'intro': texto if tiene_hijos[codigo] else '',
                'pagina': apartado['pagina'],
                'subapartados': [],
            })
            if tiene_hijos[codigo]:
                continue
        if not texto:
            raise ValueError(f'El apartado {codigo} no tiene texto')
        if codigo not in CATEGORIA:
            raise ValueError(f'Falta la categoría del apartado {codigo} ({apartado["titulo"]})')
        n += 1
        completo = f"{apartado['titulo']} {texto}"
        medida = {
            'n': n,
            'bloque': bloque,
            'seccion': seccion,
            'pagina': apartado['pagina'],
            'subapartado': None,
            'titulo': apartado['titulo'],
            'tituloFrase': frase(apartado['titulo']),
            'texto': texto,
            'oculta': False,
            'categoria': CATEGORIA[codigo],
            'colectivos': coincidencias(completo, COLECTIVOS),
            'palancas': coincidencias(completo, PALANCAS),
            'territorios': coincidencias(completo, TERRITORIOS),
            # Solo los compromisos cuantificados de `CIFRAS`: el programa cita muchos datos de contexto
            # («300.000 animales abandonados al año») que no son compromisos.
            'cifras': [],
            'plazo': None,
            'deroga': None,
        }
        if codigo in DEROGA:
            if not re.search(r'derog', completo, re.I):
                raise ValueError(f'El apartado {codigo} no dice «derogar»')
            medida['deroga'] = DEROGA[codigo]
        medidas.append(medida)
        por_codigo[codigo] = medida

    sobrantes = set(CATEGORIA) - set(por_codigo)
    if sobrantes:
        raise ValueError(f'Categorías de apartados que no son propuestas: {sorted(sobrantes)}')

    cifras = []
    for valor, unidad, texto, codigo, prueba in CIFRAS:
        medida = por_codigo[codigo]
        cuerpo = f"{medida['titulo']} {medida['texto']}"
        if prueba not in cuerpo:
            raise ValueError(f'La cifra «{valor}» no aparece en el apartado {codigo}: «{prueba}»')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': medida['n']})
        frase_cifra = frase_con(medida['texto'], prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)

    plazos = []
    for codigo, plazo, texto, prueba in PLAZOS:
        medida = por_codigo[codigo]
        if prueba not in medida['texto']:
            raise ValueError(f'El plazo «{plazo}» no aparece en el apartado {codigo}: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': medida['n']})

    # PACMA escribe en futuro («impulsaremos», «propondremos») y en presente («proponemos», «defendemos»).
    verbos = Counter()
    for medida in medidas:
        for verbo in re.findall(r'\b([a-záéíóúñ]{3,}(?:aremos|eremos|iremos))\b', medida['texto'].lower()):
            if verbo not in NO_VERBOS:
                verbos[verbo] += 1

    return {
        'id': ID,
        'partido': 'Partido Animalista Con el Medio Ambiente',
        'siglas': 'PACMA',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        # La portada solo tiene texto en una fuente decorativa sin texto extraíble; el PDF se titula
        # «PE_GENERALES_29N26» (programa electoral, generales, 29N).
        'programa': 'Programa electoral 29N',
        'subtitulo': f'{len(medidas)} propuestas en tres compromisos: los animales, el medio ambiente y las personas',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'La taxonomía común no tiene una categoría de protección animal. Cada propuesta va a la categoría más '
            'cercana: el marco legal y penal a «Justicia», la caza, la ganadería y la fauna a «Campo, mar y mundo '
            'rural», y la tauromaquia y los espectáculos a «Lengua, cultura y memoria».',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {'titulo': 'Presentación', 'texto': '\n\n'.join(presentacion)},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [{'verbo': v, 'n': c} for v, c in verbos.most_common(15)],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }, por_codigo


def main():
    pdf, salida = sys.argv[1], sys.argv[2]
    programa, por_codigo = crear_programa(pdf)
    with open(salida, 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    if '--depurar' in sys.argv:
        volcado = sys.argv[sys.argv.index('--depurar') + 1]
        with open(volcado, 'w', encoding='utf-8') as archivo:
            for codigo, medida in por_codigo.items():
                archivo.write(f"\n### {medida['n']} [{codigo}] p.{medida['pagina']} {medida['categoria']} | {medida['titulo']}\n")
                archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'propuestas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
