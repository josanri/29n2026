"""Extrae y clasifica el programa bilingüe al Senado de Formentera Viva (28 páginas, 30 medidas).

Uso: python scripts/extract_formentera_viva.py PDF SALIDA.json [--depurar volcado.txt]

Estructura del PDF oficial (28 páginas, catalán en páginas pares y castellano en páginas impares):
- Página 1: portada («UNA VEU PRÒPIA. / UNA VOZ PROPIA.»).
- Páginas 2-3: presentación («Per què ens presentem?» / «¿Por qué nos presentamos?»).
- Páginas 4-5: mapa del programa (10 ejes).
- Páginas 6-25: los 10 ejes, cada uno en catalán (página par) y castellano (página impar):
  - Cabecera «EJE NN · TÍTULO» (Lato-Bold 8,4 pt en blanco).
  - Lema del eje (NotoSerif-Bold 20,6 pt en #174f49).
  - Introducción del eje (Lato-Regular 9,1 pt en #123d43).
  - «QUÉ DEFENDEREMOS» (Lato-Heavy 7,1 pt): tres propuestas concretas, cada una con rótulo inicial en
    Lato-Bold 8,7 pt (#174f49) seguido del texto en Lato-Regular 8,7 pt (#1c3437).
  - «CÓMO LO HAREMOS DESDE EL SENADO» y «CÓMO COMPROBAREMOS LOS AVANCES» (se incorporan a la intro del bloque).
  - Cita de cierre al pie (NotoSerif-Bold 9,2 pt en #174f49).
- Páginas 26-27: «Así trabajaremos» (compromiso de método parlamentario).
- Página 28: contraportada.

El extractor toma el texto literal de las páginas en castellano (páginas impares 3 y 7..25).
"""
import json
import re
import sys
import unicodedata

import fitz

from clasificacion import COLECTIVOS, PALANCAS, TERRITORIOS, coincidencias

ID = 'formentera-viva'
PDF_PUBLICO = '/programas/formentera-viva-senado-2026.pdf'
FUENTE_PDF = 'https://formentera-viva-borrador.cvformentera.chatgpt.site/documents/Formentera_Viva_Programa_Bilingue_2026.pdf'
PAGINAS = 28
TOTAL_BLOQUES = 10
TOTAL_MEDIDAS = 30

PAGINAS_EJES_ES = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25]

TITULOS_BLOQUE = {
    1: 'Triple insularidad',
    2: 'Vivienda',
    3: 'Migración y respuesta humanitaria',
    4: 'Costas y litoral',
    5: 'Medio ambiente',
    6: 'Servicios públicos',
    7: 'Seguridad y salvamento',
    8: 'Conexiones e infraestructuras',
    9: 'Economía local',
    10: 'Oficina del senador',
}

# Categoría medida a medida (n -> id de taxonomia.json).
CATEGORIA_MEDIDA = {
    1: 'territorio',
    2: 'infraestructuras',
    3: 'territorio',
    4: 'vivienda',
    5: 'vivienda',
    6: 'vivienda',
    7: 'inmigracion',
    8: 'inmigracion',
    9: 'inmigracion',
    10: 'territorio',
    11: 'justicia',
    12: 'energia',
    13: 'energia',
    14: 'infraestructuras',
    15: 'rural',
    16: 'administracion',
    17: 'administracion',
    18: 'educacion',
    19: 'seguridad',
    20: 'emergencias',
    21: 'seguridad',
    22: 'infraestructuras',
    23: 'infraestructuras',
    24: 'infraestructuras',
    25: 'fiscalidad',
    26: 'rural',
    27: 'empleo',
    28: 'democracia',
    29: 'democracia',
    30: 'democracia',
}

TERRITORIOS_EXTRA = {
    **TERRITORIOS,
    'Formentera': r'\bFormentera\b',
    'Ibiza': r'\bIbiza\b|\bEivissa\b',
    'Argelia': r'\bArgelia\b',
}


def limpiar(texto):
    texto = unicodedata.normalize('NFC', texto)
    return re.sub(r'\s+', ' ', texto).strip()


def lineas_pagina(page):
    """Devuelve las líneas de una página ordenadas por (y, x), con sus spans."""
    resultado = []
    for bloque in page.get_text('dict')['blocks']:
        if bloque['type'] != 0:
            continue
        for linea in bloque['lines']:
            spans = [s for s in linea['spans'] if s['text'].strip()]
            if not spans:
                continue
            spans.sort(key=lambda s: s['bbox'][0])
            resultado.append({
                'y': round(linea['bbox'][1], 1),
                'x': round(linea['bbox'][0], 1),
                'spans': spans,
                'texto': limpiar(' '.join(s['text'].strip() for s in spans)),
            })
    resultado.sort(key=lambda l: (l['y'], l['x']))
    return resultado


def extraer_presentacion(page):
    lineas = lineas_pagina(page)
    titulo_partes = []
    parrafos = []
    actual = []
    y_prev = None
    for l in lineas:
        s0 = l['spans'][0]
        sz = round(s0['size'], 1)
        fn = s0['font']
        if sz >= 20 and 'NotoSerif' in fn:
            titulo_partes.append(l['texto'])
        elif 255 <= l['y'] <= 480 and sz >= 8.5 and 'Lato' in fn:
            if y_prev is not None and l['y'] - y_prev > 16:
                if actual:
                    parrafos.append(limpiar(' '.join(actual)))
                    actual = []
            actual.append(l['texto'])
            y_prev = l['y']
    if actual:
        parrafos.append(limpiar(' '.join(actual)))
    return {
        'titulo': limpiar(' '.join(titulo_partes)),
        'texto': '\n\n'.join(parrafos),
    }


def extraer_eje(page, eje_num, pagina_num):
    lineas = lineas_pagina(page)
    lema_partes = []
    intro_partes = []
    cita_partes = []
    como_senado = []
    como_avances = []
    propuestas = []
    estado = 'cabecera'

    for l in lineas:
        s0 = l['spans'][0]
        sz = round(s0['size'], 1)
        fn = s0['font']
        txt = l['texto']

        if l['y'] < 180:
            continue
        if l['y'] >= 500 and 'NotoSerif' in fn:
            cita_partes.append(txt)
            continue
        if sz >= 18 and 'NotoSerif' in fn:
            lema_partes.append(txt)
            continue
        if 'Lato-Heavy' in fn:
            if 'QUÉ DEFENDEREMOS' in txt:
                estado = 'defenderemos'
            elif 'CÓMO LO HAREMOS' in txt:
                estado = 'senado'
            elif 'CÓMO COMPROBAREMOS' in txt:
                estado = 'avances'
            continue

        if estado == 'cabecera' and 245 <= l['y'] < 280:
            intro_partes.append(txt)
        elif estado == 'defenderemos':
            if 'Lato-Bold' in s0['font']:
                titulo = s0['text'].strip().rstrip('.')
                resto = ' '.join(sp['text'].strip() for sp in l['spans'][1:])
                propuestas.append({'titulo': titulo, 'partes': [resto] if resto else []})
            elif propuestas:
                propuestas[-1]['partes'].append(txt)
        elif estado == 'senado':
            como_senado.append(txt)
        elif estado == 'avances':
            como_avances.append(txt)

    if len(propuestas) != 3:
        raise ValueError(f'Eje {eje_num} (pág. {pagina_num}): se esperaban 3 propuestas, hay {len(propuestas)}')

    intro_bloques = [limpiar(' '.join(intro_partes))]
    if como_senado:
        intro_bloques.append(f"Cómo lo haremos desde el Senado: {limpiar(' '.join(como_senado))}")
    if como_avances:
        intro_bloques.append(f"Cómo comprobaremos los avances: {limpiar(' '.join(como_avances))}")

    return {
        'id': eje_num,
        'titulo': TITULOS_BLOQUE[eje_num],
        'lema': limpiar(' '.join(lema_partes)),
        'cita': limpiar(' '.join(cita_partes)),
        'intro': '\n\n'.join(intro_bloques),
        'pagina': pagina_num,
        'propuestas': [
            {'titulo': limpiar(p['titulo']), 'texto': limpiar(' '.join(p['partes']))}
            for p in propuestas
        ],
    }


def extraer(pdf):
    doc = fitz.open(pdf)
    if len(doc) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(doc)}')

    presentacion = extraer_presentacion(doc[2])
    bloques = []
    secciones = []
    medidas = []
    n = 0

    for eje_num, pag in enumerate(PAGINAS_EJES_ES, start=1):
        eje = extraer_eje(doc[pag - 1], eje_num, pag)
        sec_id = f'eje-{eje_num:02d}'
        bloques.append({
            'id': eje['id'],
            'titulo': eje['titulo'],
            'lema': eje['lema'],
            'cita': eje['cita'],
            'intro': eje['intro'],
            'pagina': eje['pagina'],
        })
        secciones.append({
            'id': sec_id,
            'bloque': eje['id'],
            'titulo': eje['lema'],
            'tituloFrase': eje['lema'],
            'intro': '',
            'pagina': eje['pagina'],
            'subapartados': [],
        })
        for prop in eje['propuestas']:
            n += 1
            texto_completo = f"{prop['titulo']}. {prop['texto']}"
            medidas.append({
                'n': n,
                'bloque': eje['id'],
                'seccion': sec_id,
                'pagina': eje['pagina'],
                'subapartado': None,
                'titulo': prop['titulo'],
                'tituloFrase': prop['titulo'],
                'texto': prop['texto'],
                'oculta': False,
                'categoria': CATEGORIA_MEDIDA[n],
                'colectivos': coincidencias(texto_completo, COLECTIVOS),
                'palancas': coincidencias(texto_completo, PALANCAS),
                'territorios': coincidencias(texto_completo, TERRITORIOS_EXTRA),
                'cifras': [],
                'plazo': None,
                'deroga': None,
            })

    doc.close()
    if len(bloques) != TOTAL_BLOQUES or len(medidas) != TOTAL_MEDIDAS:
        raise ValueError(f'Totales inesperados: {len(bloques)} bloques, {len(medidas)} medidas')

    return {
        'id': ID,
        'partido': 'Formentera Viva',
        'siglas': 'FV',
        'comunidad': 'Illes Balears',
        'observaciones': [
            'Programa para el Senado: es la candidatura de la agrupación de electores Formentera Viva al Senado por Formentera. No concurre al Congreso.',
            'El PDF oficial es bilingüe (catalán y castellano en páginas consecutivas). Este análisis recoge el texto literal de las páginas en castellano.',
            'Cada uno de los diez ejes incluye tres propuestas concretas bajo «Qué defenderemos» (30 medidas en total), numeradas del 1 al 30 en el orden del documento.',
        ],
        'color': '#1E7DD4',
        'colorClaro': '#D7F7F8',
        'programa': 'Una voz propia',
        'subtitulo': 'Programa electoral al Senado de Formentera Viva',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE_PDF,
        'paginas': PAGINAS,
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': presentacion,
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def escribir_depuracion(programa, ruta):
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(f"{programa['partido']} — {programa['programa']} ({len(programa['medidas'])} medidas)\n\n")
        for m in programa['medidas']:
            f.write(f"#{m['n']:02d} [B{m['bloque']} p.{m['pagina']} {m['categoria']}] {m['titulo']}\n")
            f.write(f"    {m['texto']}\n")
            f.write(f"    col={m['colectivos']} pal={m['palancas']} ter={m['territorios']}\n\n")


def main():
    args = sys.argv[1:]
    depurar = None
    if '--depurar' in args:
        idx = args.index('--depurar')
        depurar = args[idx + 1]
        args = args[:idx] + args[idx + 2:]
    if len(args) != 2:
        raise SystemExit('Uso: python scripts/extract_formentera_viva.py ORIGEN.pdf DESTINO.json [--depurar volcado.txt]')

    programa = extraer(args[0])
    with open(args[1], 'w', encoding='utf-8') as f:
        json.dump(programa, f, ensure_ascii=False, indent=1)
        f.write('\n')
    if depurar:
        escribir_depuracion(programa, depurar)
    print(f"{len(programa['medidas'])} medidas, {len(programa['secciones'])} secciones, {len(programa['bloques'])} bloques")


if __name__ == '__main__':
    main()
