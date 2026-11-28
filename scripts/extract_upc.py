"""Extract the full electoral program of Unidad del Pueblo Canario (UPC) for 29N 2026.

PDF «Programa electoral de Unidad del Pueblo Canario» (19 pages, creationDate 2026-11-16), published at
https://www.unidadpueblocanario.org/programa-20261120/programa-electoral-upc.pdf.

The program is structured into 5 blocks and 16 numbered axes (ejes). Inside each axis, concrete proposals
appear either as bullet points («- » or «• ») or as standalone proposal paragraphs (in prose-only axes or
unbulleted blocks). Each concrete proposal is extracted as a measure, numbered sequentially from 1 to N.

Usage: python scripts/extract_upc.py PDF JSON [--depurar ARCHIVO]
"""
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz
from clasificacion import completar

PAGINAS = 19
FUENTE = 'https://www.unidadpueblocanario.org/programa-20261120/programa-electoral-upc.pdf'
CIERRE = 'UNA SOLA PAPELETA PARA DEFENDER CANARIAS'

BLOQUES_META = {
    1: ('Vida digna, derechos sociales y empleo', 'Vivienda, servicios públicos, empleo y juventud'),
    2: ('Economía, financiación, justicia fiscal y modelo productivo de Canarias', 'Financiación, REF, fiscalidad y sostenibilidad'),
    3: ('Autogobierno, identidad y derechos colectivos', 'Autogobierno, cultura canaria y frontera sur'),
    4: ('Igualdad y democracia participativa', 'Feminismo, igualdad y regeneración democrática'),
    5: ('Solidaridad internacional, cooperación y paz', 'Cooperación y derechos humanos'),
}

# Eje number -> (block_id, default_category)
EJES_META = {
    1: (1, 'vivienda'),
    2: (1, 'social'),
    3: (1, 'empleo'),
    4: (1, 'social'),
    5: (2, 'territorio'),
    6: (2, 'territorio'),
    7: (2, 'exterior'),
    8: (2, 'innovacion'),
    9: (2, 'fiscalidad'),
    10: (2, 'energia'),
    11: (3, 'territorio'),
    12: (3, 'identidad'),
    13: (3, 'inmigracion'),
    14: (4, 'social'),
    15: (4, 'democracia'),
    16: (5, 'exterior'),
}

SUBAPARTADOS = {
    'Pesca artesanal y gestión sostenible del medio marino': 'rural',
    'Agricultura y ganadería': 'rural',
    'Autónomos, pymes y pequeño comercio de Canarias': 'empleo',
    'Transición energética y adaptación climática': 'energia',
    'Costas, agua y restauración ecológica': 'energia',
    'Biodiversidad y espacios naturales de Canarias': 'rural',
}


def limpiar(texto):
    texto = texto.replace('\u00ad', '').replace('\ufb01', 'fi').replace('\ufb02', 'fl').replace('\u00a0', ' ')
    return unicodedata.normalize('NFC', texto)


def primera_frase(texto):
    # If the text starts with «Title: body», use the label before ':'
    m_colon = re.match(r'^([^.:;]{5,90}):\s+(.+)$', texto)
    if m_colon:
        return m_colon.group(1).strip(), texto
    m = re.search(r'(?<=[.!?])\s+', texto)
    titulo = texto[:m.start()].strip() if m else texto.strip()
    titulo = titulo.rstrip(' .;:')
    if len(titulo) > 125:
        titulo = titulo[:122].rsplit(' ', 1)[0] + '…'
    return titulo, texto


def categoria_por_texto(default_cat, sub_cat, texto):
    if sub_cat:
        return sub_cat
    low = texto.lower()
    if default_cat == 'social':
        if any(w in low for w in ('educación pública', 'colegios e institutos', 'universidades públicas', 'alumnado', 'centros escolares')):
            return 'educacion'
        if any(w in low for w in ('sanidad pública', 'atención primaria', 'diabetes', 'ley 15/1997', 'farmacéutica pública')):
            return 'sanidad'
        if 'voto a los 16' in low:
            return 'democracia'
        if 'educación afectivo-sexual' in low or 'aborto' in low:
            return 'sanidad'
        if 'educación en igualdad' in low or 'formación continua del profesorado' in low:
            return 'educacion'
    if default_cat == 'territorio':
        if any(w in low for w in ('billetes aéreos', 'transporte marítimo', 'guaguas', 'aeropuertos', 'torres de control')):
            return 'infraestructuras'
        if 'sistema eléctrico' in low:
            return 'energia'
        if 'plan integral de empleo' in low:
            return 'empleo'
        if 'luchar contra la pobreza' in low:
            return 'social'
        if 'posei' in low or 'aguas de riego' in low:
            return 'rural'
    if default_cat == 'innovacion':
        if 'ric en vivienda' in low:
            return 'vivienda'
    if default_cat == 'inmigracion':
        if 'catástrofes' in low or 'protección civil' in low or 'vigilancia volcánica' in low:
            return 'emergencias'
    return default_cat


def extraer(pdf):
    doc = fitz.open(pdf)
    if len(doc) != PAGINAS:
        raise ValueError(f'Se esperaban {PAGINAS} páginas; el PDF tiene {len(doc)}')

    # Collect raw lines with page numbers, preserving empty lines as paragraph breaks
    raw_lines = []
    for idx, page in enumerate(doc, 1):
        if idx == 1:
            continue
        lines = limpiar(page.get_text()).splitlines()
        started = False
        for line in lines:
            s = line.strip()
            if not started and s.isdigit() and int(s) == idx:
                started = True
                continue
            started = True
            raw_lines.append((idx, s))

    # Group into paragraphs (empty line or new bullet/heading starts a new paragraph)
    # First join wrapped lines inside the same paragraph
    items = []  # list of (page, text)
    cur_page, cur_lines = None, []

    def flush():
        nonlocal cur_page, cur_lines
        if cur_lines:
            joined = ''
            for ln in cur_lines:
                if joined.endswith('-') and ln[:1].islower():
                    joined = joined[:-1] + ln
                else:
                    joined = f'{joined} {ln}'.strip()
            joined = re.sub(r'\s+', ' ', joined).strip()
            if joined:
                items.append((cur_page, joined))
        cur_page, cur_lines = None, []

    for page, s in raw_lines:
        if not s:
            flush()
            continue
        if s.startswith(CIERRE):
            flush()
            break
        # New block, new axis, new subheading, or new bullet forces a paragraph break
        is_block = bool(re.match(r'^BLOQUE\s+[1-5]\.', s))
        is_axis = bool(re.match(r'^(\d{1,2})\.\s+[A-ZÁÉÍÓÚÑ]', s)) and int(re.match(r'^(\d{1,2})\.', s).group(1)) <= 16
        is_bullet = bool(re.match(r'^[-•]\s*', s))
        is_sub = s in SUBAPARTADOS
        if is_block or is_axis or is_bullet or is_sub:
            # Handle standalone bullet char '•' or '-' on its own line
            if s in ('-', '•'):
                flush()
                cur_page, cur_lines = page, [s]
                continue
            # If previous cur_lines was JUST ['-'] or ['•'], attach this line to it
            if cur_lines in (['-'], ['•']):
                cur_lines.append(s)
                continue
            flush()
            cur_page, cur_lines = page, [s]
            continue
        if cur_page is None:
            cur_page = page
        cur_lines.append(s)
    flush()

    # Merge two-line block/axis titles (e.g. 'BLOQUE 2. ... DE' + 'CANARIAS', '10. ... soberanía' + 'Energética')
    merged = []
    i = 0
    while i < len(items):
        p, txt = items[i]
        if i + 1 < len(items):
            np, ntxt = items[i + 1]
            if txt.startswith('BLOQUE 2.') and ntxt == 'CANARIAS':
                merged.append((p, txt + ' ' + ntxt))
                i += 2
                continue
            if txt.startswith('10. Sostenibilidad') and ntxt == 'Energética':
                merged.append((p, txt + ' ' + ntxt))
                i += 2
                continue
            if txt.startswith('3. Aumento del salario') and ntxt.startswith('los derechos de los trabajadores'):
                merged.append((p, txt + ' ' + ntxt))
                i += 2
                continue
            if txt.startswith('15. Democracia participativa') and ntxt.startswith('transfuguismo político'):
                merged.append((p, txt + ' ' + ntxt))
                i += 2
                continue
        merged.append((p, txt))
        i += 1

    intro_paras = []
    bloques = []
    secciones = []
    medidas = []

    current_block = None
    current_eje = None
    current_sub = None
    current_sub_cat = None

    for page, txt in merged:
        m_block = re.match(r'^BLOQUE\s+([1-5])\.\s+(.+)$', txt)
        if m_block:
            bid = int(m_block.group(1))
            titulo, lema = BLOQUES_META[bid]
            current_block = bid
            current_eje = None
            current_sub = None
            current_sub_cat = None
            bloques.append({
                'id': bid,
                'titulo': titulo,
                'tituloMayus': titulo.upper(),
                'lema': lema,
                'cita': '',
                'intro': '',
                'pagina': page,
            })
            continue

        m_eje = re.match(r'^(\d{1,2})\.\s+(.+)$', txt)
        if m_eje and current_block is not None:
            eid = int(m_eje.group(1))
            if eid in EJES_META and EJES_META[eid][0] == current_block:
                titulo = m_eje.group(2).rstrip('.').strip()
                current_eje = {
                    'id': str(eid),
                    'n': eid,
                    'bloque': current_block,
                    'titulo': titulo,
                    'tituloFrase': titulo,
                    'intro_parts': [],
                    'pagina': page,
                    'subapartados': [],
                    'has_measures': False,
                }
                secciones.append(current_eje)
                current_sub = None
                current_sub_cat = None
                continue

        if current_block is None:
            if not txt.startswith('Nuestra acción política se articula'):
                intro_paras.append(txt)
            continue

        if current_eje is None:
            continue

        if txt in SUBAPARTADOS:
            current_sub = len(current_eje['subapartados'])
            current_sub_cat = SUBAPARTADOS[txt]
            current_eje['subapartados'].append({'titulo': txt, 'intro': ''})
            continue

        is_bullet = bool(re.match(r'^[-•]\s*', txt))
        clean_txt = re.sub(r'^[-•]\s*', '', txt).strip()

        # Skip short lead-in sentences ending in ':' before a bullet list
        if not is_bullet and clean_txt.endswith(':') and len(clean_txt) < 260:
            if current_sub is not None and not current_eje['subapartados'][current_sub]['intro']:
                current_eje['subapartados'][current_sub]['intro'] = clean_txt
            else:
                current_eje['intro_parts'].append(clean_txt)
            continue

        # In axes with explicit bullets, the opening framing paragraph (if followed by bullets) is intro
        # Unless it is clearly a concrete proposal itself
        eid = current_eje['n']
        is_intro_only = (
            not is_bullet
            and not current_eje['has_measures']
            and current_sub is None
            and eid in (1, 2, 3, 5, 6, 7, 10, 14)
            and (
                clean_txt.startswith('Defendemos que el acceso')
                or clean_txt.startswith('Defendemos una sanidad')
                or clean_txt.startswith('Defenderemos en las Cortes')
                or clean_txt.startswith('UPC combatirá')
                or clean_txt.startswith('Nos oponemos a que el Gobierno')
                or clean_txt.startswith('Exigimos una financiación')
                or clean_txt.startswith('Canarias obtiene el 75%')
                or clean_txt.startswith('Reclamamos que los Presupuestos')
                or clean_txt.startswith('Defendemos que la Unión Europea')
                or clean_txt.startswith('Defenderemos en los foros estatales')
                or clean_txt.startswith('El crecimiento del sector turístico')
                or clean_txt.startswith('Desde Unidad del Pueblo Canario se incorporarán')
                or clean_txt.startswith('La lucha contra las violencias')
                or clean_txt.startswith('La coalición defenderá')
                or clean_txt.startswith('El sistema público de cuidados')
                or clean_txt.startswith('Unidad del Pueblo Canario exige')
            )
        )
        if is_intro_only:
            current_eje['intro_parts'].append(clean_txt)
            continue
        if not is_bullet and current_sub is not None and clean_txt.startswith(('Defenderemos un modelo económico', 'Acelerar la transición energética')):
            current_eje['subapartados'][current_sub]['intro'] = clean_txt
            continue

        # Otherwise it's a concrete proposal!
        current_eje['has_measures'] = True
        default_cat = EJES_META[eid][1]
        cat = categoria_por_texto(default_cat, current_sub_cat, clean_txt)
        titulo, body = primera_frase(clean_txt)
        deroga = None
        if 'derogar la ley 15/1997' in clean_txt.lower():
            deroga = 'Ley 15/1997'
        elif 'derogando el factor de sostenibilidad' in clean_txt.lower():
            deroga = 'Factor de sostenibilidad de las pensiones'
        elif 'derogación de la materialización de la ric' in clean_txt.lower():
            deroga = 'Materialización de la RIC en vivienda libre de alquiler sin límite de renta'

        medida = {
            'n': len(medidas) + 1,
            'bloque': current_block,
            'seccion': str(eid),
            'pagina': page,
            'subapartado': current_sub,
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': body,
            'oculta': False,
            'categoria': cat,
            'colectivos': [],
            'palancas': [],
            'territorios': [],
            'cifras': [],
            'plazo': None,
            'deroga': deroga,
        }
        completar(medida)
        if 'Canarias' not in medida['territorios'] and re.search(r'\bCanari[ao]s?\b|\bIslas\b|\bArchipi[eé]lago\b|\bREF\b', clean_txt):
            medida['territorios'].append('Canarias')
        medidas.append(medida)

    # Finalize sections
    secciones_out = []
    for s in secciones:
        secciones_out.append({
            'id': s['id'],
            'bloque': s['bloque'],
            'titulo': s['titulo'],
            'tituloFrase': s['tituloFrase'],
            'intro': '\n\n'.join(s['intro_parts']),
            'pagina': s['pagina'],
            'subapartados': s['subapartados'],
        })

    # Extract quantified commitments
    cifras_specs = [
        ('9% del parque residencial', '9 %', 'del parque residencial', 'Parque de vivienda pública mínimo en línea con la UE'),
        ('hipoteca al 0 % hasta 100.000 euros', '100.000 €', 'al 0 %', 'Hipoteca al 0 % para primera vivienda sin límite de edad'),
        ('hasta los 1.800 €, por doce mensualidades', '1.800 €', 'en 12 pagas', 'Incremento progresivo del SMI hasta 1.800 euros'),
        ('jornada de 37,5 horas semanales y avanzar de forma decidida hacia la jornada laboral de 34 horas semanales', '34 horas', 'semanales', 'Jornada de 37,5 horas avanzando hacia las 34 horas semanales'),
        ('voto a los 16 años', '16 años', 'edad de voto', 'Ampliación del derecho de voto a los 16 años'),
        ('reducción del 75% en los precios de los billetes aéreos y marítimos', '75 %', 'de descuento', 'Bonificación del 75 % al transporte de residentes canarios'),
        ('bonificación del 100% al transporte marítimo y aéreo de mercancías', '100 %', 'de bonificación', 'Bonificación del 100 % al transporte de mercancías'),
        ('Dotación al menos de 30 millones de euros', '30 M€', 'al menos', 'Dotación mínima del programa contra la pobreza en Canarias'),
        ('deducción de la cuota íntegra de 300 euros para rentas inferiores a 20.000 euros', '300 €', 'deducción IRPF', 'Deducción temporal por inflación para rentas inferiores a 20.000 euros'),
        ('Ampliar hasta los 85.000 euros de facturación anual el umbral de exención del IGIC', '85.000 €', 'de facturación anual', 'Umbral de exención del IGIC para autónomos'),
        ('tarifa plana de 88 euros mensuales para los autónomos', '88 €/mes', 'tarifa plana', 'Tarifa plana para autónomos con menores rendimientos'),
        ('como mínimo del 0,7%, de los Presupuestos Generales del Estado', '0,7 %', 'de los PGE', 'Consignación mínima para cooperación internacional'),
    ]
    cifras_prog = []
    for contexto, valor, unidad, resumen in cifras_specs:
        found = next((m for m in medidas if contexto in m['texto']), None)
        if not found:
            raise ValueError(f'No se encontró la cifra {contexto!r} en ninguna medida de UPC')
        if contexto not in found['cifras']:
            found['cifras'].append(contexto)
        cifras_prog.append({
            'valor': valor,
            'unidad': unidad,
            'texto': resumen,
            'contexto': contexto,
            'medida': found['n'],
        })

    if len(bloques) != 5 or len(secciones_out) != 16:
        raise ValueError(f'Se esperaban 5 bloques y 16 ejes; hay {len(bloques)} y {len(secciones_out)}')

    return {
        'id': 'upc',
        'partido': 'Unidad del Pueblo Canario',
        'siglas': 'UPC',
        'comunidad': 'Canarias',
        'color': '#1F9995',
        'colorClaro': '#D7F3F2',
        'programa': 'Una sola papeleta. Todo un pueblo',
        'subtitulo': 'Programa electoral de Unidad del Pueblo Canario: 5 bloques y 16 ejes para las elecciones generales del 29N',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/upc-programa-electoral-29n-2026.pdf',
        'fuentePdf': FUENTE,
        'paginas': len(doc),
        'fechaPdf': '2026-11-16',
        'observaciones': [
            'Programa electoral completo publicado por Unidad del Pueblo Canario el 20 de noviembre de 2026 (metadatos del PDF: 16 de noviembre de 2026), que sustituye al manifiesto previo de 6 páginas y 16 ejes.',
            'Unidad del Pueblo Canario reúne a Nueva Canarias-Bloque Canarista, Podemos, Izquierda Unida Canaria, Movimiento Sumar y Partido Verde Canarias.',
        ],
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {
            'titulo': 'Una sola papeleta. Todo un pueblo',
            'texto': '\n\n'.join(intro_paras),
        },
        'cifras': cifras_prog,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones_out,
        'medidas': medidas,
    }


def main():
    args = sys.argv[1:]
    depurar_path = None
    if '--depurar' in args:
        idx = args.index('--depurar')
        depurar_path = args[idx + 1]
        del args[idx:idx + 2]
    programa = extraer(args[0])
    with open(args[1], 'w', encoding='utf-8') as out:
        json.dump(programa, out, ensure_ascii=False, indent=1)
        out.write('\n')
    if depurar_path:
        with open(depurar_path, 'w', encoding='utf-8') as out:
            for m in programa['medidas']:
                out.write(f"[{m['n']}] p.{m['pagina']} s.{m['seccion']} {m['categoria']} | {m['titulo']}\n  {m['texto']}\n\n")
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']), 'propuestas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
