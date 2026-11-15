"""Extract the 16 axes of the electoral manifesto of Unidad del Pueblo Canario (UPC) for 29N.

PDF «Manifiesto electoral de la Unidad del Pueblo Canario (UPC). Una sola papeleta. Todo un pueblo» (6 pages: a
cover image, four pages of text and a back cover), published on unidadpueblocanario.org/manifiesto. The PDF has no
creation date; its modification date is 30 October 2026 (compressed with iLovePDF), and the press reported it on
4 November 2026.

The text is an introduction and 16 numbered axes («1.   Autogobierno, soberanía popular y derecho a decidir»), each
with one or two paragraphs. Each axis is one measure and, as in the document, its own block. A title can run over two
lines («7. Sostenibilidad territorial, límites al crecimiento turístico y soberanía / Energética»): the titles are
checked against `EJES`.

Usage: python scripts/extract_upc.py PDF JSON [--depurar ARCHIVO]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


PAGINAS = 6
CIERRE = 'UNA SOLA PAPELETA. TODO UN PUEBLO'

# Number → (title in the PDF, category).
EJES = {
    1: ('Autogobierno, soberanía popular y derecho a decidir', 'territorio'),
    2: ('Sistema de Financiación Autonómica', 'territorio'),
    3: ('Presupuestos Generales del Estado', 'administracion'),
    4: ('Nuevo Marco Financiero Plurianual 2028-2034 de la Unión Europea', 'exterior'),
    5: ('La vivienda es un derecho y no un negocio', 'vivienda'),
    6: ('Servicios públicos y pensiones', 'social'),
    7: ('Sostenibilidad territorial, límites al crecimiento turístico y soberanía Energética', 'energia'),
    8: ('Nuevo Pacto Económico para Canarias', 'empleo'),
    9: ('Propuestas de reforma fiscal a nivel estatal', 'fiscalidad'),
    10: ('Aumento del salario mínimo y avances en la legislación laboral a favor de los derechos de los trabajadores',
         'empleo'),
    11: ('Canarias feminista e igualitaria', 'social'),
    12: ('Canarias, frontera Sur', 'inmigracion'),
    13: ('Cultura, identidad y patrimonio canario', 'identidad'),
    14: ('Democracia participativa, transparencia pública y lucha contra el transfuguismo político', 'democracia'),
    15: ('Solidaridad internacional, cooperación entre pueblos y búsqueda de la paz', 'exterior'),
    16: ('Juventud, emancipación y justicia intergeneracional', 'social'),
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]ven|juventud|emancipaci[oó]n',
    'mayores': r'\bpersonas mayores\b|pensiones',
    'mujeres': r'\bmujeres?\b|machistas?|feminista|igualdad salarial',
    'familias': r'\bfamilias?\b|conciliaci[oó]n',
    'infancia': r'\binfancia\b|adolescencia|0 a 3 años',
    'autonomos': r'\bpymes\b|aut[oó]nom[oa]s\b',
    'empresas': r'\bgrandes empresas\b|industria',
    'rural': r'\bsector primario\b|agrari|pesquer|acu[ií]cola|POSEI',
    'discapacidad': r'\bdependencia\b',
    'inmigrantes': r'\bmigra',
    'pacientes': r'\bsanidad\b|salud mental|atenci[oó]n primaria',
}
PALANCAS = {
    'ley': r'\bEstatuto\b|legislaci[oó]n|regular\b|reconocimiento',
    'impuestos': r'\bfiscal|tributaci[oó]n|deducciones|tasa tur[ií]stica|\bREF\b',
    'gasto': r'\bfinanciaci[oó]n|financien|fondos\b|presupuestos|inversi[oó]n|0,7',
    'organizacion': r'\bsistema p[uú]blico|gesti[oó]n p[uú]blica|mecanismos',
    'plan': r'\bplanificaci[oó]n|pacto|moratoria',
}
TERRITORIOS = {
    'Canarias': r'\bCanarias\b|canari[oa]s?\b|Archipi[eé]lago|\bIslas\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|europe[oa]s|Europa\b',
    'Marruecos': r'\bMarruecos\b',
    'África': r'\b[ÁA]frica\b',
    'América Latina': r'\bAm[eé]rica Latina\b',
    'Palestina': r'\bpalestino\b',
    'Sáhara Occidental': r'\bsaharaui\b',
}

# Quantified commitments: (axis, literal phrase, value, unit, short text).
CIFRAS = [
    (15, 'mínimo, del 0,7% de los Presupuestos Generales del Estado', '0,7 %', 'de los Presupuestos Generales del Estado',
     'Consignación mínima para cooperación y solidaridad internacional'),
]


def limpiar(texto):
    texto = texto.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace(' ', ' ')
    return unicodedata.normalize('NFC', texto)


def lineas(documento):
    for indice, pagina in enumerate(documento):
        for linea in limpiar(pagina.get_text()).splitlines():
            # A line with only spaces separates two paragraphs in this PDF.
            yield indice + 1, linea.strip()


def parrafos(trozos):
    """Paragraphs of a list of lines: an empty line closes the paragraph."""
    resultado, actual = [], ''
    for linea in trozos:
        if not linea:
            if actual:
                resultado.append(re.sub(r'\s+', ' ', actual))
            actual = ''
            continue
        actual = f'{actual} {linea}'.strip()
    if actual:
        resultado.append(re.sub(r'\s+', ' ', actual))
    return resultado


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    intro, ejes = [], []
    actual = None
    for pagina, linea in lineas(documento):
        if not linea:
            if actual is None:
                intro.append(linea)
            elif actual['texto']:
                actual['texto'].append(linea)
            continue
        if linea == CIERRE:
            if actual:
                break
            continue
        numero = re.match(r'^(\d{1,2})\.\s+(.+)$', linea)
        if numero and int(numero.group(1)) == len(ejes) + 1 and not re.match(r'^\d+\.\d', linea):
            actual = {'n': int(numero.group(1)), 'pagina': pagina, 'titulo': [numero.group(2)], 'texto': []}
            ejes.append(actual)
            continue
        if actual is None:
            intro.append(linea)
        elif actual['texto'] or len(' '.join(actual['titulo'])) >= len(EJES[actual['n']][0].rstrip('.')):
            actual['texto'].append(linea)
        else:
            actual['titulo'].append(linea)

    if len(ejes) != len(EJES):
        raise ValueError(f'Se esperaban {len(EJES)} ejes; hay {len(ejes)}')
    for eje in ejes:
        titulo = re.sub(r'\s+', ' ', ' '.join(eje['titulo'])).rstrip('.')
        if titulo != EJES[eje['n']][0]:
            raise ValueError(f'El eje {eje["n"]} no coincide: {titulo!r}')
        eje['titulo'] = titulo
        eje['parrafos'] = parrafos(eje['texto'])
    return documento, parrafos(intro), ejes


def crear_programa(documento, intro, ejes):
    bloques, secciones, medidas = [], [], []
    for eje in ejes:
        n = eje['n']
        titulo, categoria = EJES[n]
        texto = '\n\n'.join(eje['parrafos'])
        bloques.append({'id': n, 'titulo': titulo, 'tituloMayus': titulo.upper(), 'lema': '', 'cita': '', 'intro': '',
                        'pagina': eje['pagina']})
        secciones.append({'id': str(n), 'bloque': n, 'titulo': titulo, 'tituloFrase': titulo, 'intro': '',
                          'pagina': eje['pagina'], 'subapartados': []})
        completo = f'{titulo}. {texto}'
        medidas.append({
            'n': n, 'bloque': n, 'seccion': str(n), 'pagina': eje['pagina'], 'subapartado': None,
            'titulo': titulo, 'tituloFrase': titulo, 'texto': texto, 'oculta': False, 'categoria': categoria,
            'colectivos': [nombre for nombre, patron in COLECTIVOS.items() if re.search(patron, completo, re.I)],
            'palancas': [nombre for nombre, patron in PALANCAS.items() if re.search(patron, completo, re.I)],
            'territorios': [nombre for nombre, patron in TERRITORIOS.items() if re.search(patron, completo)],
            'cifras': [], 'plazo': None, 'deroga': None,
        })

    cifras = []
    for n, contexto, valor, unidad, resumen in CIFRAS:
        medida = medidas[n - 1]
        frase = next((f for f in re.split(r'(?<=[.])\s+', medida['texto']) if contexto in f), None)
        if frase is None:
            raise ValueError(f'La cifra {contexto!r} no está en el eje {n}')
        medida['cifras'].append(frase)
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': resumen, 'contexto': contexto, 'medida': n})

    titulo_intro = intro[0]
    if not titulo_intro.startswith('MANIFIESTO ELECTORAL'):
        raise ValueError(f'Introducción inesperada: {titulo_intro!r}')
    presentacion = [p for p in intro[1:] if not p.startswith('UNA SOLA PAPELETA') and not p.startswith('Nuestra acción')]
    return {
        'id': 'upc',
        'partido': 'Unidad del Pueblo Canario',
        'siglas': 'UPC',
        'comunidad': 'Canarias',
        'color': '#1F9995',
        'colorClaro': '#D7F3F2',
        'programa': 'Una sola papeleta. Todo un pueblo',
        'subtitulo': 'Manifiesto electoral de Unidad del Pueblo Canario: 16 ejes para las elecciones generales del 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/upc-manifiesto-29n-2026.pdf',
        'fuentePdf': 'https://www.unidadpueblocanario.org/documentos/manifiesto-upc.pdf',
        'paginas': len(documento),
        'fechaPdf': '2026-10-30',
        'observaciones': [
            'Es el manifiesto electoral de la coalición, no un programa extenso: 16 ejes, cada uno con uno o dos '
            'párrafos. Cada eje es aquí una propuesta.',
            'El PDF no tiene fecha de creación; la fecha es la de su última modificación (30 de octubre de 2026). La '
            'prensa lo publicó el 4 de noviembre de 2026.',
            'Unidad del Pueblo Canario reúne a Nueva Canarias-Bloque Canarista, Podemos, Izquierda Unida Canaria, '
            'Movimiento Sumar y Partido Verde Canarias.',
        ],
        'unidadMedida': 'eje',
        'unidadMedidas': 'ejes',
        'presentacion': {'titulo': 'Una sola papeleta. Todo un pueblo', 'texto': '\n\n'.join(presentacion)},
        'cifras': cifras,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def depurar(programa, ruta):
    with open(ruta, 'w', encoding='utf-8') as archivo:
        archivo.write(programa['presentacion']['texto'] + '\n')
        for m in programa['medidas']:
            archivo.write(f"\n[{m['n']}] p.{m['pagina']} {m['categoria']} | {m['titulo']}\n    {m['texto']}\n")


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
    print('páginas', programa['paginas'], 'ejes', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
