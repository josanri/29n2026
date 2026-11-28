"""Extrae y clasifica el programa electoral 29N de Ara Més-Front Ampli (9 páginas en pliegos, 160 medidas).

Uso: python scripts/extract_arames.py PDF SALIDA.json [--depurar volcado.txt]

Estructura del PDF oficial (9 páginas en formato pliego doble, catalán, creado el 17 de noviembre de 2026):
- Página 1: portada («PROGRAMA ELECTORAL · Eleccions 29 novembre 2026»).
- Páginas 2 a 9: pliegos dobles (mitad izquierda x < 600, mitad derecha x >= 600; numeración impresa 2 a 17).
- Bloques (5): SpecialGothic-Bold 21 pt en rojo (#e73f25).
- Secciones (24): SpecialGothic-Bold 14 pt en negro.
- Medidas (160, numeradas correlativamente del 1 al 160 sin saltos): número «N.» en x ≈ 92,7 (izquierda) o
  x ≈ 688,0 (derecha) y cuerpo en SpecialGothic-Regular 10 pt en x ≈ 128,7 o x ≈ 724,0. Las medidas 93 y 123
  continúan en la columna o página siguiente. No tienen título propio: la primera frase hace de título corto.
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

from clasificacion import COLECTIVOS, PALANCAS, TERRITORIOS, coincidencias

ID = 'arames'
PDF_PUBLICO = '/programas/arames-programa-29n-2026.pdf'
FUENTE_PDF = 'https://media.timtul.com/media/web_mespermallorca/ProgramaElectoral29N_Corregit%20(1)_20261117173133.pdf'
FECHA_PDF = '2026-11-17'
PAGINAS = 9
TOTAL_BLOQUES = 5
TOTAL_SECCIONES = 24
TOTAL_MEDIDAS = 160

BLOQUE_TITULOS = {
    'LA VIDA MÉS FÀCIL': 'La vida més fàcil',
    'HABITATGE': 'Habitatge',
    'CANVI DE MODEL ECONÒMIC': 'Canvi de model econòmic',
    'IGUALTAT, DRETS I SERVEIS PÚBLICS': 'Igualtat, drets i serveis públics',
    'CANVIS SOCIALS I GLOBALS': 'Canvis socials i globals',
}

# Categoría base por sección (orden de lectura 1..24).
CATEGORIA_SECCION = {
    'Arribar a final de mes': 'social',
    'Treball de qualitat': 'empleo',
    'Desplaçar-nos': 'infraestructuras',
    'Cases assequibles i per viure-hi': 'vivienda',
    'Acabar amb la massificació turística': 'innovacion',
    'Diversificació econòmica': 'innovacion',
    'Agricultura, ramaderia i pesca': 'rural',
    'Energia': 'energia',
    'Finançament i inversions': 'territorio',
    'Serveis públics i nous drets': 'administracion',
    'Educació pública': 'educacion',
    'Sanitat': 'sanidad',
    'Sistema de Dependència i Cures': 'social',
    'Eradicació de la pobresa': 'social',
    'Igualtat efectiva: vides lliures de masclisme i LGTBIfòbia': 'social',
    'Joventut': 'social',
    'Medi ambient i territori': 'energia',
    'Autogovern': 'territorio',
    'El català, llengua de ple dret': 'identidad',
    'Cultura': 'identidad',
    'En defensa de la democràcia': 'democracia',
    'Migracions i antiracisme': 'inmigracion',
    'Pau, solidaritat i Europa': 'exterior',
    'Drets dels animals': 'rural',
}

# Excepciones medida a medida (n -> id de taxonomia.json).
CATEGORIA_MEDIDA = {
    1: 'empleo',           # Salari Mínim Interprofessional Illenc y SMI estatal 60%
    3: 'energia',          # Topall de preu als carburants
    4: 'innovacion',       # Control del preu de la cistella d'aliments bàsics
    5: 'fiscalidad',       # IVA propi reduït y eliminació de l'IVA al transport de mercaderies
    6: 'familia',          # Prestació universal de 200 € per menor + menjador escolar gratuït
    7: 'energia',          # Bo social i prohibició del tall de llum, aigua i gas
    16: 'social',          # Jubilació anticipada per a les cambreres de pis (kellys)
    29: 'vivienda',        # Extingir llicències turístiques + IVA 21% + IBI 150%
    30: 'fiscalidad',      # Exempció ITP primer habitatge, recàrrec 200% / 1000%
    31: 'fiscalidad',      # IBI progressiu, impost especulació, SOCIMIS
    32: 'fiscalidad',      # Imputació rendes immobiliàries IRPF
    38: 'infraestructuras', # Gestió ports i aeroports i planificació AENA
    39: 'infraestructuras', # Aturar ampliacions aeroports, torre control Menorca
    40: 'infraestructuras', # Llei de cogestió aeroportuària
    41: 'energia',         # Prohibició vols privats per reducció d'emissions
    42: 'fiscalidad',      # IVA 21% establiments turístics i impostos iots de luxe
    43: 'infraestructuras', # Limitar arribades de creuers als ports estatals
    44: 'infraestructuras', # Política ports de l'Estat
    45: 'infraestructuras', # Limitar entrada i circulació de vehicles a cada illa
    50: 'empleo',          # Polítiques actives d'ocupació
    52: 'infraestructuras', # Corredor mediterrani
    58: 'fiscalidad',      # Gasoil agrícola i pesquer (tractament fiscal)
    66: 'vivienda',        # Pla d'adequació i eficiència energètica d'habitatges
    67: 'territorio',      # Finançament singular / concert econòmic / condonació deute
    70: 'infraestructuras', # Pla inversions Estat aigua
    76: 'justicia',        # Jutjat Formentera, Ciutadella, ciutat justícia Palma
    77: 'familia',         # Protecció dol perinatal i permís maternitat
    78: 'social',          # Sistema d'Atenció a la Dependència 1,7% PIB
    95: 'social',          # Pressupost polítiques d'igualtat 5% i +10% violències masclistes
    96: 'justicia',        # Jutjats de Violència sobre la Dona i centres de crisi
    97: 'seguridad',       # Violència vicària i sistema VioGen
    98: 'justicia',        # Reforma Llei Llibertat Sexual (Només Sí és Sí)
    99: 'sanidad',         # Blindatge constitucional IVE / salut sexual i reproductiva
    100: 'inmigracion',    # Reforma Llei estrangeria per a víctimes de trata
    101: 'justicia',       # Reforma Codi penal violència digital i IA
    103: 'democracia',     # Reforma Llei electoral sufragi 16 anys
    104: 'educacion',      # Formació professional i dual
    105: 'empleo',         # Qualificació professional i pràctiques remunerades
    106: 'empleo',         # Programes de retorn del jovent format fora
    107: 'fiscalidad',     # Deducció IRPF 1.000 € menors de 35 anys lloguer
    108: 'sanidad',        # Pla d'Acció en Salut Mental i prevenció del suïcidi
    109: 'familia',        # Prohibir xarxes socials a menors de 16 anys
    114: 'territorio',     # Transferir terrenys de Defensa d'interès ambiental
    116: 'infraestructuras', # Trasllat de residus de Formentera a Eivissa
    121: 'territorio',     # Transferir propietats en desús de Defensa a la CAIB
    135: 'seguridad',      # Derogar Llei mordassa i democratització cossos policials i justícia
    138: 'identidad',      # Vestigis dictadura franquista (memòria històrica)
    139: 'identidad',      # Retorn béns requisats guerra civil
    140: 'identidad',      # Espais memòria democràtica (fortí d'Illetes)
    145: 'fiscalidad',     # Suprimir llei Beckham
    146: 'democracia',     # Dret de sufragi persones migrants en municipals
    147: 'emergencias',    # Força Mediterrània d'intervenció climàtica i protecció civil
    148: 'defensa',        # Reduir despesa militar, rebutjar 5% PIB, sortida OTAN
    149: 'exterior',       # Embargament integral d'armes a Israel i Palestina
    150: 'exterior',       # Autodeterminació Sàhara Occidental
    156: 'identidad',      # Eradicació tauromàquia i derogació Llei 18/2013
    157: 'rural',          # Delfinaris, zoològics i circs sense animals
    158: 'justicia',       # Estendre Llei de benestar animal i endurir sancions
    159: 'fiscalidad',     # Reduir l'IVA veterinari
    160: 'rural',          # Fi turisme explotació animal i calesses de cavalls
}

# Derogaciones explícitas comprobadas contra el texto literal (debe contener «derog»).
DEROGA_MEDIDA = {
    135: 'Llei mordassa',
    156: 'Llei 18/2013 (tauromàquia)',
}

# Compromisos cuantificados (solo compromisos, no datos de contexto).
# Cada entrada: (n, valor, unidad, texto_corto, cita_literal_en_medida)
CIFRAS_PROGRAMA = [
    (1, '60 %', 'del salari mitjà brut', 'Blindar l’SMI estatal com a mínim al 60 % del salari mitjà brut', 'arribar o superar, com a mínim, el 60 % del salari mitjà brut'),
    (3, '5 %', 'sobre la mitjana peninsular', 'Topall als carburants a un màxim del 5 % sobre el preu mitjà peninsular', 'no superin, en cap cas, el 5 % del preu mitjà de la península'),
    (6, '200 €', 'per menor', 'Prestació universal de 200 € per cada menor fins als 18 anys', 'prestació universal de 200 € per cada menor fins els 18 anys'),
    (10, '32 hores', 'setmanals', 'Jornada laboral màxima de 32 hores setmanals sense reducció salarial', 'jornada laboral a un màxim de 32 hores setmanals de feina efectiva sense reducció salarial'),
    (13, '12 mesos', 'de sou i cotització', 'Garantir 12 mesos de sou i cotització als fixos discontinus turístics', 'garantir 12 mesos de sou i de cotització'),
    (22, '35 euros', 'tarifa màxima', 'Tarifa màxima de 35 euros per als residents a l’OSP Menorca–Barcelona', 'regulada per una tarifa màxima de trenta-cinc euros per als residents'),
    (25, '25 %', 'de la renda neta', 'Limitar el lloguer en zones tensionades al 25 % de la renda neta', 'limitarà, per llei, el preu del lloguer a zones tensionades en el 25 % de la renda neta'),
    (26, '300 €', 'al mes', 'Escut hipotecari de fins a 300 € al mes si la hipoteca supera el 40 %', 'escut hipotecari per protegir, de fins a 300 € al mes, les famílies de classe mitjana en què la hipoteca els suposi més del 40 % dels ingressos nets'),
    (29, '21 %', 'd’IVA i fins al 150 % d’IBI', 'Pisos turístics al 21 % d’IVA i recàrrec d’IBI fins al 150 %', 'tributar al 21 % i s’eliminaran les deduccions a l’impost de societats i l’IRPF. Així mateix, tendran un recàrrec a l’IBI de fins al 150 %'),
    (30, '200 % / 1000 %', 'recàrrec d’ITP', 'Exempció d’ITP al primer habitatge i recàrrec del 200 % al segon i 1000 % del tercer', 'recàrrec del 200 % del segon habitatge i del 1000 % a partir del tercer'),
    (42, '21 %', 'd’IVA turístic', 'Tipus general d’IVA del 21 % per als establiments turístics i creuers', "establiments turístics tributin el tipus general d'IVA del 21%"),
    (78, '1,7 %', 'del PIB', 'Elevar la inversió en dependència fins a l’1,7 % del PIB el 2030', "elevar la inversió pública del 0,8 % a l'1,7 % del PIB l'any 2030, amb una aportació estatal directa mínima del 50 %"),
    (83, '1,5 %', 'del PIB', 'Finançament de les universitats públiques fins a l’1,5 % del PIB', 'finançament de les universitats públiques fins a assolir l’1,5% del PIB'),
    (89, '10', 'professionals / 100.000 hab.', 'Mínim de 10 professionals de salut mental per 100.000 habitants a cada illa', 'augment de les ràtios de professionals fins a un mínim de 10 per cada 100.000 habitants'),
    (90, '30 %', 'copagament màxim', 'Limitar el copagament de dependència al 30 % dels ingressos', 'limitarà el copagament màxim al 30 % dels ingressos'),
    (93, '40 %', 'de la renda mitjana', 'Renda garantida de l’IMV equivalent al 40 % de la mitjana d’ingressos', "garantir una base de renda equivalent al 40% de la mitjana d'ingressos estatals"),
    (95, '5 %', 'del pressupost estatal', 'Almenys el 5 % del pressupost no financer per a igualtat i +10 % contra violències masclistes', 'almanco un 5% del pressupost no financer de l’Estat (superant el 4,4 % actual). En particular, s’incrementarà un 10 % la dotació contra les violències masclistes'),
    (103, '16 anys', 'edat de vot', 'Sufragi actiu i passiu a partir dels 16 anys', 'dret al sufragi actiu i passiu a partir dels 16 anys'),
    (107, '1.000 euros', 'deducció IRPF', 'Deducció d’IRPF de fins a 1.000 euros per a menors de 35 anys en lloguer', 'deducció de fins a 1.000 euros de l’IRPF per als menors de 35 anys que visquin de lloguer'),
    (109, '16 anys', 'xarxes socials', 'Prohibir plataformes i xarxes socials a menors de 16 anys sense verificació', 'plataformes i xarxes socials a menors de 16 anys sense verificació'),
    (126, '1 hora', 'al dia (6 mesos)', 'Una hora diària de jornada laboral durant sis mesos per aprendre català', 'durant sis mesos els treballadors puguin dedicar una hora al dia de la seva jornada laboral a aprendre la llengua'),
    (142, '100 %', 'finançament estatal', 'Acollida digna de migrants i menors finançada al 100 % per l’Estat', 'acollida digna i finançada al 100 % per l’Estat'),
    (152, '0,7 %', 'del PIB', 'Destinar el 0,7 % del PIB a cooperació internacional transformadora', 'destinant-hi el 0,7 % del PIB'),
]

# Plazos explícitos de aplicación (solo cuándo se aplica la medida).
PLAZOS_MEDIDA = [
    (81, 'De inmediato', 'Prohibición de cuotas obligatorias en centros sostenidos con fondos públicos'),
    (29, '3 años', 'Extinción progresiva de licencias turísticas y alquileres de temporada fraudulentos'),
    (78, '2030', 'Inversión pública en dependencia hasta el 1,7 % del PIB'),
]
ORDEN_PLAZOS = ['De inmediato', '3 años', '2030']

TERRITORIOS_EXTRA = {
    **TERRITORIOS,
    'Mallorca': r'\bMallorca\b|\bPalma\b|\bSóller\b|\bLlucmajor\b|\bAlcúdia\b|\bTramuntana\b|\bLlevant\b',
    'Menorca': r'\bMenorca\b|\bMaó\b|\bCiutadella\b',
    'Ibiza': r'\bEivissa\b|\bIbiza\b|\bSant Antoni\b|\bTagomago\b',
    'Formentera': r'\bFormentera\b',
    'Argelia': r'\bAlgèria\b',
    'Palestina': r'\bPalestina\b|\bpalestí\b',
    'Israel': r'\bIsrael\b|\bisraeliana\b',
    'Sáhara Occidental': r'\bSàhara [Oo]ccidental\b|\bsahrauí\b',
}


def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    # Normalizar el carácter Unicode U+0140 (ŀ) usado por Affinity a l· estándar en catalán.
    texto = texto.replace('\u0140', 'l·').replace('\u013f', 'L·')
    return re.sub(r'\s+', ' ', texto).strip()


def slugify(texto):
    s = unicodedata.normalize('NFD', texto.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s


def primera_frase(texto):
    # Corta al primer punto final (evitando abreviaturas tipo «p. ex.» o números).
    m = re.match(r'^(.+?[.!?])(?:\s+|$)', texto)
    return m.group(1) if m else texto


def leer_flujo(doc):
    """Devuelve eventos de lectura ordenados por (página PDF, mitad izq/der, y)."""
    eventos = []
    for pag_idx in range(1, len(doc)):  # páginas 2..9 (0-based 1..8)
        pag_num = pag_idx + 1
        page = doc[pag_idx]
        mitades = {0: [], 1: []}
        for bloque in page.get_text('dict')['blocks']:
            if bloque['type'] != 0:
                continue
            for linea in bloque['lines']:
                spans = [s for s in linea['spans'] if s['text'].strip()]
                if not spans:
                    continue
                spans.sort(key=lambda s: s['bbox'][0])
                x = round(linea['bbox'][0], 1)
                y = round(linea['bbox'][1], 1)
                sz = round(spans[0]['size'], 1)
                fn = spans[0]['font']
                color = f"{spans[0]['color']:06x}"
                txt = limpiar(' '.join(s['text'].strip() for s in spans))
                # Saltar numeración de pie de página (y > 775, MarrSansCondWeb).
                if y > 775 or 'MarrSansCondWeb' in fn:
                    continue
                mitad = 0 if x < 600 else 1
                mitades[mitad].append({
                    'pagina': pag_num,
                    'mitad': mitad,
                    'x': x,
                    'y': y,
                    'sz': sz,
                    'fn': fn,
                    'color': color,
                    'txt': txt,
                })
        for mitad in (0, 1):
            # Agrupar líneas que están a la misma altura (p. ej., número «1.» y su primera línea de texto).
            items = sorted(mitades[mitad], key=lambda i: (round(i['y'], 0), i['x']))
            eventos.extend(items)
    return eventos


def extraer(pdf):
    doc = fitz.open(pdf)
    if len(doc) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(doc)}')

    eventos = leer_flujo(doc)
    doc.close()

    bloques = []
    secciones = []
    medidas_raw = []

    bloque_actual = None
    seccion_actual = None
    medida_actual = None
    esperando_texto_numero = False

    for ev in eventos:
        # Bloque: SpecialGothic-Bold >= 20pt
        if ev['sz'] >= 20 and 'Bold' in ev['fn']:
            titulo_may = ev['txt']
            titulo = BLOQUE_TITULOS.get(titulo_may, titulo_may.capitalize())
            bloque_actual = {
                'id': len(bloques) + 1,
                'titulo': titulo,
                'lema': '',
                'cita': '',
                'intro': '',
                'pagina': ev['pagina'],
            }
            bloques.append(bloque_actual)
            medida_actual = None
            esperando_texto_numero = False
            continue

        # Sección: SpecialGothic-Bold ~14pt
        if 13 <= ev['sz'] <= 16 and 'Bold' in ev['fn']:
            if bloque_actual is None:
                raise ValueError(f'Sección sin bloque: {ev["txt"]}')
            sec_id = slugify(ev['txt'])
            seccion_actual = {
                'id': sec_id,
                'bloque': bloque_actual['id'],
                'titulo': ev['txt'],
                'tituloFrase': ev['txt'],
                'intro': '',
                'pagina': ev['pagina'],
                'subapartados': [],
            }
            secciones.append(seccion_actual)
            medida_actual = None
            esperando_texto_numero = False
            continue

        # Número de medida: «1.» .. «160.» en columna de números (x < 110 o 670 <= x < 710)
        m_num = re.fullmatch(r'(\d+)\.', ev['txt'])
        if m_num and (ev['x'] < 110 or (670 <= ev['x'] < 710)):
            num = int(m_num.group(1))
            if seccion_actual is None:
                raise ValueError(f'Medida {num} sin sección')
            medida_actual = {
                'n': num,
                'bloque': bloque_actual['id'],
                'seccion': seccion_actual['id'],
                'seccion_titulo': seccion_actual['titulo'],
                'pagina': ev['pagina'],
                'partes': [],
            }
            medidas_raw.append(medida_actual)
            esperando_texto_numero = True
            continue

        # Línea de cuerpo de medida
        if medida_actual is not None:
            medida_actual['partes'].append(ev['txt'])
            esperando_texto_numero = False

    if len(bloques) != TOTAL_BLOQUES:
        raise ValueError(f'Se esperaban {TOTAL_BLOQUES} bloques; hay {len(bloques)}')
    if len(secciones) != TOTAL_SECCIONES:
        raise ValueError(f'Se esperaban {TOTAL_SECCIONES} secciones; hay {len(secciones)}')
    if len(medidas_raw) != TOTAL_MEDIDAS:
        raise ValueError(f'Se esperaban {TOTAL_MEDIDAS} medidas; hay {len(medidas_raw)}')

    numeros = [m['n'] for m in medidas_raw]
    if numeros != list(range(1, TOTAL_MEDIDAS + 1)):
        raise ValueError(f'Numeración no correlativa: faltan {set(range(1, TOTAL_MEDIDAS + 1)) - set(numeros)}')

    # Mapear cifras y plazos por medida
    cifras_por_medida = {}
    cifras_cabecera = []
    for n_m, valor, unidad, texto_c, cita in CIFRAS_PROGRAMA:
        cifras_por_medida.setdefault(n_m, []).append(cita)
        cifras_cabecera.append({
            'valor': valor,
            'unidad': unidad,
            'texto': texto_c,
            'contexto': cita,
            'medida': n_m,
        })

    plazos_por_medida = {}
    plazos_cabecera = []
    for n_m, plazo, texto_p in PLAZOS_MEDIDA:
        plazos_por_medida[n_m] = plazo
        plazos_cabecera.append({'plazo': plazo, 'texto': texto_p, 'medida': n_m})

    medidas = []
    for m in medidas_raw:
        n = m['n']
        cuerpo = limpiar(' '.join(m['partes']))
        titulo = primera_frase(cuerpo)
        categoria = CATEGORIA_MEDIDA.get(n) or CATEGORIA_SECCION[m['seccion_titulo']]

        # Comprobar cifras literales
        for cita in cifras_por_medida.get(n, []):
            if cita not in cuerpo:
                raise ValueError(f'Medida {n}: cita de cifra no encontrada literal: «{cita}» en «{cuerpo}»')

        # Comprobar derogaciones explícitas
        deroga = DEROGA_MEDIDA.get(n)
        if deroga and 'derog' not in cuerpo.lower():
            raise ValueError(f'Medida {n}: marcada como derogación pero no contiene «derog»: {cuerpo}')

        medidas.append({
            'n': n,
            'bloque': m['bloque'],
            'seccion': m['seccion'],
            'pagina': m['pagina'],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': cuerpo,
            'oculta': False,
            'categoria': categoria,
            'colectivos': coincidencias(cuerpo, COLECTIVOS),
            'palancas': coincidencias(cuerpo, PALANCAS),
            'territorios': coincidencias(cuerpo, TERRITORIOS_EXTRA),
            'cifras': cifras_por_medida.get(n, []),
            'plazo': plazos_por_medida.get(n),
            'deroga': deroga,
        })

    # Verbos en futuro de primera persona plural (-rem), forma dominante del documento en catalán.
    conteo_verbos = Counter()
    for m in medidas:
        for verbo in re.findall(r'(?<![A-Za-zÀ-ÿ])([a-zà-ÿ]{3,}[aei]rem)(?![A-Za-zÀ-ÿ])', m['texto'].lower()):
            if verbo not in {'podrem', 'farem', 'serem', 'haurem'}:
                conteo_verbos[verbo] += 1
    verbos = [{'verbo': v, 'n': c} for v, c in conteo_verbos.most_common(15)]

    return {
        'id': ID,
        'partido': 'Aramés-Front Ampli',
        'siglas': 'ARAMÉS',
        'comunidad': 'Illes Balears',
        'observaciones': [
            'Programa en catalán de Ara Més-Front Ampli, la coalición balear de Més per Mallorca, Més per Menorca, Ara Eivissa y Movimiento Sumar.',
            'El PDF oficial está maquetado en 9 páginas en pliego doble (equivalentes a 17 páginas impresas) y recoge 160 medidas numeradas sin título propio: el título corto es la primera frase.',
            'La taxonomía común no tiene categoría específica de protección animal ni de turismo: los derechos de los animales se asignan a la categoría más cercana (tauromaquia a Lengua, cultura y memoria; sanciones a Justicia; IVA veterinario a Impuestos; resto a Campo, mar y mundo rural).',
        ],
        'color': '#5a96b4',
        'colorClaro': '#cee0e8',
        'programa': 'Programa electoral 29N',
        'subtitulo': 'Programa electoral d’Ara Més-Front Ampli per a les eleccions generals del 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE_PDF,
        'paginas': PAGINAS,
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {
            'titulo': 'Programa electoral 29N',
            'texto': '',
        },
        'cifras': cifras_cabecera,
        'plazos': plazos_cabecera,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': verbos,
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def escribir_depuracion(programa, ruta):
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(f"{programa['partido']} — {programa['programa']} ({len(programa['medidas'])} medidas)\n\n")
        for m in programa['medidas']:
            extras = []
            if m['cifras']:
                extras.append(f"cifras={len(m['cifras'])}")
            if m['plazo']:
                extras.append(f"plazo={m['plazo']}")
            if m['deroga']:
                extras.append(f"deroga={m['deroga']}")
            extra_str = ' ' + ' '.join(extras) if extras else ''
            f.write(f"#{m['n']:03d} [B{m['bloque']}/{m['seccion']} p.{m['pagina']} {m['categoria']}{extra_str}] {m['titulo']}\n")
            if m['texto'] != m['titulo']:
                f.write(f"     {m['texto']}\n")
            f.write(f"     col={m['colectivos']} pal={m['palancas']} ter={m['territorios']}\n\n")


def main():
    args = sys.argv[1:]
    depurar = None
    if '--depurar' in args:
        idx = args.index('--depurar')
        depurar = args[idx + 1]
        args = args[:idx] + args[idx + 2:]
    if len(args) != 2:
        raise SystemExit('Uso: python scripts/extract_arames.py ORIGEN.pdf DESTINO.json [--depurar volcado.txt]')

    programa = extraer(args[0])
    with open(args[1], 'w', encoding='utf-8') as f:
        json.dump(programa, f, ensure_ascii=False, indent=1)
        f.write('\n')
    if depurar:
        escribir_depuracion(programa, depurar)
    print(f"{len(programa['medidas'])} medidas, {len(programa['secciones'])} secciones, {len(programa['bloques'])} bloques, {len(programa['cifras'])} cifras")


if __name__ == '__main__':
    main()
