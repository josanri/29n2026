"""Build the JSON of the NEX program (15 pages, 11 blocks, 150 measures).

Structure of the PDF:
- Pages 1 and 2 are the cover and the index. The index gives each block's title and slogan
  ("I. Vivienda. Una casa para vivir, no para invertir."). The script reads them there.
- A block starts with its Roman numeral on pages 3 to 14 ("II. Trabajo digno y garantizado").
- A section starts with a line in capital letters ("EMPLEO Y SALARIOS"). A block that has no
  such line before its first measure gets one section with the block title.
- A measure starts with a line that holds only its number and a dot ("17."). Its text runs
  until the next measure, the next section or block, or an information panel ("Cómo se paga",
  "Cuánto cuesta", "Fuente"), or the page footer ("@nuevoext").
- "Lo que llevaremos al Congreso:" is the summary of the block. It becomes the block intro.
- The PDF has no measure titles. The title is the first sentence of the text.

Every text is checked: the script stops if a text, a figure or a deadline is not in the PDF.

Usage: python scripts/extract_nex.py public/2026/generales/programas/nex-programa-generales-29n-2026.pdf src/data/2026/generales/programas/nex.json
"""
import json
import re
import sys
import unicodedata

import fitz


PAGINAS = 15
TOTAL_MEDIDAS = 150
PRIMERA_PAGINA_CUERPO = 3

PROGRAMA = 'La única candidatura 100% extremeña'
SUBTITULO = '150 medidas para que se escuche a Extremadura en Madrid'

NUMERO_RE = re.compile(r'^(\d{1,3})\.$')
BLOQUE_RE = re.compile(r'^(XI|IX|X|VIII|VII|VI|V|IV|III|II|I)\. (.*)$')
PARADAS = ('Cómo ', 'Cuánto ', 'Qué ', 'Fuente', 'Estimación', '@nuevoext', 'www.nuevoext')
PIE_RE = re.compile(r'^\d{1,2}$')

# Categoría de cada bloque y excepciones por medida (ids de src/data/taxonomia.json).
CATEGORIA_BLOQUE = {
    'I': 'vivienda', 'II': 'empleo', 'III': 'energia', 'IV': 'infraestructuras', 'V': 'energia',
    'VI': 'rural', 'VII': 'territorio', 'VIII': 'administracion', 'IX': 'familia', 'X': 'sanidad',
    'XI': 'social',
}
CATEGORIA_MEDIDA = {
    38: 'territorio', 39: 'territorio', 40: 'territorio', 41: 'territorio',
    42: 'infraestructuras', 61: 'infraestructuras', 62: 'infraestructuras', 63: 'infraestructuras', 64: 'infraestructuras',
    65: 'rural', 83: 'identidad', 84: 'territorio', 85: 'territorio', 86: 'territorio', 87: 'infraestructuras',
    88: 'identidad', 89: 'identidad', 90: 'exterior', 91: 'identidad',
    92: 'democracia', 93: 'justicia', 94: 'democracia', 95: 'democracia', 96: 'democracia', 97: 'democracia',
    99: 'sanidad', 100: 'sanidad', 101: 'empleo', 102: 'fiscalidad', 103: 'fiscalidad', 104: 'fiscalidad',
    105: 'administracion', 106: 'administracion', 107: 'administracion', 108: 'administracion', 109: 'rural',
    114: 'empleo', 115: 'empleo', 116: 'vivienda', 117: 'empleo', 118: 'democracia', 119: 'sanidad',
    120: 'social', 121: 'social', 122: 'social',
    123: 'sanidad', 124: 'sanidad', 125: 'sanidad', 126: 'sanidad', 127: 'sanidad', 128: 'sanidad', 129: 'sanidad',
    130: 'educacion', 131: 'educacion', 132: 'educacion', 133: 'educacion', 134: 'educacion', 135: 'educacion',
    136: 'educacion', 137: 'educacion', 138: 'educacion', 139: 'educacion', 140: 'educacion',
    142: 'justicia', 143: 'justicia', 145: 'justicia',
    146: 'exterior', 147: 'exterior', 148: 'exterior', 149: 'exterior', 150: 'exterior',
}

# Cifras de compromiso: (medida, valor, unidad, texto, contexto). El contexto es cita literal del PDF.
CIFRAS = [
    (18, '30 h', 'horas', 'Jornada semanal', '30 horas semanales'),
    (19, '1.500 €', '€', 'Salario mínimo en 14 pagas', 'Salario mínimo de 1.500 euros en 14 pagas'),
    (21, '32 h', 'horas', 'Jornada en todas las empresas', 'Jornada de 32 horas en todas las empresas'),
    (26, '32 h', 'horas', 'Jornada en la Administración General del Estado', 'Jornada de 32 horas en la Administración General del Estado'),
    (28, '100 %', '%', 'Baja médica cobrada desde el primer día', 'Baja médica cobrada al 100 % desde el primer día'),
    (29, '30 días', 'días', 'Vacaciones pagadas al año', '30 días de vacaciones pagadas al año'),
    (34, '212', 'municipios', 'Municipios extremeños sin gasolinera', 'Prioridad para los 212 municipios extremeños sin gasolinera'),
    (52, '30 %', '%', 'Entrada del Estado en cada nueva planta renovable', 'el Estado entra con un 30 %'),
    (66, '6 millones', 'hectáreas', 'Hectáreas ecológicas en 2030', '6 millones de hectáreas ecológicas en 2030'),
    (81, '20.000', 'empleos', 'Empleos al año en el Cuerpo Civil de Regeneración', 'con 20.000 empleos al año'),
    (94, '15 años', 'años', 'Incompatibilidad de los altos cargos', '15 años de incompatibilidad'),
    (97, '500.000', 'firmas', 'Firmas para la Iniciativa Legislativa Popular', 'fijadas en 500.000'),
    (110, '1 año', 'año', 'Permiso de nacimiento', 'Permisos de nacimiento de un año'),
    (120, '1.200 €', '€', 'Pensión mínima', 'Pensión mínima por encima de 1.200 euros'),
    (123, '48 h', 'horas', 'Cita en atención primaria', 'cita en atención primaria en 48 horas'),
    (138, '4 años', 'años', 'Becas de doctorado', 'Becas de doctorado de cuatro años'),
    (146, '0,7 %', '%', 'Cooperación al desarrollo', 'el 0,7 % de la Renta Nacional Bruta'),
]

# Plazos: (medida, plazo, texto literal). Cada plazo aparece en el PDF.
PLAZOS = [
    (51, 'en 2040', 'Independencia energética en 2040'),
    (66, 'en 2030', '6 millones de hectáreas ecológicas en 2030'),
]

# Derogaciones explícitas: (medida, texto de la derogación).
DEROGA = {127: 'Ley 15/1997'}

COLECTIVOS = {
    'jovenes': r'\bjóvenes?\b|[Jj]uventud|[Bb]ecario|Trabajador Joven|Generaciones Futuras',
    'mayores': r'mayores|pensionistas?|[Pp]ensión|jubilación|dependientes|[Dd]ependencia',
    'mujeres': r'mujeres|[Mm]ujer|Violencia de Género',
    'familias': r'familias|[Ff]amilia|hijos|[Pp]ermisos?|conciliación',
    'infancia': r'[Ii]nfancia|alumnos?|alumnado|escolar|colegios|institutos|menores',
    'autonomos': r'[Aa]utónomos|pequeño comercio|pymes|pequeñas',
    'empresas': r'empresas|multinacionales',
    'rural': r'rurales?|pueblos?|agricultura|ganader|agricultores?|pequeños productores|campo',
    'funcionarios': r'Administración|empleo público|plantilla|[Ss]ervicios públicos',
    'discapacidad': r'discapacidad|[Aa]ccesibilidad',
    'victimas': r'víctimas',
    'pacientes': r'pacientes?|[Ss]anidad|atención primaria|[Ss]alud',
    'inmigrantes': r'inmigrantes?|migración|asilo',
}

PALANCAS = {
    'ley': r'\bley\b|\bLey\b|[Rr]eforma|derogar|Constitucional|Real Decreto|Estatuto|[Rr]egulación|Código',
    'impuestos': r'impuesto|IRPF|IBI|IAE|IVA|recargo|cotizaciones?|tasa|margen municipal|bonificaci|deducci',
    'gasto': r'[Ff]inanciaci|[Ff]inanciar|[Ii]nversión|[Ff]ondo|[Pp]artidas|[Pp]resupuesto|coste|[Pp]agad|[Aa]yuda|[Bb]ecas?|salario|[Pp]agar|[Ss]ueldo',
    'organizacion': r'[Cc]rear|[Cc]reación|[Cc]omisionado|[Oo]ficina|[Cc]onsejo|[Cc]uerpo|[Rr]egistro|[Tt]raspaso|[Cc]omisión|[Bb]uzón|[Aa]gencia',
    'plan': r'\bPlan\b|[Pp]acto|[Ee]strategia|[Aa]cuerdo',
}

TERRITORIOS = {
    'Extremadura': r'Extremadura|extremeñ|estremeñu',
    'Cáceres': r'Cáceres',
    'Badajoz': r'Badajoz',
    'Portugal': r'Portugal|portugués',
    'Palestina': r'Palestina',
    'Unión Europea': r'Unión Europea|europea|europeo',
    'España': r'España',
}


def normalizar(texto):
    texto = unicodedata.normalize('NFC', texto)
    return re.sub(r'\s+', ' ', texto).strip()


def compacto(texto):
    return re.sub(r'\s+', '', unicodedata.normalize('NFC', texto))


def es_mayusculas(linea):
    letras = [caracter for caracter in linea if caracter.isalpha()]
    return len(letras) >= 3 and linea == linea.upper()


def slug(texto):
    sin_acentos = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+', '-', sin_acentos.lower()).strip('-')


def leer_lineas(documento):
    lineas = []
    for numero, pagina in enumerate(documento, start=1):
        for linea in pagina.get_text().splitlines():
            linea = unicodedata.normalize('NFC', linea).strip()
            if linea:
                lineas.append((numero, linea))
    return lineas


def leer_indice(lineas):
    """Read the block titles and slogans from the index on page 2."""
    texto = ' '.join(linea for pagina, linea in lineas if pagina == 2)
    texto = texto[texto.index('Lo que llevaremos a Madrid') + len('Lo que llevaremos a Madrid'):]
    texto = texto.replace('@nuevoext', ' ').replace('www.nuevoext.es', ' ')
    partes = re.split(r'(?<!\S)(?=(?:XI|IX|X|VIII|VII|VI|V|IV|III|II|I)\. )', texto)
    bloques = []
    for parte in partes:
        coincidencia = re.match(r'^(\S+?)\. (.*?)\. (.*)$', parte.strip())
        if coincidencia:
            bloques.append({'romano': coincidencia.group(1), 'titulo': coincidencia.group(2),
                            'lema': coincidencia.group(3).strip()})
    return bloques


def leer_presentacion(lineas):
    """The text under 'Lo que llevaremos a Madrid' on page 2."""
    partes = []
    capturando = False
    for pagina, linea in lineas:
        if pagina != 2:
            continue
        if linea == 'Lo que llevaremos a Madrid':
            capturando = True
            continue
        if capturando:
            if BLOQUE_RE.match(linea):
                break
            partes.append(linea)
    return normalizar(' '.join(partes))


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    fuente = compacto(''.join(pagina.get_text() for pagina in documento))
    lineas = leer_lineas(documento)

    indice = leer_indice(lineas)
    if len(indice) != 11:
        raise ValueError(f'Se esperaban 11 bloques en el índice; hay {len(indice)}')

    bloques = []
    secciones = []
    medidas = []
    bloque_idx = -1
    seccion = None
    medida = None
    intro = None
    esperado = 1

    def cerrar_medida():
        nonlocal medida
        if medida is not None:
            medidas.append(medida)
            medida = None

    def cerrar_intro():
        nonlocal intro
        if intro is not None:
            texto = normalizar(' '.join(intro['partes']))
            if not bloques[intro['bloque']]['intro']:
                bloques[intro['bloque']]['intro'] = texto
            intro = None

    for pagina, linea in lineas:
        if pagina < PRIMERA_PAGINA_CUERPO:
            continue

        numero = NUMERO_RE.match(linea)
        if numero:
            cerrar_medida()
            cerrar_intro()
            n = int(numero.group(1))
            if n != esperado:
                raise ValueError(f'Medida {n} fuera de orden; se esperaba {esperado} (página {pagina})')
            esperado += 1
            if seccion is None:
                seccion = {'id': slug(bloques[bloque_idx]['titulo']), 'bloque': bloque_idx + 1,
                           'titulo': bloques[bloque_idx]['titulo'], 'pagina': bloques[bloque_idx]['pagina'],
                           'usada': False}
                secciones.append(seccion)
            seccion['usada'] = True
            medida = {'n': n, 'pagina': pagina, 'seccion': seccion, 'bloque': bloque_idx + 1, 'partes': []}
            continue

        if PIE_RE.match(linea):
            continue

        if linea.startswith('@nuevoext') or linea.startswith('www.nuevoext'):
            cerrar_medida()
            cerrar_intro()
            continue

        coincidencia = BLOQUE_RE.match(linea)
        if coincidencia and bloque_idx + 1 < len(indice) and coincidencia.group(1) == indice[bloque_idx + 1]['romano']:
            cerrar_medida()
            cerrar_intro()
            bloque_idx += 1
            seccion = None
            bloques.append({'id': bloque_idx + 1, 'titulo': indice[bloque_idx]['titulo'],
                            'lema': indice[bloque_idx]['lema'], 'cita': '', 'intro': '', 'pagina': pagina})
            continue

        if es_mayusculas(linea) and bloque_idx >= 0:
            cerrar_medida()
            cerrar_intro()
            seccion = {'id': slug(linea), 'bloque': bloque_idx + 1, 'titulo': linea.capitalize(),
                       'pagina': pagina, 'usada': False}
            secciones.append(seccion)
            continue

        if linea.startswith('Lo que llevaremos'):
            cerrar_medida()
            cerrar_intro()
            intro = {'bloque': bloque_idx, 'partes': [linea]}
            continue

        if intro is not None:
            if linea.startswith(PARADAS):
                cerrar_intro()
            else:
                intro['partes'].append(linea)
            continue

        if medida is not None:
            if linea.startswith(PARADAS):
                cerrar_medida()
            else:
                medida['partes'].append(linea)

    cerrar_medida()
    cerrar_intro()

    if len(medidas) != TOTAL_MEDIDAS:
        raise ValueError(f'Se esperaban {TOTAL_MEDIDAS} medidas; hay {len(medidas)}')

    for bloque in bloques:
        if not bloque['intro']:
            bloque['intro'] = ''

    numeros_cifra = {cifra[0] for cifra in CIFRAS}
    salida_medidas = []
    for medida in medidas:
        n = medida['n']
        texto = normalizar(' '.join(medida['partes']))
        if compacto(texto) not in fuente:
            raise ValueError(f'Medida {n}: el texto no está en el PDF')
        numeral = indice[medida['bloque'] - 1]['romano']
        categoria = CATEGORIA_MEDIDA.get(n, CATEGORIA_BLOQUE[numeral])
        titulo = re.split(r'(?<=\.)\s', texto, maxsplit=1)[0]
        cifras = [cifra for cifra in CIFRAS if cifra[0] == n]
        for _, _, _, _, contexto in cifras:
            if compacto(contexto) not in compacto(texto):
                raise ValueError(f'Medida {n}: la cifra «{contexto}» no está en el texto')
        plazos = [plazo for plazo in PLAZOS if plazo[0] == n]
        for _, _, literal in plazos:
            if compacto(literal) not in compacto(texto):
                raise ValueError(f'Medida {n}: el plazo «{literal}» no está en el texto')
        if n in DEROGA and 'derog' not in texto.lower():
            raise ValueError(f'Medida {n}: la derogación no está en el texto')
        salida_medidas.append({
            'n': n,
            'bloque': medida['bloque'],
            'seccion': medida['seccion']['id'],
            'pagina': medida['pagina'],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [clave for clave, patron in COLECTIVOS.items() if re.search(patron, titulo + ' ' + texto)],
            'palancas': [clave for clave, patron in PALANCAS.items() if re.search(patron, texto)],
            'territorios': [clave for clave, patron in TERRITORIOS.items() if re.search(patron, texto)],
            'cifras': [contexto for _, _, _, _, contexto in cifras],
            'plazo': plazos[0][1] if plazos else None,
            'deroga': DEROGA.get(n),
        })

    secciones_usadas = []
    for seccion in secciones:
        if not seccion['usada'] or any(s['id'] == seccion['id'] for s in secciones_usadas):
            continue
        secciones_usadas.append({
            'id': seccion['id'],
            'bloque': seccion['bloque'],
            'titulo': seccion['titulo'],
            'tituloFrase': seccion['titulo'],
            'intro': '',
            'pagina': seccion['pagina'],
            'subapartados': [],
        })

    cifras_salida = []
    for n, valor, unidad, texto_cifra, contexto in CIFRAS:
        cifras_salida.append({'valor': valor, 'unidad': unidad, 'texto': texto_cifra, 'contexto': contexto, 'medida': n})

    plazos_salida = [{'plazo': plazo, 'texto': literal, 'medida': n} for n, plazo, literal in PLAZOS]

    return {
        'id': 'nex',
        'partido': 'Nuevo Extremeñismo - Adelante Extremadura',
        'siglas': 'NEX',
        'comunidad': 'Extremadura',
        'observaciones': [
            'Programa para el Congreso y para el Senado por Cáceres y Badajoz.',
            'El PDF no pone título a las medidas: el título es la primera frase del texto.',
            'Las cifras de los paneles del PDF (precios, paro, gasolineras, firmas) son datos de contexto. Solo son cifras las que son compromisos.',
            'La web del partido (nuevoext.es, sección «programa») publica el PDF. La URL directa del archivo no consta: la ficha enlaza la página.',
        ],
        'color': '#00bca4',
        'colorClaro': '#b2ebe4',
        'programa': PROGRAMA,
        'subtitulo': SUBTITULO,
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/nex-programa-generales-29n-2026.pdf',
        'fuentePdf': 'https://www.nuevoext.es/#/programa',
        'paginas': PAGINAS,
        'fechaPdf': '2026-11-16',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': 'Lo que llevaremos a Madrid', 'texto': leer_presentacion(lineas)},
        'cifras': cifras_salida,
        'plazos': plazos_salida,
        'ordenPlazos': ['en 2030', 'en 2040'],
        'verbos': [],
        'bloques': [{k: v for k, v in bloque.items()} for bloque in bloques],
        'secciones': secciones_usadas,
        'medidas': salida_medidas,
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Uso: python scripts/extract_nex.py ORIGEN.pdf DESTINO.json')
    programa = extraer(sys.argv[1])
    with open(sys.argv[2], 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(programa["medidas"])} medidas, {len(programa["secciones"])} secciones, {len(programa["bloques"])} bloques')


if __name__ == '__main__':
    main()
