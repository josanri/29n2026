"""Crea una ficha de programa para cada partido o coalición de «Quién se presenta».

Lee public/datos-electorales/candidaturas.json y agrupa las denominaciones por partido.
Si un partido ya tiene su JSON (extraído de un PDF), no lo toca.
Si no tiene programa, crea una ficha con «vacio: true».
Escribe también src/data/presencia.json: dónde presenta candidaturas cada partido
(provincias por cámara), en qué comunidades y si es de ámbito estatal o autonómico.
Uso: python scripts/generate_partidos.py
"""
import json
import re
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CANDIDATURAS = RAIZ / 'public' / 'datos-electorales' / 'candidaturas.json'
PROGRAMAS = RAIZ / 'src' / 'data' / 'programas'
PRESENCIA = RAIZ / 'src' / 'data' / 'presencia.json'

# Ámbito: por defecto, un partido es autonómico si solo presenta candidaturas en una
# comunidad. Estas excepciones corrigen los casos en los que esa regla falla.
# Partidos de ámbito estatal que este 29N solo se presentan en una comunidad.
ESTATALES = {'ph', 'ie', 'puede', 'pdsje', 'tercera-edad', 'pfac'}
# Partidos o coaliciones nacionalistas que se presentan en más de una comunidad.
AUTONOMICOS = {'eh-bildu', 'eh-bildu-erc'}

# Partidos con su propio extractor en curso: no se generan aquí para no pisar su trabajo.
EN_CURSO = {'salf', 'ie'}

# Color principal de cada partido sin programa.
# «verificado»: color tomado de la web oficial del partido (confianza media, según la investigación).
# El resto son colores provisionales de PALETA_PROVISIONAL, sin verificar, hasta confirmar el color real.
COLOR_POR_ID = {
    'vox': '#7cbd2a',           # verificado (voxespana.es, color repetido en la hoja de estilos)
    'eaj-pnv': '#00902f',       # verificado (eaj-pnv.eus, variable --verdeboton)
    'pcte': '#e3061a',          # verificado (pcte.es, logotipo SVG)
    'pctc': '#e3061a',          # mismo color que PCTE, ya que comparte identidad visual
    'psc': '#E10819',           # muestreado del logotipo aportado (Partit dels Socialistes de Catalunya)
    'podemos': '#9269F5',       # muestreado del logotipo aportado
    'pacma': '#0BEC52',         # muestreado del logotipo aportado (verde dominante)
    'puede': '#3E6C2B',         # muestreado del logotipo aportado (verde oscuro del borde y del texto)
    'fe-jons': '#DA141C',       # muestreado de la bandera aportada (rojo)
    'pdsje': '#FF5AD4',         # muestreado del logotipo aportado (magenta del círculo)
    'vlc': '#00B0D0',           # verificado desde la imagen del logotipo de Valencia Unida
    'compromis-front-valencia': '#FF5800',  # verificado desde el logotipo de Compromís/Front Valencià
    'alantre': '#FFCC02',       # verificado (imagen del logotipo aportada)
    'sdp': '#DF0022',           # verificado (logotipo electoral de Senado de Progreso 2026)
    'pfac': '#7368AF',          # verificado (degradado de la web oficial)
    'autonomos': '#009999',     # verificado (color de enlaces en la web oficial)
    'acord-progres-mallorca': '#A8AA00',  # verificado (emblema de Mallorca en el logotipo aportado)
    'escanos-en-blanco': '#000000',  # verificado (identidad en blanco y negro)
    'alternativa-malaguena': '#1d3a7a',  # azul oscuro indicado por el responsable del proyecto
    'fia': '#C63C3E',           # verificado desde el logotipo oficial de la Federación de los Independientes de Aragón
    'lib': '#033E65',  # verificado desde la imagen de la web oficial de Liberación Canaria
    'sa-unio': '#02A29F',  # verificado desde el logotipo oficial de Sa Unió de Formentera
    'menorca-al-senat': '#0B264D',  # color principal del logotipo de la coalición Menorca al Senat
    'formentera-viva': '#1E7DD4',  # verificado desde el logotipo oficial de Formentera Viva
    'eivissa-al-senat': '#D71921',  # color principal del cartel de la coalición Eivissa al Senat
    'renacer': '#B89078',  # verificado desde el logotipo oficial de Renacer Renaixer
    'ixlg': '#009C4E',  # verificado desde el logotipo oficial de Iniciativa por La Gomera
    'upc': '#1F9995',  # verificado desde el logotipo oficial de Unidad del Pueblo Canario
    'pcpc': '#ED2A24',  # verificado desde el logotipo oficial del Partido Comunista del Pueblo Canario
    'pctg': '#C63C3E',  # verificado desde el logotipo oficial del Partido Comunista dos Traballadores da Galiza
    'pancal': '#5A0074',  # verificado desde el logotipo oficial del Partido Nacionalista de Castilla y León
    'upn': '#0B55A3',  # azul de las siglas del logotipo aportado de UPN (estimado a ojo, sin muestreo)
}
COLOR_CLARO_POR_ID = {
    'escanos-en-blanco': '#FFFFFF',
    'lib': '#D9F0D3',
    'sa-unio': '#DFFAFB',
    'menorca-al-senat': '#DFEEFC',
    'formentera-viva': '#D7F7F8',
    'eivissa-al-senat': '#F8D6D8',
    'psc': '#FDE7E8',
    'podemos': '#CEBCFA',
    'pacma': '#91F6B1',
    'puede': '#A8BDA0',
    'fe-jons': '#EE9599',
    'pdsje': '#FFB5EC',
    'vlc': '#D9F7FF',
    'compromis-front-valencia': '#FFE5D9',
    'renacer': '#F1E3DA',
    'ixlg': '#DFFAE8',
    'upc': '#D7F3F2',
    'pcpc': '#FDE4E2',
    'pctg': '#FDE5E5',
    'pancal': '#F5E8FF',
    'fia': '#FDE5E5',
}
PALETA_PROVISIONAL = [
    '#2d6a4f', '#3a5a98', '#b5651d', '#6d4c9f', '#1f7a8c', '#8c4a2f', '#4f772d', '#9d2c63',
    '#386641', '#7b6d8d', '#bc6c25', '#00747a', '#5e548e', '#a7513a', '#2b9348', '#8d99ae',
]


def color_de(id_, indice):
    return COLOR_POR_ID.get(id_, PALETA_PROVISIONAL[indice % len(PALETA_PROVISIONAL)])


def aclarar(hexadecimal, factor=0.55):
    canales = [int(hexadecimal[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(c + (255 - c) * factor):02x}' for c in canales)


def color_claro_de(id_, color):
    return COLOR_CLARO_POR_ID.get(id_, aclarar(color))


# (patrón sobre el nombre en mayúsculas sin tildes, id, siglas, nombre)
REGLAS = [
    (r'SENADO DE PROGRESO|SDP \(|COALICION ELECTORAL SENADO', 'sdp', 'SDP', 'Senado de Progreso'),
    (r'ESCANOS EN (BLANCO|BRANCO)', 'escanos-en-blanco', 'EB', 'Escaños en Blanco'),
    (r'^PARTIDO POPULAR|^PARTIT POPULAR|\(PP\)$', 'pp', 'PP', 'Partido Popular'),
    (r'^VOX', 'vox', 'VOX', 'VOX'),
    (r'^PODEMOS', 'podemos', 'PODEMOS', 'Podemos'),
    (r'FRENTE OBRERO', 'fo', 'FO', 'Frente Obrero'),
    (r'MUNDO\+JUSTO|MUNDO MAS JUSTO|MUNDO MAIS XUSTO|MUNDO MÁS JUSTO', 'mundo-mas-justo', 'MUNDO+JUSTO', 'Por un Mundo Más Justo'),
    (r'PARTIDO SOCIALISTA OBRERO ESPANOL|PARTIDO SOCIALISTA DE EUSKADI|PARTIDO SOCIALISTA DE HUELVA|PARTIDO SOCIALISTA DE LAS ISLAS|PARTIDO SOCIALISTA DE NAVARRA|PARTIDO DOS SOCIALISTAS DE GALICIA|PARTIDO DOS SOCIALISTAS|\(PSOE\)', 'psoe', 'PSOE', 'Partido Socialista Obrero Español'),
    (r'PACMA|ANIMALISTA', 'pacma', 'PACMA', 'PACMA'),
    (r'ELAK/PCTE|PCTE/ELAK|LANGILEEN ALDERDI KOMUNISTA', 'elak-pcte', 'ELAK/PCTE', 'ELAK / PCTE'),
    (r'PARTIDO COMUNISTA DE LOS TRABAJADORES DE ESPANA', 'pcte', 'PCTE', 'Partido Comunista de los Trabajadores de España'),
    (r'PARTIDO COMUNISTA DOS TRABALLADORES DA GALIZA|PCTG', 'pctg', 'PCTG', 'Partido Comunista dos Traballadores da Galiza'),
    (r'PARTIT COMUNISTA DELS TREBALLADORS DE CATALUNYA|PCTC', 'pctc', 'PCTC', 'Partit Comunista dels Treballadors de Catalunya'),
    (r'PARTIDO COMUNISTA DEL PUEBLO CANARIO|PCPC', 'pcpc', 'PCPC', 'Partido Comunista del Pueblo Canario'),
    (r'PARTIT DELS SOCIALISTES DE CATALUNYA|\(PSC\)', 'psc', 'PSC', 'Partit dels Socialistes de Catalunya'),
    (r'JUNTS PER CATALUNYA|JXCAT', 'jxcat', 'JxCat', 'Junts per Catalunya'),
    (r'UNIDAD DEL PUEBLO CANARIO', 'upc', 'UPC', 'Unidad del Pueblo Canario'),
    (r'EUZKO ALDERDI|EAJ-PNV', 'eaj-pnv', 'EAJ-PNV', 'Euzko Alderdi Jeltzalea-Partido Nacionalista Vasco'),
    (r'PREPAL', 'prepal', 'PREPAL', 'Partido Regionalista del País Leonés'),
    (r'BLOQUE NACIONALISTA GALEGO|\(BNG\)|B\.N\.G\.', 'bng', 'BNG', 'Bloque Nacionalista Galego'),
    (r'ERC-EH BILDU|EH BILDU-ERC|EH BILDU- ERC|EH BILDU-ESQUERRA', 'eh-bildu-erc', 'EH BILDU-ERC', 'EH Bildu-ERC'),
    (r'EUSKAL HERRIA BILDU|EH BILDU', 'eh-bildu', 'EH BILDU', 'EH Bildu'),
    (r'ESQUERRA REPUBLICANA DE CATALUNYA \(ERC\)|^ESQUERRA REPUBLICANA DE CATALUNYA$', 'erc', 'ERC', 'Esquerra Republicana de Catalunya'),
    (r'NUEVO EXTREMENISMO|NEX\)', 'nex', 'NEX', 'Nuevo Extremeñismo - Adelante Extremadura'),
    (r'COMUNS', 'comuns', 'COMUNS', 'Comuns-Front Ampli'),
    (r'ARAMES', 'arames', 'ARAMÉS', 'Aramés-Front Ampli'),
    (r'CHUNTA ARAGONESISTA|CHA-IU', 'cha-fa', 'CHA-FA', 'Chunta Aragonesista-Frente Amplio Aragón'),
    (r'^COMPROMIS', 'compromis-front-valencia', 'COMPROMÍS', 'Compromís: Front Valencià'),
    (r'ADELANTE ANDALUCIA', 'adelante', 'AA', 'Adelante Andalucía'),
    (r'FALANGE ESPANOLA', 'fe-jons', 'FE de las JONS', 'Falange Española de las J.O.N.S.'),
    (r'COALICION CANARIA|1\.?\s?CAN', 'cc', 'CC', 'Coalición Canaria'),
    (r'UNION DEL PUEBLO NAVARRO|UPN', 'upn', 'UPN', 'Unión del Pueblo Navarro'),
    (r'PARTIDO NACIONALISTA DE CASTILLA|PANCAL', 'pancal', 'PANCAL', 'Partido Nacionalista de Castilla y León'),
    (r'FEDERACION DE LOS INDEPENDIENTES DE ARAGON|F\.I\.A\.|\(FIA\)', 'fia', 'FIA', 'Federación de los Independientes de Aragón'),
    (r'PARTIDO HUMANISTA|\(PH\)', 'ph', 'PH', 'Partido Humanista'),
    (r'FRENTE AMPLI|FRONTE AMPLA|FRENTE AMPLIO|FRONT AMPLI|\(FA\)|FRENTE AMPLIU', 'fa', 'FA', 'Frente Amplio'),
    (r'ALHORA', 'alhora', 'ALHORA', 'Alhora'),
    (r'PARTIDO DEMOCRATA SOCIAL JUBILADOS', 'pdsje', 'P.D.S.J.E.', 'Partido Demócrata Social Jubilados Europeos'),
    (r'ALTERNATIVA MALAGUENA', 'alternativa-malaguena', 'AM', 'Alternativa Malagueña'),
    (r'TERCERA EDAD EN ACCION', 'tercera-edad', '3e', 'Tercera Edad en Acción'),
    (r'GEROA BAI', 'geroa-bai', 'GBAI', 'Geroa Bai'),
    (r'LIBERACION CANARIA', 'lib', 'LIB', 'Liberación Canaria'),
    (r'DRAGO CANARIAS', 'drago-canarias', 'D.R.G', 'Partido Drago Canarias'),
    (r'SORIA .?YA', 'soria-ya', 'SY', 'Soria ¡Ya!'),
    (r'CONVERGENTS', 'convergents', 'CNV', 'Convergents'),
    (r'TERUEL EXISTE', 'teruel-existe', 'TE', 'Teruel Existe'),
    (r'AGENDA VALENCIANA', 'agenda-valenciana', 'AV', 'Agenda Valenciana'),
    (r'FEMINISTAS AL CONGRESO', 'pfac', 'PFAC', 'Feministas al Congreso'),
    (r'ACORD DE PROGRES PER MALLORCA', 'acord-progres-mallorca', 'APM', 'Acord de Progrés per Mallorca'),
    (r'MENORCA AL SENAT', 'menorca-al-senat', 'MAS', 'Menorca al Senat'),
    (r'EIVISSA AL SENAT', 'eivissa-al-senat', 'EAS', 'Eivissa al Senat'),
    (r'FORMENTERA AL SENAT', 'formentera-al-senat', 'FAS', 'Formentera al Senat'),
    (r'FORMENTERA VIVA', 'formentera-viva', 'FV', 'Formentera Viva'),
    (r'SA UNIO DE FORMENTERA', 'sa-unio', 'SA UNIÓ', 'Sa Unió de Formentera'),
    (r'DEMOCRACIA PARA EL SIGLO 21', 'd21', 'D21', 'Democracia para el siglo 21'),
    (r'PROYECTO ALANTRE', 'alantre', 'ALANTRE', 'Proyecto Alantre'),
    (r'INICIATIVA POR LA GOMERA', 'ixlg', 'IxLG', 'Iniciativa por La Gomera'),
    (r'AGRUPACION SOCIALISTA GOMERA', 'asg', 'ASG', 'Agrupación Socialista Gomera'),
    (r'AGRUPACION HERRENA', 'ahi', 'A.H.I.', 'Agrupación Herreña Independiente'),
    (r'ASAMBLEA HERRENA', 'asamblea-herrena', 'AH', 'Asamblea Herreña'),
    (r'VALENCIA UNIDA', 'vlc', 'VLC', 'Valencia Unida'),
    (r'RENACER RENAIXER', 'renacer', 'RRB', 'Renacer Renaixer'),
    (r'PARTIDO UNIONISTA ESTADO DE ESPANA', 'puede', 'PUEDE', 'Partido Unionista Estado de España'),
    (r'EGUZKILORE', 'eguzkilore', 'EGUZKILORE', 'Eguzkilore'),
    (r'PARTIDO AUTONOMOS', 'autonomos', 'AUTÓNOMOS', 'Partido Autónomos'),
    (r'SE ACABO LA FIESTA|SALF', 'salf', 'SALF', 'Se Acabó La Fiesta'),
    (r'IUSTITIA|IUSTITIA EUROPA', 'ie', 'IE', 'Iustitia Europa'),
]


# Código INE de provincia → comunidad autónoma (o ciudad autónoma).
COMUNIDAD_POR_PROVINCIA = {
    '01': 'País Vasco', '20': 'País Vasco', '48': 'País Vasco',
    '02': 'Castilla-La Mancha', '13': 'Castilla-La Mancha', '16': 'Castilla-La Mancha',
    '19': 'Castilla-La Mancha', '45': 'Castilla-La Mancha',
    '03': 'Comunidad Valenciana', '12': 'Comunidad Valenciana', '46': 'Comunidad Valenciana',
    '04': 'Andalucía', '11': 'Andalucía', '14': 'Andalucía', '18': 'Andalucía', '21': 'Andalucía',
    '23': 'Andalucía', '29': 'Andalucía', '41': 'Andalucía',
    '05': 'Castilla y León', '09': 'Castilla y León', '24': 'Castilla y León', '34': 'Castilla y León',
    '37': 'Castilla y León', '40': 'Castilla y León', '42': 'Castilla y León', '47': 'Castilla y León',
    '49': 'Castilla y León',
    '06': 'Extremadura', '10': 'Extremadura',
    '07': 'Illes Balears',
    '08': 'Cataluña', '17': 'Cataluña', '25': 'Cataluña', '43': 'Cataluña',
    '15': 'Galicia', '27': 'Galicia', '32': 'Galicia', '36': 'Galicia',
    '22': 'Aragón', '44': 'Aragón', '50': 'Aragón',
    '26': 'La Rioja', '28': 'Madrid', '30': 'Murcia', '31': 'Navarra', '33': 'Asturias',
    '35': 'Canarias', '38': 'Canarias', '39': 'Cantabria', '51': 'Ceuta', '52': 'Melilla',
}


def ambito_de(id_, comunidades):
    if id_ in AUTONOMICOS:
        return 'autonomico'
    if id_ in ESTATALES:
        return 'estatal'
    return 'autonomico' if len(comunidades) == 1 else 'estatal'


def escribir_presencia(camaras_por_id):
    """camaras_por_id: id → {'Congreso': set(códigos), 'Senado': set(códigos)}."""
    presencia = {}
    for id_, camaras in sorted(camaras_por_id.items()):
        provincias = sorted(camaras['Congreso'] | camaras['Senado'])
        # Comunidades ordenadas por número de provincias en las que se presenta.
        cuenta = {}
        for codigo in provincias:
            comunidad = COMUNIDAD_POR_PROVINCIA[codigo]
            cuenta[comunidad] = cuenta.get(comunidad, 0) + 1
        comunidades = sorted(cuenta, key=lambda comunidad: (-cuenta[comunidad], comunidad))
        presencia[id_] = {
            'ambito': ambito_de(id_, comunidades),
            'comunidades': comunidades,
            'congreso': sorted(camaras['Congreso']),
            'senado': sorted(camaras['Senado']),
        }
    salida = {'comunidadPorProvincia': COMUNIDAD_POR_PROVINCIA, 'partidos': presencia}
    PRESENCIA.write_text(json.dumps(salida, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return presencia


def sin_tildes(texto):
    return ''.join(c for c in unicodedata.normalize('NFKD', texto) if not unicodedata.combining(c)).upper()


def identificar(nombre):
    clave = sin_tildes(nombre)
    for patron, id_, siglas, etiqueta in REGLAS:
        if re.search(patron, clave):
            return id_, siglas, etiqueta
    return None


def ficha_vacia(id_, siglas, etiqueta, indice, comunidad):
    color = color_de(id_, indice)
    ficha = {
        'id': id_,
        'partido': etiqueta,
        'siglas': siglas,
        'color': color,
        'colorClaro': color_claro_de(id_, color),
        'programa': '',
        'subtitulo': 'Programa vacío',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'vacio': True,
        'pdf': '',
        'paginas': 0,
        'unidadMedida': 'medida',
        'unidadMedidas': 'medidas',
        'presentacion': {'titulo': '', 'texto': ''},
        'cifras': [],
        'plazos': [],
        'ordenPlazos': [],
        'verbos': [],
        'bloques': [],
        'secciones': [],
        'medidas': [],
    }
    if comunidad:
        ficha['comunidad'] = comunidad
    return ficha


def main():
    datos = json.loads(CANDIDATURAS.read_text(encoding='utf-8'))
    sin_clasificar = set()
    agrupados = {}
    provincias_por_partido = {}
    camaras_por_id = {}
    for provincia in datos['provincias']:
        for candidatura in provincia['candidaturas']:
            nombre = candidatura['partido']
            identificado = identificar(nombre)
            if identificado is None:
                sin_clasificar.add(nombre)
                continue
            agrupados.setdefault(identificado, set()).add(nombre)
            provincias_por_partido.setdefault(identificado, set()).add(provincia['codigo'])
            camaras = camaras_por_id.setdefault(identificado[0], {'Congreso': set(), 'Senado': set()})
            camaras[candidatura['camara']].add(provincia['codigo'])

    if sin_clasificar:
        print('Sin clasificar:', *sorted(sin_clasificar), sep='\n  ')
    presencia = escribir_presencia(camaras_por_id)
    print(f'presencia escrita para {len(presencia)} partidos')

    creados, existentes, omitidos = [], [], []
    for indice, ((id_, siglas, etiqueta), _) in enumerate(sorted(agrupados.items())):
        ruta = PROGRAMAS / f'{id_}.json'
        if id_ in EN_CURSO:
            omitidos.append(id_)
        else:
            # Comunidad principal de los partidos autonómicos (la web usa presencia.json
            # para agruparlos en todas sus comunidades).
            comunidad = presencia[id_]['comunidades'][0] if presencia[id_]['ambito'] == 'autonomico' else None
            if ruta.exists():
                existentes.append(id_)
                ficha = json.loads(ruta.read_text(encoding='utf-8'))
                if ficha.get('vacio'):
                    # Actualiza color y comunidad de las fichas vacías ya creadas.
                    ficha['color'] = color_de(id_, indice)
                    ficha['colorClaro'] = color_claro_de(id_, ficha['color'])
                    ficha.pop('comunidad', None)
                    if comunidad:
                        ficha['comunidad'] = comunidad
                    ruta.write_text(json.dumps(ficha, ensure_ascii=False, indent=1), encoding='utf-8')
            else:
                ruta.write_text(json.dumps(ficha_vacia(id_, siglas, etiqueta, indice, comunidad), ensure_ascii=False, indent=1), encoding='utf-8')
                creados.append(id_)

    print(f'partidos agrupados: {len(agrupados)}')
    print(f'fichas vacías creadas: {len(creados)}')
    print(f'ya existentes (con programa): {len(existentes)} {existentes}')
    print(f'omitidos por trabajo en curso: {omitidos}')


if __name__ == '__main__':
    main()
