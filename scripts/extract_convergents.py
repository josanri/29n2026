"""Extrae el programa de Convergents (Eleccions Generals 2026) al esquema compartido.

Estructura del PDF (48 diapositivas de PowerPoint exportadas a PDF, en catalán; tipografía Calibri):
- Página 1: portada («Programa Electoral Eleccions Generals 2026», Bold 72 pt, azul #002060).
- Páginas 2-3: «PRESENTACIÓ» (Bold 17,5 pt azul) y su texto en dos columnas (Regular 12 pt).
- Página 4: «ELS NOSTRES COMPROMISOS», el índice de los diez compromisos (Regular 12 pt, azul #2f5597), con su
  página. El índice es la referencia: el script para si los bloques del cuerpo no coinciden con él.
- Cuerpo (páginas 5-48): cada compromiso empieza en una página nueva con su título numerado («1. AVANÇAR CAP A LA
  SOBIRANIA NACIONAL», Bold 17,5 pt azul) y una introducción en prosa, en cajas de texto de dos columnas, que
  suele acabar en «Per tot això, des de Convergents proposem:».
  Después, los objetivos («Reivindicar la sobirania nacional…», Bold 17,5-18 pt azul) y, debajo de cada uno, las
  propuestas: cada una empieza por la marca «✓» (Wingdings) y sigue en Regular 12 pt, a veces en otra caja de texto
  o en la página siguiente.
- Pie: el número de página (Regular 11 pt, x ≈ 520).

Niveles → esquema:
- Compromiso (1-10) → bloque. Su prosa → introducción del bloque.
- Objetivo → sección («<bloque>.<orden>»).
- Cada «✓» → una propuesta, numerada de forma correlativa (el PDF no las numera). El título es la primera frase y
  el texto, el resto.

Orden de lectura: PowerPoint exporta las cajas de texto en el orden en que se crearon, que en la prosa de dos
columnas es el bueno (columna izquierda y después la derecha) pero no lo es para los títulos de los objetivos. Por
eso, en cada página, la prosa va en el orden del PDF y los títulos y las propuestas, por su altura. El script para si
en una página hay prosa por debajo de un título de objetivo o de una propuesta.

Uso: python scripts/extract_convergents.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'convergents'
PDF_PUBLICO = '/programas/convergents-programa-electoral-2026.pdf'
FUENTE = 'https://www.convergents.org/_files/ugd/d24b0b_2c84e86795954481a948f644038a7cb3.pdf'
FECHA_PDF = '2025-11-27'
COLOR = '#001480'
COLOR_CLARO = '#b2b8d9'
PAGINAS = 48
AZUL = 0x002060
PRIMERA_PAGINA_CUERPO = 5

# Nombre corto de cada compromiso. El título completo del PDF va en `lema`.
BLOQUES = {
    1: 'Sobirania nacional',
    2: 'Persones i famílies',
    3: 'Economia',
    4: 'Sector agroalimentari i pesquer',
    5: 'Escola catalana',
    6: 'Igualtat, drets i acollida',
    7: 'Salut i qualitat de vida',
    8: 'Innovació, coneixement i infraestructures',
    9: 'Administració, justícia i seguretat',
    10: 'Europa de les nacions',
}

# Categoría de cada objetivo (sección). Las excepciones, medida a medida, en `CATEGORIA_MEDIDA`.
# Criterios: los traspasos de competencias y el concierto económico → «territorio» (modelo autonómico y
# financiación territorial); la igualdad entre mujeres y hombres → «social» (igualdad de oportunidades) y la
# violencia machista → «seguridad», como en la taxonomía común.
CATEGORIA_SECCION = {
    '1.1': 'territorio', '1.2': 'identidad', '1.3': 'territorio',
    '2.1': 'social', '2.2': 'familia', '2.3': 'social', '2.4': 'empleo', '2.5': 'social', '2.6': 'vivienda',
    '3.1': 'innovacion', '3.2': 'fiscalidad', '3.3': 'empleo', '3.4': 'empleo', '3.5': 'innovacion',
    '4.1': 'rural', '4.2': 'fiscalidad', '4.3': 'rural', '4.4': 'rural',
    '5.1': 'educacion', '5.2': 'educacion', '5.3': 'educacion', '5.4': 'educacion', '5.5': 'educacion',
    '6.1': 'social', '6.2': 'seguridad', '6.3': 'inmigracion',
    '7.1': 'sanidad', '7.2': 'sanidad', '7.3': 'sanidad', '7.4': 'identidad',
    '8.1': 'innovacion', '8.2': 'innovacion', '8.3': 'infraestructuras', '8.4': 'innovacion',
    '8.5': 'infraestructuras', '8.6': 'energia', '8.7': 'infraestructuras',
    '9.1': 'democracia', '9.2': 'innovacion', '9.3': 'territorio', '9.4': 'justicia', '9.5': 'seguridad',
    '9.6': 'exterior',
    '10.1': 'exterior', '10.2': 'rural', '10.3': 'inmigracion', '10.4': 'defensa', '10.5': 'infraestructuras',
}

# Excepciones a la categoría de la sección, por número de propuesta (leídas una a una).
CATEGORIA_MEDIDA = {
    # 1. Sobirania nacional: el bloque de condiciones para dar apoyo a otro partido mezcla temas.
    9: 'justicia',            # amnistía
    11: 'seguridad',          # Mossos y Policía Local como únicos cuerpos policiales
    12: 'infraestructuras',   # traspaso de los aeropuertos
    13: 'identidad',          # selecciones deportivas catalanas
    14: 'justicia',           # Consejo de Justicia de Cataluña
    15: 'identidad',          # escudo en las matrículas
    16: 'vivienda',           # ley contra la ocupación
    17: 'inmigracion',        # expulsión de inmigrantes que delinquen
    # 2. Persones i famílies
    21: 'familia', 23: 'vivienda', 29: 'justicia', 36: 'justicia', 40: 'vivienda', 42: 'social',
    47: 'fiscalidad', 50: 'vivienda',
    # 3. Economia
    65: 'fiscalidad', 67: 'fiscalidad', 68: 'fiscalidad', 69: 'fiscalidad', 70: 'energia', 71: 'vivienda',
    72: 'territorio', 73: 'territorio', 85: 'fiscalidad', 87: 'fiscalidad', 97: 'social',
    # 4. Sector agroalimentari: el agua va a «infraestructuras» y la energía a «energia».
    134: 'infraestructuras', 135: 'infraestructuras', 138: 'energia', 139: 'energia', 140: 'infraestructuras',
    # 5. Escola catalana
    151: 'familia', 159: 'familia', 168: 'empleo', 169: 'empleo', 171: 'familia',
    # 6. Igualtat, drets i acollida
    177: 'familia', 178: 'familia', 181: 'justicia', 185: 'social', 195: 'social', 196: 'social',
    # 7. Salut i esport
    216: 'social', 220: 'fiscalidad',
    # 8. Innovació i infraestructures
    232: 'educacion', 233: 'inmigracion', 237: 'innovacion', 238: 'educacion', 255: 'emergencias',
    # 9. Administració
    259: 'territorio', 261: 'administracion', 265: 'fiscalidad',
    # 10. Europa
    281: 'identidad', 286: 'fiscalidad', 288: 'empleo', 289: 'empleo', 297: 'exterior', 300: 'energia',
}

# Derogaciones explícitas, por número de propuesta. Se comprueba que la propuesta dice «derog».
DEROGA = {
    60: 'Ley 12/2023, de 24 de mayo, por el derecho a la vivienda',
}

# Cifras: solo compromisos cuantificados. (valor, unidad, texto, número de propuesta, prueba literal)
CIFRAS = [
    ('48 h', 'para recuperar una vivienda ocupada', 'y 24 horas si es la primera vivienda o un centro productivo', 16,
     'en un màxim de 48 hores'),
    ('10 %', 'IVA en la cesión de suelo', 'para vivienda social, hoy al 21 %', 59, 'del 21% al 10%'),
    ('0,6 %', 'del PIB para vivienda', 'los fondos estatales, hasta la media europea', 62, '(0,6% del PIB)'),
    ('100', 'entre edad y años cotizados', 'para cobrar el 100 % de la pensión desde los 60 años («base 100»)', 34,
     'sumin un total de 100 entre edat i anys cotitzats'),
    ('40', 'años cotizados', 'sin coeficientes reductores en la jubilación anticipada', 35, 'cotitzat 40 anys o més'),
    ('6', 'meses como máximo', 'para reconocer o revisar el grado de discapacidad y de dependencia', 44,
     'a un màxim de 6 mesos'),
    ('100 %', 'de bonificación en la Seguridad Social', 'por el primer trabajador que contrata un autónomo', 86,
     'la bonificació del 100% de la quota'),
    ('5.000', 'habitantes', 'exenciones fiscales en los municipios más pequeños, contra la despoblación', 80,
     'municipis de menys de 5.000 habitants'),
    ('75 %', 'de los fondos de la PAC', 'como mínimo, para el Plan de Desarrollo Rural de Cataluña', 113,
     'un mínim del 75% dels fons del PAC'),
    ('30 %', 'de bonificación', 'a las inversiones en gestión forestal sostenible, en el IRPF y en Sociedades', 120,
     'una bonificació del 30%'),
    ('18', 'años', 'enseñanza obligatoria hasta esa edad', 150, 'fins als 18 anys'),
]

# Plazos: solo cuándo se aplica la propuesta. (número, plazo, texto, prueba literal)
PLAZOS = [
    (139, 'De inmediato', 'Moratoria a las nuevas fotovoltaicas en tierras agrícolas de valor y de regadío',
     'moratòria immediata'),
    (251, 'De inmediato', 'Ejecutar todas las inversiones en infraestructuras pendientes en Cataluña',
     'execució immediata'),
    (11, '4 años', 'Mossos y Policía Local sustituyen a la Policía Nacional y la Guardia Civil',
     'progressivament en 4 anys'),
]
ORDEN_PLAZOS = ['De inmediato', '4 años']

COLECTIVOS = {
    'empresas': r'\bempres(?:a|es|arial|arials|aris)\b|\bind[uú]stri(?:a|es|al)\b',
    'familias': r'\bfam[ií]l(?:ia|ies)\b|\bconciliaci[oó]\b|\bnatalitat\b',
    'infancia': r'\binf[aà]n(?:cia|ts?)\b|\badolesc[eè]n(?:cia|ts?)\b|\balumnat\b|\bmenors\b',
    'inmigrantes': r'\bimmigra(?:ci[oó]|nts?)\b|\bmigra(?:ci[oó]|nts?|tori[ae]?s?)\b|\brefugiats?\b|\bnouvinguts?\b',
    'jovenes': r'\bjov(?:e|es|entut)\b',
    'rural': r'\bpages(?:ia|os|os)\b|\bagr[aà]ri(?:a|es|s)?\b|\bpesca(?:dors)?\b|\bpesquer\w*|\bramader\w*|\bm[oó]n rural\b|\bsector primari\b|\bagricultors?\b',
    'autonomos': r'\baut[oò]noms?\b|\btreball aut[oò]nom\b|\bpimes?\b|\bemprenedor\w*',
    'agentes': r'\bMossos d[\'’]Esquadra\b|\bpolici(?:a|es)\b|\bcossos policials\b|\bGu[aà]rdia Civil\b',
    'mayores': r'\bgent gran\b|\bpersones grans\b|\bpensionistes?\b|\bpensions?\b',
    'discapacidad': r'\bdiscapacitat\w*|\bdepend[eè]ncia\b',
    'mujeres': r'\bdones?\b|\bviol[eè]ncia (?:masclista|de g[eè]nere)\b',
    'victimas': r'\bv[ií]ctimes?\b',
    'pacientes': r'\bpacients?\b|\bllistes d[\'’]espera\b',
    'funcionarios': r'\bfuncionari\w*|\bdocents?\b|\bprofessorat\b|\bprofessionals sanitaris\b',
}

PALANCAS = {
    'ley': r'\bllei\b|\blleis\b|\bderog\w*|\breforma\b|\bmodificaci[oó]\b|\bnormativ\w*|\blegisla\w*|\bEstatut\b|\bLlei Org[aà]nica\b',
    'impuestos': r'\bfiscal\w*|\bimpostos?\b|\btribut\w*|\bIVA\b|\bIRPF\b|\bdesgrava\w*|\bdeducci\w*|\bbonificaci\w*',
    'gasto': r'\bfinan[cç]a\w*|\binversi(?:[oó]|ons)\b|\bpressupost\w*|\bajuts?\b|\bsubvenci\w*|\bfons\b|\bdotaci[oó]\b',
    'organizacion': r'\bcrear\w*|\bcreaci[oó]\b|\bag[eè]ncia\b|\borganisme\b|\boficina\b|\bautoritat\b|\bconsell\b|\bcentre\b|\btrasp[aà]s\b|\bdelegaci[oó]\b',
    'plan': r'\bpla\b|\bplans\b|\bestrat[eè]gi(?:a|es)\b|\bprogram(?:a|es)\b|\bpacte\b|\bacords?\b',
}

TERRITORIOS = {
    'Cataluña': r'\bCatalunya\b',
    'España': r'\bEspanya\b|\bEstat espanyol\b',
    'Unión Europea': r'\bUni[oó] Europea\b|\bUE\b|\binstitucions europees\b',
    'País Vasco': r'\bPa[ií]s Basc\b',
    'Val d’Aran': r'\bAran\b',
    'Comunidad Valenciana': r'\bvalenci[aà]\b',
}

NO_VERBOS = set()

# El índice del PDF da una página que no es la del cuerpo: el compromiso 10 empieza en la 45, no en la 46.
INDICE_ERRATAS = {10: 45}

COMPROMISO_RE = re.compile(r'^(\d{1,2})\.\s*(.+)$')
INDICE_RE = re.compile(r'^(\d{1,2})\.\s*(.+?)\s*\.{3,}\s*(\d+)\s*$')


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
        if re.search(r'[a-zà-ú]-$', resultado) and pieza[:1].islower():
            resultado = resultado[:-1] + pieza
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


def cajas(pagina):
    """Las cajas de texto de una página: tipo («titulo», «marca», «texto»), posición y líneas."""
    resultado = []
    for orden, bloque in enumerate(pagina.get_text('dict')['blocks']):
        filas = []
        for linea in bloque.get('lines', []):
            spans = [s for s in linea['spans'] if s['text'].strip()]
            if not spans:
                continue
            filas.append({'y': linea['bbox'][1], 'spans': spans})
        if not filas:
            continue
        # Las piezas de una misma línea pueden venir en líneas distintas del PDF: se unen por altura.
        filas.sort(key=lambda f: f['y'])
        unidas = []
        for fila in filas:
            if unidas and abs(unidas[-1]['y'] - fila['y']) < 3:
                unidas[-1]['spans'].extend(fila['spans'])
            else:
                unidas.append({'y': fila['y'], 'spans': list(fila['spans'])})
        # Una caja puede llevar varias propuestas: cada línea con «✓» empieza una caja nueva.
        grupos = []
        for fila in unidas:
            inicio = min(fila['spans'], key=lambda s: s['bbox'][0])
            marca = inicio['font'].startswith('Wingdings') or inicio['text'].lstrip().startswith('✓')
            if not grupos or marca:
                grupos.append([])
            grupos[-1].append(fila)
        for grupo in grupos:
            primero = min(grupo[0]['spans'], key=lambda s: s['bbox'][0])
            lineas = [texto_linea(f['spans']) for f in grupo]
            texto = limpiar(' '.join(lineas))
            if re.fullmatch(r'\d{1,2}', texto) and primero['size'] < 11.5:
                continue  # número de página
            if 'Bold' in primero['font'] and primero['size'] >= 17 and primero['color'] == AZUL:
                tipo = 'titulo'
            elif primero['font'].startswith('Wingdings') or texto.startswith('✓'):
                tipo = 'marca'
            else:
                tipo = 'texto'
            resultado.append({'tipo': tipo, 'y': grupo[0]['y'], 'x': bloque['bbox'][0], 'orden': orden,
                              'lineas': lineas})
    return resultado


def leer_indice(documento):
    filas = []
    for caja in cajas(documento[3]):
        filas.extend(caja['lineas'])
    texto = limpiar(' '.join(filas))
    entradas = re.findall(r'(\d{1,2})\.\s*(.+?)\s*\.{3,}\s*(\d+)', texto)
    return [(int(n), limpiar(t), int(p)) for n, t, p in entradas]


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    indice = leer_indice(documento)
    if [n for n, _, _ in indice] != list(range(1, 11)):
        raise ValueError(f'El índice no tiene los diez compromisos: {indice}')

    presentacion = []
    for pagina in documento[1:3]:
        for caja in cajas(pagina):
            if caja['tipo'] == 'texto':
                presentacion.append(unir(caja['lineas']))

    bloques, secciones, medidas = [], [], []
    actual = None  # propuesta abierta
    for numero in range(PRIMERA_PAGINA_CUERPO, PAGINAS + 1):
        lista = cajas(documento[numero - 1])
        titulos = [c for c in lista if c['tipo'] == 'titulo']
        compromiso = [c for c in titulos if COMPROMISO_RE.match(limpiar(' '.join(c['lineas'])))]
        prosa = [c for c in lista if c['tipo'] == 'texto']
        resto = sorted([c for c in lista if c not in compromiso], key=lambda c: (c['y'], c['x']))

        if compromiso:
            caja = compromiso[0]
            coincide = COMPROMISO_RE.match(limpiar(' '.join(caja['lineas'])))
            n = int(coincide.group(1))
            if n != len(bloques) + 1:
                raise ValueError(f'Compromiso {n} fuera de orden en la página {numero}')
            if actual:
                medidas.append(actual)
                actual = None
            bloques.append({'id': n, 'lema': coincide.group(2).rstrip(' .'), 'pagina': numero, 'intro': []})
            # La prosa de la introducción: en el orden del PDF y por encima del primer objetivo o propuesta.
            primero = min((c['y'] for c in resto if c['tipo'] != 'texto'), default=10_000)
            intro = [c for c in prosa if c['y'] < primero]
            for c in sorted(intro, key=lambda c: c['orden']):
                bloques[-1]['intro'].append(unir(c['lineas']))
            resto = [c for c in resto if c not in intro]

        previa = None
        for caja in resto:
            texto = unir(caja['lineas'])
            if caja['tipo'] == 'titulo' and previa is not None and previa['tipo'] == 'titulo' \
                    and caja['y'] - previa['y'] < 45:
                # Un título de dos o tres líneas puede venir en cajas separadas, una debajo de otra.
                secciones[-1]['titulo'] = unir([secciones[-1]['titulo'], texto]).rstrip(' .')
                previa = caja
                continue
            previa = caja
            if caja['tipo'] == 'titulo':
                if actual:
                    medidas.append(actual)
                    actual = None
                bloque = bloques[-1]['id']
                orden = sum(1 for s in secciones if s['bloque'] == bloque) + 1
                secciones.append({'id': f'{bloque}.{orden}', 'bloque': bloque, 'titulo': texto.rstrip(' .'),
                                  'pagina': numero})
            elif caja['tipo'] == 'marca':
                if actual:
                    medidas.append(actual)
                if not secciones or secciones[-1]['bloque'] != bloques[-1]['id']:
                    raise ValueError(f'Propuesta sin objetivo en la página {numero}: {texto[:60]}')
                actual = {'seccion': secciones[-1]['id'], 'bloque': bloques[-1]['id'], 'pagina': numero,
                          'piezas': [texto.lstrip('✓').strip()]}
            else:
                if actual is None:
                    raise ValueError(f'Prosa fuera de la introducción en la página {numero}: {texto[:80]}')
                actual['piezas'].append(texto)
    if actual:
        medidas.append(actual)

    marcas = sum(pagina.get_text().count('✓') for pagina in documento)
    if len(medidas) != marcas:
        raise ValueError(f'El PDF tiene {marcas} marcas «✓» y el script ha leído {len(medidas)} propuestas')

    # El cuerpo y el índice deben tener los mismos compromisos y en las mismas páginas.
    for (n, titulo, pagina), bloque in zip(indice, bloques):
        if bloque['pagina'] != INDICE_ERRATAS.get(n, pagina):
            raise ValueError(f'El compromiso {n} empieza en la página {bloque["pagina"]}; el índice dice {pagina}')
    if len(bloques) != len(indice):
        raise ValueError(f'El cuerpo tiene {len(bloques)} compromisos y el índice {len(indice)}')
    return documento, indice, presentacion, bloques, secciones, medidas


def parrafos(piezas):
    """Párrafos de prosa: una caja que no acaba en punto sigue en la siguiente (cambio de columna)."""
    resultado = []
    for pieza in piezas:
        if resultado and not re.search(r'[.:;!?»”]$', resultado[-1]):
            resultado[-1] = unir([resultado[-1], pieza])
        else:
            resultado.append(pieza)
    return resultado


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
        if re.search(r'\b(?:p\.ex|etc|Sr|Sra|núm|art)\.$', antes):
            continue
        return antes.strip(), texto[corte.end():].strip()
    return texto.strip(), ''


def frase_con(texto, prueba):
    for parte in re.split(r'(?<=[.!?])\s+', texto):
        if prueba in parte:
            return parte.strip()
    return prueba


def crear_programa(pdf):
    documento, indice, presentacion, bloques_raw, secciones_raw, medidas_raw = extraer(pdf)
    bloques = [{
        'id': b['id'],
        'titulo': BLOQUES[b['id']],
        'tituloMayus': BLOQUES[b['id']].upper(),
        'lema': indice[b['id'] - 1][1],
        'cita': '',
        'intro': '\n\n'.join(parrafos(b['intro'])),
        'pagina': b['pagina'],
    } for b in bloques_raw]
    secciones = [{
        'id': s['id'],
        'bloque': s['bloque'],
        'titulo': s['titulo'],
        'tituloFrase': frase(s['titulo']),
        'intro': '',
        'pagina': s['pagina'],
        'subapartados': [],
    } for s in secciones_raw]

    medidas = []
    for n, raw in enumerate(medidas_raw, start=1):
        completo = unir(raw['piezas'])
        if not completo:
            raise ValueError(f'La propuesta {n} (página {raw["pagina"]}) no tiene texto')
        titulo, texto = titulo_y_texto(completo)
        seccion = raw['seccion']
        categoria = CATEGORIA_MEDIDA.get(n) or CATEGORIA_SECCION.get(seccion)
        if CATEGORIA_SECCION and not categoria:
            raise ValueError(f'Falta la categoría de la sección {seccion}')
        medida = {
            'n': n,
            'bloque': raw['bloque'],
            'seccion': seccion,
            'pagina': raw['pagina'],
            'subapartado': None,
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

    # Convergents escribe en futuro: «Defensarem», «Impulsarem», «Exigirem».
    verbos = Counter()
    for medida in medidas:
        cuerpo = f"{medida['titulo']} {medida['texto']}".lower()
        for verbo in re.findall(r'\b([a-zà-úç·]{3,}(?:arem|erem|irem))\b', cuerpo):
            if verbo not in NO_VERBOS:
                verbos[verbo] += 1

    return {
        'id': ID,
        'partido': 'Convergents',
        'siglas': 'CNV',
        'comunidad': 'Cataluña',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Programa electoral',
        'subtitulo': f'{len(medidas)} propostes en deu compromisos per a les Eleccions Generals 2026',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'El PDF no numera las propuestas: cada «✓» es una propuesta y el número es correlativo, en el orden del '
            'documento. El título es la primera frase de la propuesta.',
            'Las fechas internas del PDF son del 27 de noviembre de 2025 y el documento no menciona el 29 de '
            'noviembre de 2026: se titula «Programa Electoral Eleccions Generals 2026» y es el que el partido '
            'enlaza como programa electoral en su web.',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {'titulo': 'Presentació', 'texto': '\n\n'.join(parrafos(presentacion))},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [{'verbo': v, 'n': c} for v, c in verbos.most_common(15)],
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
        secciones = {s['id']: s['titulo'] for s in programa['secciones']}
        with open(volcado, 'w', encoding='utf-8') as archivo:
            for bloque in programa['bloques']:
                archivo.write(f"\n######## BLOQUE {bloque['id']} p.{bloque['pagina']} {bloque['lema']}\n{bloque['intro']}\n")
            seccion = None
            for medida in programa['medidas']:
                if medida['seccion'] != seccion:
                    seccion = medida['seccion']
                    archivo.write(f"\n=== {seccion} {secciones[seccion]}\n")
                archivo.write(f"\n### {medida['n']} p.{medida['pagina']} {medida['categoria']} | {medida['titulo']}\n")
                if medida['texto']:
                    archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'propuestas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
