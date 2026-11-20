"""Extrae el programa electoral de Drago Canarias (29N 2026) a JSON.

Uso: python scripts/extract_drago_canarias.py <programa.pdf> <salida.json>
     python scripts/extract_drago_canarias.py --depurar <programa.pdf>   (volcado legible de las medidas)

Estructura del PDF (tipografía observada con PyMuPDF):
  - «E J E 01» (13 pt, negrita) + título del eje (49 pt): bloque. Intro del eje: 13,1 pt negrita cursiva.
  - Título de sección (24 pt, Bahnschrift): sección. Intro de sección: 11,1 pt antes de «PROPUESTAS».
  - Número de medida (25,5 pt, negrita) + título (12,8 pt, negrita) + texto (11,1 pt).
  - Recuadros «El dato» / «Por qué desde el Congreso» (10,1 pt): se descartan.
  - Cabeceras y pies (9,6 pt; 22 pt; 38 pt «29N»): se descartan.
La tabla de la medida 9 (9,7 pt) se transcribe aparte, tal como aparece en la página 9.
"""
import json
import re
import sys
from datetime import datetime

import pymupdf

ULTIMA_PAGINA_PROPUESTAS = 30  # la página 31 son los agradecimientos

BLOQUES_TITULO = {1: 'Vivir en Canarias', 2: 'Islas conectadas y sostenibles',
                  3: 'Derechos y democracia', 4: 'Soberanía'}

# Categoría de cada medida: `src/data/taxonomia.json`.
CATEGORIA = {
    1: 'inmigracion', 2: 'vivienda', 3: 'territorio', 4: 'vivienda', 5: 'vivienda',
    6: 'fiscalidad', 7: 'fiscalidad', 8: 'empleo', 9: 'empleo', 10: 'empleo',
    11: 'empleo', 12: 'empleo', 13: 'empleo', 14: 'sanidad', 15: 'educacion',
    16: 'administracion', 17: 'social', 18: 'social', 19: 'educacion', 20: 'educacion',
    21: 'educacion', 22: 'social', 23: 'territorio', 24: 'infraestructuras',
    25: 'infraestructuras', 26: 'empleo', 27: 'fiscalidad', 28: 'energia', 29: 'energia',
    30: 'rural', 31: 'energia', 32: 'energia', 33: 'infraestructuras', 34: 'rural',
    35: 'rural', 36: 'rural', 37: 'rural', 38: 'rural', 39: 'infraestructuras',
    40: 'rural', 41: 'inmigracion', 42: 'inmigracion', 43: 'inmigracion', 44: 'inmigracion',
    45: 'exterior', 46: 'seguridad', 47: 'empleo', 48: 'social', 49: 'inmigracion',
    50: 'inmigracion', 51: 'inmigracion', 52: 'democracia', 53: 'democracia',
    54: 'identidad', 55: 'democracia', 56: 'democracia', 57: 'democracia',
    58: 'democracia', 59: 'administracion', 60: 'fiscalidad', 61: 'territorio',
    62: 'vivienda', 63: 'exterior', 64: 'territorio', 65: 'territorio', 66: 'territorio',
    67: 'exterior', 68: 'exterior', 69: 'identidad', 70: 'identidad',
}

# Colectivos de la taxonomía común, asignados a mano por medida.
COLECTIVOS = {
    1: ['inmigrantes'], 2: ['familias'], 4: ['familias', 'jovenes'], 5: ['familias'],
    9: ['autonomos'], 14: ['pacientes'], 15: ['jovenes', 'infancia'], 17: ['familias', 'mayores'],
    18: ['mayores'], 19: ['jovenes'], 20: ['infancia'], 21: ['jovenes'], 26: [],
    28: ['familias'], 29: ['rural'], 30: ['rural'], 31: ['familias'], 34: ['rural'],
    35: ['rural'], 36: ['rural'], 37: ['mujeres', 'rural'], 38: ['rural'], 40: ['rural', 'empresas'],
    41: ['inmigrantes', 'infancia'], 42: ['inmigrantes'], 43: ['inmigrantes'],
    44: ['inmigrantes'], 46: ['mujeres', 'victimas'], 47: ['mujeres'], 49: ['inmigrantes'],
    50: ['inmigrantes'], 51: ['inmigrantes'], 60: ['empresas'],
}

# Cifras comprometidas: el programa propone la cantidad. `contexto` es una cita literal del texto de la medida
# (lo comprueba el script). No entran las cifras que describen la situación actual.
CIFRAS = [
    (4, '222,6 millones', 'euros', 'duplicar la aportación estatal a la vivienda pública en alquiler', 'con otros 222,6 millones dedicados íntegramente a comprar y rehabilitar'),
    (7, '0 %', 'tipo del Impuesto sobre Sociedades', 'tipo cero solo para la vivienda protegida', 'que ese tipo cero valga solo para la vivienda en alquiler protegido permanente'),
    (9, '50 euros', 'al mes', 'cuota de autónomos con rendimientos de una a dos veces el salario mínimo', 'pagarían 50 euros al mes'),
    (10, '35 horas', 'semanales', 'jornada de las kellys', 'hasta las 35 horas semanales'),
    (13, '5 %', 'de representación sindical', 'bajar el listón de representatividad sindical', 'Proponemos bajarlo al 5 % y 500'),
    (19, '130 euros', 'más en la beca', 'subida de las becas por insularidad', 'cobre 130 euros más por lo que cuesta vivir en las islas'),
    (21, '25 %', 'del Consejo de Gobierno', 'peso del estudiantado en la universidad', 'subir ese mínimo al 25 %'),
    (25, '90 días', 'para localizar zonas sin conexión', 'plan estatal de localización de zonas sin internet', 'que en 90 días localice'),
    (44, '6,5 millones', 'euros al año', 'presupuesto de Salvamento Marítimo', 'subir el presupuesto de Salvamento Marítimo en unos 6,5 millones al año'),
    (47, '25 personas', 'trabajadoras, umbral del plan de igualdad', 'umbral del plan de igualdad', 'rebajar de 50 a 25 personas trabajadoras'),
    (47, '24 semanas', 'de permisos retribuidos', 'permisos retribuidos de conciliación', 'ampliar los permisos retribuidos de conciliación a 24 semanas'),
    (48, '25 personas', 'trabajadoras, umbral del protocolo', 'umbral del protocolo contra el acoso', 'rebajar de 50 a 25 personas trabajadoras'),
    (53, '400 escaños', 'en el Congreso', 'ampliación del Congreso', 'ampliar el Congreso a 400 escaños'),
    (53, '1', 'escaño mínimo por provincia', 'mínimo de escaños por provincia', 'bajar de 2 a 1 el mínimo por provincia'),
    (58, '15 días', 'para contestar, prorrogables 7', 'plazo de respuesta a las preguntas escritas', 'tenga 15 días, prorrogables 7'),
    (60, 'la mitad', 'de los puestos nuevos', 'reparto de puestos para desempleadas en Canarias', 'al menos la mitad de los puestos nuevos'),
    (62, 'veinte años', 'de compromiso mínimo', 'beneficio fiscal de la vivienda asequible', 'un compromiso mínimo de veinte años'),
]

# Plazos: solo cuándo se aplica la medida, en orden de inmediatez.
PLAZOS = [
    (43, 'inmediato', 'exigimos su cierre inmediato'),
    (25, '90 días', 'que en 90 días localice, parcela a parcela, dónde sigue sin haber conexión'),
    (65, 'esta legislatura', 'un calendario público para completarlos en esta legislatura'),
]
ORDEN_PLAZOS = ['inmediato', '90 días', 'esta legislatura']

# Derogaciones explícitas (el texto de la medida debe decir «derog»).
DEROGA = {49: 'Pacto Europeo de Migración y Asilo'}

# Palancas por palabras clave (aproximación, ver la nota de método).
PALANCAS = [
    ('ley', r'\bley\b|reforma|reglamento|derog|estatuto'),
    ('impuestos', r'impuesto|\btributar\b|(?-i:\bIBI\b)|IRPF|cotizaci|\bcuota\b|bonificad|exención|tipo reducido'),
    ('gasto', r'financi|presupuest|millones|fondos|dinero|euros'),
    ('organizacion', r'traspaso|Canarias decida|decidir|cabildo|ayuntamiento|administración'),
    ('plan', r'\bplan\b|convenio|\bpacto\b(?! Europeo)|programa|auditor|protocolo|calendario'),
]

TERRITORIOS = ['El Hierro', 'La Palma', 'La Gomera', 'Lanzarote', 'Fuerteventura', 'Gran Canaria',
               'Las Palmas de Gran Canaria', 'La Laguna', 'Tenerife', 'Santa Cruz de Tenerife', 'Canarias', 'Marruecos', 'Sáhara Occidental',
               'Ceuta', 'Melilla', 'Barranco Seco', 'Hoya Fría', 'La Restinga', 'Mar de las Calmas']

TABLA_MEDIDA_9 = [
    'Lo que ganas al año (neto) | Lo que pagas hoy al mes | Lo que pagarías al mes | Lo que te ahorras al año',
    'Menos de 17.094 € | Desde 205,88 € | 0 € | Entre 2.471 y 3.632 €',
    'De 17.094 a 34.188 € | Desde 302,65 € | 50 € | Entre 3.032 y 4.835 €',
    'De 34.188 a 42.735 € | Desde 452,94 € | De 50 € a la cuota normal, poco a poco | De 4.835 € a 0, según lo que ganes',
    'Más de 42.735 € | Cuota normal | Sin cambios | Nada',
]


def lineas(page):
    """Líneas de una página con su tamaño, tipografía y posición vertical."""
    out = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            spans = [s for s in l['spans'] if s['text'].strip()]
            if not spans:
                continue
            texto = re.sub(r'\s+', ' ', ''.join(s['text'] for s in spans)).strip()
            out.append({'texto': texto, 'size': round(spans[0]['size'], 1), 'font': spans[0]['font'],
                        'y': l['bbox'][1], 'x': l['bbox'][0], 'x1': l['bbox'][2]})
    return sorted(out, key=lambda r: (round(r['y']), r['x']))


def unir(parrafos, texto, salto):
    if salto or not parrafos:
        parrafos.append(texto)
    else:
        parrafos[-1] = f'{parrafos[-1]} {texto}'


def extraer(ruta):
    doc = pymupdf.open(ruta)
    bloques, secciones, medidas = [], [], []
    eje = None
    seccion = None
    medida = None
    ultima_y = None
    ultima_pagina = None
    ultima_x1 = None
    detener = False
    previa_seccion = False
    for num in range(6, ULTIMA_PAGINA_PROPUESTAS + 1):
        pagina = num
        for r in lineas(doc[num - 1]):
            t, size, y = r['texto'], r['size'], r['y']
            if detener or y < 40 or y > 770 or size in (9.6, 22.0, 38.0, 10.1, 9.0, 9.7):
                continue
            # Dentro de una página, un salto vertical grande abre párrafo. Al cambiar de página, abre párrafo
            # solo si la última línea anterior acaba lejos del margen derecho (el párrafo termina ahí).
            if ultima_y is None:
                salto = True
            elif ultima_pagina == pagina:
                salto = y - ultima_y > 19
            else:
                salto = ultima_x1 is not None and ultima_x1 < 495
            if size == 13.0 and re.fullmatch(r'E J E \d\d', t):
                if medida:
                    medidas.append(medida)
                    medida = None
                n = int(t[-2:])
                eje = n
                bloques.append({'id': n, 'titulo': BLOQUES_TITULO[n], 'lema': '', 'cita': '',
                                'intro': '', 'pagina': pagina})
                seccion = None
                ultima_y = None
                continue
            if size == 49.0 and eje:
                continue
            if size == 13.1 and seccion is None and eje:
                bloques[-1]['intro'] = unir_texto(bloques[-1]['intro'], t)
                ultima_y, ultima_pagina, ultima_x1 = y, pagina, r['x1']
                continue
            if size == 24.0 and eje:
                if previa_seccion and seccion:
                    # Título de sección en dos líneas (p. ej. «Energía, agua, sector primario y medio» + «ambiente»).
                    seccion['titulo'] = f"{seccion['titulo']} {t}"
                    seccion['tituloFrase'] = seccion['titulo']
                else:
                    if medida:
                        medidas.append(medida)
                        medida = None
                    seccion = {'id': str(len(secciones) + 1), 'bloque': eje, 'titulo': t,
                               'tituloFrase': t, 'intro': '', 'pagina': pagina, 'subapartados': []}
                    secciones.append(seccion)
                ultima_y = None
                previa_seccion = True
                continue
            previa_seccion = False
            if size == 25.5 and re.match(r'\d+(\s|$)', t):
                # El número puede ir solo (título en la línea siguiente) o seguido del título.
                if medida:
                    medidas.append(medida)
                numero, _, resto = t.partition(' ')
                medida = {'n': int(numero), 'bloque': eje, 'seccion': seccion['id'], 'pagina': pagina,
                          'titulo_partes': [resto] if resto.strip() else [], 'parrafos': [],
                          'estado': 'titulo'}
                ultima_y = None
                continue
            if size == 12.8 and medida and medida['estado'] == 'titulo':
                medida['titulo_partes'].append(t)
                ultima_y, ultima_pagina, ultima_x1 = y, pagina, r['x1']
                continue
            if size == 11.1 and t.startswith('Estas son nuestras propuestas'):
                if medida:
                    medidas.append(medida)
                    medida = None
                detener = True
                continue
            if size == 11.1 and medida:
                medida['estado'] = 'cuerpo'
                unir(medida['parrafos'], t, salto)
                ultima_y, ultima_pagina, ultima_x1 = y, pagina, r['x1']
                continue
            if size == 11.1 and seccion is not None and medida is None:
                seccion['intro'] = unir_texto(seccion['intro'], t) if not salto else (
                    seccion['intro'] + '\n\n' + t if seccion['intro'] else t)
                ultima_y, ultima_pagina, ultima_x1 = y, pagina, r['x1']
                continue
    if medida:
        medidas.append(medida)
    return doc, bloques, secciones, medidas


def unir_texto(acumulado, texto):
    return f'{acumulado} {texto}'.strip()


def fecha_pdf(doc):
    creado = doc.metadata.get('creationDate', '') or ''
    m = re.search(r"D:(\d{4})(\d{2})(\d{2})", creado)
    return f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else None


def construir(doc, bloques, secciones, medidas):
    salida_medidas = []
    for m in medidas:
        n = m['n']
        titulo = ' '.join(m['titulo_partes']).strip()
        texto = '\n\n'.join(m['parrafos']).strip()
        if n == 9:
            texto = f"{texto}\n\n" + '\n\n'.join(TABLA_MEDIDA_9)
        palancas = [k for k, rx in PALANCAS if re.search(rx, f'{titulo} {texto}', re.IGNORECASE)]
        territorios = [t for t in TERRITORIOS if t in f'{titulo} {texto}']
        if len(territorios) > 1 and 'Canarias' in territorios:
            territorios.remove('Canarias')
        # Un nombre que está dentro de otro (Tenerife dentro de Santa Cruz de Tenerife) no se repite.
        territorios = [t for t in territorios if not any(t != o and t in o for o in territorios)]
        cifras = []
        for cn, _, _, _, contexto in CIFRAS:
            if cn == n:
                assert contexto in texto, f'cifra de la medida {n} no literal: {contexto!r}'
                cifras.append(contexto)
        plazo = next((p for pn, p, _ in PLAZOS if pn == n), None)
        salida_medidas.append({
            'n': n, 'bloque': m['bloque'], 'seccion': m['seccion'], 'pagina': m['pagina'],
            'subapartado': None, 'titulo': titulo, 'tituloFrase': titulo, 'texto': texto,
            'oculta': False, 'categoria': CATEGORIA[n],
            'colectivos': COLECTIVOS.get(n, []), 'palancas': palancas,
            'territorios': territorios, 'cifras': cifras, 'plazo': plazo,
            'deroga': DEROGA.get(n),
        })
    cifras_programa = []
    for cn, valor, unidad, texto, contexto in CIFRAS:
        cifras_programa.append({'valor': valor, 'unidad': unidad, 'texto': texto,
                                'contexto': contexto, 'medida': cn})
    plazos = [{'plazo': p, 'texto': t, 'medida': pn} for pn, p, t in PLAZOS]
    return salida_medidas, cifras_programa, plazos


def presentacion(doc):
    """Dos párrafos de la portada del programa (página 3, 14,6 pt)."""
    parrafos = []
    ultima_y = None
    for r in lineas(doc[2]):
        if r['size'] != 14.6:
            continue
        salto = ultima_y is None or r['y'] - ultima_y > 25
        unir(parrafos, r['texto'], salto)
        ultima_y = r['y']
    return parrafos


def main(ruta_pdf, ruta_json):
    doc, bloques, secciones, medidas = extraer(ruta_pdf)
    medidas_json, cifras, plazos = construir(doc, bloques, secciones, medidas)

    assert len(medidas_json) == 70, f'{len(medidas_json)} medidas, se esperaban 70'
    assert [m['n'] for m in medidas_json] == list(range(1, 71)), 'numeración no correlativa'
    assert len(bloques) == 4 and len(secciones) == 9, (len(bloques), len(secciones))
    for m in medidas_json:
        assert m['titulo'], f"medida {m['n']} sin título"
        assert m['texto'], f"medida {m['n']} sin texto"
    por_n = {m['n']: m for m in medidas_json}
    for n, plazo, literal in PLAZOS:
        assert literal in por_n[n]['texto'], f'plazo de la medida {n} no literal: {literal!r}'
    for n, texto in DEROGA.items():
        assert 'derog' in por_n[n]['texto'].lower(), f'la medida {n} no dice «derog»'

    partes = presentacion(doc)
    salida = {
        'id': 'drago-canarias',
        'partido': 'Partido Drago Canarias',
        'siglas': 'D.R.G',
        'comunidad': 'Canarias',
        'observaciones': [
            'Programa tomado del PDF publicado en la web oficial del partido (dragocanarias.com).',
            'Medidas numeradas del 1 al 70 en cuatro ejes; el PDF no salta ningún número.',
        ],
        'color': '#000000',
        'colorClaro': '#ffffff',
        'programa': 'La esperanza vence al miedo',
        'subtitulo': '70 propuestas en cuatro ejes para las elecciones generales',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/drago-la-esperanza-2026.pdf',
        'fuentePdf': 'https://www.dragocanarias.com/wp-content/uploads/2026/11/Drago-Canarias-Programa-electoral-29N.pdf',
        'paginas': doc.page_count,
        'fechaPdf': fecha_pdf(doc),
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {'titulo': 'La esperanza vence al miedo', 'texto': '\n\n'.join(partes)},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas_json,
    }
    with open(ruta_json, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(medidas_json)} medidas, {len(secciones)} secciones, {len(cifras)} cifras, {len(plazos)} plazos -> {ruta_json}')


def depurar(ruta_pdf):
    doc, bloques, secciones, medidas = extraer(ruta_pdf)
    medidas_json, _, _ = construir(doc, bloques, secciones, medidas)
    for m in medidas_json:
        print(f"[{m['n']}] p.{m['pagina']} {m['categoria']} | {m['titulo']}")
        print(m['texto'])
        print()


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--depurar':
        depurar(sys.argv[2])
    elif len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        sys.exit(__doc__)
