"""Extract and categorize the measures in the Teruel Existe program for 29N.

PDF «Programa electoral completo 29N | Teruel Existe» (15 pages, A4, two columns), published on
teruelexiste.info on 13 November 2026. Typography of each level:

- Block (the 12 numbered chapters, «1. Un cambio de rumbo…»): Lato-Bold 16.3, green.
- Intro of a block or a subsection: Lato-Regular / Lato-Bold 10.6, black.
- Subsection («4.1. Sanidad pública de calidad», «Carreteras», «Lo que no aceptaremos»): Lato-Bold 12.3, green.
- Measure: a bullet «•» (Helvetica 10) followed by its text in Lato 10. When the measure starts with a bold run
  that ends in a full stop («Mecanismo rural de garantía.»), that run is its title; otherwise the title is the first
  sentence of the text.
- Repeated pieces that are not content: «P R O G R A M A   E L E C T O R A L», «Propuestas», «PRIORIDAD N» and the
  page counter «03 / 15».

Each bullet is one measure. The document has no numbering of its own, so `n` is consecutive. Page 2 (the five
priorities) is the presentation.

Usage: python scripts/extract_teruel_existe.py PDF JSON [--depurar ARCHIVO]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz


PAGINAS = 15
TOTAL_MEDIDAS = 140
BLOQUES_ESPERADOS = 12

# Base category of each block (by its number) and of each subsection (by its id).
CATEGORIA_BLOQUE = {
    1: 'territorio',
    2: 'energia',
    3: 'territorio',
    4: 'social',
    5: 'infraestructuras',
    6: 'rural',
    7: 'empleo',
    8: 'innovacion',
    9: 'territorio',
    10: 'energia',
    11: 'social',
    12: 'democracia',
}
CATEGORIA_SECCION = {
    '4.1': 'sanidad',
    '4.2': 'social',
    '4.3': 'vivienda',
    '6.2': 'infraestructuras',
    '6.3': 'rural',
}
# Exceptions, measure by measure, after reading the whole program (`--depurar`). Keyed by the measure title, which
# does not change if the party adds a bullet before it.
CATEGORIA_MEDIDA = {
    'Presupuestos con mirada territorial': 'administracion',
    'Puertas giratorias': 'democracia',
    'Minería': 'empleo',
    'El abandono y saqueo de nuestra tierra': 'territorio',
    'Fondo Soberano': 'fiscalidad',
    'Recuperar el cánon energético': 'fiscalidad',
    'Exigir contrapartidas': 'empleo',
    'Fiscalidad justa y diferenciada': 'fiscalidad',
    'Fondo específico para financiación de proyectos empresariales, creado y gestionado desde la SEPI (Sociedad Estatal de…': 'empleo',
    'Educación': 'educacion',
    'Seguridad en el medio rural': 'seguridad',
    'Digitalización': 'innovacion',
    'Estrategia nacional contra los incendios': 'emergencias',
    'Universidad en el territorio': 'educacion',
    'Un Museo Nacional en Teruel': 'identidad',
    'Centro Nacional de Diseño Contemporáneo “Manuel Pertegaz”': 'identidad',
    'Desarrollo de la iniciativa “Power Experience”, para la dinamización económica y cultural de la provincia a partir de…': 'identidad',
    'Teruel, ciudad de museos': 'identidad',
    'Cultura en red': 'identidad',
    'Geoparques': 'identidad',
    'Recursos endógenos': 'identidad',
    'Fiscalidad diferenciada positiva': 'fiscalidad',
    'Administración presente en el territorio': 'administracion',
    'Complemento de territorialidad para empleados públicos en zonas menos pobladas y subida salarial en las plazas de…': 'administracion',
    'Vivienda contra la despoblación': 'vivienda',
    'Empleo y teletrabajo': 'empleo',
    'Emprendimiento, FP e investigación vinculados al territorio, y fomento de la economía social y solidaria': 'empleo',
    'Conciliación y corresponsabilidad': 'familia',
    'Natalidad y crianza': 'familia',
    'Igualdad laboral en el empleo, en los puestos de responsabilidad y en los salarios, y medidas para facilitar el…': 'empleo',
    'Violencia de género': 'seguridad',
}

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes\b|juventud',
    'mayores': r'\bpersonas mayores\b|pensionistas?|pensiones?|\bmayores\b',
    'mujeres': r'\bmujeres?\b|violencia de g[eé]nero',
    'familias': r'\bfamilias?\b|conciliaci[oó]n|crianza|natalidad',
    'infancia': r'\binfancia\b|infantil|alumn|escuelas?\b|colegios?',
    'autonomos': r'\baut[oó]nom[oa]s\b|pymes|pequeñas empresas|emprendimiento|emprendedor',
    'empresas': r'\bempresas?\b|industria',
    'rural': r'\brural(?:es)?\b|agricultur|ganader|agrari|regantes|pueblos\b|montes\b',
    'funcionarios': r'\bfuncionari|empleados? p[uú]blicos|personal sanitario|profesionales sanitarios|docentes\b',
    'discapacidad': r'\bdiscapacidad\b|dependencia\b|dependientes',
    'victimas': r'\bv[ií]ctimas?\b',
    'inmigrantes': r'\binmigra|migrantes?\b',
    'pacientes': r'\bpacientes?\b|sanidad|sanitari|hospital|consultorios?',
}

PALANCAS = {
    'ley': r'\bley\b|leyes|reforma|normativa|legislaci[oó]n|transposici[oó]n|derog|estatuto',
    'impuestos': r'\bIRPF\b|fiscal|impuestos?|tribut|deducci[oó]n|bonificaci[oó]n|canon|c[aá]non|cotizaci',
    'gasto': r'\bfinanciaci[oó]n|financiar|inversi[oó]n|invertir|fondos?\b|ayudas?\b|presupuest|recursos\b|dotaci',
    'organizacion': r'\bcrear|creaci[oó]n|agencia|organismo|oficina|centro\b|ventanilla|unidad\b',
    'plan': r'\bplan(?:es)?\b|programa\b|estrategia|pacto|convenio|acuerdo',
}

TERRITORIOS = {
    'Teruel': r'\bTeruel\b|turolense',
    'Aragón': r'\bArag[oó]n\b|aragon[eé]s',
    'Maestrazgo': r'\bMaestrazgo\b',
    'Matarraña': r'\bMatarraña\b',
    'Andorra (Teruel)': r'\bAndorra\b',
    'Alcañiz': r'\bAlcañiz\b',
    'Albarracín': r'\bAlbarrac[ií]n\b',
    'Zaragoza': r'\bZaragoza\b',
    'Valencia': r'\bValencia\b|Sagunto|Requena',
    'Castellón': r'\bCastell[oó]n\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bUE\b|europe[oa]s?\b',
}

DEROGA = {}

IGNORAR = re.compile(r'^(P R O G R A M A\s+E L E C T O R A L|Propuestas|PRIORIDAD \d+|\d{2} / \d{2})$')


def limpiar(texto):
    texto = texto.replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace(' ', ' ')
    return unicodedata.normalize('NFC', texto)


def unir(lineas):
    """Join PDF lines into one paragraph: words cut with a hyphen are rejoined."""
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
    """Lines of the PDF, in reading order, with their style and the text of their bold and regular runs."""
    for indice, pagina in enumerate(documento):
        for bloque in pagina.get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                spans = sorted(linea['spans'], key=lambda span: span['bbox'][0])
                texto = limpiar(''.join(span['text'] for span in spans))
                if not texto.strip():
                    continue
                principal = next((span for span in spans if span['text'].strip() and span['font'] != 'Helvetica'), spans[0])
                yield {
                    'pagina': indice + 1,
                    'texto': texto.strip(),
                    'tamano': round(principal['size'], 1),
                    'negrita': 'Bold' in principal['font'],
                    'vineta': texto.lstrip().startswith('•'),
                    'spans': [(limpiar(span['text']), 'Bold' in span['font']) for span in spans if span['font'] != 'Helvetica'],
                }


def extraer(pdf):
    documento = fitz.open(pdf)
    if len(documento) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(documento)}')

    bloques, secciones, crudas = [], [], []
    presentacion = []
    estado = None  # 'titulo_bloque', 'intro_bloque', 'titulo_seccion', 'intro_seccion', 'medida'
    actual = None

    def seccion_actual(pagina):
        bloque = bloques[-1]
        propias = [s for s in secciones if s['bloque'] == bloque['id']]
        if not propias:
            secciones.append({
                'id': str(bloque['id']), 'bloque': bloque['id'], 'titulo': bloque['titulo'],
                'tituloFrase': bloque['titulo'], 'intro': '', 'pagina': pagina, 'subapartados': [], '_intro': [],
            })
        return secciones[-1]

    for linea in lineas_pdf(documento):
        texto = linea['texto']
        if IGNORAR.match(texto):
            continue
        if linea['pagina'] <= 2:
            if linea['pagina'] == 2:
                presentacion.append(texto)
            continue

        if linea['tamano'] == 16.3 and linea['negrita']:
            if estado == 'titulo_bloque':
                bloques[-1]['_titulo'].append(texto)
            else:
                bloques.append({'id': len(bloques) + 1, '_titulo': [texto], '_intro': [], 'pagina': linea['pagina']})
            estado = 'titulo_bloque'
            continue
        if estado == 'titulo_bloque':
            titulo = unir(bloques[-1]['_titulo'])
            numero = re.match(r'^(\d+)\.\s+(.*)$', titulo)
            if not numero or int(numero.group(1)) != bloques[-1]['id']:
                raise ValueError(f'Bloque inesperado: {titulo!r}')
            bloques[-1]['titulo'] = numero.group(2)

        if linea['tamano'] == 12.3 and linea['negrita']:
            if estado == 'titulo_seccion':
                secciones[-1]['_titulo'].append(texto)
            else:
                bloque = bloques[-1]
                k = sum(1 for s in secciones if s['bloque'] == bloque['id']) + 1
                secciones.append({
                    'id': f"{bloque['id']}.{k}", 'bloque': bloque['id'], '_titulo': [texto], '_intro': [],
                    'pagina': linea['pagina'], 'subapartados': [],
                })
            estado = 'titulo_seccion'
            continue
        if estado == 'titulo_seccion':
            titulo = unir(secciones[-1]['_titulo'])
            numero = re.match(r'^(\d+\.\d+)\.\s+(.*?)\.?$', titulo)
            if numero:
                secciones[-1]['id'] = numero.group(1)
                titulo = numero.group(2)
            secciones[-1]['titulo'] = secciones[-1]['tituloFrase'] = titulo

        if linea['vineta']:
            seccion = seccion_actual(linea['pagina'])
            actual = {'pagina': linea['pagina'], 'bloque': bloques[-1]['id'], 'seccion': seccion['id'], 'spans': []}
            crudas.append(actual)
            actual['spans'].extend(linea['spans'])
            estado = 'medida'
            continue

        if linea['tamano'] == 10.0 and estado == 'medida':
            actual['spans'].append((' ', False))
            actual['spans'].extend(linea['spans'])
            continue
        if linea['tamano'] == 10.6:
            if estado in ('titulo_bloque', 'intro_bloque'):
                bloques[-1]['_intro'].append(texto)
                estado = 'intro_bloque'
            elif estado in ('titulo_seccion', 'intro_seccion'):
                secciones[-1]['_intro'].append(texto)
                estado = 'intro_seccion'
            else:
                raise ValueError(f'Texto de entradilla fuera de sitio (p. {linea["pagina"]}): {texto!r}')
            continue
        raise ValueError(f'Línea sin clasificar (p. {linea["pagina"]}, {linea["tamano"]}): {texto!r}')

    for bloque in bloques:
        bloque['intro'] = unir(bloque.pop('_intro'))
        bloque.pop('_titulo')
    for seccion in secciones:
        seccion['intro'] = unir(seccion.pop('_intro'))
        seccion.pop('_titulo', None)

    if len(bloques) != BLOQUES_ESPERADOS:
        raise ValueError(f'Se esperaban {BLOQUES_ESPERADOS} bloques; hay {len(bloques)}')
    if len(crudas) != TOTAL_MEDIDAS:
        raise ValueError(f'Se esperaban {TOTAL_MEDIDAS} medidas; hay {len(crudas)}')
    # The block titles must be the ones in the PDF outline.
    indice = [re.sub(r'^\d+\.\s+', '', titulo) for nivel, titulo, pagina in documento.get_toc() if re.match(r'^\d+\.', titulo)]
    if indice != [bloque['titulo'] for bloque in bloques]:
        raise ValueError(f'Los bloques no coinciden con el índice del PDF:\n{indice}\n{[b["titulo"] for b in bloques]}')
    return documento, bloques, secciones, crudas, unir(presentacion)


def titulo_y_texto(spans):
    """Split a bullet into title and text: the leading bold run, if it ends with a full stop, is the title."""
    texto = unir([''.join(t for t, _ in spans).replace('•', '', 1)])
    negrita = ''
    for trozo, es_negrita in spans:
        if trozo.strip() == '•':
            continue
        if not es_negrita and trozo.strip():
            break
        negrita += trozo
    negrita = unir([negrita])
    if negrita.endswith('.') and len(negrita) > 3 and texto.startswith(negrita):
        return negrita.rstrip('.'), texto[len(negrita):].strip()
    partes = re.split(r'(?<=[.])\s+', texto, maxsplit=1)
    # A short first sentence followed by more text works as a title even when the PDF does not set it in bold
    # («Alquiler asequible. Impulsaremos…»).
    if len(partes) == 2 and len(partes[0]) <= 70:
        return partes[0].rstrip('.'), partes[1].strip()
    primera = re.split(r'(?<=[.:])\s+', texto, maxsplit=1)[0].rstrip('.:')
    if len(primera) > 120:
        primera = primera[:118].rsplit(' ', 1)[0] + '…'
    return primera, texto


def frases(texto):
    return [frase.strip() for frase in re.split(r'(?<=[.!?])\s+', texto) if frase.strip()]


CIFRA = re.compile(r'\d[\d.,]*\s*(?:%|€|euros?|millones|mil\b|kil[oó]metros|km\b|viviendas|habitantes|años?\b|meses\b|horas\b)', re.I)


def crear_programa(documento, bloques, secciones, crudas, presentacion):
    medidas = []
    for numero, cruda in enumerate(crudas, start=1):
        titulo, texto = titulo_y_texto(cruda['spans'])
        completo = f'{titulo}. {texto}'
        categoria = CATEGORIA_MEDIDA.get(
            titulo, CATEGORIA_SECCION.get(cruda['seccion'], CATEGORIA_BLOQUE[cruda['bloque']]))
        medidas.append({
            'n': numero,
            'bloque': cruda['bloque'],
            'seccion': cruda['seccion'],
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
            'deroga': DEROGA.get(titulo),
        })

    por_titulo = {medida['titulo']: medida for medida in medidas}
    if set(CATEGORIA_MEDIDA) - set(por_titulo):
        raise ValueError(f'Excepciones de categoría sin medida: {sorted(set(CATEGORIA_MEDIDA) - set(por_titulo))}')

    # Quantified commitments, read one by one (title of the measure → literal phrase, value, unit, short text).
    cifras = []
    for titulo, contexto, valor, unidad, resumen in CIFRAS:
        medida = por_titulo[titulo]
        frase = next((f for f in frases(medida['texto']) if contexto in f), None)
        if frase is None:
            raise ValueError(f'La cifra {contexto!r} no está en la medida {titulo!r}')
        if frase not in medida['cifras']:
            medida['cifras'].append(frase)
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': resumen, 'contexto': contexto, 'medida': medida['n']})

    plazos = []
    for titulo, contexto, plazo in PLAZOS:
        medida = por_titulo[titulo]
        if contexto not in medida['texto']:
            raise ValueError(f'El plazo {contexto!r} no está en la medida {titulo!r}')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': medida['tituloFrase'], 'medida': medida['n']})

    return {
        'id': 'teruel-existe',
        'partido': 'Teruel Existe',
        'siglas': 'TE',
        'comunidad': 'Aragón',
        'color': '#2b9348',
        'colorClaro': '#a0cead',
        'programa': 'Programa electoral 29N',
        'subtitulo': 'Vamos a seguir defendiendo nuestra tierra: programa de Teruel Existe para las elecciones generales del 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/teruel-existe-programa-29n-2026.pdf',
        'fuentePdf': 'https://teruelexiste.info/wp-content/uploads/2026/11/Programa_Teruel_Existe_Completo_29N.pdf',
        'paginas': len(documento),
        'fechaPdf': '2026-11-13',
        'observaciones': [
            'El PDF no tiene fecha en sus metadatos; la fecha es la de su publicación en teruelexiste.info (13 de noviembre de 2026).',
            'El programa no numera sus propuestas: cada viñeta es una medida, numerada en orden de aparición.',
        ],
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': 'Un programa para transformar Teruel', 'texto': presentacion},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [],
        'bloques': [
            {'id': b['id'], 'titulo': b['titulo'], 'tituloMayus': b['titulo'].upper(), 'lema': '', 'cita': '',
             'intro': b['intro'], 'pagina': b['pagina']}
            for b in bloques
        ],
        'secciones': secciones,
        'medidas': medidas,
    }


# Quantified commitments: (measure title, literal phrase in its text, value, unit, short text).
CIFRAS = [
    ('Pacto de Estado por el Desarrollo Rural, la Repoblación y el Reequilibrio Territorial, con un mecanismo estable de…',
     'al menos el equivalente al 2% del PIB', '2 %', 'del PIB al año',
     'Pacto de Estado contra los desequilibrios territoriales, durante 30 años'),
    ('Fondo de Inversiones de Teruel (FITE)', 'hasta los 100 millones de euros', '100', 'millones de euros',
     'Fondo de Inversiones de Teruel (FITE)'),
    ('Eficiencia energética en viviendas', 'para 700.000 viviendas al año', '700.000', 'viviendas al año',
     'Rehabilitación energética, con el 30 % para vivienda rural'),
    ('Atención primaria', 'hasta el 25 % del presupuesto sanitario', '25 %', 'del presupuesto sanitario',
     'Financiación de la atención primaria'),
    ('Fiscalidad diferenciada positiva', 'reducir en un 25% la cuota del IRPF', '25 %', 'de la cuota del IRPF',
     'Rebaja para residentes en localidades despobladas de menos de 5.000 habitantes'),
    ('Fiscalidad diferenciada positiva', 'reducido en un 80 % el impuesto de transmisiones patrimoniales', '80 %',
     'del impuesto de transmisiones', 'Rebaja al comprar vivienda en localidades despobladas'),
    ('Ayudas al funcionamiento de las empresas y autónomos en la provincia de Teruel, en los niveles máximos autorizados…',
     '20% de los costes laborales', '20 %', 'de los costes laborales', 'Ayudas al funcionamiento de empresas y autónomos'),
    ('Democratizar la producción y el acceso', 'reservaremos el 20 % de la capacidad de acceso', '20 %',
     'de la capacidad de acceso a la red', 'Reserva para pequeñas instalaciones de autoconsumo'),
    ('Internet para todos', 'al menos 300 Mbps simétricos en zonas rurales', '300', 'Mbps simétricos',
     'Conexión mínima en zonas rurales'),
    ('Plan 300/30/30', 'a un máximo de 30 minutos', '30', 'minutos', 'Distancia máxima a los servicios públicos básicos'),
    ('Parques Público de Vivienda en todos los municipios en modalidad de alquiler', 'al menos cuatro vivendas por localidad',
     '4', 'viviendas por localidad', 'Vivienda pública de alquiler en los pueblos pequeños'),
]
PLAZOS = [
    ('Tren directo Teruel–Madrid, con trenes de altas prestaciones, en ambas direcciones y de forma inmediata',
     'de forma inmediata', 'De forma inmediata'),
    ('Plan Director de la línea convencional 610 Zaragoza–Teruel–Sagunto', 'su inmediata apertura al tráfico',
     'De forma inmediata'),
    ('Clima', 'para 2030', '2030'),
]
ORDEN_PLAZOS = ['De forma inmediata', '2030']


def depurar(programa, ruta):
    with open(ruta, 'w', encoding='utf-8') as archivo:
        for bloque in programa['bloques']:
            archivo.write(f"\n##### {bloque['id']}. {bloque['titulo']} (p. {bloque['pagina']})\n{bloque['intro']}\n")
            for seccion in [s for s in programa['secciones'] if s['bloque'] == bloque['id']]:
                archivo.write(f"\n=== {seccion['id']} {seccion['titulo']}\n{seccion['intro']}\n")
                for m in [m for m in programa['medidas'] if m['seccion'] == seccion['id']]:
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
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'medidas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
