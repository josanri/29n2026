"""Extrae el programa de Compromís–Front Valencià (Elecciones generales 2026) al esquema compartido.

PDF «Programa electoral 29N. Compromís-Front Valencià» (64 páginas, en valenciano, exportado desde Word). Tipografía de
cada nivel:

- Portada e índice: páginas 1-2. El índice (bloques en Bacalar-ExtraExpanded 12 pt naranja, apartados en Manrope-Bold)
  es la referencia: la compilación para si los bloques o los apartados del cuerpo no coinciden con él.
- Página 3: «0. Introducció» (Bacalar-ExtraExpanded 19,9 pt naranja y su texto). Es la presentación, no una medida.
- Bloque: los siete capítulos «1. UNA VIDA SEGURA…» (Bacalar-ExtraExpanded 19,9 pt naranja, a veces en varias líneas).
- Apartado: «HABITATGE», «SANITAT»… (Bacalar-Expanded 16,1 pt negro, a veces en varias líneas). Son 41.
- Medida: una viñeta «-» (x = 90) y su texto en Manrope-Medium 11 pt (x = 108). Las medidas no tienen número ni
  título. Unas pocas llevan una lista de subviñetas (x = 126, páginas 58-59): cada subviñeta es un párrafo «– » de
  la medida que la abre.

El programa no numera sus medidas: cada viñeta de primer nivel es una medida, con `n` correlativo en el orden del
documento. El título corto (`titulo`) es la primera frase de la medida. Sin pies de página ni cabeceras repetidas.

Uso: python scripts/extract_compromis.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'compromis-front-valencia'
PDF_PUBLICO = '/programas/compromis-front-valencia-programa-29n-2026.pdf'
FUENTE = 'https://frontvalencia.org/programa-compromis-front-valencia.pdf'
FECHA_PDF = '2026-11-13'
PAGINAS = 64
PAGINA_INTRODUCCION = 3
NARANJA = 0xFF5500

# Categoría base de cada bloque, excepciones por apartado (id «bloque.n») y por medida (número `n`, el orden del
# documento). Criterio: la categoría más cercana de la taxonomía común. No tiene una para el deporte (7.2.7 va a
# «Lengua, cultura y memoria») ni para la protección animal (5.8 va a «Campo, mar y mundo rural», como en PACMA).
CATEGORIA_BLOQUE = {
    1: 'social', 2: 'sanidad', 3: 'fiscalidad', 4: 'energia', 5: 'democracia', 6: 'territorio', 7: 'exterior',
}
CATEGORIA_SECCION = {
    '1.1': 'vivienda', '1.2': 'empleo', '1.3': 'empleo', '1.4': 'social',
    '2.1': 'sanidad', '2.2': 'sanidad', '2.3': 'educacion', '2.4': 'social', '2.5': 'infraestructuras',
    '2.6': 'identidad', '2.7': 'identidad', '2.8': 'educacion', '2.9': 'democracia', '2.10': 'educacion',
    '3.1': 'fiscalidad', '3.2': 'empleo', '3.3': 'innovacion', '3.4': 'innovacion', '3.5': 'rural',
    '3.6': 'social', '3.7': 'empleo',
    '4.1': 'energia', '4.2': 'energia', '4.3': 'infraestructuras', '4.4': 'energia', '4.5': 'infraestructuras',
    '4.6': 'emergencias',
    '5.1': 'administracion', '5.2': 'democracia', '5.3': 'democracia', '5.4': 'justicia', '5.5': 'identidad',
    '5.6': 'identidad', '5.7': 'democracia', '5.8': 'rural', '5.9': 'familia', '5.10': 'social',
    '5.11': 'familia', '5.12': 'familia', '5.13': 'democracia', '5.14': 'sanidad', '5.15': 'justicia',
    '5.16': 'democracia',
    '6.1': 'administracion', '6.2': 'territorio', '6.3': 'territorio',
    '7.1': 'exterior', '7.2': 'exterior', '7.3': 'exterior', '7.4': 'exterior',
}
CATEGORIA_MEDIDA = {
    **{n: 'seguridad' for n in (357, 358, 359, 435, 436, 437)},
    360: 'emergencias',
    **{n: 'empleo' for n in (406, 407, 408, 409)},
    **{n: 'vivienda' for n in (410, 411, 412, 413, 414)},
    **{n: 'infraestructuras' for n in (426, 427, 428)},
    432: 'social',
    438: 'inmigracion', 439: 'inmigracion',
    **{n: 'social' for n in (450, 451, 452, 453, 454)},
    **{n: 'educacion' for n in (458, 459, 460, 461)},
    501: 'infraestructuras',
    **{n: 'defensa' for n in (526, 527, 528, 529, 530)},
    **{n: 'inmigracion' for n in (545, 546, 547)},
    365: 'identidad', 366: 'identidad', 367: 'identidad', 368: 'identidad', 369: 'identidad',
    493: 'administracion', 494: 'administracion',
    240: 'energia', 245: 'energia', 250: 'energia',
    **{n: 'identidad' for n in range(116, 119)},
}

COLECTIVOS = {
    'jovenes': r'\bjov(?:e|es|entut)\b|\bjoves\b|joventut',
    'mayores': r'\bpersones majors\b|\bmajors\b|\bpensionist\w*|\bpensions\b|jubilaci',
    'mujeres': r'\bdones\b|feminis\w*|masclist\w*|\bgènere\b',
    'familias': r'\bfamílies\b|\bfamiliar\w*|monoparental\w*|\bcriança\b|\bfill o filla\b|\bfills\b',
    'infancia': r'\binfància\b|\bmenors\b|\balumn\w+|\bxiquets\b|\bxiquetes\b|\bescol\w+',
    'autonomos': r'\bautònom\w*|\bpimes\b|\bemprenedor\w*|\bxicotes empreses\b|\bmicroempreses\b',
    'empresas': r'\bempreses\b|\bindústri\w+|\bmultinacionals\b',
    'rural': r'\bmón rural\b|\bagricult\w+|\bramader\w+|\bpesquer\w*|\bpesca\b|despoblament|\bmunicipis rurals\b',
    'funcionarios': r'\bfuncionari\w+|\bpersonal públic\b|\boposicions\b|\bempleades? públiques?\b',
    'discapacidad': r'\bdiscapacitat\b|\bdiversitat funcional\b|\bdependència\b',
    'victimas': r'\bvíctimes\b|\bvictimes\b',
    'inmigrantes': r'\bmigrants?\b|\bimmigra\w+|\brefugiad\w+|\basil\b|\bsol·licitants d’asil\b|\bestrangeria\b',
    'pacientes': r'\bpacients\b|\bsanitat pública\b|\bsistema sanitari\b|\bsalut\b',
    'agentes': r'\bpolicia\w*|\bForces i Cossos\b|\bGuàrdia Civil\b|\bmilitar\w*|\bbombers?\b',
}

PALANCAS = {
    'ley': r'\bllei\b|\blleis\b|\bderog\w+|\breform\w+|\blegislaci\w+|\bprohib\w+|\bCodi Penal\b|\bnormativa\b|\bmodific\w+|\bConstitució\b',
    'impuestos': r'\bIVA\b|\bIRPF\b|\bfiscal\w*|\bimpost\w*|\bdeducci\w+|\btribut\w+|\bbonific\w+|\btaxa\b|\bgravamen\b|\bcotitzaci\w+',
    'gasto': r'\binversi\w+|\bfinan[cç]\w+|\bpressupost\w+|\bfons\b|\bajud\w+|\bsubvenci\w+|\bdotar\w*|\bdotaci\w+|\bmilions\b',
    'organizacion': r'\bcrear\w*|\bagència\b|\borganisme\b|\boficina\b|\bobservatori\b|\bautoritat\b|\bempresa pública\b|\bregistre\b|\bcomissió\b',
    'plan': r'\bpla\b|\bplans\b|\bestratègia\b|\bprograma\b|\bprogrames\b|\bpacte\b|\bcampanyes\b|\bprotocols?\b',
}

TERRITORIOS = {
    'Unión Europea': r'Unió Europea|Parlament Europeu|Comissió Europea|\bTJUE\b|\bde la UE\b|\bla UE\b',
    'Comunidad Valenciana': r'País Valencià|Generalitat Valenciana|valencià|valenciana|valencians|\bXúquer\b|\bAlbufera\b|\bAlacant\b|\bCastelló\b',
    'Palestina': r'palestin\w+',
    'Ucrania': r'ucraïn\w+',
    'Sáhara Occidental': r'Sàhara Occidental',
}

# Derogaciones explícitas («derogarem…»), por número de medida.
DEROGA = {
    45: 'Ley 15/1997',
    320: 'Normativa que impide ampliar plantillas públicas (tasas de reposición)',
    335: 'Ley franquista de secretos oficiales',
    357: 'Ley de Protección de la Seguridad Ciudadana (ley mordaza)',
    361: 'Ley de Amnistía de 1977',
    377: 'Delito de ofensa a los sentimientos religiosos (art. 525 del Código Penal)',
    382: 'Ley 18/2013 (tauromaquia como patrimonio cultural)',
}

# Cifras: compromisos cuantificados. (n, contexto literal, valor, unidad, resumen)
CIFRAS = [
    (4, '1% del PIB', '1 %', 'del PIB', 'cada año a comprar o construir vivienda pública, protegida o cooperativa'),
    (7, 'fins al 10% dels seus beneficis mundials', '10 %', 'de los beneficios mundiales', 'multa máxima a las empresas infractoras'),
    (13, 'menys de 350.000€', '350.000 €', 'primera vivienda', 'exención del ITP para la primera vivienda por debajo de ese valor'),
    (15, '18.000M€', '18.000', 'M€', 'fondo estatal de inversión en vivienda asequible'),
    (18, 'gravamen específic del 10%', '10 %', 'del valor catastral', 'gravamen sobre las viviendas desde la tercera propiedad'),
    (21, '60% del salari mitjà', '60 %', 'del salario medio', 'nivel al que se fijaría el SMI por ley'),
    (23, 'Reduirem un 50%', '50 %', 'menos domingos', 'reducción de domingos y festivos laborables en el comercio'),
    (24, '45 dies per any treballat', '45', 'días por año', 'indemnización por despido que se recupera'),
    (37, '65 anys', '65', 'años', 'edad de jubilación a la que se vuelve'),
    (44, '800€', '800', '€', 'pensión no contributiva a la que se sube'),
    (77, '50 milions d’euros', '50', 'M€', 'aportación estatal a la Autoridad Metropolitana de Transporte'),
    (138, '30.000€', '30.000', '€', 'rentas por debajo de las cuales se deflacta el IRPF'),
    (148, '2€ per pernoctació', '2', '€ por noche', 'tasa en viviendas de uso turístico'),
    (150, '6.000 milions anuals', '6.000', 'M€ al año', 'se destinan al ferrocarril desde los privilegios fiscales de la aviación'),
    (176, '3% d\'inversió del PIB', '3 %', 'del PIB', 'inversión en ciencia que se quiere superar'),
    (245, '100 % de titularitat pública de Red Eléctrica', '100 %', 'de Red Eléctrica', 'titularidad pública de la red de transporte'),
    (250, 'mínim el 51%', '51 %', 'de Red Eléctrica', 'participación mínima del Estado'),
    (255, 'fins al 100% en 2030', '100 %', 'electrificación', 'objetivo para 2030'),
    (272, '30% del Mediterrani', '30 %', 'del Mediterráneo', 'protegido, con las praderas de posidonia'),
    (275, '30% de cobertura arbòria', '30 %', 'de arbolado', 'en todos los núcleos urbanos en 2040'),
    (326, '16 anys', '16', 'años', 'edad del derecho de voto'),
    (353, 'deu nous jutjats', '10', 'juzgados', 'nuevos juzgados'),
    (390, '200 euros mensuals', '200', '€ al mes', 'prestación universal por hijo o hija'),
    (399, 'huit setmanes', '8', 'semanas', 'de permiso de cuidado que pasarían a estar remuneradas'),
    (499, '50% del finançament', '50 %', 'de la dependencia', 'financiación estatal de la Ley de dependencia'),
    (501, '1.500 milions d’euros', '1.500', 'M€', 'plan de modernización de Rodalies en el País Valenciano'),
    (538, '2% RNB', '2 %', 'de la RNB', 'presupuesto europeo mínimo'),
    (543, '0,7%', '0,7 %', 'para cooperación', 'ayuda al desarrollo blindada por ley'),
]

# Plazos: cuándo se aplica la medida. (n, contexto literal, plazo)
PLAZOS = [
    (31, 'de forma immediata', 'De inmediato'),
    (307, 'separació immediata', 'De inmediato'),
    (385, 'moratòria immediata', 'De inmediato'),
    (235, 'abans del final del primer any de legislatura', 'Primer año'),
    (274, 'durant el primer any de legislatura', 'Primer año'),
    (218, 'abans de la meitat de la legislatura', 'A mitad de legislatura'),
    (255, 'en 2030', '2030'),
    (275, 'en 2040', '2040'),
    (87, 'al 2050', '2050'),
]
ORDEN_PLAZOS = ['De inmediato', 'Primer año', 'A mitad de legislatura', '2030', '2040', '2050']


def limpiar(texto):
    texto = texto.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace(' ', ' ').replace('​', '')
    return unicodedata.normalize('NFC', texto)


def unir(lineas):
    """Une líneas del PDF en un párrafo: las palabras cortadas con guion se recomponen."""
    resultado = ''
    for linea in lineas:
        linea = linea.strip()
        if not linea:
            continue
        if resultado.endswith('-') and linea[:1].islower() and not resultado.endswith(' -'):
            resultado = resultado[:-1] + linea
        else:
            resultado = f'{resultado} {linea}'.strip()
    return re.sub(r'\s+', ' ', resultado).strip()


def lineas_pdf(documento):
    """Líneas del PDF en orden de lectura, con su estilo, su sangría y su página."""
    for indice, pagina in enumerate(documento):
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = sorted(linea['spans'], key=lambda span: span['bbox'][0])
                texto = limpiar(''.join(span['text'] for span in spans))
                if not texto.strip():
                    continue
                principal = next(span for span in spans if span['text'].strip())
                yield {
                    'pagina': indice + 1,
                    'texto': texto.strip(),
                    'x': round(linea['bbox'][0]),
                    'tamano': round(principal['size'], 1),
                    'fuente': principal['font'],
                    'color': principal['color'],
                }


def es_bloque(linea):
    return linea['fuente'].startswith('Bacalar-ExtraExpanded') and linea['tamano'] == 19.9 and linea['color'] == NARANJA


def es_apartado(linea):
    return linea['fuente'].startswith('Bacalar-Expanded') and linea['tamano'] == 16.1


def indice_pdf(documento):
    """Bloques y apartados del índice (páginas 1 y 2), en orden."""
    bloques, apartados = [], []
    pendiente = None
    for linea in lineas_pdf(documento):
        if linea['pagina'] > 2:
            break
        texto = re.sub(r'\s*\.{3,}.*$', '', linea['texto']).strip()
        if linea['fuente'].startswith('Bacalar-ExtraExpanded') and linea['tamano'] == 12.0:
            if re.match(r'^\d+\.\s', texto):
                bloques.append(texto)
                pendiente = bloques
            elif texto and pendiente is bloques:
                bloques[-1] = unir([bloques[-1], texto])
        elif 'Manrope-Bold' in linea['fuente'] and linea['tamano'] == 11.0:
            apartados.append(texto)
            pendiente = apartados
    return bloques, apartados


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    bloques, secciones, crudas = [], [], []
    introduccion = []
    estado = None  # 'bloque', 'apartado', 'medida', 'introduccion'
    actual = None

    for linea in lineas_pdf(documento):
        pagina, texto = linea['pagina'], linea['texto']
        if pagina <= 2:
            continue
        if pagina == PAGINA_INTRODUCCION:
            if es_bloque(linea):
                continue
            introduccion.append(texto)
            continue

        if es_bloque(linea):
            if estado == 'bloque':
                bloques[-1]['_titulo'].append(texto)
            else:
                bloques.append({'_titulo': [texto], 'pagina': pagina})
            estado = 'bloque'
            continue
        if es_apartado(linea):
            if estado == 'apartado':
                secciones[-1]['_titulo'].append(texto)
            else:
                secciones.append({'bloque': len(bloques), '_titulo': [texto], 'pagina': pagina})
            estado = 'apartado'
            continue

        if linea['x'] == 90 and texto.startswith('-'):
            resto = texto[1:].strip()
            actual = {'pagina': pagina, 'bloque': len(bloques), 'seccion': len(secciones), 'parrafos': [[resto]]}
            crudas.append(actual)
            estado = 'medida'
            continue
        if linea['x'] == 126 and texto.startswith('-'):
            actual['parrafos'].append([texto[1:].strip()])
            continue
        if estado == 'medida' and linea['x'] in (108, 144):
            actual['parrafos'][-1].append(texto)
            continue
        raise ValueError(f'Línea sin clasificar (p. {pagina}, x={linea["x"]}, {linea["fuente"]} {linea["tamano"]}): {texto!r}')

    # Títulos (pueden ocupar varias líneas), numeración de los bloques e ids de los apartados («bloque.n»).
    for elemento in bloques + secciones:
        elemento['titulo'] = unir(elemento.pop('_titulo'))
    for bloque in bloques:
        numero = re.match(r'^(\d+)\.\s+(.*)$', bloque['titulo'])
        bloque['id'] = int(numero.group(1))
        bloque['titulo'] = numero.group(2)
    if [b['id'] for b in bloques] != list(range(1, len(bloques) + 1)):
        raise ValueError(f'Los bloques no están numerados de 1 a {len(bloques)}')
    contador = Counter()
    for seccion in secciones:
        contador[seccion['bloque']] += 1
        seccion['id'] = f"{seccion['bloque']}.{contador[seccion['bloque']]}"

    # Los títulos del cuerpo deben ser los del índice del propio PDF, en el mismo orden.
    indice_bloques, indice_apartados = indice_pdf(documento)
    indice_bloques = [b for b in indice_bloques if not b.startswith('0.')]  # «0. Introducció» es la presentación
    if indice_bloques != [f"{b['id']}. {b['titulo']}" for b in bloques]:
        raise ValueError(f'Los bloques no coinciden con el índice:\n{indice_bloques}\n{[b["titulo"] for b in bloques]}')
    if [t.upper() for t in indice_apartados] != [s['titulo'].upper() for s in secciones]:
        raise ValueError(f'Los apartados no coinciden con el índice:\n{indice_apartados}\n{[s["titulo"] for s in secciones]}')
    return documento, bloques, secciones, crudas, unir(introduccion[1:] if introduccion[0].startswith('0.') else introduccion)


def titulo_y_texto(parrafos):
    """El texto de la medida: un párrafo y, si hay subviñetas, un párrafo «– » por cada una. Título: primera frase."""
    textos = [unir(p) for p in parrafos]
    texto = textos[0]
    if len(textos) > 1:
        texto = '\n\n'.join([texto] + [f'– {t}' for t in textos[1:]])
    primera = re.split(r'(?<=[.:;])\s+', textos[0], maxsplit=1)[0].rstrip('.:;')
    if len(primera) > 120:
        primera = primera[:118].rsplit(' ', 1)[0].rstrip(',') + '…'
    return primera, texto


def frases(texto):
    return [frase.strip() for frase in re.split(r'(?<=[.!?])\s+', texto) if frase.strip()]


def titulo_apartado(titulo):
    """El PDF escribe los apartados con mayúscula en cada palabra: deja solo la primera y las siglas."""
    minusculas = titulo[0] + titulo[1:].lower().replace('lgtbiq+', 'LGTBIQ+')
    return minusculas.replace(' d’estat', ' d’Estat').replace('Model d’estat', 'Model d’Estat')


def crear_programa(documento, bloques, secciones, crudas, introduccion):
    medidas = []
    for numero, cruda in enumerate(crudas, start=1):
        titulo, texto = titulo_y_texto(cruda['parrafos'])
        seccion = secciones[cruda['seccion'] - 1]
        completo = f'{titulo}. {texto}'
        categoria = CATEGORIA_MEDIDA.get(numero, CATEGORIA_SECCION.get(seccion['id'], CATEGORIA_BLOQUE.get(cruda['bloque'])))
        medidas.append({
            'n': numero,
            'bloque': cruda['bloque'],
            'seccion': seccion['id'],
            'pagina': cruda['pagina'],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [nombre for nombre, patron in COLECTIVOS.items() if re.search(patron, completo, re.I)],
            'palancas': [nombre for nombre, patron in PALANCAS.items() if re.search(patron, completo, re.I)],
            'territorios': [nombre for nombre, patron in TERRITORIOS.items() if re.search(patron, completo)],
            'cifras': [],
            'plazo': None,
            'deroga': DEROGA.get(numero),
        })

    por_n = {m['n']: m for m in medidas}
    for tabla in (CATEGORIA_MEDIDA, DEROGA):
        sobran = set(tabla) - set(por_n)
        if sobran:
            raise ValueError(f'Números sin medida: {sorted(sobran)}')
    for n in DEROGA:
        if 'derog' not in por_n[n]['texto'].lower():
            raise ValueError(f'La medida {n} no dice «derog»')

    cifras = []
    for n, contexto, valor, unidad, resumen in CIFRAS:
        medida = por_n[n]
        frase = next((f for f in frases(medida['texto'].replace('\n\n– ', ' ')) if contexto in f), None)
        if frase is None:
            raise ValueError(f'La cifra {contexto!r} no está en la medida {n}')
        if frase not in medida['cifras']:
            medida['cifras'].append(frase)
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': resumen, 'contexto': contexto, 'medida': medida['n']})

    plazos = []
    for n, contexto, plazo in PLAZOS:
        medida = por_n[n]
        if contexto not in medida['texto']:
            raise ValueError(f'El plazo {contexto!r} no está en la medida {n}')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': medida['tituloFrase'], 'medida': medida['n']})

    return {
        'id': ID,
        'partido': 'Compromís: Front Valencià',
        'siglas': 'COMPROMÍS',
        'color': '#FF5800',
        'colorClaro': '#FFE5D9',
        'comunidad': 'Comunidad Valenciana',
        'programa': 'Programa electoral 29N',
        'subtitulo': 'Una alternativa de la izquierda valenciana para las Corts Generals',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'observaciones': [
            'El programa está escrito en valenciano y no numera ni titula sus medidas: cada viñeta de primer nivel es una medida, numerada en orden de aparición, y su primera frase hace de título.',
            'El PDF no menciona el año 2026 ni «elecciones generales»: el título («Programa electoral 29N») y la introducción («les Corts Generals») lo sitúan en esta elección. La fecha es la de creación del PDF.',
        ],
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': 'Introducció', 'texto': introduccion},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [],
        'bloques': [
            {'id': b['id'], 'titulo': b['titulo'], 'tituloMayus': b['titulo'].upper(), 'lema': '', 'cita': '',
             'intro': '', 'pagina': b['pagina']}
            for b in bloques
        ],
        'secciones': [
            {'id': s['id'], 'bloque': s['bloque'], 'titulo': titulo_apartado(s['titulo']),
             'tituloFrase': titulo_apartado(s['titulo']), 'intro': '', 'pagina': s['pagina'], 'subapartados': []}
            for s in secciones
        ],
        'medidas': medidas,
    }


def depurar(programa, ruta):
    with open(ruta, 'w', encoding='utf-8') as archivo:
        for bloque in programa['bloques']:
            archivo.write(f"\n##### {bloque['id']}. {bloque['titulo']} (p. {bloque['pagina']})\n")
            for seccion in [s for s in programa['secciones'] if s['bloque'] == bloque['id']]:
                archivo.write(f"\n=== {seccion['id']} {seccion['titulo']} (p. {seccion['pagina']})\n")
                for m in [m for m in programa['medidas'] if m['seccion'] == seccion['id']]:
                    archivo.write(f"[{m['n']}] p.{m['pagina']} {m['categoria']} | {m['texto']}\n")


def main():
    argumentos = sys.argv[1:]
    ruta_depurar = None
    if '--depurar' in argumentos:
        posicion = argumentos.index('--depurar')
        ruta_depurar = argumentos[posicion + 1]
        del argumentos[posicion:posicion + 2]
    programa = crear_programa(*extraer(argumentos[0]))
    with open(argumentos[1], 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    if ruta_depurar:
        depurar(programa, ruta_depurar)
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
