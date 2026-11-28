"""Extrae el programa de Falange Española de las JONS (Elecciones generales 2026) al esquema compartido.

Estructura del PDF (60 páginas, maquetado con PSPDFKit; tipografía Raleway):
- Páginas 1-2: portada (imagen, sin texto). Páginas 3-4: índice, con los bloques («BLOQUE I» y su nombre en
  Raleway-ExtraBold 12 pt granate) y los capítulos («1. INMIGRACIÓN») con su página. El índice es la referencia:
  el script para si un capítulo del índice no está en el cuerpo o al revés.
- Páginas 6-7: introducción, en Raleway-Regular 12 pt; un párrafo empieza con sangría (x ≈ 121).
- Cada bloque abre con una página de imagen sin texto. Cada capítulo abre con «N.» + título en Raleway-ExtraBold
  24 pt granate (#801f1e), en una o dos líneas.
- Las medidas son los puntos «N.M.» (Raleway-Regular 12 pt, x ≈ 103), con el texto a la derecha (x ≈ 142). No
  tienen título. Un punto de tercer nivel («6.1.1.», x ≈ 128) sigue dentro de su medida. Las viñetas «●» (ArialMT)
  pasan a párrafos «– ».
- Anexo I «Plan Nacional de Remigración» (páginas 11-13): sin números. Tres fases en mayúsculas («EN LOS PRIMEROS
  5 AÑOS:», x = 85), frases de introducción (x = 85) y viñetas «●». Cada frase de introducción y cada viñeta es
  una medida; la fase es su plazo.
- Pie: «Falange Española de las JONS» y el número de página (Roboto-Black 10 pt, y > 720). El número impreso va
  dos por detrás del de la página del PDF; `pagina` es la del PDF.
- Páginas 57-58: epílogo, que no tiene medidas.

Esquema: los seis bloques del índice → bloques; los 25 capítulos y el anexo → secciones; los puntos «N.M.» y las
piezas del anexo → medidas, con `n` correlativo. Las tablas de este script usan el código del PDF («6.12») o, en el
anexo, «A.1», «A.2»… en orden.

Uso: python scripts/extract_fe_jons.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'fe-jons'
PDF_PUBLICO = '/programas/fe-jons-programa-electoral-2026.pdf'
# El partido no ha publicado el PDF en su web (falange.es) al incorporarlo: es el documento que facilitó la
# redacción, compartido en Google Drive. Ver `observaciones`.
FUENTE = 'https://falange.es/wp-content/uploads/2026/11/FEDELASJONS_ProgramaElectoral_29NGenerales2026.pdf'
FECHA_PDF = '2026-11-13'  # modDate de los metadatos: el documento no escribe la fecha
COLOR = '#DA141C'
COLOR_CLARO = '#EE9599'
PAGINAS = 60
GRANATE = 0x801F1E
ROMANOS = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6}

# Bloque de cada capítulo, según el índice.
BLOQUE_DE_CAPITULO = {
    **{c: 1 for c in (1, 2)}, **{c: 2 for c in (3, 4, 5)}, **{c: 3 for c in (6, 7, 8)},
    **{c: 4 for c in (9, 10, 11, 12)}, **{c: 5 for c in range(13, 19)}, **{c: 6 for c in range(19, 26)},
}

# Categoría de cada capítulo (la base) y excepciones medida a medida, leyendo cada medida.
CATEGORIA_CAPITULO = {
    1: 'inmigracion', 2: 'vivienda', 3: 'exterior', 4: 'exterior', 5: 'territorio', 6: 'empleo', 7: 'familia',
    8: 'territorio', 9: 'fiscalidad', 10: 'innovacion', 11: 'energia', 12: 'rural', 13: 'democracia',
    14: 'democracia', 15: 'seguridad', 16: 'defensa', 17: 'justicia', 18: 'administracion', 19: 'educacion',
    20: 'sanidad', 21: 'identidad', 22: 'innovacion', 23: 'innovacion', 24: 'infraestructuras', 25: 'rural',
    'A': 'inmigracion',
}
# La taxonomía no tiene una categoría de modelo económico ni de consumo: la nacionalización de la banca y de los
# sectores estratégicos (9.1-9.3, 9.15) va a «Productividad e innovación», como la industria, y el capítulo de
# consumo (23) también, salvo la nutrición (sanidad) y los impuestos de los envases (impuestos).
CATEGORIA_MEDIDA = {
    '1.8': 'seguridad',
    '5.7': 'identidad',
    '6.1': 'innovacion', '6.13': 'social', '6.18': 'social',
    '8.3': 'empleo', '8.4': 'rural',
    '9.1': 'innovacion', '9.2': 'innovacion', '9.3': 'innovacion', '9.10': 'social', '9.11': 'social',
    '9.15': 'innovacion',
    '11.5': 'infraestructuras',
    '13.4': 'administracion',
    '14.5': 'administracion', '14.6': 'identidad', '14.7': 'identidad',
    '15.2': 'vivienda', '15.7': 'innovacion', '15.8': 'infraestructuras', '15.9': 'infraestructuras',
    '17.7': 'democracia',
    '19.20': 'familia',
    '23.2': 'sanidad', '23.3': 'fiscalidad',
    '24.4': 'energia',
    '25.4': 'justicia', '25.5': 'emergencias',
}

# Derogaciones explícitas, por código. Se comprueba que la medida dice «derog».
DEROGA = {
    'A.1': 'Ley de Extranjería',
    '6.4': 'Reformas laborales de PP, PSOE y Podemos/Sumar',
    '7.3': 'Leyes de los colectivos LGTBI y de «género», incluida la Ley de Violencia de Género',
    '21.1': 'Leyes de Memoria',
    '24.4': 'Real Decreto de las zonas de bajas emisiones',
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes\b|\bjuventud\b',
    'mayores': r'\bmayores\b|\bpensionistas?\b|\bjubilad\w*',
    'mujeres': r'\bmujer(?:es)?\b|\bmadres?\b|\bembarazad\w*',
    'familias': r'\bfamilias?\b|conciliaci[oó]n',
    'infancia': r'\binfancia\b|\bniñ[oa]s\b|\bmenores\b|\balumn\w*',
    'autonomos': r'\baut[oó]nom[oa]s\b|\bpymes\b|emprendedor\w*',
    'empresas': r'\bempresas?\b|\bempresari\w*',
    'rural': r'\bmundo rural\b|\bagricultor\w*|\bganader\w*|\bmedio rural\b|despoblaci[oó]n|\bcampo\b|\bpescador\w*',
    'funcionarios': r'\bfuncionari\w*|\bempleados? p[uú]blicos?\b',
    'discapacidad': r'\bdiscapacidad\b|\bdependencia\b|\bdependientes\b',
    'victimas': r'\bv[ií]ctimas\b',
    'inmigrantes': r'\binmigra\w*|\bextranjer\w*|\bMENAS\b|\bilegales\b',
    'pacientes': r'\bpacientes\b|\bsanidad p[uú]blica\b|\bsistema sanitario\b',
    'agentes': r'\bFuerzas (?:y Cuerpos )?de Seguridad\b|\bGuardia Civil\b|\bpolic[ií]\w*|\bmilitares\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|\bderog\w*|\breform\w*|\blegislaci[oó]n\b|\bprohibi\w*|C[oó]digo Penal|\bnormativa\b|\bilegaliza\w*',
    'impuestos': r'\bIVA\b|\bIRPF\b|\bfiscal\w*|\bimpuestos?\b|\bdeducci\w*|\btribut\w*|\bcotizaci[oó]n\b',
    'gasto': r'\binversi[oó]n\b|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b|\bayudas?\b|\bsubvenci\w*|\bdotaci[oó]n\b',
    'organizacion': r'\bcreaci[oó]n\b|\bcrear\b|\bagencia\b|\borganismo\b|\binstituto\b|\bcuerpo\b|\bregistro\b|\bnacionaliza\w*',
    'plan': r'\bplan(?:es)?\b|\bestrategia\b|\bprogramas?\b|\bpacto\b|\bcampañas?\b|\bprotocolos?\b',
}

TERRITORIOS = {
    'Unión Europea': r'\bUni[oó]n Europea\b|\bUE\b|\bSchengen\b|\beuro\b',
    'Gibraltar': r'\bGibraltar\b',
    'Marruecos': r'\bMarruecos\b',
    'Ceuta': r'\bCeuta\b',
    'Melilla': r'\bMelilla\b',
    'Canarias': r'\bCanarias\b',
    'Iberoamérica': r'\bHispanoam[eé]rica\b|\bIberoam[eé]rica\b',
}

# Cifras: solo compromisos cuantificados. (valor, unidad, texto, código, prueba literal)
CIFRAS = [
    ('1,5 %', 'de inmigración, como máximo', 'Tasa máxima de inmigración, con permisos de dos años como mucho', 'A.25', 'tasa máxima de inmigración del 1,5%'),
    ('50 %', 'de impuesto a las remesas', 'Impuesto de no menos del 50 % al dinero enviado al extranjero', 'A.12', 'no menos del 50% al envío de dinero'),
    ('25 %', 'del salario familiar', 'Tope del alquiler: nunca más del 25 % del salario de la familia', '2.9', 'no pudiendo ser superior al 25% del salario de la unidad familiar'),
    ('0 %', 'de interés, aproximadamente', 'Hipotecas del ICO para familias jóvenes, con la deuda saldada al cuarto hijo', '2.5', 'a muy bajo interés, cercanas al 0%'),
    ('47 %', 'de industria en la economía', 'Objetivo del modelo productivo a 10-15 años (hoy, 24,5 %)', '6.1', '47 % industria'),
    ('65', 'años', 'Vuelta a la edad de jubilación a los 65 años', '6.18', 'vuelta a la edad de jubilación a los 65 años'),
    ('2', 'meses de período de prueba', 'Período de prueba general para todos los contratos', '6.20', 'período de prueba general de dos meses'),
    ('2 %', 'del PIB en I+D+i', 'Inversión directa en investigación, desarrollo e innovación', '10.6', 'un 2% del PIB en investigación'),
    ('180', 'días de reserva energética', 'Reserva estratégica nacional obligatoria de energía importada', '11.12', 'Reserva estratégica nacional obligatoria de 180 días de consumo'),
    ('18', 'meses de servicio militar', 'Servicio militar obligatorio para hombres y mujeres de 18 a 22 años', '16.7', 'con duración de 18 meses'),
]

# Otros compromisos cuantificados que no van en la cabecera: solo cuentan en «N tienen una cifra».
CIFRAS_MEDIDA = [
    ('A.21', 'con permiso de trabajo con una duración máxima de tres años'),
    ('2.3', 'Se reducirá la categoría de gran tenedor a partir de 5 pisos en propiedad en situación de arrendamiento'),
    ('6.6', 'con 20 o 33 días por año'),
    ('6.19', 'deberán cesar su actividad laboral o comercial los sábados a partir de las 14:00'),
    ('8.4', 'exenciones en el pago de IRPF los cinco primeros años'),
    ('9.6', 'bonificación fiscal del 50% para aquellos autónomos que incorporen a sus hijos'),
    ('11.3', 'al menos un 25% de la energía generada y sus beneficios se reviertan directamente en los municipios'),
    ('11.11', 'financiación de hasta el 90% a interés cero a través del ICO'),
    ('16.8', 'al menos 4 de ellos se destinarán a actividades civiles'),
    ('17.3', 'reducción de 2 días de condena menos por cada día de trabajo efectivo'),
]

# Plazos: solo cuándo se aplica la medida. Los del anexo salen de su fase. (código, plazo, texto, prueba)
PLAZOS = [
    ('2.8', 'De inmediato', 'Sacar al mercado todo el parque de vivienda del Estado', 'sacándolo al mercado de inmediato'),
    ('3.1', 'De inmediato', 'Salir de la OTAN, el FMI, la UE y la ONU', 'el abandono inmediato de las organizaciones supranacionales'),
    ('4.2', 'De inmediato', 'Salir del euro y recuperar la moneda nacional', 'la salida inmediata de España de la moneda común'),
    ('6.4', 'De inmediato', 'Derogar todas las reformas laborales', 'Derogación inmediata y total'),
    ('18.6', 'De inmediato', 'Cesar las subvenciones a colectivos LGTB y a la memoria histórica', 'Cese inmediato de cualquier tipo de subvención'),
    ('21.1', 'De inmediato', 'Derogar las leyes de memoria', 'Derogación inmediata de las mal llamadas Leyes de “Memoria”'),
    ('5.2', 'A corto plazo', 'Retirar las competencias a las autonomías y disolverlas', 'en el corto plazo, la retirada de todas las competencias'),
    ('6.1', 'En 10-15 años', 'Nuevo modelo productivo: 8 % sector primario, 47 % industria', 'modelo productivo a 10-15 años'),
    ('4.3', 'A largo plazo', 'Refundar la Unión Europea sobre la soberanía de las naciones', 'una refundación a largo plazo de la Unión Europea'),
]
FASES = {
    'EN LOS PRIMEROS 5 AÑOS': 'En los primeros 5 años',
    'EN UN PLAZO DE 10 AÑOS': 'En un plazo de 10 años',
    'DE 10 AÑOS EN ADELANTE': 'De 10 años en adelante',
}
ORDEN_PLAZOS = ['De inmediato', 'A corto plazo', 'En los primeros 5 años', 'En un plazo de 10 años', 'En 10-15 años',
                'De 10 años en adelante', 'A largo plazo']

# Títulos de capítulo: el índice los escribe en mayúsculas («REGÍMEN POLÍTICO», con la tilde errada).
TITULOS = {4: 'Unión Europea y euro', 13: 'Forma del Estado', 14: 'Régimen político'}

CODIGO_RE = re.compile(r'^(\d{1,2})\.(\d{1,2})\.\s*(.*)$')
SUBCODIGO_RE = re.compile(r'^(\d{1,2}\.\d{1,2}\.\d{1,2})\.\s*(.*)$')
CAPITULO_RE = re.compile(r'^(\d{1,2})\.\s*(.+)$')


def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    texto = texto.replace('​', ' ').replace('\xa0', ' ').replace('\xad', '').replace('\t', ' ')
    return re.sub(r'\s+', ' ', texto).strip()


def unir(piezas):
    """Une líneas. El PDF no parte palabras con guion: un guion a final de línea cierra un inciso
    («–revisables según dichas necesidades-»), y se conserva."""
    return limpiar(' '.join(limpiar(pieza) for pieza in piezas))


def lineas(documento):
    """Las líneas de cada página, con las piezas de la misma altura unidas de izquierda a derecha."""
    for numero, pagina in enumerate(documento, start=1):
        piezas = []
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip(' ​')]
                if not spans or spans[0]['font'].startswith('Roboto'):  # pie de página
                    continue
                piezas.append({'y': round(linea['bbox'][1], 1), 'spans': spans})
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
                'y': fila['y'],
                'x': round(primero['bbox'][0]),
                'texto': limpiar(' '.join(s['text'] for s in spans)),
                'fuente': primero['font'],
                'tam': round(primero['size']),
                'granate': primero['color'] == GRANATE,
            }


def leer_indice(filas):
    """Bloques y capítulos del índice (páginas 3-4). Cada fila lleva al final su número de página."""
    bloques, capitulos = [], []
    for fila in filas:
        if fila['pagina'] not in (3, 4) or fila['tam'] != 12:
            continue
        texto = re.sub(r'\s+\d{1,2}$', '', fila['texto']).strip()
        romano = re.fullmatch(r'BLOQUE ([IVX]+)', texto)
        capitulo = CAPITULO_RE.match(texto)
        if romano:
            bloques.append({'id': ROMANOS[romano.group(1)], 'titulo': ''})
        elif capitulo and fila['x'] > 95:
            capitulos.append((int(capitulo.group(1)), capitulo.group(2)))
        elif fila['granate'] and fila['x'] < 95 and bloques and texto not in ('INTRODUCCIÓN', 'EPÍLOGO'):
            # El nombre del bloque, en una o dos líneas bajo «BLOQUE N».
            bloques[-1]['titulo'] = limpiar(f"{bloques[-1]['titulo']} {texto}")
    return bloques, capitulos


def frase(texto):
    """La primera oración del texto, como título corto."""
    primera = re.split(r'(?<=[.!?:])\s+', texto.replace('\n\n', ' '), maxsplit=1)[0].strip().rstrip(' .:')
    primera = primera.lstrip('– ').strip()
    if len(primera) > 125:
        primera = primera[:122].rsplit(' ', 1)[0] + '…'
    return primera


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    filas = list(lineas(documento))
    bloques_indice, capitulos_indice = leer_indice(filas)

    presentacion, parrafo_pres = [], []
    capitulos = []   # {numero, titulo, pagina}
    medidas = []     # {codigo, seccion, pagina, parrafos, plazo}
    actual = None
    parrafo = []
    zona = 'antes'   # antes, intro, cuerpo, anexo, epilogo
    fase = None
    previa = None
    i = 0
    cuerpo = [f for f in filas if f['pagina'] >= 6]
    n_anexo = 0

    def cerrar():
        nonlocal parrafo
        if parrafo and actual is not None:
            actual['parrafos'].append(unir(parrafo))
        parrafo = []

    while i < len(cuerpo):
        fila = cuerpo[i]
        texto = fila['texto']
        if fila['pagina'] in (6, 7):
            if fila['x'] > 110 and parrafo_pres:
                presentacion.append(unir(parrafo_pres))
                parrafo_pres = []
            parrafo_pres.append(texto)
            i += 1
            continue
        if fila['pagina'] >= 57:
            break
        # Título de capítulo o del anexo (24 pt granate), en una o dos líneas.
        if fila['granate'] and fila['tam'] == 24:
            cerrar()
            actual = None
            titulo = [texto]
            while i + 1 < len(cuerpo) and cuerpo[i + 1]['granate'] and cuerpo[i + 1]['tam'] == 24 \
                    and cuerpo[i + 1]['pagina'] == fila['pagina']:
                i += 1
                titulo.append(cuerpo[i]['texto'])
            titulo = unir(titulo)
            if titulo.startswith('ANEXO'):
                zona = 'anexo'
                capitulos.append({'numero': 'A', 'titulo': titulo, 'pagina': fila['pagina']})
            else:
                zona = 'cuerpo'
                capitulo = CAPITULO_RE.match(titulo)
                capitulos.append({'numero': int(capitulo.group(1)), 'titulo': capitulo.group(2), 'pagina': fila['pagina']})
            previa = None
            i += 1
            continue

        vineta = texto.startswith('●')
        if vineta:
            texto = texto.lstrip('●').strip()

        if zona == 'cuerpo':
            codigo = CODIGO_RE.match(texto) if 95 < fila['x'] < 110 else None
            if codigo:
                cerrar()
                cap = int(codigo.group(1))
                if cap != capitulos[-1]['numero']:
                    raise ValueError(f'El punto {codigo.group(1)}.{codigo.group(2)} está en el capítulo {capitulos[-1]["numero"]}')
                actual = {'codigo': f'{cap}.{int(codigo.group(2))}', 'seccion': str(cap), 'pagina': fila['pagina'],
                          'parrafos': [], 'plazo': None}
                medidas.append(actual)
                parrafo = [codigo.group(3)]
                previa = fila
                i += 1
                continue
            sub = SUBCODIGO_RE.match(texto) if 120 < fila['x'] < 135 else None
            if sub:
                cerrar()
                parrafo = [f'{sub.group(1)}. {sub.group(2)}']
                previa = fila
                i += 1
                continue
        elif zona == 'anexo':
            mayus = re.sub(r':$', '', texto).strip()
            if fila['x'] < 95 and mayus in FASES:
                cerrar()
                actual = None
                fase = FASES[mayus]
                i += 1
                continue
            if vineta or fila['x'] < 95:
                # Cada viñeta y cada frase de introducción del anexo empieza una medida. Una frase de introducción
                # ocupa varias líneas a x = 85: solo la primera abre medida.
                abre = vineta or previa is None or previa['x'] >= 95 or fila['y'] - previa['y'] > 18 \
                    or fila['pagina'] != previa['pagina']
                if abre:
                    cerrar()
                    n_anexo += 1
                    actual = {'codigo': f'A.{n_anexo}', 'seccion': 'anexo-1', 'pagina': fila['pagina'],
                              'parrafos': [], 'plazo': fase}
                    medidas.append(actual)
                parrafo.append(texto)
                previa = fila
                i += 1
                continue

        if actual is None:
            raise ValueError(f'Texto fuera de una medida en la página {fila["pagina"]}: {texto[:80]}')
        if vineta:
            cerrar()
            parrafo = ['– ' + texto]
        else:
            parrafo.append(texto)
        previa = fila
        i += 1
    cerrar()
    if parrafo_pres:
        presentacion.append(unir(parrafo_pres))

    # El índice y el cuerpo deben tener los mismos capítulos, en el mismo orden.
    del_cuerpo = [(c['numero'], c['titulo']) for c in capitulos if c['numero'] != 'A']
    if [n for n, _ in del_cuerpo] != [n for n, _ in capitulos_indice]:
        raise ValueError(f'El índice y el cuerpo no coinciden: {capitulos_indice} / {del_cuerpo}')
    # Dentro de cada capítulo, los puntos van seguidos desde el 1.
    por_capitulo = Counter(m['seccion'] for m in medidas)
    for m in medidas:
        if m['seccion'] == 'anexo-1':
            continue
        cap, num = map(int, m['codigo'].split('.'))
        if num > por_capitulo[str(cap)]:
            raise ValueError(f'Salto en la numeración del capítulo {cap}: {m["codigo"]}')
    return documento, presentacion, bloques_indice, capitulos, medidas


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto)]


def frase_con(texto, prueba):
    """La frase (o el punto de una lista) del texto que contiene la prueba de una cifra."""
    for parte in re.split(r'(?<=[.!?])\s+|\n\n', texto):
        if prueba in parte:
            return parte.strip().lstrip('– ').strip()
    return prueba


def capitalizar(texto):
    texto = texto.lower()
    texto = texto[:1].upper() + texto[1:]
    for sigla in ('I+d+i', 'i+d+i', 'ue', 'jons'):
        texto = re.sub(rf'\b{re.escape(sigla)}\b', sigla.upper().replace('I+D+I', 'I+D+i'), texto)
    texto = re.sub(r'\b78\b', '78', texto)
    texto = texto.replace('españa', 'España').replace('régimen del 78', 'Régimen del 78').replace('euro', 'euro')
    return texto


def crear_programa(pdf):
    documento, presentacion, bloques_indice, capitulos, piezas = extraer(pdf)
    bloques = []
    primera_pagina = {}
    for capitulo in capitulos:
        b = 1 if capitulo['numero'] == 'A' else BLOQUE_DE_CAPITULO[capitulo['numero']]
        primera_pagina.setdefault(b, capitulo['pagina'])
    for bloque in bloques_indice:
        nombre = capitalizar(bloque['titulo'])
        bloques.append({
            'id': bloque['id'],
            'titulo': nombre,
            'tituloMayus': bloque['titulo'],
            'lema': '',
            'cita': '',
            'intro': '',
            'pagina': primera_pagina[bloque['id']],
        })
    secciones = []
    for capitulo in capitulos:
        numero = capitulo['numero']
        titulo = TITULOS.get(numero) or (capitalizar(capitulo['titulo']) if numero != 'A'
                                         else 'Anexo I: Plan Nacional de Remigración')
        secciones.append({
            'id': 'anexo-1' if numero == 'A' else str(numero),
            'bloque': 1 if numero == 'A' else BLOQUE_DE_CAPITULO[numero],
            'titulo': titulo,
            'tituloFrase': titulo,
            'intro': '',
            'pagina': capitulo['pagina'],
            'subapartados': [],
        })
    # El anexo va detrás del capítulo 1, como en el PDF: las secciones siguen el orden del documento.

    medidas, por_codigo = [], {}
    for n, pieza in enumerate(piezas, start=1):
        texto = '\n\n'.join(pieza['parrafos'])
        if not texto:
            raise ValueError(f'La medida {pieza["codigo"]} no tiene texto')
        codigo = pieza['codigo']
        capitulo = 'A' if codigo.startswith('A.') else int(codigo.split('.')[0])
        medida = {
            'n': n,
            'bloque': 1 if capitulo == 'A' else BLOQUE_DE_CAPITULO[capitulo],
            'seccion': pieza['seccion'],
            'pagina': pieza['pagina'],
            'subapartado': None,
            'titulo': '',
            'tituloFrase': frase(texto),
            'texto': texto,
            'oculta': False,
            'categoria': CATEGORIA_MEDIDA.get(codigo, CATEGORIA_CAPITULO[capitulo]),
            'colectivos': coincidencias(texto, COLECTIVOS),
            'palancas': coincidencias(texto, PALANCAS),
            'territorios': coincidencias(texto, TERRITORIOS),
            'cifras': [],
            'plazo': pieza['plazo'],
            'deroga': None,
        }
        if codigo in DEROGA:
            if not re.search(r'derog', texto, re.I):
                raise ValueError(f'La medida {codigo} no dice «derogar»')
            medida['deroga'] = DEROGA[codigo]
        medidas.append(medida)
        por_codigo[codigo] = medida

    for tabla, nombre in ((CATEGORIA_MEDIDA, 'CATEGORIA_MEDIDA'), (DEROGA, 'DEROGA')):
        sobrantes = set(tabla) - set(por_codigo)
        if sobrantes:
            raise ValueError(f'{nombre} tiene códigos que no son medidas: {sorted(sobrantes)}')

    cifras = []
    for valor, unidad, texto, codigo, prueba in CIFRAS:
        medida = por_codigo[codigo]
        if prueba not in medida['texto']:
            raise ValueError(f'La cifra «{valor}» no aparece en la medida {codigo}: «{prueba}»')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': medida['n']})
        frase_cifra = frase_con(medida['texto'], prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)

    for codigo, prueba in CIFRAS_MEDIDA:
        medida = por_codigo[codigo]
        if prueba not in medida['texto']:
            raise ValueError(f'La cifra de la medida {codigo} no aparece en su texto: «{prueba}»')
        frase_cifra = frase_con(medida['texto'], prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)

    plazos = []
    for medida in medidas:
        if medida['plazo']:
            plazos.append({'plazo': medida['plazo'], 'texto': medida['tituloFrase'], 'medida': medida['n']})
    for codigo, plazo, texto, prueba in PLAZOS:
        medida = por_codigo[codigo]
        if prueba not in medida['texto']:
            raise ValueError(f'El plazo «{plazo}» no aparece en la medida {codigo}: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': medida['n']})
    orden = ORDEN_PLAZOS + [p for p in dict.fromkeys(x['plazo'] for x in plazos) if p not in ORDEN_PLAZOS]
    plazos.sort(key=lambda p: (orden.index(p['plazo']), p['medida']))

    return {
        'id': ID,
        'partido': 'Falange Española de las J.O.N.S.',
        'siglas': 'FE de las JONS',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Programa electoral 29N',
        'subtitulo': f'{len(medidas)} medidas en seis bloques, de la remigración a los servicios esenciales',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'El PDF no estaba publicado en la web del partido al incorporarlo: es el documento que se facilitó a '
            'la redacción en Google Drive, y la fuente enlaza a esa copia.',
            'La fecha de las elecciones (29 de noviembre de 2026) solo está en la portada, que es una imagen. La '
            'fecha del documento es la de los metadatos del PDF (13 de noviembre de 2026).',
            'Las medidas no tienen título: el título corto de cada una es su primera frase. El Anexo I (Plan '
            'Nacional de Remigración) no está numerado: cada frase de introducción y cada viñeta es una medida, '
            'con la fase del plan como plazo.',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': 'Introducción', 'texto': '\n\n'.join(presentacion)},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': [p for p in orden if any(x['plazo'] == p for x in plazos)],
        'verbos': [],
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
                archivo.write(f"\n### {medida['n']} [{codigo}] p.{medida['pagina']} {medida['categoria']}"
                              f"{' plazo=' + medida['plazo'] if medida['plazo'] else ''}\n")
                archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
