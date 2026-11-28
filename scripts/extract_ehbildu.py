"""Extrae el programa de EH Bildu («Garantía y derechos», elecciones generales 2026) al esquema compartido.

Estructura del PDF (30 páginas, A4, maquetado en InDesign; tipografías Bildu Circular, Bildu Sans y Tiempos Text):
- Página 1: portada. Páginas 2-3: índice. Página 4: «Nuestro compromiso» (la presentación, sin medidas).
- Capítulos: BilduCircular-Bold 28 pt («1. Derechos y libertades»). Hay tres.
- Secciones: BilduSans-Bold 16 pt («1.1. Vivienda»). Algunas tienen subapartados: BilduSans-Regular 9,5 pt, en
  mayúsculas, con tres niveles de número («1.5.1 SALUD…», «3.2.10 …»). Los rótulos sueltos en Tiempos Semibold
  («Ciudadanía», «Profesionales.», «Gobernanza.», en 1.5.1) agrupan viñetas dentro de un subapartado; no son una
  propuesta y se omiten.
- Texto: TiemposText 9,5 pt. Una viñeta «•» (x = 57; el texto, en x = 75) es una propuesta. Las «»» (x = 75) son
  los puntos de esa propuesta. Los párrafos sin viñeta antes de la primera son la introducción de la sección.
- Cabecera («PROGRAMA», y ≈ 55) y pie (número de página, y ≈ 785): se ignoran. Los guiones de fin de línea son
  guiones blandos (U+00AD).

Esquema:
- Capítulo → bloque. Sección → sección. Subapartado → subapartado de su sección.
- Cada viñeta «•», con sus puntos «»», es una propuesta (`n` correlativo). El programa no las numera ni las titula:
  el título es el rótulo («Ambición climática: …») si lo tiene, y si no la primera frase, recortada. El texto es
  siempre la viñeta entera; los puntos «»» van como párrafos que empiezan por «– ».
- Las secciones sin viñetas (2.3, 2.6 y 3.2) son prosa: cada párrafo con un compromiso es una propuesta.
- En 2.5 la última propuesta («Reservas de cuotas para la diversidad…») perdió su viñeta en el PDF: se trata como
  una más.

El número de propuestas se comprueba contra `TOTAL_MEDIDAS`.

Uso: python scripts/extract_ehbildu.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'eh-bildu'
PDF_PUBLICO = '/programas/eh-bildu-garantia-y-derechos-2026.pdf'
FUENTE = 'https://ehbildu.eus/media/dokumentuak/posibleegin-programa-cas.pdf'
FECHA_PDF = '2026-11-16'  # creationDate de los metadatos
PAGINAS = 30
PAGINA_PRESENTACION = 4
TOTAL_MEDIDAS = 188
COLOR = '#00C19F'
COLOR_CLARO = '#00C19F'

BLOQUES = {
    1: 'Derechos y libertades',
    2: 'Nación y autogobierno',
    3: 'Paz y convivencia',
}

# Categoría por defecto de cada sección o subapartado («1.5.1»).
CATEGORIA = {
    '1.1': 'vivienda', '1.2': 'empleo', '1.3': 'social', '1.4': 'social',
    '1.5.1': 'sanidad', '1.5.2': 'educacion', '1.5.3': 'social', '1.5.4': 'administracion',
    '1.6': 'social', '1.7': 'familia', '1.8': 'fiscalidad',
    '1.9.1': 'energia', '1.9.2': 'innovacion', '1.9.3': 'rural', '1.9.4': 'infraestructuras',
    '1.9.5': 'vivienda', '1.9.6': 'fiscalidad',
    '1.10': 'social', '1.10.1': 'social', '1.11': 'inmigracion', '1.12': 'innovacion', '1.13': 'democracia',
    '2.1': 'territorio', '2.2': 'territorio', '2.3': 'territorio', '2.4': 'identidad', '2.5': 'identidad',
    '2.6': 'identidad',
    '3.1': 'identidad',
    '3.2.1': 'exterior', '3.2.2': 'exterior', '3.2.3': 'exterior', '3.2.4': 'defensa', '3.2.5': 'defensa',
    '3.2.6': 'defensa', '3.2.7': 'exterior', '3.2.8': 'exterior', '3.2.9': 'exterior', '3.2.10': 'exterior',
}

# Excepciones: (apartado, patrón sobre el título y la primera frase, categoría). Gana la primera que coincide.
CATEGORIA_PROPUESTA = [
    ('1.2', r'Inspecci[oó]n de Trabajo|empleadas de hogar|homologaci[oó]n', 'empleo'),
    ('1.2', r'prestaciones y desem|desempleo', 'social'),
    ('1.4', r'bono social', 'social'),
    ('1.4', r'gas utilizado|electricidad|energ[eé]tic|combustibles|bono social', 'energia'),
    ('1.4', r'alimentari|alimentos|agr[ií]col|ganader|pesca', 'rural'),
    ('1.4', r'transporte|viajero|tarifas', 'infraestructuras'),
    ('1.4', r'formaci[oó]n de precios', 'energia'),
    ('1.5.1', r'Eutanasia|violencia obst[eé]trica|derecho al olvido oncol', 'sanidad'),
    ('1.5.4', r'euskara', 'identidad'),
    ('1.5.4', r'negociaci[oó]n colectiva|competencia para decidir', 'territorio'),
    ('1.6', r'Ingreso M[ií]nimo Vital', 'social'),
    ('1.7', r'oficinas de extranjer[ií]a', 'inmigracion'),
    ('1.7', r'participaci[oó]n de j[oó]venes', 'democracia'),
    ('1.8', r'art[ií]culo 135|reglas fiscales|austeridad', 'administracion'),
    ('1.9.1', r'bono social', 'social'),
    ('1.9.4', r'Competencias [ií]ntegras', 'territorio'),
    ('1.9.4', r'Ayudas progresivas y leasing', 'innovacion'),
    ('1.9.5', r'Electrificaci[oó]n t[eé]rmica', 'energia'),
    ('1.9.5', r'Financiaci[oó]n para la rehabilitaci[oó]n', 'vivienda'),
    ('1.9.6', r'Respeto a las Haciendas', 'territorio'),
    ('1.10', r'aborto', 'sanidad'),
    ('1.10', r'violencia|violencias|acoso|v[ií]ctimas|machista|antifeminista', 'seguridad'),
    ('1.10.1', r'ITS y VIH', 'sanidad'),
    ('1.10.1', r'delitos de odio', 'seguridad'),
    ('1.12', r'menores de edad', 'familia'),
    ('1.12', r'tecnolog[ií]as ling[uü][ií]sticas', 'identidad'),
    ('1.12', r'Gobernanza democr[aá]tica', 'democracia'),
    ('1.12', r'Empleo, distribuci[oó]n', 'empleo'),
    ('1.13', r'Ley Mordaza', 'seguridad'),
    ('1.13', r'delitos del c[oó]digo penal|discurso de odio', 'justicia'),
    ('3.1', r'legislaci[oó]n penitenciaria|presas', 'justicia'),
    ('3.1', r'Secretos Oficiales', 'democracia'),
    ('3.1', r'repliegue|condecoraciones', 'seguridad'),
    ('3.2.2', r'gasto en defensa|env[ií]o de armas', 'defensa'),
]

# Derogaciones explícitas: (apartado, prueba literal en el texto, ley derogada).
DEROGA = [
    ('1.5.1', 'Derogar la Ley 15/1997', 'Ley 15/1997 sobre nuevas formas de gestión del Sistema Nacional de Salud'),
    ('1.8', 'Derogar la modificación del artículo 135', 'Reforma del artículo 135 de la Constitución'),
    ('3.1', 'Derogar la Ley de Secretos Oficiales', 'Ley de Secretos Oficiales'),
]

# Cifras clave: (valor, unidad, texto, apartado, inicio de la propuesta, prueba literal).
CIFRAS = [
    ('32 h', 'jornada semanal', 'jornada de 32 horas semanales o de 4 días, sin reducción salarial', '1.2',
     'Reducción de la jornada laboral', '32 horas semanales'),
    ('45 días', 'de indemnización', 'por despido improcedente, como mínimo', '1.2',
     'Establecer la adaptación a la realidad socioeconómica', 'al menos 45 días'),
    ('1.220 €', 'pensión mínima', 'subida de las pensiones mínimas, como mínimo, y actualizada con el SMI', '1.3',
     'Aumentar las pensiones mínimas', '1.220 €'),
    ('15 %', 'pensiones de viudedad y no contributivas', 'nueva subida de al menos el 15 %', '1.3',
     'Nuevo alza de las pensiones de viudedad', 'al menos un 15 %'),
    ('2 %', 'tope de la subida del alquiler', 'máximo de actualización anual de la renta si el IPC lo supera', '1.1',
     'Establecer de manera estructural el máximo de 2%', 'máximo de 2%'),
    ('21 %', 'IVA de los pisos turísticos', 'IVA de los alojamientos turísticos de corta duración', '1.1',
     'Establecer un IVA del 21%', '21%'),
    ('6 %', 'de inversión educativa', 'a la que acercarse progresivamente, según la referencia de la UNESCO', '1.5.2',
     'Aumentar la financiación', '6%'),
    ('53 %', 'plazas MIR, EIR y PIR', 'reserva transitoria para profesionales que dominen las dos lenguas oficiales del País Vasco',
     '1.5.1', 'Transitoriamente y mientras la transferencia', '53%'),
    ('15 %', 'del Fondo de la Cinematografía', 'mínimo para proyectos en lenguas oficiales distintas del castellano', '2.5',
     'Que un mínimo del 15%', '15%'),
    ('100 %', 'subvención a la rehabilitación', 'para las personas más vulnerables, que puede llegar a cubrir toda la obra',
     '1.9.5', 'Financiación para la rehabilitación', 'puede llegar al 100%'),
    ('21 %', 'IVA de los pisos turísticos', 'IVA de los alojamientos turísticos de corta duración (repite la propuesta de vivienda)',
     '1.8', 'Establecer un 21% de IVA', '21%'),
    ('3 meses', 'periodo de prueba', 'máximo para el personal técnico titulado, y un mes para el resto, si no hay pacto colectivo',
     '1.2', 'Control de las extinciones', 'máximo de 3 meses'),
    ('2 años', 'de padrón', 'inscripción previa para que un extranjero multipropietario compre vivienda', '1.1',
     'Condicionar la compra de vivienda', '2 años previos'),
    ('40 años', 'de cotización', 'para jubilarse sin penalización', '1.3', 'Culminar la tramitación',
     'al menos 40 años de cotización'),
]

# Plazos: (apartado, inicio de la propuesta, plazo, texto, prueba literal).
PLAZOS = [
    ('1.2', 'Reducción de la jornada laboral', 'En 3 años',
     'Pymes: de 35 a 32 horas en una senda progresiva de 3 años como máximo', 'plazo máximo de 3 años'),
    ('1.9.1', 'Ambición climática', '2045', 'Adelantar la descarbonización, al menos, a 2045', 'al menos, a 2045'),
]
ORDEN_PLAZOS = ['En 3 años', '2045']

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes\b|\bjuventud\b',
    'mayores': r'\bpensionistas?\b|\bpersonas mayores\b|\bjubilaci[oó]n\b|\bviudedad\b',
    'mujeres': r'\bmujer(?:es)?\b|violencia (?:machista|vicaria|obst[eé]trica|sexual)|\bfeminis\w*|\bmaternidad\b',
    'familias': r'\bfamilias?\b|conciliaci[oó]n|\bcrianza\b|\bpaternidad\b',
    'infancia': r'\binfancia\b|\bni[ñn][oa]s\b|\bmenores\b|\balumnado\b|\blactancia\b',
    'autonomos': r'(?<!comunidades )\baut[oó]nom[oa]s\b|\bpymes?\b|\bmicro\b',
    'empresas': r'\bempresas?\b|\bindustri\w*|\bdistribuidoras\b',
    'rural': r'\bmundo rural\b|\bmedio rural\b|\bagricultur\w*|\bganader\w*|\bprimer sector\b|\bpesquer\w*',
    'funcionarios': r'\bfuncionari\w*|\bempleo p[uú]blico\b|\bprofesionales (?:sanitari|de la salud)\w*|\bprofesionales\b.*\bMIR\b',
    'discapacidad': r'\bdiscapacidad\b|\b(?:ley de|atenci[oó]n a la|por la) dependencia\b|\bpersonas dependientes\b',
    'victimas': r'\bv[ií]ctimas\b',
    'inmigrantes': r'\bmigrantes?\b|\binmigrantes\b|\brefugiad\w*|\basilo\b|personas extranjeras|\bextranjer[ií]a\b|titulaciones extranjeras|\bracismo\b',
    'pacientes': r'\bpacientes\b|\bsanidad p[uú]blica\b|\bSistema (?:Nacional|P[uú]blico) de Salud\b|\bsalud mental\b',
    'agentes': r'\bFuerzas (?:y Cuerpos )?de Seguridad\b|\bGuardia Civil\b|\bpol[ií]cia\b|\bpelotas de goma\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|\bderog\w*|\breform\w*|\blegisla\w*|\bprohib\w*|C[oó]digo Penal|\bnormativ\w*|\bpenaliz\w*|\bregular\b|\bregulaci[oó]n\b',
    'impuestos': r'\bIVA\b|\bIRPF\b|\bfiscal\w*|\bimpuestos?\b|\bdeducci\w*|\btribut\w*|\bgravamen\b|\bgravar\b',
    'gasto': r'\binversi[oó]n\b|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b(?! de inversi)|\bayudas?\b|\bsubvenci\w*|\bbonos?\b|\bdotar\b|\bdotaci[oó]n\b',
    'organizacion': r'\bcreaci[oó]n\b|\bcrear\b|\bagencia\b|\borganismo\b|\bobservatorio\b|\bregistro\b|\btransferencia\b|\bcompetencias?\b|\boficinas?\b',
    'plan': r'\bplan(?:es)?\b|\bestrategia\b|\bprogramas?\b|\bpacto\b|\bcampañas?\b|\bprotocolos?\b|\bPNIEC\b',
}

TERRITORIOS = {
    'Unión Europea': r'\bUni[oó]n Europea\b|\bParlamento Europeo\b|\bComisi[oó]n Europea\b|\bPAC\b|\bPol[ií]tica Pesquera Com[uú]n\b|\bEuropa\b',
    'Navarra': r'\bNavarra\b|\bNafarroa\b|\bBardenas\b|\bBardeak\b',
    'País Vasco': r'\bCAPV\b|\bPa[ií]s Vasco\b|\bComunidad Aut[oó]noma (?:del Pa[ií]s )?Vasca\b|\bHego Euskal Herria\b|(?<!Ipar )\bEuskal Herria\b',
    'Palestina': r'\bPalestin\w*',
    'Sáhara Occidental': r'\bSahara\b|\bsaharaui\w*',
}

def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    texto = texto.replace('\xa0', ' ').replace('\t', ' ')
    return re.sub(r'\s+', ' ', texto).strip()


def unir(piezas):
    """Une líneas: el guion blando (U+00AD) al final de línea corta la palabra, que se cierra sin espacio."""
    resultado = ''
    for pieza in piezas:
        pieza = pieza.strip(' \t')
        if not pieza:
            continue
        if resultado.endswith('\xad'):
            resultado = resultado[:-1] + pieza
        elif re.search(r'[a-záéíóúñ]-$', resultado) and pieza[:1].islower():
            resultado = resultado[:-1] + pieza
        else:
            resultado = f'{resultado} {pieza}'.strip()
    return limpiar(resultado.replace('\xad', ''))


def lineas(documento):
    """Las líneas del cuerpo, con las piezas de la misma altura unidas de izquierda a derecha."""
    for numero, pagina in enumerate(documento, start=1):
        if numero < PAGINA_PRESENTACION:
            continue
        piezas = []
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip(' \t\n')]
                if not spans:
                    continue
                y = round(linea['bbox'][1], 1)
                if y < 70 or y > 770:  # cabecera «PROGRAMA» y número de página
                    continue
                piezas.append([y, linea['bbox'][0], list(spans)])
        piezas.sort(key=lambda p: (p[0], p[1]))
        filas = []
        for y, x, spans in piezas:
            if filas and abs(filas[-1][0] - y) < 2:
                filas[-1][2].extend(spans)
            else:
                filas.append([y, x, spans])
        for y, x, spans in filas:
            # De izquierda a derecha: el «»» (MyriadPro) queda un poco más alto o bajo que su texto.
            spans.sort(key=lambda s: s['bbox'][0])
            texto = ''
            for anterior, span in zip([None] + spans[:-1], spans):
                hueco = anterior is not None and span['bbox'][0] - anterior['bbox'][2] > 1
                if hueco and not texto.endswith((' ', '\t', '\xad')) and not span['text'].startswith((' ', '\t')):
                    texto += ' '
                texto += span['text']
            yield {
                'pagina': numero, 'y': y, 'x': min(s['bbox'][0] for s in spans), 'texto': texto,
                'fuente': spans[0]['font'], 'tam': round(spans[0]['size'], 1),
            }


def elementos(documento):
    """Los elementos del cuerpo en orden: bloque (B), sección (S), subapartado (SS), viñeta (U), punto (V),
    párrafo (P) y párrafo suelto dentro de una viñeta (W)."""
    items = []
    cur = None
    prev = None

    def cerrar():
        nonlocal cur
        if cur:
            cur['t'] = unir(cur['lineas'])
            items.append(cur)
            cur = None

    for r in lineas(documento):
        t, f = r['texto'], r['fuente']
        mismo = prev is not None and prev['pagina'] == r['pagina']
        if r['tam'] == 28:
            if cur and cur['k'] == 'B' and mismo and prev['tam'] == 28:
                cur['lineas'].append(t)
            else:
                cerrar()
                cur = {'k': 'B', 'p': r['pagina'], 'lineas': [t]}
        elif r['tam'] == 16:
            if cur and cur['k'] == 'S' and mismo and prev['tam'] == 16 and not re.match(r'\d+\.\d+\.', t):
                cur['lineas'].append(t)
            else:
                cerrar()
                cur = {'k': 'S', 'p': r['pagina'], 'lineas': [t]}
        elif f.startswith('BilduSans-Regular') and r['tam'] == 9.5:
            if re.match(r'\d+\.\d+\.\d+', t):
                cerrar()
                cur = {'k': 'SS', 'p': r['pagina'], 'lineas': [t]}
            elif cur and cur['k'] == 'SS' and mismo and r['y'] - prev['y'] < 16:
                cur['lineas'].append(t)
            else:
                raise ValueError(f'Texto inesperado en BilduSans-Regular, página {r["pagina"]}: {t!r}')
        elif t.startswith('•') or t.startswith('»'):
            cerrar()
            cur = {'k': 'U' if t[0] == '•' else 'V', 'p': r['pagina'], 'lineas': [t[1:].lstrip(' \t')]}
        else:
            salto = r['y'] - prev['y'] if mismo else None
            nuevo_parrafo = cur is None or cur['k'] in ('B', 'S', 'SS') or (salto is not None and salto > 17)
            if cur and cur['k'] in ('U', 'V', 'P', 'W') and not nuevo_parrafo:
                cur['lineas'].append(t)
            else:
                previo = cur['k'] if cur else None
                cerrar()
                # Un párrafo sangrado (x = 75) tras una viñeta es otro párrafo de esa viñeta.
                if previo in ('U', 'V', 'W') and r['x'] > 70:
                    cur = {'k': 'W', 'p': r['pagina'], 'lineas': [t]}
                else:
                    cur = {'k': 'P', 'p': r['pagina'], 'lineas': [t]}
        prev = r
    cerrar()
    return items


def leer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    # Presentación: página 4, «Nuestro compromiso».
    items = elementos(documento)
    presentacion = []
    bloques, secciones, propuestas = [], [], []
    bloque = seccion = subapartado = None
    con_vinetas = set()
    # Una pasada previa: qué secciones o subapartados tienen viñetas.
    clave = None
    for it in items:
        if it['k'] == 'S':
            clave = re.match(r'(\d+\.\d+)', it['t']).group(1)
        elif it['k'] == 'SS':
            clave = re.match(r'(\d+\.\d+\.\d+)', it['t']).group(1)
        elif it['k'] == 'U' and clave:
            con_vinetas.add(clave)
            con_vinetas.add('.'.join(clave.split('.')[:2]))

    ultimo_u = None
    for it in items:
        k, t, p = it['k'], it['t'], it['p']
        if k == 'B':
            m = re.match(r'^(\d+)\.\s*(.*)$', t)
            if m:
                bloque = {'id': int(m.group(1)), 'titulo_pdf': m.group(2), 'pagina': p, 'intro': []}
                bloques.append(bloque)
                seccion = subapartado = None
            else:
                presentacion_titulo = t
            ultimo_u = None
        elif k == 'S':
            m = re.match(r'^(\d+\.\d+)\.\s*(.*)$', t)
            seccion = {'id': m.group(1), 'bloque': int(m.group(1).split('.')[0]), 'titulo': m.group(2), 'pagina': p,
                       'intro': [], 'subapartados': []}
            secciones.append(seccion)
            subapartado = None
            ultimo_u = None
        elif k == 'SS':
            m = re.match(r'^(\d+\.\d+\.\d+)\s*(.*)$', t)
            titulo = m.group(2).strip().rstrip('.:')
            titulo = titulo[:1] + titulo[1:].lower()
            for mal, bien in (('Lgtbiq+', 'LGTBIQ+'), ('otan', 'OTAN'), ('bardeak', 'Bardeak'), ('palestina', 'Palestina'),
                              ('cuba', 'Cuba')):
                titulo = re.sub(rf'\b{re.escape(mal)}(?!\w)', bien, titulo)
            subapartado = {'id': m.group(1), 'titulo': titulo, 'intro': [], 'indice': len(seccion['subapartados'])}
            seccion['subapartados'].append(subapartado)
            ultimo_u = None
        elif k == 'U':
            ultimo_u = {'seccion': seccion['id'] if seccion else None, 'bloque': seccion['bloque'], 'pagina': p,
                        'subapartado': subapartado, 'parrafos': [t]}
            propuestas.append(ultimo_u)
        elif k in ('V', 'W'):
            if ultimo_u is None:
                raise ValueError(f'Punto sin viñeta en la página {p}: {t[:60]!r}')
            ultimo_u['parrafos'].append(('– ' + t) if k == 'V' else t)
        elif k == 'P':
            if seccion is None:
                (bloque['intro'] if bloque else presentacion).append(t)
                continue
            clave = subapartado['id'] if subapartado else seccion['id']
            tiene = clave in con_vinetas
            if tiene and len(t) < 40:  # rótulo de grupo («Ciudadanía», «Profesionales.»): no es una propuesta
                continue
            if not tiene:
                # Sección o subapartado en prosa: cada párrafo es una propuesta (2.3, 2.6, 3.2.x), salvo la
                # introducción de 3.1, que sí tiene viñetas.
                ultimo_u = {'seccion': seccion['id'], 'bloque': seccion['bloque'], 'pagina': p,
                            'subapartado': subapartado, 'parrafos': [t]}
                propuestas.append(ultimo_u)
            elif ultimo_u is not None and ultimo_u['seccion'] == seccion['id'] and (ultimo_u['subapartado'] is subapartado):
                # Párrafo largo tras una viñeta: una viñeta sin marca en el PDF (2.5).
                ultimo_u = {'seccion': seccion['id'], 'bloque': seccion['bloque'], 'pagina': p,
                            'subapartado': subapartado, 'parrafos': [t]}
                propuestas.append(ultimo_u)
            else:
                (subapartado['intro'] if subapartado else seccion['intro']).append(t)
    return documento, presentacion, bloques, secciones, propuestas


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def titulo_de(texto):
    """Rótulo de la viñeta («Ambición climática: …») o, si no lo tiene, su primera frase recortada."""
    primera = texto.split('\n')[0]
    rotulo = re.match(r'^([^:.]{6,110}):\s', primera)
    if rotulo and not re.search(r'\b(?:aremos|eremos|iremos)\b', rotulo.group(1)):
        return rotulo.group(1).strip()
    frase = re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])', primera)[0].strip().rstrip('.:;')
    if len(frase) > 125:
        frase = frase[:122].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'
    return frase


def categoria_de(apartado, seccion, titulo, texto):
    asunto = f'{titulo} {texto.split(chr(10))[0][:240]}'
    for clave, patron, categoria in CATEGORIA_PROPUESTA:
        if clave in (apartado, seccion) and re.search(patron, asunto, re.IGNORECASE):
            return categoria
    return CATEGORIA.get(apartado) or CATEGORIA[seccion]


def frase_con(texto, prueba):
    for parte in re.split(r'(?<=[.!?])\s+|\n', texto):
        if prueba in parte:
            return parte.strip().lstrip('– ').strip()
    return prueba


def buscar(medidas, apartado, inicio):
    candidatas = [m for m in medidas if m['_apartado'] == apartado and m['texto'].startswith(inicio)]
    if len(candidatas) != 1:
        raise ValueError(f'«{inicio}» en {apartado}: {len(candidatas)} coincidencias')
    return candidatas[0]


def crear_programa(pdf):
    documento, presentacion, bloques_pdf, secciones_pdf, propuestas = leer(pdf)

    bloques = []
    for b in bloques_pdf:
        nombre = BLOQUES[b['id']]
        bloques.append({
            'id': b['id'], 'titulo': nombre, 'tituloMayus': nombre.upper(), 'lema': b['titulo_pdf'], 'cita': '',
            'intro': '\n\n'.join(b['intro']), 'pagina': b['pagina'],
        })

    secciones = []
    for s in secciones_pdf:
        secciones.append({
            'id': s['id'], 'bloque': s['bloque'], 'titulo': s['titulo'],
            'tituloFrase': titulo_de(s['titulo']) if len(s['titulo']) > 125 else s['titulo'],
            'intro': '\n\n'.join(s['intro']), 'pagina': s['pagina'],
            'subapartados': [{'titulo': a['titulo'], 'intro': '\n\n'.join(a['intro'])} for a in s['subapartados']],
        })

    medidas = []
    for n, pr in enumerate(propuestas, start=1):
        sub = pr['subapartado']
        apartado = sub['id'] if sub else pr['seccion']
        texto = '\n\n'.join(pr['parrafos'])
        titulo = titulo_de(texto)
        completo = f'{titulo} {texto}'
        medidas.append({
            'n': n, 'bloque': pr['bloque'], 'seccion': pr['seccion'], 'pagina': pr['pagina'],
            'subapartado': sub['indice'] if sub else None,
            'titulo': titulo, 'tituloFrase': titulo, 'texto': texto, 'oculta': False,
            'categoria': categoria_de(apartado, pr['seccion'], titulo, texto),
            'colectivos': coincidencias(completo, COLECTIVOS),
            'palancas': coincidencias(completo, PALANCAS),
            'territorios': coincidencias(completo, TERRITORIOS),
            'cifras': [], 'plazo': None, 'deroga': None, '_apartado': apartado,
        })

    if TOTAL_MEDIDAS and len(medidas) != TOTAL_MEDIDAS:
        raise ValueError(f'Se esperaban {TOTAL_MEDIDAS} propuestas y hay {len(medidas)}')

    for apartado, prueba, ley in DEROGA:
        candidatas = [m for m in medidas if m['_apartado'] == apartado and prueba in m['texto']]
        if len(candidatas) != 1:
            raise ValueError(f'Deroga «{ley}»: {len(candidatas)} coincidencias en {apartado}')
        if not re.search(r'derog', candidatas[0]['texto'], re.I):
            raise ValueError(f'La propuesta que deroga «{ley}» no dice «derogar»')
        candidatas[0]['deroga'] = ley

    cifras = []
    for valor, unidad, texto, apartado, inicio, prueba in CIFRAS:
        medida = buscar(medidas, apartado, inicio)
        if prueba not in medida['texto']:
            raise ValueError(f'La cifra «{valor}» no aparece en «{inicio}»: «{prueba}»')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': medida['n']})
        frase_cifra = frase_con(medida['texto'], prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)

    plazos = []
    for apartado, inicio, plazo, texto, prueba in PLAZOS:
        medida = buscar(medidas, apartado, inicio)
        if prueba not in medida['texto']:
            raise ValueError(f'El plazo «{plazo}» no aparece en «{inicio}»: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': medida['n']})

    # Los verbos no se escriben aquí: el programa va en infinitivo y `src/lib/verbs.ts` los calcula.

    for medida in medidas:
        del medida['_apartado']

    return {
        'id': ID,
        'partido': 'EH Bildu',
        'siglas': 'EH BILDU',
        'comunidad': 'País Vasco',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Garantía y derechos',
        'subtitulo': f'{len(medidas)} propuestas en tres capítulos: derechos y libertades, nación y autogobierno, '
                     'paz y convivencia',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'El programa no numera ni titula sus propuestas: cada viñeta es una propuesta, con sus puntos. Las secciones '
            'en prosa (2.3, 2.6 y 3.2) cuentan un párrafo por propuesta. En la sección 2.5 la última propuesta pierde su '
            'viñeta en el PDF y se cuenta como una más.',
            'El propio PDF repite algunas propuestas (51 y 52, 10 y 86, 82 y 138, 36 y 73): se cuentan las dos veces.',
            'La fuente enlazada es el PDF que publica el diario Naiz (naiz.eus); el documento se presenta como el '
            'programa de EH Bildu («Euskal Herria Bildu»). La fecha es la de creación del PDF. No se ha encontrado aún en la web de EH Bildu (16 de noviembre de 2026): '
            'la URL se sustituirá si aparece.',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {'titulo': 'Nuestro compromiso', 'texto': '\n\n'.join(presentacion)},
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
        with open(volcado, 'w', encoding='utf-8') as archivo:
            for medida in programa['medidas']:
                archivo.write(f"\n### {medida['n']} [{medida['seccion']}/{medida['subapartado']}] p.{medida['pagina']} "
                              f"{medida['categoria']} | {medida['titulo']}\n")
                archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'propuestas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
