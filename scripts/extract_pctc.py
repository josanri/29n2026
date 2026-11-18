"""Extrae el programa del PCTC («Programa de lluita», elecciones generales 2026) al esquema compartido.

Es la versión en catalán del «Programa de lucha» del PCTE (`extract_pcte.py`), que se publica en la web
oposicionobrera.pcte.es: el mismo texto, con las mismas 11 secciones y las mismas 95 fichas. El PDF (24 páginas, A4, tipografías Montserrat y Barlow
Condensed) tiene la misma maquetación que el del PCTE; solo cambian la lengua y la etiqueta «EIXOS DE LLUITA».
- Página 1-2: portada (imagen). Página 3: presentación (sin título). Página 5: índice, con los 11 bloques («01» en
  Barlow Condensed 20 pt granate y el título en 16 pt) y su página. Las páginas 4 y 6 son imágenes.
- Cada bloque: número («01», Barlow Condensed 22 pt granate) y título (Barlow Condensed 28-33 pt) arriba de la
  página; una introducción a todo el ancho (Montserrat 9,2-10 pt, x ≈ 51); la etiqueta «EIXOS DE LLUITA» y las
  fichas en dos columnas. Cada ficha tiene un título (Montserrat Bold 10,5-11 pt, x ≈ 77 o 331) y un texto
  (8,4-9,6 pt, x ≈ 63 o 317). Las fichas siguen en la página siguiente cuando no caben: primero la columna
  izquierda y luego la derecha de cada página.
- Páginas 22-23: «Pel socialisme», el cierre, sin medidas. Página 24: contraportada.
- Pie: «PROGRAMA DE LLUITA» y el número de página (y > 800).

Esquema: cada bloque del índice es un bloque con una sola sección; cada ficha es una medida, con su título. Las
tablas de este script usan el código «bloque.ficha» («3.4» es la cuarta ficha del bloque 3) y coinciden con las
del PCTE: el script comprueba que hay 95 fichas y que cada bloque tiene las mismas que el programa del PCTE.

Uso: python scripts/extract_pctc.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

ID = 'pctc'
PDF_PUBLICO = '/programas/pctc-programa-de-lluita-2026.pdf'
FUENTE = 'https://oposicionobrera.pcte.es/assets/docs/CAT-Programa-de-lluita-PCTC-d.pdf'
PAGINAS = 24
GRANATE = 0xAF2D36
PAGINA_EPILOGO = 22
FICHAS_POR_BLOQUE = {1: 9, 2: 7, 3: 12, 4: 13, 5: 10, 6: 7, 7: 9, 8: 5, 9: 8, 10: 8, 11: 7}  # = 95, como el PCTE

# Categoría de cada bloque (la base) y excepciones ficha a ficha, leyendo cada medida.
CATEGORIA_BLOQUE = {
    1: 'empleo', 2: 'empleo', 3: 'vivienda', 4: 'social', 5: 'rural', 6: 'empleo', 7: 'empleo', 8: 'identidad',
    9: 'exterior', 10: 'democracia', 11: 'empleo',
}
CATEGORIA_MEDIDA = {
    '1.4': 'social',
    '2.4': 'innovacion', '2.5': 'innovacion', '2.6': 'innovacion',
    '4.3': 'administracion', '4.4': 'sanidad', '4.5': 'sanidad', '4.6': 'educacion', '4.7': 'educacion',
    '4.13': 'infraestructuras',
    '6.4': 'vivienda', '6.5': 'educacion', '6.6': 'identidad', '6.7': 'social',
    '7.4': 'familia', '7.5': 'familia', '7.6': 'seguridad', '7.7': 'sanidad', '7.8': 'seguridad', '7.9': 'familia',
    '8.4': 'innovacion', '8.5': 'innovacion',
    '9.1': 'defensa', '9.2': 'defensa', '9.4': 'defensa', '9.5': 'defensa',
    '10.3': 'vivienda', '10.4': 'seguridad', '10.5': 'inmigracion', '10.6': 'identidad', '10.8': 'social',
}

# Derogaciones explícitas, por código. Se comprueba que la medida dice «derog».
DEROGA = {
    '4.1': 'Ley 15/1997, de nuevas formas de gestión del Sistema Nacional de Salud',
    '10.1': 'Ley de Seguridad Ciudadana («Ley Mordaza»)',
    '10.2': 'Ley de Convivencia Universitaria',
    '10.7': 'Delitos de injurias a la Corona y a las instituciones y de ultrajes a símbolos',
}

COLECTIVOS = {
    'jovenes': r'\bjoves?\b|\bjoventut\b|\bestudiants?\b',
    'mayores': r'\bgent gran\b|\bpensionistes?\b|\bjubilaci[óo]\b|\bpensions\b',
    'mujeres': r'\bdon(?:a|es)\b|\bmaternitat\b|\bmasclista\b|\bembarassad\w*',
    'familias': r'\bfam[ií]li(?:a|es)\b|\bcrian[çc]a\b|\bnaixement\b|\bconciliaci[óo]\b',
    'infancia': r'\binfància\b|\bnen[sa]?s?\b|\bmenors\b|\balumn\w*|\b0 a 3\b|\b0-3\b|\bescoles bressol\b',
    'autonomos': r'\baut[òo]noms?\b|\bfalsos aut[òo]noms\b',
    'empresas': r'\bempres(?:a|es)\b|\bpatronal\b|\bgrups empresarials\b',
    'rural': r'\bmedi rural\b|\bcamp\b|\bjornaler\w*|\bagricult\w*|\bramader\w*|\bpetits productors\b',
    'funcionarios': r'\bocupaci[óo] p[úu]blica\b|\bfuncionari\w*',
    'discapacidad': r'\bdiscapacitat\b|\bdepend[èe]ncia\b(?! econòmica)',
    'victimas': r'\bv[ií]ctim(?:a|es)\b',
    'inmigrantes': r'\bmigrants?\b|\bimmigra\w*|\bsense papers\b|\bCIE\b|\bestrangers?\b',
    'pacientes': r'\bpacients\b|\bsanitat p[úu]blica\b|\bllistes d.espera\b',
    'agentes': r'\bpol[ií]c\w*|\bGuàrdia Civil\b',
}

PALANCAS = {
    'ley': r'\bllei(?:s)?\b|\bderog\w*|\breform\w*|\blegislaci[óo]\b|\bprohibi\w*|\bCodi Penal\b|\bnormativa\b|\bil·legalitz\w*|\bnul·litat\b',
    'impuestos': r'\bIVA\b|\bIRPF\b|\bfiscal\w*|\bimpostos?\b|\btribut\w*|\bcotitz\w*',
    'gasto': r'\binversi[óo]\b|\bfinan[çc]\w*|\bpressupost\w*|(?<!bancs, )\bfons\b|\bajud(?:a|es)\b|\bsubvenci\w*|\bdespesa\b|\bgratu[ïi]t\w*',
    'organizacion': r'\bcreaci[óo]\b|\bcrear\b|\bempresa p[úu]blica\b|\bempres(?:a|es) estatals?\b|\bnacionalitz\w*|\bexpropiaci\w*|\bgesti[óo] (?:p[úu]blica|directa)\b|\bxarxa p[úu]blica\b|\bparc p[úu]blic\b',
    'plan': r'\bpla(?:ns?)\b|\bestratègia\b|\bprogram(?:a|es)\b|\bprotocols?\b',
}

TERRITORIOS = {
    'Unión Europea': r'\bUni[óo] Europea\b|\bUE\b|\bBrussel·les\b',
    'Palestina': r'\bPalestina\b|\bIsrael\b',
    'Estados Unidos': r'\bEstats Units\b|\bEUA\b',
}

# Cifras: solo compromisos cuantificados. (valor, unidad, texto, código, prueba literal)
CIFRAS = [
    ('35', 'horas semanales', 'Jornada máxima ya, sin reducción salarial, como paso hacia las 30', '1.2', 'Jornada de 35 hores setmanals ja'),
    ('1.540', 'horas al año', 'Tope de trabajo efectivo anual', '1.2', 'Topall de 1.540 hores anuals de treball efectiu'),
    ('25', 'días laborables de vacaciones', 'Cinco semanas de vacaciones retribuidas', '1.3', 'Cinc setmanes (25 dies laborables) de vacances retribuïdes'),
    ('60', 'años', 'Jubilación ordinaria, sin penalización; a los 55 en trabajos penosos', '1.4', 'Jubilació ordinària als 60 anys'),
    ('50 %', 'menos de alquiler', 'Bajada inmediata de los alquileres, a costa de los propietarios', '3.5', 'Baixada immediata dels lloguers del 50%'),
    ('15 %', 'de los ingresos', 'Alquiler social obligatorio en viviendas de bancos, fondos y grandes tenedores', '3.3', 'no més del 15% dels seus ingressos'),
    ('10 %', 'de las viviendas', 'Parque público permanente de vivienda en alquiler, a corto plazo', '3.8', 'almenys el 10% del total d’habitatges'),
    ('0,5 %', 'de viviendas turísticas', 'Límite de la vivienda turística en cada localidad', '3.7', 'a un 0,5% del conjunt d’habitatges de la localitat'),
    ('25 %', 'del gasto sanitario', 'Para la atención primaria', '4.4', '25% de la despesa sanitària per a l’atenció primària'),
    ('52', 'semanas de permiso', 'Permiso por nacimiento igual, intransferible y retribuido al 100 %', '7.4', 'Permís per naixement de 52 setmanes'),
]
# Otros compromisos cuantificados que no van en la cabecera. (código, prueba literal)
CIFRAS_MEDIDA = [
    ('1.4', 'jubilació als 55 anys'),
    ('1.5', 'contracte fix a partir de 6 mesos de contractes encadenats en un període de 12'),
    ('4.12', 'Incapacitat temporal pagada al 100% del salari des del primer dia'),
    ('6.4', 'Reserva d’un terç del parc públic de lloguer per a joves treballadors'),
    ('7.3', 'fins que el fill o la filla compleixi 3 anys'),
    ('11.2', 'almenys 10 hores retribuïdes l’any'),
    # Cuantías fijadas por referencia al salario mínimo (como en el PCTE).
    ('4.10', 'Cap pensió per sota del salari mínim'),
    ('4.12', 'Prestació per desocupació mentre duri l’atur, mai inferior al salari mínim'),
    ('6.2', 'amb compensació no inferior al salari mínim en proporció a les hores'),
    ('6.5', 'Beca salari equivalent al salari mínim'),
]
# Plazos: solo cuándo se aplica la medida. (código, plazo, texto, prueba literal)
PLAZOS = [
    ('1.2', 'De inmediato', 'Jornada de 35 horas semanales sin reducción salarial', 'Jornada de 35 hores setmanals ja'),
    ('3.5', 'De inmediato', 'Bajar un 50 % los alquileres', 'Baixada immediata dels lloguers del 50%'),
    ('3.8', 'A corto plazo', 'Parque público de alquiler del 10 % de las viviendas', 'a curt termini, almenys el 10%'),
]
ORDEN_PLAZOS = ['De inmediato', 'A corto plazo']


def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    texto = texto.replace('​', '').replace('\xa0', ' ').replace('\xad', '').replace('\t', ' ')
    return re.sub(r'\s+', ' ', texto).strip()


def lineas(documento):
    """Las líneas de cada página, con las piezas de la misma altura y columna unidas de izquierda a derecha."""
    for numero, pagina in enumerate(documento, start=1):
        piezas = []
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip()]
                if not spans or linea['bbox'][1] > 800:  # pie de página
                    continue
                piezas.append({'y': round(linea['bbox'][1], 1), 'x': linea['bbox'][0], 'spans': spans})
        piezas.sort(key=lambda p: (p['y'], p['x']))
        filas = []
        for pieza in piezas:
            columna = 1 if pieza['x'] > 300 else 0
            if filas and abs(filas[-1]['y'] - pieza['y']) < 2 and filas[-1]['columna'] == columna:
                filas[-1]['spans'].extend(pieza['spans'])
            else:
                filas.append({'y': pieza['y'], 'x': pieza['x'], 'columna': columna, 'spans': list(pieza['spans'])})
        for fila in filas:
            spans = sorted(fila['spans'], key=lambda s: s['bbox'][0])
            texto = ''
            for anterior, span in zip([None] + spans[:-1], spans):
                # Entre una pieza en negrita y la siguiente puede faltar el espacio: se añade si hay hueco.
                hueco = anterior is not None and span['bbox'][0] - anterior['bbox'][2] > 1
                if hueco and not texto.endswith(' ') and not span['text'].startswith(' '):
                    texto += ' '
                texto += span['text']
            primero = spans[0]
            yield {
                'pagina': numero,
                'y': fila['y'],
                'x': round(fila['x']),
                'columna': fila['columna'],
                'texto': limpiar(texto),
                'fuente': primero['font'],
                'tam': round(primero['size'], 1),
                'granate': primero['color'] == GRANATE,
                'negrita': 'Bold' in primero['font'] or 'SemiBold' in primero['font'],
            }


def leer_indice(filas):
    """Los bloques del índice (página 5): número y título. El título (una a tres líneas) queda centrado en
    altura con su número: cada línea va al número más cercano."""
    de_indice = [f for f in filas if f['pagina'] == 5 and 'Barlow' in f['fuente']]
    numeros = [f for f in de_indice if f['granate'] and re.fullmatch(r'\d{2}', f['texto'])]
    bloques = {int(f['texto']): [] for f in numeros}
    for fila in de_indice:
        if fila['tam'] != 16:
            continue
        cercano = min(numeros, key=lambda f: abs(f['y'] + 5 - (fila['y'] + 8)))
        bloques[int(cercano['texto'])].append(fila)
    return [{'id': numero, 'titulo': limpiar(' '.join(f['texto'] for f in sorted(lineas_, key=lambda f: f['y'])))}
            for numero, lineas_ in sorted(bloques.items())]


def parrafos(filas):
    """Une líneas en párrafos: un salto vertical mayor que el interlineado abre párrafo nuevo."""
    resultado, actual, previa = [], [], None
    for fila in filas:
        if previa is not None and (fila['pagina'] != previa['pagina'] or fila['y'] - previa['y'] > fila['tam'] * 2):
            resultado.append(limpiar(' '.join(actual)))
            actual = []
        actual.append(fila['texto'])
        previa = fila
    if actual:
        resultado.append(limpiar(' '.join(actual)))
    return resultado


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')
    filas = list(lineas(documento))
    indice = leer_indice(filas)

    presentacion = parrafos([f for f in filas if f['pagina'] == 3 and f['texto'] != 'PRESENTACIÓ'])

    bloques = {}      # id → {titulo, pagina, intro (filas)}
    fichas = []       # {bloque, titulo, pagina, filas}
    bloque = None
    for pagina in range(7, PAGINA_EPILOGO):
        de_pagina = [f for f in filas if f['pagina'] == pagina]
        numero = [f for f in de_pagina if 'Barlow' in f['fuente'] and f['granate'] and re.fullmatch(r'\d{2}', f['texto'])]
        if numero:
            bloque = int(numero[0]['texto'])
            titulo = [f['texto'] for f in sorted(de_pagina, key=lambda f: f['y'])
                      if 'Barlow' in f['fuente'] and not f['granate'] and f['tam'] >= 25]
            bloques[bloque] = {'titulo': limpiar(' '.join(titulo)), 'pagina': pagina, 'intro': []}
        if bloque is None:
            raise ValueError(f'La página {pagina} no tiene bloque')
        etiqueta = [f for f in de_pagina if f['texto'] == 'EIXOS DE LLUITA']
        inicio_fichas = etiqueta[0]['y'] if etiqueta else (0 if not numero else 10_000)
        for fila in sorted(de_pagina, key=lambda f: f['y']):
            if 'Barlow' in fila['fuente'] or fila['texto'] == 'EIXOS DE LLUITA':
                continue
            if fila['y'] < inicio_fichas:
                if fila['x'] > 60:
                    raise ValueError(f'Texto inesperado antes de las fichas en la página {pagina}: {fila["texto"]}')
                bloques[bloque]['intro'].append(fila)
        # Fichas: columna izquierda y luego derecha, de arriba abajo.
        for columna in (0, 1):
            for fila in sorted((f for f in de_pagina if f['columna'] == columna and f['y'] > inicio_fichas
                                and 'Barlow' not in f['fuente'] and f['texto'] != 'EIXOS DE LLUITA'),
                               key=lambda f: f['y']):
                es_titulo = fila['negrita'] and fila['tam'] >= 10.4
                if es_titulo:
                    fichas.append({'bloque': bloque, 'titulo': fila['texto'], 'pagina': pagina, 'filas': []})
                elif not fichas or fichas[-1]['bloque'] != bloque:
                    raise ValueError(f'Texto de ficha sin título en la página {pagina}: {fila["texto"]}')
                else:
                    fichas[-1]['filas'].append(fila)

    por_bloque = Counter(f['bloque'] for f in fichas)
    if dict(por_bloque) != FICHAS_POR_BLOQUE:
        raise ValueError(f'Las fichas por bloque no coinciden con las del PCTE: {dict(por_bloque)}')
    if [b['id'] for b in indice] != sorted(bloques):
        raise ValueError(f'El índice y el cuerpo no coinciden: {[b["id"] for b in indice]} / {sorted(bloques)}')
    for entrada in indice:
        cuerpo = bloques[entrada['id']]['titulo'].replace(' ', '')
        if cuerpo != entrada['titulo'].replace(' ', ''):
            raise ValueError(f'El título del bloque {entrada["id"]} no coincide: {entrada["titulo"]} / {cuerpo}')
    return documento, presentacion, indice, bloques, fichas


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.I)]


def frase_con(texto, prueba):
    """La frase del texto que contiene la prueba de una cifra."""
    for parte in re.split(r'(?<=[.!?])\s+|\n\n', texto):
        if prueba in parte:
            return parte.strip()
    return prueba


def capitalizar(texto):
    texto = texto.lower()
    return texto[:1].upper() + texto[1:]


def crear_programa(pdf):
    documento, presentacion, indice, bloques_cuerpo, fichas = extraer(pdf)
    bloques, secciones = [], []
    for entrada in indice:
        datos = bloques_cuerpo[entrada['id']]
        titulo = capitalizar(entrada['titulo'])
        bloques.append({
            'id': entrada['id'],
            'titulo': titulo,
            'tituloMayus': entrada['titulo'],
            'lema': '',
            'cita': '',
            'intro': '\n\n'.join(parrafos(datos['intro'])),
            'pagina': datos['pagina'],
        })
        secciones.append({
            'id': str(entrada['id']),
            'bloque': entrada['id'],
            'titulo': titulo,
            'tituloFrase': titulo,
            'intro': '',
            'pagina': datos['pagina'],
            'subapartados': [],
        })

    medidas, por_codigo = [], {}
    contador = Counter()
    for n, ficha in enumerate(fichas, start=1):
        contador[ficha['bloque']] += 1
        codigo = f"{ficha['bloque']}.{contador[ficha['bloque']]}"
        texto = '\n\n'.join(parrafos(ficha['filas']))
        if not texto:
            raise ValueError(f'La ficha {codigo} («{ficha["titulo"]}») no tiene texto')
        completo = f"{ficha['titulo']} {texto}"
        medida = {
            'n': n,
            'bloque': ficha['bloque'],
            'seccion': str(ficha['bloque']),
            'pagina': ficha['pagina'],
            'subapartado': None,
            'titulo': ficha['titulo'],
            'tituloFrase': ficha['titulo'],
            'texto': texto,
            'oculta': False,
            'categoria': CATEGORIA_MEDIDA.get(codigo, CATEGORIA_BLOQUE[ficha['bloque']]),
            'colectivos': coincidencias(completo, COLECTIVOS),
            'palancas': coincidencias(completo, PALANCAS),
            'territorios': coincidencias(completo, TERRITORIOS),
            'cifras': [],
            'plazo': None,
            'deroga': None,
        }
        if codigo in DEROGA:
            if not re.search(r'derog', completo, re.I):
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
    for codigo, plazo, texto, prueba in PLAZOS:
        medida = por_codigo[codigo]
        if prueba not in medida['texto']:
            raise ValueError(f'El plazo «{plazo}» no aparece en la medida {codigo}: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': medida['n']})

    return {
        'id': ID,
        'partido': 'Partit Comunista dels Treballadors de Catalunya',
        'siglas': 'PCTC',
        'color': '#e3061a',
        'colorClaro': '#f8b4b8',
        'programa': 'Programa de lluita',
        'subtitulo': f'{len(medidas)} eixos de lluita en {len(bloques)} blocs per construir una oposició obrera',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'Programa en catalán. Los textos se mantienen en catalán: no están traducidos.',
            'Es la versión catalana del «Programa de lucha» del PCTE, que se publica en la web oposicionobrera.pcte.es: '
            'mismas 11 secciones y mismas 95 fichas, con el mismo orden. El PDF no menciona al PCTC: el texto habla del '
            'Partit Comunista dels Treballadors d’Espanya. El PDF no tiene fecha.',
            'El texto se presenta como «programa de lluita» y no como programa electoral: «Aquestes no són un seguit '
            'de mesures per aplicar des de les institucions».',
            'Cada ficha de «Eixos de lluita» es una medida, con su título. Las fichas no están numeradas en el '
            'original: el número sigue el orden del PDF.',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': 'Presentación', 'texto': '\n\n'.join(presentacion)},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': [p for p in ORDEN_PLAZOS if any(x['plazo'] == p for x in plazos)],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
        'comunidad': 'Cataluña',
    }, por_codigo


def main():
    pdf, salida = sys.argv[1], sys.argv[2]
    programa, por_codigo = crear_programa(pdf)
    with open(salida, 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    if '--depurar' in sys.argv:
        volcado = sys.argv[sys.argv.index('--depurar') + 1]
        with open(volcado, 'w', encoding='utf-8') as archivo:
            for bloque in programa['bloques']:
                archivo.write(f"\n## BLOQUE {bloque['id']} p.{bloque['pagina']} {bloque['titulo']}\n{bloque['intro']}\n")
                for codigo, medida in por_codigo.items():
                    if medida['bloque'] == bloque['id']:
                        archivo.write(f"\n### {medida['n']} [{codigo}] p.{medida['pagina']} {medida['categoria']} | {medida['titulo']}\n")
                        archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
