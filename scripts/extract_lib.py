"""Build src/data/2026/generales/programas/lib.json for Liberación Canaria from its six PDF documents.

Liberación Canaria does not publish one electoral program with numbered measures. It publishes six documents
(liberacioncanaria.org), five short essays (RUP→PTU, residence, PAI statute, ports and airports, Canarian tax
agency) and the «Política Nacional Canaria de Vivienda» (292 pages). Every document has the same page header
(title, web address, page number); the housing document also has a footer on each printed page.

A measure is a proposal that the text states: the passage between a start line and an end line (regular
expressions in MEDIDAS). The text is literal; only the short title is editorial. The housing document gives the
11 «Ejes» of chapter 19 and the 4 horizons of chapter 20 («Plan de aplicación»), plus the monitoring indicators
of chapter 21. The page numbers are the pages of each PDF.

Usage: python scripts/extract_lib.py public/2026/generales/programas src/data/2026/generales/programas/lib.json
       python scripts/extract_lib.py public/2026/generales/programas src/data/2026/generales/programas/lib.json --depurar volcado.txt
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import fitz

from clasificacion import completar

WEB = 'https://www.liberacioncanaria.org'

# clave del documento: (archivo, título del bloque, páginas)
DOCUMENTOS = {
    'rup-ptu': ('lib-rup-a-ptu-2026.pdf', 'De RUP a PTU', 33, 'De RUP a PTU: cambiar la relación con la Unión Europea'),
    'residencia': ('lib-regulacion-residencia-2026.pdf', 'Regulación de la residencia', 11,
                   'Regulación de la residencia en Canarias y acceso al mercado laboral'),
    'pai': ('lib-estatuto-pai-2026.pdf', 'Estatuto de Plena Autonomía Interna (PAI)', 17,
            'Estatuto de Plena Autonomía Interna (PAI)'),
    'puertos': ('lib-puertos-aeropuertos-2026.pdf', 'Control de puertos y aeropuertos', 7,
                'Control por el Gobierno de Canarias de todos los puertos y aeropuertos'),
    'hacienda': ('lib-hacienda-canaria-2026.pdf', 'Hacienda canaria tributaria independiente', 11,
                 'Hacienda canaria tributaria independiente'),
    'vivienda': ('lib-vivienda-2026.pdf', 'Política Nacional Canaria de Vivienda', 292,
                 'Política Nacional Canaria de Vivienda'),
}

# Líneas que no son texto: pie de página del documento de vivienda.
RUIDO = re.compile(
    r'^(POLÍTICA NACIONAL CANARIA DE VIVIENDA\s+·\s+PÁGINA \d+|EDICIÓN GENERAL\s*\||'
    r'LIBERACIÓN CANARIA\s*\|\s*POLÍTICA NACIONAL CANARIA DE VIVIENDA|Edición de ampliación documental|'
    r'Documento marco integrado|INFORME\s*/\s*VIVIENDA|Documento de análisis y propuesta política|'
    r'Canarias\s*·\s*Vivienda\s*\||LIBERACIÓN CANARIA$|POLÍTICA NACIONAL CANARIA DE VIVIENDA$)')
VINETAS = set('●••●▪')

# (documento, sección, título, categoría, inicio, fin, página de partida o None, quitar la línea de inicio)
# `inicio` y `fin` son expresiones regulares sobre una línea (sin espacios al principio ni al final).
M = []


def medida(doc, seccion, titulo, categoria, inicio, fin, desde=1, titulo_de_linea=False, **extra):
    # extra: prefijo (regex que se quita del texto), reemplazos (lista de (regex, sustituto)), numerada
    M.append(dict(doc=doc, seccion=seccion, titulo=titulo, categoria=categoria, inicio=inicio, fin=fin,
                  desde=desde, quitar_inicio=titulo_de_linea, **extra))


# 1. De RUP a PTU
medida('rup-ptu', 'rup-ptu', 'El Parlamento de Canarias debe provocar el cambio legal; si no, alternativas más contundentes', 'exterior',
       r'^Corresponde al pueblo canario', r'^Los demás países europeos no tienen', desde=19)
medida('rup-ptu', 'rup-ptu', 'Cambiar la relación con la UE y volver a los Puertos Francos', 'exterior',
       r'^El marco jurídico de las RUP', r'^De alguna forma, los PTU', desde=30)
medida('rup-ptu', 'rup-ptu', 'Salir de las RUP y pasar a estatus PTU o abandonar la UE', 'exterior',
       r'^En Liberación Canaria lo tenemos claro', r'^La concreción de lo que pretendemos', desde=31)
medida('rup-ptu', 'rup-ptu', 'Más libertad de importación sin perder la exportación preferencial a la UE', 'exterior',
       r'^1º\)\s+Sin perder', r'^2º\)\s+Negociar', desde=31)
medida('rup-ptu', 'rup-ptu', 'Regular el establecimiento de personas para evitar la superpoblación', 'inmigracion',
       r'^2º\)\s+Negociar', r'^3º\)\s+Igualmente', desde=31)
medida('rup-ptu', 'rup-ptu', 'Regular el acceso al mercado laboral según las necesidades de los canarios', 'empleo',
       r'^3º\)\s+Igualmente', r'^De resto, seguir', desde=31)
medida('rup-ptu', 'rup-ptu', 'Mantener la ciudadanía europea y los espacios culturales, de juventud y educativos', 'exterior',
       r'^De resto, seguir', r'^Autor citado', desde=31)

# 2. Regulación de la residencia
medida('residencia', 'residencia', 'Control de extranjería desde Canarias', 'inmigracion',
       r'^Como elemento más sencillo', r'^La cuestión del tratamiento de la residencia', desde=6)
medida('residencia', 'residencia', 'Pasar a PTU, o «canarexit», para regular la residencia de ciudadanos de la UE', 'inmigracion',
       r'^Para ello se nos abren dos posibilidades', r'^Como expresa el artículo 355', desde=7)
medida('residencia', 'residencia', 'En el PTU, controlar la residencia y el acceso al mercado laboral sin perder la ciudadanía europea',
       'inmigracion', r'^En definitiva, en el PTU', r'^En 2022', desde=9)
medida('residencia', 'residencia', 'Principio de Preferencia Natural: los canarios en Canarias', 'identidad',
       r'^Los riojanos deben tener preferencia', r'^Expresamos un ejemplo curioso', desde=10)
medida('residencia', 'residencia', 'Condición de canario por tres generaciones, como en Rapa Nui', 'inmigracion',
       r'^Expresamos un ejemplo curioso', r'^Esperemos, señores', desde=10)

# 3. Estatuto de Plena Autonomía Interna
medida('pai', 'pai', 'Controlar el mar archipiélago, la ZEE y los fondos marinos', 'territorio',
       r'^Objetivo:', r'^2\. Nuestro mar en el estatuto', desde=1,
       reemplazos=[(r'(?<=plataforma continental-) (?=Una parte importante)', '\n\n')])
medida('pai', 'pai', 'Desarrollar las competencias del Estatuto con proyección en el mar', 'territorio',
       r'^Esas competencias estatutarias', r'^En lo que aquí importa', desde=2)
medida('pai', 'pai', 'Exigir al Estado, por el artículo 150.2, las facultades para explotar el mar', 'territorio',
       r'^Entre las materias que Canarias debe exigir', r'^3\. Convención del derecho del mar', desde=4)
medida('pai', 'pai', 'Reconocer la libertad de modificar la posición política de Canarias', 'territorio',
       r'^3\. La cuestión sobre Libertad de modificación', r'^De resto de factores', desde=15, prefijo=r'^3\. ')
medida('pai', 'pai', 'Canarias ya está en situación jurídica de PAI', 'territorio',
       r'^En consecuencia, con la salvedad', r'^Hay que reparar en que la CE', desde=16)
medida('pai', 'pai', 'Acceder a las riquezas del mar sin ser Estado, con las transferencias necesarias', 'territorio',
       r'^Llegados aquí conviene recapitular', None, desde=17)

# 4. Puertos y aeropuertos
medida('puertos', 'puertos', 'Asumir el control de los puertos y aeropuertos de interés general', 'infraestructuras',
       r'^Como otro complemento', r'^Nuestra ubicación en el planeta', desde=1)
medida('puertos', 'puertos', 'Pedir el control por la vía del artículo 150.2 de la Constitución', 'territorio',
       r'^La pretensión política', r'^En el asunto aeroportuario', desde=5)
medida('puertos', 'puertos', 'Quinta libertad del aire y centro operativo (HUB) tricontinental', 'infraestructuras',
       r'^Sobre la cuestión de la navegación aérea', r'^Fuente:', desde=6)

# 5. Hacienda canaria tributaria independiente
medida('hacienda', 'hacienda', 'Un «Cupo Canario» por los servicios que el Estado mantiene', 'fiscalidad',
       r'^3\.3\. Simulación', r'^4\. Ventajas Estratégicas', desde=5, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Blindar el REF con una agencia propia que aplique sus incentivos', 'fiscalidad',
       r'^4\.1\. Blindaje', r'^4\.2\. Eficiencia', desde=6, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Ventanilla única fiscal y compensación de deudas y créditos', 'administracion',
       r'^4\.2\. Eficiencia', r'^4\.3\. Inteligencia', desde=7, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Cruzar todos los datos fiscales para combatir el fraude', 'fiscalidad',
       r'^4\.3\. Inteligencia', r'^4\.4\. Capacidad', desde=7, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Capacidad normativa sobre el IRPF y el Impuesto sobre Sociedades', 'fiscalidad',
       r'^4\.4\. Capacidad', r'^5\. Marco Jurídico', desde=8, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Empezar por el consorcio y delegar el IRPF y Sociedades en la agencia canaria', 'administracion',
       r'^5\.2\. El Estatuto', r'^5\.3\. El Art', desde=9, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Incluir en el cupo una aportación al Fondo de Compensación Interterritorial', 'fiscalidad',
       r'^5\.3\. El Art', r'^6\. Desaf', desde=9, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Fondo de Estabilización Fiscal con el excedente turístico', 'fiscalidad',
       r'^6\.1\. El Riesgo', r'^6\.2\. Capacidad', desde=10, titulo_de_linea=True)
medida('hacienda', 'hacienda', 'Traspasar los sistemas informáticos y el personal de la AEAT', 'administracion',
       r'^6\.2\. Capacidad', r'^7\. Conclusi', desde=10, titulo_de_linea=True)

medida('hacienda', 'hacienda', 'Agencia Tributaria Canaria independiente e integral', 'fiscalidad',
       r'^El análisis detallado de los factores', r'^Resumen de Beneficios Estratégicos', desde=10)

# 6. Política Nacional Canaria de Vivienda: capítulo 19 («Propuesta política»)
EJES = [
    ('Declaración inmediata de zonas tensionadas', 'vivienda'),
    ('Misión Canaria de Vivienda Pública', 'vivienda'),
    ('Construir dentro de la ciudad existente', 'vivienda'),
    ('Protección de la juventud canaria', 'vivienda'),
    ('Regulación del uso turístico', 'vivienda'),
    ('Mercado libre con responsabilidad', 'vivienda'),
    ('Fiscalidad residencial', 'fiscalidad'),
    ('Sistema Canario de Capacidad Territorial y Residencial', 'territorio'),
    ('Nuevo pacto de autogobierno real con España', 'territorio'),
    ('Asociación especial con la Unión Europea', 'exterior'),
    ('Adaptación climática, rehabilitación energética y confort de la vivienda', 'energia'),
]
for i, (titulo, categoria) in enumerate(EJES, start=1):
    fin = rf'^Eje {i + 1}\. ' if i < len(EJES) else r'^20\. PLAN DE APLICACIÓN'
    medida('vivienda', 'ejes', titulo, categoria, rf'^Eje {i}\. ', fin, desde=104, titulo_de_linea=True)

# capítulo 20 («Plan de aplicación») y capítulo 21 («Indicadores de seguimiento»)
medida('vivienda', 'plan', 'Plan de los primeros cien días', 'vivienda', r'^Primeros cien días', r'^Primeros dos años', desde=109,
       titulo_de_linea=True, numerada=True,
       reemplazos=[(r'(?<=constitucional\.) (?=Auditoría climática)', '\n\n')])
medida('vivienda', 'plan', 'Plan de los dos primeros años', 'vivienda', r'^Primeros dos años', r'^Entre tres y ocho años', desde=110,
       titulo_de_linea=True,
       reemplazos=[(r'(?<=asociación especial\.) (?=Aprobación y aplicación del Estándar)', '\n\n')])
medida('vivienda', 'plan', 'Plan de tres a ocho años', 'vivienda', r'^Entre tres y ocho años', r'^Entre ocho y quince años',
       desde=112, titulo_de_linea=True,
       reemplazos=[(r'(?<=recursos públicos\.) (?=Rehabilitación climática)', '\n\n')])
medida('vivienda', 'plan', 'Plan de ocho a quince años', 'vivienda', r'^Entre ocho y quince años',
       r'^21\. INDICADORES DE SEGUIMIENTO', desde=113, titulo_de_linea=True)
medida('vivienda', 'plan', 'Indicadores públicos de seguimiento', 'vivienda', r'^21\. INDICADORES DE SEGUIMIENTO',
       r'^21\.1\. CUADRO INTEGRAL', desde=115, titulo_de_linea=True)

# Informes sectoriales de la edición ampliada (pasajes que el texto presenta como propuesta)
PARQUE = 'Parque público o asequible permanente: al menos el 10 % (20 % en municipios tensionados)'
HOJA = 'Hoja de ruta de 0 a 36 meses contra la cronificación de la zona tensionada'
medida('vivienda', 'informes', PARQUE, 'vivienda', r'^Defendemos una misión de quince años', r'^Vía de incorporación',
       desde=173, reemplazos=[(r' \[A\]', '')])
medida('vivienda', 'informes', 'Las diez líneas de la política integral de vivienda del informe sectorial', 'vivienda',
       r'^Desde Liberación Canaria proponemos una estrategia', r'^La negociación de un marco de asociación especial',
       desde=192)
medida('vivienda', 'informes', HOJA, 'vivienda', r'^Proponemos que, antes del inicio de la declaración',
       r'^Indicadores mínimos', desde=194)

# Plazos: horizonte de cada medida (solo cuándo se aplica) y su texto corto.
PLAZOS = {
    ('vivienda', 'Declaración inmediata de zonas tensionadas'): ('Inmediata', 'Declaración de zonas tensionadas'),
    ('vivienda', 'Misión Canaria de Vivienda Pública'): ('15 años', 'Programa de quince años para alcanzar un parque público y asequible suficiente'),
    ('vivienda', 'Plan de los primeros cien días'): ('100 días', 'Auditoría, mapas, inventarios de suelo y primeras unidades y comisiones'),
    ('vivienda', 'Plan de los dos primeros años'): ('2 años', 'Nueva Ley Canaria de Vivienda y Soberanía Residencial, Ley de Arraigo y primeras zonas tensionadas'),
    ('vivienda', 'Plan de tres a ocho años'): ('3 a 8 años', 'Aumento del parque público, reforma fiscal del REF y negociación con la UE'),
    ('vivienda', 'Plan de ocho a quince años'): ('8 a 15 años', 'Parque público consolidado y entrada en vigor del nuevo marco bilateral y del estatuto PTU'),
    ('vivienda', PARQUE): ('15 años', 'Misión de quince años para el parque público o asequible permanente'),
    ('vivienda', HOJA): ('0 a 36 meses', 'Horizontes de 0–6, 6–18 y 18–36 meses desde la declaración'),
}
ORDEN_PLAZOS = ['Inmediata', '100 días', '0 a 36 meses', '2 años', '3 a 8 años', '8 a 15 años', '15 años']

# Cifras: compromisos con un número (frase literal que contiene el contexto).
CIFRAS = {
    ('vivienda', 'Declaración inmediata de zonas tensionadas'): [
        ('5', 'viviendas', 'Umbral de gran tenedor', 'reducir a cinco viviendas el umbral de gran tenedor')],
    ('vivienda', 'Misión Canaria de Vivienda Pública'): [
        ('25', 'años de arraigo', 'Arraigo con máxima valoración en la vivienda protegida', 'máxima valoración a partir de veinticinco años')],
    ('vivienda', PARQUE): [
        ('10', '% del parque', 'Parque público o asequible permanente en Canarias', 'permanente de al menos el 10 % en Canarias'),
        ('20', '% en municipios tensionados', 'Aproximación en los municipios tensionados',
         'una aproximación al 20 % en los municipios tensionados')],
}

PRESENTACION = {
    'titulo': 'Política Nacional Canaria de Vivienda: resumen ejecutivo',
    'texto': ('La vivienda constituye una cuestión estratégica de país. La finalidad de esta edición es garantizar la '
              'coherencia entre la política nacional de vivienda y el instrumento estatal de las zonas de mercado '
              'residencial tensionado (ZMRT), sin eliminar ninguna de las líneas de análisis del documento original.'),
}


def normalizar(texto):
    texto = unicodedata.normalize('NFC', texto.replace(' ', ' '))
    texto = re.sub(r'[ \t]+', ' ', texto).strip()
    return re.sub(r'\s+([,.;:!?)»])', r'\1', texto)


def leer_documento(carpeta, clave):
    """Lista de (página, línea) del cuerpo: sin la cabecera de cada página, sin pies y sin líneas vacías."""
    pdf = fitz.open(str(Path(carpeta) / DOCUMENTOS[clave][0]))
    if len(pdf) != DOCUMENTOS[clave][2]:
        raise SystemExit(f'{clave}: se esperaban {DOCUMENTOS[clave][2]} páginas y el PDF tiene {len(pdf)}')
    lineas = []
    for indice, pagina in enumerate(pdf, start=1):
        brutas = pagina.get_text().splitlines()
        corte = next((k for k, l in enumerate(brutas[:9]) if l.strip() == str(indice)), None)
        if corte is None:
            raise SystemExit(f'{clave}: no encuentro el número de página {indice} en la cabecera')
        for linea in brutas[corte + 1:]:
            if linea.strip() and not RUIDO.match(linea.strip()):
                lineas.append((indice, normalizar(linea)))
    return lineas


def anchura(lineas):
    largos = sorted(len(l) for _, l in lineas if len(l) > 30)
    return largos[int(len(largos) * 0.9)] if largos else 90


def parrafos(lineas, ancho, numerada=False):
    """Une las líneas en párrafos. Una viñeta empieza «– »; un punto final en una línea corta cierra el párrafo."""
    resultado, actual, viñeta = [], '', False
    previa = ''
    for linea in lineas:
        if len(linea) == 1 and linea in VINETAS:
            viñeta = True
            continue
        empieza = viñeta or re.match(r'^\d+\. (?=[A-ZÁÉÍÓÚ])', linea)
        corta = previa.endswith(('.', ';', ':', '?', '!', '»')) and len(previa) < ancho * 0.82
        if actual and (empieza or corta):
            resultado.append(actual)
            actual = ''
        if viñeta and not actual:
            linea = '– ' + linea
        actual = f'{actual} {linea}'.strip() if actual else linea
        viñeta = False
        previa = linea
    if actual:
        resultado.append(actual)
    texto = '\n\n'.join(resultado)
    if numerada:
        texto = re.sub(r'(?<=[.;)]) (?=\d{1,2}\. [A-ZÁÉÍÓÚ])', '\n\n', texto)
    return texto


def extraer(carpeta):
    cache, anchos = {}, {}
    medidas = []
    for item in M:
        clave = item['doc']
        if clave not in cache:
            cache[clave] = leer_documento(carpeta, clave)
            anchos[clave] = anchura(cache[clave])
        lineas = cache[clave]
        inicio = next((k for k, (p, l) in enumerate(lineas) if p >= item['desde'] and re.search(item['inicio'], l)), None)
        if inicio is None:
            raise SystemExit(f'{clave}: no encuentro el inicio «{item["inicio"]}» de «{item["titulo"]}»')
        if item['fin'] is None:
            fin = len(lineas)
        else:
            fin = next((k for k in range(inicio + 1, len(lineas)) if re.search(item['fin'], lineas[k][1])), None)
            if fin is None:
                raise SystemExit(f'{clave}: no encuentro el fin «{item["fin"]}» de «{item["titulo"]}»')
            if lineas[fin][0] - lineas[inicio][0] > 3:
                raise SystemExit(f'{clave}: el fin de «{item["titulo"]}» está a más de tres páginas del inicio')
        cuerpo = [l for _, l in lineas[inicio + (1 if item['quitar_inicio'] else 0):fin]]
        texto = parrafos(cuerpo, anchos[clave], item.get('numerada', False))
        if not texto.strip():
            raise SystemExit(f'{clave}: «{item["titulo"]}» no tiene texto')
        if item.get('prefijo'):
            texto = re.sub(item['prefijo'], '', texto)
        for patron, sustituto in item.get('reemplazos', []):
            texto = re.sub(patron, sustituto, texto)
        # Llamada de nota al pie pegada al final de un párrafo («know-how.24»).
        texto = re.sub(r'(?<=[a-záéíóúñ]\.)\d{1,2}(?=\n|$)', '', texto)
        medidas.append(dict(item, pagina=lineas[inicio][0], texto=texto))
    return medidas


def limpiar_colectivos(m):
    """Quita falsos positivos de las palabras clave: «Comunidad Autónoma», «mayores competencias», «inversión extranjera»."""
    texto = f"{m['titulo']} {m['texto']}"
    exigen = {
        'autonomos': r'(?<!no )\baut[oó]nomos\b|\bpymes?\b|\bemprendedor',
        'mayores': r'personas mayores|pensionistas|jubilad|mayores de',
        'pacientes': r'pacientes|listas? de espera',
        'inmigrantes': r'inmigra|extranjer[ií]a|extranjeros|refugiad|\basilo\b',
    }
    m['colectivos'] = [c for c in m['colectivos'] if c not in exigen or re.search(exigen[c], texto, re.I)]


def frase_con(texto, contexto):
    for frase in re.split(r'(?<=[.!?])\s+|\n\n', texto):
        if contexto in frase:
            return frase.strip()
    raise SystemExit(f'La cifra «{contexto}» no está en el texto de la medida')


def depurar(medidas, ruta):
    with open(ruta, 'w', encoding='utf-8') as salida:
        for n, m in enumerate(medidas, start=1):
            salida.write(f'### {n} · {m["doc"]} · p. {m["pagina"]} · {m["categoria"]} · {m["titulo"]}\n{m["texto"]}\n\n')


def main():
    argv = sys.argv[1:]
    if '--depurar' in argv:
        del argv[argv.index('--depurar'):argv.index('--depurar') + 2]
    args = argv
    if len(args) != 2:
        raise SystemExit(__doc__)
    carpeta, ruta = args
    extraidas = extraer(carpeta)
    if '--depurar' in sys.argv:
        depurar(extraidas, sys.argv[sys.argv.index('--depurar') + 1])
    with open(ruta, encoding='utf-8') as entrada:
        previo = json.load(entrada)

    claves = list(DOCUMENTOS)
    bloques, secciones, medidas, cifras, plazos = [], [], [], [], []
    for indice, clave in enumerate(claves, start=1):
        archivo, _, paginas, titulo = DOCUMENTOS[clave]
        primera = next(m for m in extraidas if m['doc'] == clave)
        bloques.append({'id': indice, 'titulo': titulo, 'lema': '', 'cita': '', 'intro': '', 'pagina': 1})
        if clave == 'vivienda':
            for sid, stitulo in (('ejes', 'Los once ejes de la propuesta política'), ('plan', 'Plan de aplicación e indicadores'),
                           ('informes', 'Informes sectoriales: parque público, líneas de actuación y hoja de ruta')):
                secciones.append({'id': sid, 'bloque': indice, 'titulo': stitulo, 'tituloFrase': stitulo, 'intro': '',
                                  'pagina': next(m['pagina'] for m in extraidas if m['seccion'] == sid), 'subapartados': []})
        else:
            secciones.append({'id': clave, 'bloque': indice, 'titulo': titulo, 'tituloFrase': titulo, 'intro': '',
                              'pagina': 1, 'subapartados': []})

    for m in extraidas:
        numero = len(medidas) + 1
        clave_plazo = (m['doc'], m['titulo'])
        cifras_medida = []
        for valor, unidad, texto, contexto in CIFRAS.get(clave_plazo, []):
            frase = frase_con(m['texto'], contexto)
            cifras_medida.append(frase)
            cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': contexto, 'medida': numero})
        plazo = PLAZOS.get(clave_plazo)
        if plazo:
            plazos.append({'plazo': plazo[0], 'texto': plazo[1], 'medida': numero})
        archivo = DOCUMENTOS[m['doc']][0]
        medidas.append({
            'n': numero,
            'bloque': claves.index(m['doc']) + 1,
            'seccion': m['seccion'],
            'pagina': m['pagina'],
            'subapartado': None,
            'titulo': m['titulo'],
            'tituloFrase': m['titulo'],
            'texto': m['texto'],
            'oculta': False,
            'categoria': m['categoria'],
            'colectivos': [],
            'palancas': [],
            'territorios': [],
            'cifras': cifras_medida,
            'plazo': plazo[0] if plazo else None,
            'deroga': None,
            'fuente': f'/programas/{archivo}',
        })
    for m in medidas:
        completar(m)
        limpiar_colectivos(m)
        if m['deroga'] is None and re.search(r'\bderog', m['texto'], re.I):
            print(f'Aviso: la medida {m["n"]} nombra una derogación; revísala a mano.')

    plazos.sort(key=lambda p: ORDEN_PLAZOS.index(p['plazo']))
    total = sum(DOCUMENTOS[c][2] for c in claves)
    documentos = [{'titulo': DOCUMENTOS[c][3], 'pdf': f'/programas/{DOCUMENTOS[c][0]}',
                   'nombreDescarga': 'programa-' + DOCUMENTOS[c][0], 'paginas': DOCUMENTOS[c][2]} for c in claves]
    programa = {
        'id': 'lib',
        'partido': previo['partido'],
        'siglas': previo['siglas'],
        'comunidad': previo.get('comunidad', 'Canarias'),
        'observaciones': [
            'Liberación Canaria no publica un programa electoral único con medidas numeradas. Publica seis documentos en su web: cinco estudios breves (De RUP a PTU, Regulación de la residencia, Estatuto de Plena Autonomía Interna, Control de puertos y aeropuertos, Hacienda canaria tributaria independiente) y la «Política Nacional Canaria de Vivienda» (292 páginas).',
            'Cada medida es una propuesta que el texto formula, con su texto literal. Los estudios son ensayos: sus propuestas están dentro de la argumentación, y el título corto de cada una es editorial. Del documento de vivienda se toman los once ejes del capítulo 19, los cuatro horizontes del plan de aplicación (capítulo 20), los indicadores de seguimiento (capítulo 21) y tres pasajes de los informes que el texto presenta como propuesta: la misión del 10 % de parque público, las diez líneas de la política integral y la hoja de ruta de 0 a 36 meses.',
            'Los cinco estudios llevan fecha de creación del 6 de enero de 2026, y los de puertos y de residencia citan como fuente el «Ensayo sobre la descolonización de un canario» (edición de 2021). El documento de vivienda es la edición ampliada del 18 de noviembre de 2026 y avisa de que sus propuestas son «para revisión institucional»: no los presenta como reformas aprobadas del programa. Ninguno de los seis menciona las elecciones del 29 de noviembre.',
            'Los plazos son los que el texto da a cada propuesta. El eje 1 dice «inmediata», pero el plan de aplicación sitúa las primeras zonas tensionadas en los dos primeros años; a los cien días solo hay identificación de ámbitos. Los horizontes de la hoja de ruta de 0 a 36 meses son «propuestos» y, según el propio documento, no son plazos legales.',
            'El documento de vivienda reproduce además análisis, datos y anexos (zonas tensionadas, alquiler justo, suelo e inversión) que no son medidas y no se cuentan.',
        ],
        'color': previo['color'],
        'colorClaro': previo['colorClaro'],
        'programa': 'Seis documentos programáticos',
        'subtitulo': 'Vivienda, residencia, relación con la UE, autogobierno y hacienda propia para Canarias',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'pdf': '/programas/' + DOCUMENTOS[claves[0]][0],
        'fuentePdf': WEB,
        'paginas': total,
        'fechaPdf': '2026-11-18',
        'documentos': documentos,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': PRESENTACION,
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }
    with open(ruta, 'w', encoding='utf-8') as salida:
        json.dump(programa, salida, ensure_ascii=False, indent=1)
        salida.write('\n')
    print(f'{len(medidas)} medidas, {len(bloques)} bloques, {len(cifras)} cifras, {len(plazos)} plazos, {total} páginas')


if __name__ == '__main__':
    main()
