"""Extract and categorize the 115 measures in the VOX program «Es sentido común» (29N 2026).

The PDF (A5, 55 pages, InDesign) sets each measure as «N.» + title in Gotham-Medium 10 pt,
its body in Gotham-Light, and its bullet points (•) in Gotham-Light 9.8 pt.
Block headings use GothamCondensed 22 pt; every page repeats the running head «ES SENTIDO COMÚN».
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz

PAGINAS = 55
TOTAL_MEDIDAS = 115

# (title in the index, base category)
BLOQUES = [
    ('Ceuta y Melilla', 'territorio'),
    ('Economía, industria y energía', 'fiscalidad'),
    ('Inmigración', 'inmigracion'),
    ('Prioridad nacional', 'social'),
    ('Vivienda', 'vivienda'),
    ('Desregulación', 'administracion'),
    ('Sector primario y Mundo rural', 'rural'),
    ('Sanidad', 'sanidad'),
    ('Educación, Cultura y Deporte', 'educacion'),
    ('Seguridad y Defensa', 'seguridad'),
    ('Familia y Vida', 'familia'),
    ('Independencia de la Justicia y lucha contra la corrupción', 'justicia'),
    ('Infraestructuras y Transportes', 'infraestructuras'),
]

# Category chosen by reading each measure when it differs from its block's base category.
CATEGORIA_MEDIDA = {
    3: 'administracion', 5: 'innovacion', 7: 'social', 8: 'energia',
    19: 'inmigracion', 20: 'sanidad', 21: 'fiscalidad', 23: 'inmigracion', 25: 'territorio',
    37: 'innovacion', 40: 'innovacion', 42: 'territorio', 44: 'energia', 46: 'identidad', 47: 'seguridad',
    71: 'identidad', 76: 'identidad', 77: 'identidad', 78: 'identidad',
    79: 'defensa', 88: 'inmigracion', 89: 'defensa', 90: 'emergencias', 91: 'defensa', 92: 'exterior', 93: 'exterior',
    95: 'social', 96: 'social',
    101: 'democracia', 103: 'territorio', 104: 'identidad', 105: 'identidad', 106: 'democracia',
    108: 'administracion', 109: 'identidad', 110: 'democracia', 111: 'democracia',
}

# Laws the program names explicitly as repealed. Measure 46 asks to «superar» the Ley de Memoria
# Democrática without saying «derogar», so it is not listed.
DEROGA = {
    8: 'Legislación laboral de Sánchez y calendario de cierre nuclear',
    30: 'Ley de Vivienda',
    47: 'Leyes de género',
    69: 'LOMLOE',
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]ven(?:es)?\b|juventud|emancipaci',
    'mayores': r'\bmayores\b|pensionistas?|pensiones?|jubilaci',
    'mujeres': r'\bmujer(?:es)?\b|madres?\b|embarazad',
    'familias': r'\bfamilias?\b|conciliaci[oó]n|natalidad|crianza',
    'infancia': r'\binfancia\b|infantil|niñ[oa]s?\b|menores\b|hijos?\b|alumnos?',
    'autonomos': r'\baut[oó]nom[oa]s\b|\btrabajadores aut[oó]nomos|pymes|pequeñ[oa]s? empres',
    'empresas': r'\bempresas?\b|industria|empresari',
    'rural': r'\brural(?:es)?\b|agricultor|ganader|pescador|agrari|campo\b|despoblaci',
    'agentes': r'Fuerzas y Cuerpos|Guardia Civil|Polic[ií]a|Fuerzas Armadas|militares|agentes',
    'funcionarios': r'\bfuncionari[oa]s?\b|empleados p[uú]blicos|personal (?:del sector )?p[uú]blico',
    'discapacidad': r'\bdiscapacidad\b|dependencia\b',
    'victimas': r'\bv[ií]ctimas?\b',
    'inmigrantes': r'\binmigra|extranjer|ilegales|regularizaci|menores extranjeros|remigraci',
    'pacientes': r'\bpacientes?\b|listas de espera|sanitari|salud\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|reforma\b|reformar|norma|legislaci[oó]n|derogar|derogaci[oó]n|prohibi|C[oó]digo Penal|Constituci[oó]n',
    'impuestos': r'\bIRPF\b|\bIVA\b|fiscal|impuesto|tribut|deducci[oó]n|bonificaci[oó]n|tasas?\b|cotizaci',
    'gasto': r'\bfinanciaci[oó]n|financiar|inversi[oó]n|invertir|fondos?\b|ayudas?\b|recursos\b|subvenci|presupuest|gasto',
    'organizacion': r'\bcrear\b|creaci[oó]n|agencia|organismo|oficina|suprimir|supresi[oó]n|eliminar|cierre|auditor',
    'plan': r'\bplan(?:es)?\b|programa\b|estrategia|convenio|acuerdo|pacto',
}

TERRITORIOS = {
    'Ceuta': r'\bCeuta\b',
    'Melilla': r'\bMelilla\b',
    'Canarias': r'\bCanarias\b|canari[oa]\b',
    'Baleares': r'\bBaleares\b',
    'Cataluña': r'\bCatalu[ñn]a\b',
    'País Vasco': r'\bPa[ií]s Vasco\b|\bVascongadas\b',
    'Navarra': r'\bNavarra\b',
    'Gibraltar': r'\bGibraltar\b',
    'Marruecos': r'\bMarruecos\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bBruselas\b|\beurope[oa]s?\b',
}

# Words ending in -ar, -er or -ir that are not infinitives.
NO_VERBOS = {
    'cualquier', 'alquiler', 'escolar', 'familiar', 'carácter', 'cáncer', 'gibraltar', 'nuclear', 'mujer',
    'lugar', 'hogar', 'bienestar', 'militar', 'particular', 'popular', 'similar', 'exterior', 'interior',
    'superior', 'anterior', 'posterior', 'menor', 'mayor', 'sector', 'valor', 'labor', 'titular', 'singular',
    'auxiliar', 'pilar', 'mar', 'escolar', 'regular', 'celular', 'vascular', 'circular', 'solar', 'polar',
    'nivel', 'primer', 'tercer', 'parlamentar', 'ejemplar',
}

# Key figures, chosen by reading the program. Each value must appear in the text of its measure.
CIFRAS = [
    ('5 millones', 'personas', 'recibidas en cinco años, según el programa, que propone no acoger a más inmigrantes', 9, '5 millones'),
    ('24', 'horas', 'como máximo para desalojar una vivienda okupada', 31, '24 horas'),
    ('0 %', 'IVA', 'en la compra de la primera vivienda habitual de nueva construcción', 34, '0%'),
    ('100 %', 'bonificación del ITP', 'en la compra de la primera vivienda habitual de segunda mano', 34, '100%'),
    ('0 €', 'cuota de autónomos', 'si los ingresos no llegan al Salario Mínimo Interprofesional', 2, 'cero euros'),
    ('50 €', 'cuota mínima', 'cuota progresiva de autónomos desde 50 euros, superado el SMI', 2, '50 euros'),
    ('3', 'normas derogadas', 'por cada ley nueva que se apruebe', 40, 'tres normas'),
    ('0-3', 'años', 'gratuidad real de la educación infantil', 94, '0 a 3 años'),
    ('12', 'vocales del CGPJ', 'de procedencia judicial, elegidos por y entre los jueces', 100, 'doce vocales'),
]

PRESENTACION = {
    'titulo': 'Es sentido común',
    'texto': (
        'El PDF oficial no tiene texto de presentación: tras el índice, entra directamente en las medidas. '
        'Reúne 115 medidas numeradas en 13 áreas, desde «Ceuta y Melilla» hasta «Infraestructuras y Transportes». '
        'El lema de la campaña resume sus tres ejes: prioridad nacional, desregulación y remigración.'
    ),
}

# Figures written in words that count as data («tres normas», «doce vocales», «cero euros»).
NUMEROS_ESCRITOS = r'\b(?:cero|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|veinte|cien|mil)\s+(?:euros|normas|vocales)\b'
NUMERO_RE = re.compile(r'^\s*(\d{1,3})\.\t')  # InDesign sets a tab after the number
CABECERA = 'ES SENTIDO COMÚN'
GUIONES = '­'


def limpiar(texto):
    texto = texto.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace(' ', ' ')
    return unicodedata.normalize('NFC', texto)


def unir(piezas):
    """Join pieces of text; '\\n' marks a line end. Removes the soft hyphens InDesign leaves
    where it breaks a word, and the line break itself."""
    lineas = ''.join(piezas).replace('\t', ' ').split('\n')
    resultado = ''
    for linea in lineas:
        linea = linea.strip()
        if not linea:
            continue
        if resultado.endswith(GUIONES):
            resultado = resultado[:-1] + linea
        elif resultado.endswith('-') and linea[:1].islower():
            resultado = resultado[:-1] + linea
        else:
            resultado = f'{resultado} {linea}'.strip()
    resultado = resultado.replace(GUIONES, '')
    return re.sub(r'\s+', ' ', resultado).strip()


def lineas_pdf(documento):
    """Yield (page, kind, runs) for every text line in reading order.

    A line can start with the measure's bold title and go on in light text, so each line is
    returned as runs of (is_title_font, text)."""
    for indice, pagina in enumerate(documento):
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = [s for s in linea['spans'] if s['text'].strip()]
                if not spans:
                    continue
                texto = limpiar(''.join(s['text'] for s in spans)).strip()
                primero = spans[0]
                fuente, tamano = primero['font'], round(primero['size'], 1)
                if tamano >= 17 and texto == CABECERA:
                    continue
                if 'Gotham-Bold' in fuente and tamano == 10.0 and texto.isdigit():
                    continue  # folio
                if 'GothamCondensed' in fuente and tamano == 22.0:
                    yield indice + 1, 'bloque', [(False, texto)]
                elif texto == '•':
                    yield indice + 1, 'vineta', []
                else:
                    runs = []
                    for s in linea['spans']:
                        negrita = 'Gotham-Medium' in s['font'] and round(s['size'], 1) == 10.0
                        if runs and runs[-1][0] == negrita:
                            runs[-1] = (negrita, runs[-1][1] + limpiar(s['text']))
                        else:
                            runs.append((negrita, limpiar(s['text'])))
                    yield indice + 1, 'linea', runs


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    medidas = []
    bloques_vistos = []  # (title in the PDF, page)
    actual = None
    parrafo = None
    en_titulo = False

    def cerrar_parrafo():
        nonlocal parrafo
        if actual is not None and parrafo and parrafo['lineas']:
            actual['parrafos'].append(parrafo)
        parrafo = None

    tipo_anterior = None
    for pagina, tipo, runs in lineas_pdf(documento):
        if pagina <= 3:
            continue  # cover, date and index
        anterior, tipo_anterior = tipo_anterior, tipo
        if tipo == 'bloque':
            cerrar_parrafo()
            en_titulo = False
            texto = runs[0][1]
            if anterior == 'bloque':  # heading set on two lines
                bloques_vistos[-1] = (bloques_vistos[-1][0] + ' ' + texto, pagina)
            else:
                bloques_vistos.append((texto, pagina))
            continue
        if tipo == 'vineta':
            cerrar_parrafo()
            en_titulo = False
            parrafo = {'vineta': True, 'lineas': []}
            continue
        numero = NUMERO_RE.match(runs[0][1]) if runs[0][0] else None
        if numero:
            cerrar_parrafo()
            actual = {
                'n': int(numero.group(1)),
                'bloque': len(bloques_vistos),
                'pagina': pagina,
                'titulo': [],
                'parrafos': [],
            }
            medidas.append(actual)
            en_titulo = True
            runs = [(True, runs[0][1][numero.end():])] + runs[1:]
        if actual is None:
            raise ValueError(f'Texto antes de la primera medida en la página {pagina}: {runs!r}')
        for negrita, texto in runs:
            if en_titulo and negrita:
                actual['titulo'].append(texto)
                continue
            if en_titulo:
                en_titulo = False
                actual['titulo'].append('\n')  # the title ends here, mid-line
            if parrafo is None:
                parrafo = {'vineta': False, 'lineas': []}
            parrafo['lineas'].append(texto)
        if en_titulo:
            actual['titulo'].append('\n')
        elif parrafo is not None:
            parrafo['lineas'].append('\n')
    cerrar_parrafo()

    numeros = [m['n'] for m in medidas]
    if numeros != list(range(1, TOTAL_MEDIDAS + 1)):
        raise ValueError(f'La numeración no es 1-{TOTAL_MEDIDAS}: {numeros}')
    if len(bloques_vistos) != len(BLOQUES):
        raise ValueError(f'Se esperaban {len(BLOQUES)} bloques; hay {len(bloques_vistos)}: {bloques_vistos}')
    for (titulo_pdf, _), (titulo, _) in zip(bloques_vistos, BLOQUES):
        if titulo_pdf.upper() != titulo.upper():
            raise ValueError(f'Bloque inesperado: {titulo_pdf!r} en lugar de {titulo!r}')
    return documento, bloques_vistos, medidas


def separar_titulo(medida):
    """The bold run is the title. When it holds several sentences, the first one is the title
    and the rest opens the text."""
    negrita = unir(medida['titulo'])
    if not negrita:
        raise ValueError(f'La medida {medida["n"]} no tiene título')
    titulo, resto = negrita, ''
    partes = re.split(r'(?<=[.:])\s+(?=[A-ZÁÉÍÓÚÑ¿«])', negrita, maxsplit=1)
    if len(partes) == 2:
        titulo, resto = partes
    return negrita, limpiar_titulo(titulo), resto.strip()


def limpiar_titulo(titulo):
    titulo = titulo.strip().rstrip(',:;').strip()
    if titulo.endswith('.') and not titulo.endswith('etc.'):
        titulo = titulo[:-1]
    return titulo


def componer_texto(negrita, resto, parrafos):
    """Text of the measure: the rest of the bold run and the paragraphs, bullets marked with «•».

    When the light text goes on with the bold sentence (lowercase or a comma), the bold run is
    only the lead-in of the sentence, so the text repeats it to stay readable."""
    textos = [(p['vineta'], unir(p['lineas'])) for p in parrafos]
    textos = [(v, t) for v, t in textos if t]
    if textos and not textos[0][0]:
        primero = textos[0][1]
        if re.match(r'^[a-záéíóúñ,;(]', primero):
            separador = '' if primero[0] in ',;' else ' '
            textos[0] = (False, f'{negrita}{separador}{primero}')
            resto = ''
        elif primero.startswith('.'):
            textos[0] = (False, primero[1:].strip())
        if resto:
            textos[0] = (False, f'{resto} {textos[0][1]}'.strip())
            resto = ''
    salida = [resto] if resto else []
    salida += [f'• {t}' if v else t for v, t in textos if t]
    return '\n\n'.join(salida)


ESPAÑOLES = {'Ceuta', 'Melilla', 'Canarias', 'Baleares', 'Cataluña', 'País Vasco', 'Navarra'}


def territorios_de(titulo, texto):
    """A Spanish territory counts only when the title (or the block title) names it: «Alivio fiscal en Baleares y Canarias»
    is for those islands, but the border plan of measure 88 names Ceuta and Melilla as an example and
    applies to all of Spain («Sin siglas» would show it only to readers in those cities)."""
    return [
        nombre for nombre, patron in TERRITORIOS.items()
        if re.search(patron, titulo) or (nombre not in ESPAÑOLES and re.search(patron, texto))
    ]


def frase(titulo):
    return titulo[:1].upper() + titulo[1:]


def crear_programa(documento, bloques_vistos, extraidas):
    bloques, secciones, medidas = [], [], []
    for bloque_id, ((titulo, _base), (_, pagina)) in enumerate(zip(BLOQUES, bloques_vistos), start=1):
        bloques.append({
            'id': bloque_id,
            'titulo': titulo,
            'tituloMayus': titulo.upper(),
            'lema': '',
            'cita': '',
            'intro': '',
            'pagina': pagina,
        })
        secciones.append({
            'id': str(bloque_id),
            'bloque': bloque_id,
            'titulo': titulo,
            'tituloFrase': titulo,
            'intro': '',
            'pagina': pagina,
            'subapartados': [],
        })

    for extraida in extraidas:
        numero = extraida['n']
        negrita, titulo, resto = separar_titulo(extraida)
        texto = componer_texto(negrita, resto, extraida['parrafos'])
        completo = f'{titulo}. {texto}'
        base = BLOQUES[extraida['bloque'] - 1][1]
        categoria = CATEGORIA_MEDIDA.get(numero, base)
        frases_cifra = [
            parte.strip().lstrip('• ')
            for parte in re.split(r'(?<=[.!?])\s+|\n\n', texto)
            if (re.search(r'\d', parte) and re.search(r'%|€|\b(?:euros?|millones|horas|d[ií]as|años|meses)\b', parte, re.I))
            or re.search(NUMEROS_ESCRITOS, parte, re.I)
        ][:3]
        medidas.append({
            'n': numero,
            'bloque': extraida['bloque'],
            'seccion': str(extraida['bloque']),
            'pagina': extraida['pagina'],
            'subapartado': None,
            'titulo': titulo,
            'tituloFrase': frase(titulo),
            'texto': texto,
            'oculta': False,
            'categoria': categoria,
            'colectivos': [n for n, p in COLECTIVOS.items() if re.search(p, completo, re.I)],
            'palancas': [n for n, p in PALANCAS.items() if re.search(p, completo, re.I)],
            'territorios': territorios_de(f"{BLOQUES[extraida['bloque'] - 1][0]}. {titulo}", texto),
            'cifras': frases_cifra,
            # No measure sets a date or a time to carry it out. The «24 horas» of measure 31 is how fast
            # a squatted home would be cleared: a figure of the measure, listed in CIFRAS, not a deadline.
            'plazo': None,
            'deroga': DEROGA.get(numero),
        })

    # VOX writes its measures in infinitives and nouns («Reducción», «Garantizar»), not in the future
    # tense of other programs, so the count looks for infinitives anywhere in the text.
    verbos = Counter()
    for medida in medidas:
        cuerpo = f"{medida['titulo']} {medida['texto']}".lower()
        for verbo in re.findall(r'\b([a-záéíóúñ]{4,}(?:ar|er|ir))\b', cuerpo):
            if verbo not in NO_VERBOS:
                verbos[verbo] += 1

    textos = {m['n']: f"{m['titulo']}. {m['texto']}" for m in medidas}
    cifras = []
    for valor, unidad, texto, numero, prueba in CIFRAS:
        if prueba not in textos[numero]:
            raise ValueError(f'La cifra «{valor}» no aparece en la medida {numero}')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'medida': numero})

    return {
        'id': 'vox',
        'partido': 'VOX',
        'siglas': 'VOX',
        'color': '#7cbd2a',
        'colorClaro': '#c4e19f',
        'programa': 'Es sentido común',
        'subtitulo': '115 medidas en 13 áreas para las elecciones generales',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/vox-es-sentido-comun-2026.pdf',
        'fuentePdf': 'https://votasentidocomun.es/general/files/programa-elecct-vox.pdf',
        'paginas': len(documento),
        'fechaPdf': '2026-11-12',
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': PRESENTACION,
        'cifras': cifras,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [{'verbo': v, 'n': n} for v, n in verbos.most_common(15)],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def main():
    documento, bloques_vistos, extraidas = extraer(sys.argv[1])
    programa = crear_programa(documento, bloques_vistos, extraidas)
    with open(sys.argv[2], 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
        archivo.write('\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
