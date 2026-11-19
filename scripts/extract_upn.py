"""Construye el JSON de los compromisos de UPN a partir del texto de su web (https://upn-pp.es/).

El programa es una sección de la web de la coalición UPN-PP, «01 COMPROMISOS» (lema «Por España, por Navarra, por
fin»). No tiene PDF ni fecha de publicación: la web solo da la de su última modificación (16 de noviembre de 2026).
Son 12 bloques con epígrafe y 36 viñetas; cada viñeta es una medida. Las viñetas no tienen título: el título corto es
editorial y el texto es el de la web, literal.

Los textos se escriben aquí porque la web los muestra en tarjetas y no hay un documento que leer. El script comprueba
que los totales son los esperados y que cada cifra, cada plazo y cada derogación están literales en su medida.

Uso: python scripts/extract_upn.py src/data/2026/generales/programas/upn.json
"""
import json
import sys
from clasificacion import completar

URL = 'https://upn-pp.es/'
FECHA_CONSULTA = '2026-11-19'
TOTAL_MEDIDAS = 36

# (título del bloque, [(título corto, texto literal, categoría)]). Los territorios los fija el script: Navarra.
BLOQUES = [
    ('España necesita un cambio', [
        ('Respeto a la Constitución y a las instituciones', 'Recuperar el respeto a la Constitución y a las instituciones.', 'democracia'),
        ('Separación de poderes', 'Garantizar la separación de poderes.', 'democracia'),
        ('Más papel para las Cortes Generales', 'Reforzar el papel de las Cortes Generales.', 'democracia'),
        ('Tolerancia cero con la corrupción', 'Tolerancia cero con la corrupción.', 'justicia'),
    ]),
    ('Navarra decide su futuro', [
        ('Navarra, Comunidad Foral', 'Navarra es y va a seguir siendo una Comunidad Foral.', 'territorio'),
        ('Defensa del Fuero y del Convenio Económico', 'Defensa del Fuero y del Convenio Económico.', 'territorio'),
        ('Suprimir la Transitoria Cuarta', 'Supresión de la Transitoria Cuarta, que abre la puerta a anexionar Navarra con el País Vasco.', 'territorio'),
    ]),
    ('Navarra nunca será moneda de cambio', [
        ('Solo acuerdos dignos', 'Solo aceptamos acuerdos dignos, con quien respeta la democracia y las instituciones.', 'democracia'),
        ('Memoria, dignidad, justicia y verdad para las víctimas', 'Memoria, dignidad, justicia y verdad para las víctimas del terrorismo.', 'identidad'),
    ]),
    ('Menos espera y mejor atención', [
        ('Una sanidad pública de referencia', 'Una sanidad pública que vuelva a ser referente.', 'sanidad'),
        ('Menos listas de espera', 'Menos listas de espera para diagnosticar antes y tratar mejor.', 'sanidad'),
        ('Más prevención', 'Más prevención y mejores resultados.', 'sanidad'),
        ('Más plazas MIR', 'Más plazas MIR.', 'sanidad'),
        ('Plazos más cortos en dependencia', 'En dependencia, plazos más cortos.', 'social'),
        ('Ayudas sin duplicidades ni abusos', 'Ayudas sin duplicidades ni abusos.', 'social'),
    ]),
    ('Formar para un futuro mejor', [
        ('Educación de calidad y rendimiento escolar', 'Educación de calidad orientada a la mejora del rendimiento escolar.', 'educacion'),
        ('FP dual y becas garantizadas', 'FP dual conectada con las empresas y un sistema de becas garantizado para quien las necesite.', 'educacion'),
    ]),
    ('Vivir con tranquilidad', [
        ('Más medios y coordinación entre policías', 'Más medios y mejor coordinación entre todas las policías.', 'seguridad'),
        ('Calles seguras en cada barrio y pueblo', 'Calles seguras en cada barrio y pueblo.', 'seguridad'),
    ]),
    ('Que tu dinero llegue más lejos', [
        ('Alivio fiscal', 'Un alivio fiscal que genere más actividad, que ayude a las personas a tener más poder adquisitivo y a las empresas a ser más competitivas.', 'fiscalidad'),
        ('Impuestos sin inflación y pensiones que mantengan el poder adquisitivo', 'Que la inflación no te suba los impuestos. Pensiones que mantengan tu poder adquisitivo.', 'fiscalidad'),
    ]),
    ('Las inversiones que Navarra necesita', [
        ('Calendario y financiación de las grandes obras', 'Calendario y financiación para la segunda fase del Canal de Navarra, el recrecimiento de Yesa, el tren de alta velocidad y la autovía A-15.', 'infraestructuras'),
        ('Red eléctrica para la industria', 'Red eléctrica para la industria.', 'energia'),
        ('Mejores conexiones aéreas', 'Mejores conexiones aéreas.', 'infraestructuras'),
        ('Internet y cobertura en todos los pueblos', 'Internet y cobertura en todos los pueblos.', 'infraestructuras'),
    ]),
    ('Una vivienda que puedas pagar', [
        ('Más oferta para bajar los precios', 'Más oferta para bajar los precios.', 'vivienda'),
        ('Suelo público para vivienda asequible', 'Suelo público para vivienda asequible.', 'vivienda'),
        ('Desbloquear las 20.000 viviendas protegidas', 'Menos trámites para desbloquear las 20.000 viviendas protegidas que esperan en Navarra.', 'vivienda'),
        ('Okupas fuera en 48 horas', 'Okupas fuera en 48 horas.', 'vivienda'),
    ]),
    ('Más oportunidades y mejores empleos', [
        ('Refuerzo del tejido empresarial y la industria', 'Refuerzo del tejido empresarial, la industria y los servicios, con un ecosistema innovador.', 'innovacion'),
        ('Salarios dignos y concertación social', 'Salarios dignos y respeto a la concertación social.', 'empleo'),
        ('Contratación en origen y títulos homologados en 6 meses', 'Contratación en origen y títulos homologados en 6 meses.', 'empleo'),
        ('Ayudas a los autónomos', 'Autónomos: cuota cero los dos primeros años, sin IVA hasta 85.000€ de facturación y mayor cobertura social.', 'empleo'),
    ]),
    ('Llegar con orden, trabajar con futuro', [
        ('Inmigración legal y ordenada', 'Inmigración legal, ordenada, con derechos y obligaciones.', 'inmigracion'),
    ]),
    ('Pueblos con vida', [
        ('Una PAC para agricultores y ganaderos profesionales', 'Una PAC para agricultores y ganaderos profesionales, con relevo generacional.', 'rural'),
        ('Servicios y actividad económica en los pueblos', 'Servicios y actividad económica en todos nuestros pueblos.', 'rural'),
    ]),
]

# Compromisos con una cifra: (número de medida, valor, unidad, contexto literal). El texto de la cifra es el de la medida.
CIFRAS = [
    ('Desbloquear las 20.000 viviendas protegidas', '20.000', 'viviendas protegidas', '20.000 viviendas protegidas'),
    ('Okupas fuera en 48 horas', '48 h', 'plazo de desalojo', '48 horas'),
    ('Contratación en origen y títulos homologados en 6 meses', '6 meses', 'homologación de títulos', '6 meses'),
    ('Ayudas a los autónomos', '2 años', 'cuota cero', 'cuota cero los dos primeros años'),
    ('Ayudas a los autónomos', '85.000 €', 'facturación sin IVA', 'sin IVA hasta 85.000€ de facturación'),
]


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Uso: python scripts/extract_upn.py src/data/2026/generales/programas/upn.json')
    ruta = sys.argv[1]
    with open(ruta, encoding='utf-8') as entrada:
        previo = json.load(entrada)

    bloques, secciones, medidas, por_titulo = [], [], [], {}
    for indice, (titulo_bloque, items) in enumerate(BLOQUES, start=1):
        bloques.append({'id': indice, 'titulo': titulo_bloque, 'lema': '', 'cita': '', 'intro': ''})
        secciones.append({'id': f'{indice}.1', 'bloque': indice, 'titulo': titulo_bloque,
                          'tituloFrase': titulo_bloque, 'intro': '', 'subapartados': []})
        for titulo, texto, categoria in items:
            numero = len(medidas) + 1
            por_titulo[titulo] = numero
            medidas.append({
                'n': numero, 'bloque': indice, 'seccion': f'{indice}.1', 'subapartado': None,
                'titulo': titulo, 'tituloFrase': titulo, 'texto': texto, 'oculta': False,
                'categoria': categoria, 'colectivos': [], 'palancas': [], 'territorios': [],
                'cifras': [], 'plazo': None, 'deroga': None, 'fuente': URL,
            })
    if len(medidas) != TOTAL_MEDIDAS:
        raise SystemExit(f'Se esperaban {TOTAL_MEDIDAS} medidas; hay {len(medidas)}')

    for medida in medidas:
        completar(medida, territorios=False)
        if 'Navarra' in medida['texto']:
            medida['territorios'] = ['Navarra']

    cifras = []
    for titulo, valor, unidad, contexto in CIFRAS:
        n = por_titulo[titulo]
        medida = medidas[n - 1]
        if contexto not in medida['texto']:
            raise SystemExit(f'La cifra «{contexto}» no está en la medida {n}')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': medida['texto'], 'contexto': contexto, 'medida': n})
        if medida['texto'] not in medida['cifras']:
            medida['cifras'].append(medida['texto'])

    programa = {
        'id': 'upn',
        'partido': previo['partido'],
        'siglas': previo['siglas'],
        'comunidad': previo.get('comunidad', 'Navarra'),
        'color': previo['color'],
        'colorClaro': previo['colorClaro'],
        'programa': 'Por España, por Navarra, por fin',
        'subtitulo': '36 compromisos en 12 bloques: España, el Fuero, sanidad, vivienda, inversiones y empleo',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'Los compromisos se publican en la web de la coalición UPN-PP (upn-pp.es), en la sección «01 Compromisos», con el lema «Por España, por Navarra, por fin». No hay PDF ni programa extenso: la web solo da la fecha de su última modificación (16 de noviembre de 2026).',
            'Cada viñeta de los 12 bloques es una medida (36). Las viñetas no tienen título: el título corto es editorial y el texto es el de la web, literal. Los nombres de los bloques son los epígrafes de la web.',
            'No hay plazos de aplicación (el «48 horas» de los okupas o los «6 meses» de los títulos son cifras de la medida, no fechas) ni derogaciones explícitas: la «supresión de la Transitoria Cuarta» es la de una disposición de la Ley Orgánica de Reintegración y Amejoramiento del Régimen Foral, no una ley que se derogue.',
        ],
        'tipoDocumento': 'web',
        'origenMedidas': 'web',
        'pdf': URL,
        'fuentePdf': URL,
        'fechaFuente': FECHA_CONSULTA,
        'unidadMedida': 'compromiso',
        'unidadMedidas': 'compromisos',
        'presentacion': {
            'titulo': 'Por España, por Navarra, por fin',
            'texto': 'UPN y PP unen fuerzas para las elecciones generales del 29N. Los compromisos se agrupan en doce bloques, de «España necesita un cambio» a «Pueblos con vida».',
        },
        'cifras': cifras,
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }
    with open(ruta, 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(medidas)} medidas, {len(bloques)} bloques, {len(cifras)} cifras')


if __name__ == '__main__':
    main()
