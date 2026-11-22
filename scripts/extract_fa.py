"""Extrae el programa del Frente Amplio (Elecciones generales 2026) al esquema compartido.

Estructura del PDF (151 páginas, maquetado en InDesign; tipografías Inter y Marr Sans):
- Páginas 3-5: índice (Inter 8.5 pt y capítulos en MarrSansCond Semibold 11 pt, color #f03c12).
  El índice es la referencia: la compilación para si una sección del índice no está en el cuerpo o al revés.
- Páginas 7-8: «Introducción» (Inter 10 pt, sin cabecera de sección). Va entera a la presentación.
- Cuerpo (páginas 9-150): cada capítulo abre con una página-portada (número en MarrSansCond Bold 32,4 pt y título en
  MarrSansCond Bold 70-84 pt). Las secciones («1.3.» + título) van en MarrSans Medium 15 pt naranja.
  Dentro de una sección, algunos grupos llevan un epígrafe en MarrSans Medium 12 pt naranja («Tope de precios de
  alquiler vinculado al 25 % de la renta del barrio»). El resto son viñetas «●» (Inter 5,2 pt naranja + texto
  Inter 10 pt, x = 113/125) y, dentro de una viñeta, listas «▶» / «▷» (Inter 5,8 pt).
- Cabecera de página (y ≈ 57): número de página y título del capítulo. Se ignora.
- La paginación impresa va tres por detrás de la del PDF (la sección 1.1 está en la página impresa 13 y en la 10 del PDF).
  Las páginas que se citan en los datos son las del PDF, que son las que abre el enlace «#page=».

Esquema:
- Capítulo (01-18) → bloque. Sección (1.1 …) → sección. Epígrafe naranja → subapartado de su sección.
- Cada viñeta «●» es una propuesta (`n` correlativo). Las viñetas que preceden al primer epígrafe de una sección
  no pertenecen a ningún subapartado (`subapartado: null`). El programa no numera ni titula las viñetas: el título
  de cada propuesta es su rótulo («Servicios complementarios: …») si lo tiene, y si no su primera frase, recortada.
  El texto es siempre la viñeta entera.
- Las tablas de este script (categoría, derogaciones, cifras, plazos) usan el número `n` solo al final, cuando el
  extractor ya los conoce: aquí se identifican las propuestas por «sección + inicio del texto».

Uso: python scripts/extract_fa.py <pdf> <salida.json> [--depurar <volcado.txt>]
"""
import json
import re
import sys
from collections import Counter

import fitz


ID = 'fa'
PDF_PUBLICO = '/programas/fa-programa-electoral-2026.pdf'
FUENTE = 'https://frenteamplio.info/programa/'
FECHA_PDF = '2026-11-16'
COLOR = '#F03C00'
COLOR_CLARO = '#F03C00'
PAGINA_INTRO = (7, 8)
PRIMERA_PAGINA_CUERPO = 9
ULTIMA_PAGINA_CUERPO = 150
TOTAL_BLOQUES = 18

# Nombre corto de cada capítulo (el título entero del PDF va en `lema`).
BLOQUES = {
    1: 'Vivienda',
    2: 'Derechos sociales',
    3: 'Reforma fiscal',
    4: 'Salarios y pensiones',
    5: 'Transición ecológica',
    6: 'Política industrial',
    7: 'Campo, ganadería y pesca',
    8: 'Autónomos y economía social',
    9: 'Despoblación e insularidad',
    10: 'Empleo público',
    11: 'Financiación autonómica',
    12: 'Ayuntamientos',
    13: 'Democracia económica',
    14: 'Poder digital',
    15: 'Igualdad y derechos',
    16: 'Migraciones y antirracismo',
    17: 'Seguridad humana y Europa',
    18: 'Democracia avanzada',
}

# Categoría de cada sección. Las excepciones, propuesta a propuesta, van en `CATEGORIA_PROPUESTA`.
CATEGORIA = {
    '1.1': 'vivienda', '1.2': 'vivienda', '1.3': 'vivienda', '1.4': 'vivienda', '1.5': 'vivienda',
    '1.6': 'vivienda', '1.7': 'vivienda', '1.8': 'vivienda', '1.9': 'vivienda',
    '2.1': 'social', '2.2': 'sanidad', '2.3': 'social', '2.4': 'sanidad', '2.5': 'educacion',
    '2.6': 'identidad', '2.7': 'social', '2.8': 'familia',
    '3.1': 'fiscalidad', '3.2': 'fiscalidad', '3.3': 'fiscalidad', '3.4': 'fiscalidad', '3.5': 'fiscalidad',
    '3.6': 'fiscalidad', '3.7': 'fiscalidad',
    '4.1': 'empleo', '4.2': 'social', '4.3': 'social',
    '5.0': 'energia', '5.1': 'energia', '5.2': 'infraestructuras', '5.3': 'energia', '5.4': 'energia', '5.5': 'energia',
    '5.6': 'infraestructuras', '5.7': 'rural',
    '6.1': 'innovacion', '6.2': 'innovacion', '6.3': 'fiscalidad',
    '7.1': 'rural', '7.2': 'rural',
    '8.1': 'empleo', '8.2': 'energia', '8.3': 'empleo',
    '9.1': 'rural', '9.2': 'territorio',
    '10.1': 'administracion', '10.2': 'administracion',
    '11.1': 'territorio', '11.2': 'territorio', '11.3': 'infraestructuras',
    '12.1': 'territorio', '12.2': 'territorio', '12.3': 'territorio', '12.4': 'fiscalidad', '12.5': 'territorio',
    '13.1': 'empleo', '13.2': 'innovacion',
    '14.1': 'innovacion', '14.2': 'innovacion', '14.3': 'innovacion',
    '15.1': 'empleo', '15.2': 'social',
    '16.1': 'social', '16.2': 'inmigracion',
    '17.1': 'exterior', '17.2': 'exterior', '17.3': 'exterior',
    '18.1': 'democracia', '18.2': 'democracia', '18.3': 'seguridad', '18.4': 'seguridad', '18.5': 'democracia',
    '18.6': 'identidad', '18.7': 'justicia', '18.8': 'identidad',
}

# Excepciones: (sección, expresión sobre el texto de la propuesta, categoría). Gana la primera que coincide.
CATEGORIA_PROPUESTA = [
    # 2.7 Feminismo: la violencia machista es seguridad; la brecha y los cuidados, empleo; la salud sexual, sanidad.
    ('2.7', r'violencia (?:machista|de g[eé]nero|sexual)|v[ií]ctimas|acoso sexual|trata', 'seguridad'),
    ('2.7', r'brecha salarial|permisos?|corresponsabilidad|igualdad retributiva|empleo', 'empleo'),
    ('2.7', r'aborto|interrupci[oó]n voluntaria|salud sexual|reproductiv|anticonceptiv|menstrua|menopausia|c[aá]ncer de mama', 'sanidad'),
    ('2.7', r'\bciencia\b|\bcultura\b|deporte', 'identidad'),
    # 2.1: gasto social de otras áreas
    ('2.1', r'comedor escolar|educaci[oó]n|alumnado|becas', 'educacion'),
    ('2.1', r'vivienda|alquiler|hipoteca|desahucio', 'vivienda'),
    ('2.1', r'\bIVA\b|\bIRPF\b|impuesto', 'fiscalidad'),
    # 2.8 Infancia y juventud: educación, vivienda, empleo y salud mental de jóvenes
    ('2.8', r'universidad|beca|educaci[oó]n|escolar|FP\b|formaci[oó]n profesional|aula', 'educacion'),
    ('2.8', r'salud mental|sanitari|psicolog|adicci[oó]n|alcohol|tabaco|juego', 'sanidad'),
    ('2.8', r'empleo|trabajo|salario|pr[aá]cticas|becarios', 'empleo'),
    ('2.8', r'redes sociales|plataformas|pantallas|digital|ciberacoso|internet', 'innovacion'),
    ('2.8', r'prostituci[oó]n|abuso sexual|explotaci[oó]n|justicia juvenil|penal|Barnahus|Fiscal[ií]a|juzgados', 'justicia'),
    ('2.2', r'educaci[oó]n de 0 a 3|etapa 0-3|escuelas infantiles', 'educacion'),
    ('2.2', r'permiso|nacimiento y adopci[oó]n|monoparentales|corresponsabilidad', 'familia'),
    ('2.2', r'pobreza|ingresos', 'social'),
    ('15.2', r'sanitari|salud|tratamientos', 'sanidad'),
    # 2.5 Educación: lo que no es educación
    ('2.5', r'^(?:Promoveremos la )?investigaci[oó]n', 'innovacion'),
    # 2.6 Cultura: patrimonio, deporte y lenguas son identidad; derechos laborales de artistas, empleo
    ('2.6', r'Estatuto del Artista|artistas|trabajadores de la cultura|profesionales de la cultura|cotizaci', 'empleo'),
    ('2.6', r'IVA|fiscal|deducci', 'fiscalidad'),
    # 4.1 Salarios: tiempo de trabajo, salarios y reformas laborales son empleo; lo fiscal, impuestos
    ('4.1', r'\bIRPF\b|\bIVA\b|cotizaci[oó]n(?:es)? a la Seguridad Social|bonificaci', 'fiscalidad'),
    ('4.1', r'funcionari|empleo p[uú]blico|empleados p[uú]blicos', 'administracion'),
    # 4.2 Precios: alimentación, energía, vivienda
    ('4.2', r'energ[ií]a|electricidad|el[eé]ctric|carburantes|combustibles', 'energia'),
    ('4.2', r'agricultor|ganader|productores|cadena alimentaria', 'rural'),
    ('4.2', r'\bIVA\b|impuesto|fiscal', 'fiscalidad'),
    # 5.7 Bienestar animal (misma regla que PACMA: no hay categoría de protección animal)
    ('5.7', r'taurin|tauromaqu|toros|circos?|zool[oó]gic|delfinari|espect[aá]culos? con animales|ferias|festejos', 'identidad'),
    ('5.7', r'C[oó]digo Penal|delito|penal|multas?|sanci[oó]n|infracci[oó]n|ley de protecci[oó]n|maltrato', 'justicia'),
    ('5.7', r'sanitari|veterinari|vacuna|zoonosis|salud', 'sanidad'),
    # 6.1 Industria: lo energético y lo laboral
    ('6.1', r'energ[ií]a|renovable|hidr[oó]geno|bater[ií]a|electrificaci', 'energia'),
    ('6.1', r'armamento|industria (?:de )?defensa|\bmilitar', 'defensa'),
    ('6.1', r'\btrenes?\b|ferrocarril|\bpuertos?\b|aeropuert', 'infraestructuras'),
    # 6.2 y 6.3: empresas públicas y banca pública
    ('6.2', r'energ[ií]a|el[eé]ctric', 'energia'),
    # 5.3 Adaptación climática: emergencias
    ('5.3', r'emergencia|incendio|(?-i:\bDANA\b)|inundaci|cat[aá]strofe|protecci[oó]n civil|(?-i:\bUME\b)|desastre', 'emergencias'),
    ('5.3', r'bosques?|forestal|monte|biodiversidad|espacios naturales|fauna|especies', 'rural'),
    ('5.3', r'vivienda|edificios?|rehabilit', 'vivienda'),
    ('5.3', r'agua|embalse|r[ií]o|sequ[ií]a|dep[oó]sito|regad[ií]o|desal', 'infraestructuras'),
    # 5.5 Residuos y 5.4 turismo ya son energía y clima; 5.1 contiene redes (energía)
    # 7.2 y 9.1 son rurales; 9.1 reparte servicios públicos
    ('9.1', r'sanitari|sanidad|hospital|centro de salud|m[eé]dic', 'sanidad'),
    ('9.1', r'educaci[oó]n|escuela|colegio|instituto|universidad', 'educacion'),
    ('9.1', r'transporte|tren|autob[uú]s|carretera|banda ancha|fibra|conectividad', 'infraestructuras'),
    ('9.1', r'vivienda|alquiler', 'vivienda'),
    ('9.1', r'empleo|trabajo|empresas?|aut[oó]nomos|emprend', 'empleo'),
    # 11.3 Infraestructuras: ferrocarril es infraestructuras; lo demás territorio
    ('11.3', r'financiaci[oó]n|inversi[oó]n territorializada|deuda', 'territorio'),
    # 13.1 Democracia en las empresas: empleo; 13.2: competencia
    ('13.2', r'fiscal|impuesto|tributa', 'fiscalidad'),
    ('13.2', r'banca|bancari|financier|entidad(?:es)? de cr[eé]dito|CNMV|Banco de Espa', 'fiscalidad'),
    # 14.x: derechos digitales
    ('14.1', r'medios|periodis|informaci[oó]n', 'democracia'),
    ('14.1', r'penal|delito|responsabilidad penal|C[oó]digo Penal', 'justicia'),
    ('14.2', r'datos personales|privacidad|protecci[oó]n de datos', 'democracia'),
    ('14.3', r'administraci[oó]n p[uú]blica|sector p[uú]blico|derechos fundamentales|vigilancia|reconocimiento facial', 'democracia'),
    ('14.3', r'trabajadores|laboral|empleo|negociaci[oó]n colectiva|sindicat', 'empleo'),
    # 16.2 Regularización: empleo y asilo son inmigración; mantenemos la sección
    # 17.1 Seguridad humana: ayuda, diplomacia, ONU y migración son exterior
    ('17.1', r'embargo|Israel', 'exterior'),
    ('17.1', r'militar|armas|armamento|(?-i:\bOTAN\b)|desarme|nuclear|desmilitar|seguridad humana|defensa nacional|jurisdicci[oó]n universal', 'defensa'),
    # 17.2 y 17.3 ya son exterior; 17.3 contiene política económica europea
    ('17.3', r'guaridas fiscales|para[ií]sos fiscales|evasi[oó]n|impuestos?|tributaci|Sociedades', 'fiscalidad'),
    ('17.3', r'migraci[oó]n|asilo|fronteras|Frontex|refugiad|v[ií]as legales', 'inmigracion'),
    # 18.1 República federal: territorio, justicia y reglas electorales
    ('18.1', r'autodeterminaci[oó]n|plurinacional|federal|autonom[ií]|comunidades aut[oó]nomas|Senado|lenguas|cooficial|derecho a decidir|referéndum|refer[eé]ndum', 'territorio'),
    ('18.1', r'Consejo General del Poder Judicial|(?-i:\bCGPJ\b)|Tribunal Supremo|Fiscal[ií]a|jueces|magistrad|Tribunal Constitucional', 'justicia'),
    ('18.1', r'lengua|lenguas|cultura|himno|bandera|s[ií]mbolos|identidad', 'identidad'),
    ('18.1', r'Casa Real|Rey\b|monarqu|corona|rep[uú]blica', 'democracia'),
    # 18.2 Corrupción y ética
    ('18.2', r'Fiscal[ií]a|Poder Judicial|jueces|delito|C[oó]digo Penal|prescripci|aforamiento|condena|inhabilitaci|cohecho|puertas giratorias', 'justicia'),
    # 18.4 Fuerzas y Cuerpos de Seguridad: derechos laborales y militares
    ('18.4', r'Fuerzas Armadas|\bmilitar|(?-i:\bUME\b)|Ministerio de Defensa', 'defensa'),
    ('18.4', r'salari|retribuci|jubilaci|pensi[oó]n|carrera profesional|sindicat|asociaciones profesionales|conciliaci|permisos', 'administracion'),
    # 18.6 Memoria democrática: justicia para las víctimas
    ('18.6', r'Fiscal|jueces|juicio|prescripci|Ley de Amnist[ií]a|anular|nulidad|tribunales|v[ií]ctimas del franquismo', 'justicia'),
    # 18.8 Laicidad
    ('18.8', r'IBI|exenci[oó]n fiscal|impuesto|tribut|financiaci[oó]n|asignaci[oó]n tributaria|casilla', 'fiscalidad'),
    ('18.8', r'colegios concertados|escuela|educaci[oó]n|religi[oó]n en la escuela|alumnos', 'educacion'),
]

# Leyes que la propuesta deroga o revierte de forma explícita: (sección, prueba literal en el texto, ley).
DEROGA = [
    ('1.7', 'Derogaremos de forma inmediata y definitiva el régimen fiscal especial', 'Régimen fiscal especial de las SOCIMI'),
    ('2.4', 'Derogaremos expresamente la Ley 15/1997', 'Ley 15/1997, nuevas formas de gestión del SNS'),
    ('2.6', 'Derogaremos la Ley 18/2013 que reconoce', 'Ley 18/2013, de la tauromaquia como patrimonio cultural'),
    ('5.7', 'Derogaremos la Ley 18/2013 de protección cultural', 'Ley 18/2013, de la tauromaquia como patrimonio cultural'),
    ('16.2', 'Derogaremos formalmente la disposición adicional décima de la Ley de Extranjería', 'Rechazo en frontera (disposición adicional décima de la Ley de Extranjería)'),
    ('18.3', 'Derogaremos por completo la Ley Mordaza', 'Ley Mordaza'),
    ('18.3', 'Derogaremos los artículos del Código Penal que castigan', 'Delitos del Código Penal contra los sentimientos religiosos, la Corona y las instituciones'),
    ('18.4', 'Derogaremos el Código Penal Militar', 'Código Penal Militar en las tareas policiales'),
    ('18.8', 'Derogaremos exenciones del IBI a bienes confesionales', 'Exenciones del IBI a bienes confesionales no destinados al culto'),
    ('18.8', 'derogando la Ley de Libertad Religiosa', 'Ley de Libertad Religiosa'),
]

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes\b|\bjuventud\b|\bjuvenil\w*',
    'mayores': r'\bpersonas mayores\b|\bpensionistas?\b|\bjubilad[oa]s?\b|\bresidencias?\b|\bmayores de\b',
    'mujeres': r'\bmujeres?\b|violencia (?:machista|de g[eé]nero)|\bfeminis\w*|\bmenstrua\w*',
    'familias': r'\bfamilias?\b|\bconciliaci[oó]n\b|\bhogares?\b',
    'infancia': r'\binfancia\b|\bniñ[oa]s\b|\bmenores\b|\balumnado\b|\badolescen\w*',
    'autonomos': r'\baut[oó]nom[oa]s\b|aut[oó]nomos/as|\bpymes?\b|\bemprendedor\w*|\bmicroempresas?\b',
    'empresas': r'\bempresas?\b|\bindustria\w*|\bgrandes tenedores\b',
    'rural': r'\bmundo rural\b|\bagricultor\w*|\bganader\w*|\bmedio rural\b|\bdespoblaci[oó]n\b|\bpesca\w*|\bEspaña vaciada\b|\bcampesin\w*',
    'funcionarios': r'\bfuncionari\w*|\bempleados? p[uú]blicos?\b|\bempleo p[uú]blico\b|\bpersonal (?:sanitario|docente|estatutario)\b',
    'discapacidad': r'\bdiscapacidad\w*|\bdependencia\b|\bpersonas con diversidad funcional\b',
    'victimas': r'\bv[ií]ctimas?\b',
    'inmigrantes': r'\bmigrantes?\b|\binmigrantes?\b|\brefugiad\w*|\basilo\b|\bextranjer\w*|\bregularizaci[oó]n\b',
    'pacientes': r'\bpacientes?\b|\bsanidad p[uú]blica\b|\bsistema (?:nacional de salud|sanitario)\b|\blistas de espera\b',
    'agentes': r'\bFuerzas (?:y Cuerpos )?de Seguridad\b|\bGuardia Civil\b|\bpolic[ií]a\w*\b|\bFuerzas Armadas\b|\bmilitares?\b',
}

PALANCAS = {
    'ley': r'\bley(?:es)?\b|\bderog\w*|\breform\w*|\blegislaci[oó]n\b|\bprohibi\w*|C[oó]digo Penal|\bnormativa\b|\breal decreto\b|\bestatuto\b|\bregular\w*',
    'impuestos': r'\bIVA\b|\bIRPF\b|\bfiscal\w*|\bimpuestos?\b|\bdeducci\w*|\btribut\w*|\bbonificaci\w*|\bcotizaci\w*|\bgravar\w*',
    'gasto': r'\binversi[oó]n\b|\bfinanci\w*|\bpresupuest\w*|\bfondos?\b|\bayudas?\b|\bsubvenci\w*|\bdotaci\w*|\b% del PIB\b|\bmillones de euros\b',
    'organizacion': r'\bcreaci[oó]n\b|\bcrear\w*|\bcrearemos\b|\bconstituiremos\b|\bagencia\b|\borganismo\b|\bDirecci[oó]n General\b|\bregistro\b|\bobservatorio\b|\boficinas?\b|\bautoridad\b|\bcomisi[oó]n\b|\bconsejo\b',
    'plan': r'\bplan(?:es)?\b|\bestrategia\b|\bprogramas?\b|\bpacto\b|\bcampañas?\b|\bprotocolos?\b',
}

TERRITORIOS = {
    'Canarias': r'\bCanarias\b',
    'Baleares': r'\bBaleares\b|\bIlles Balears\b',
    'Ceuta y Melilla': r'\bCeuta\b|\bMelilla\b',
    'Cataluña': r'\bCatalu[ñn]a\b|\bCatalunya\b',
    'País Vasco': r'\bPa[ií]s Vasco\b|\bEuskadi\b',
    'Galicia': r'\bGalicia\b',
    'Navarra': r'\bNavarra\b',
    'Andalucía': r'\bAndaluc[ií]a\b',
    'Comunitat Valenciana': r'\bComunitat Valenciana\b|\bComunidad Valenciana\b|\bValencia\b|\bDANA\b',
    'Aragón': r'\bAragón\b',
    'Castilla-La Mancha': r'\bCastilla-La Mancha\b',
    'Castilla y León': r'\bCastilla y León\b',
    'Extremadura': r'\bExtremadura\b',
    'Asturias': r'\bAsturias\b',
    'Cantabria': r'\bCantabria\b',
    'La Rioja': r'\bLa Rioja\b',
    'Región de Murcia': r'\bMurcia\b|\bMar Menor\b',
    'Madrid': r'\bComunidad de Madrid\b',
    'Sáhara': r'\bS[aá]hara\b',
    'Palestina': r'\bPalestina\b|\bGaza\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bParlamento Europeo\b|\bComisi[oó]n Europea\b|\bBCE\b',
    'Doñana': r'\bDoñana\b',
}

# Cifras clave: compromisos cuantificados, elegidos leyendo el programa.
# (valor, unidad, texto, sección, inicio del texto de la propuesta, prueba literal que debe estar en ella)
CIFRAS = [
    ('1 %', 'del PIB al año', 'asignación permanente para crear el parque público de vivienda, unos 17.000 millones de euros', '1.1', 'Asignación presupuestaria permanente', '1 % del PIB anual'),
    ('1,5 millones', 'de viviendas públicas', 'en 12 años, 125.000 al año, hasta llegar a la media europea del 9,3 % del parque', '1.1', 'Ampliaremos el parque público', '1,5 millones de viviendas públicas en 12 años'),
    ('25 %', 'de la renta del barrio', 'techo del alquiler en zonas tensionadas, con una rebaja media del 35 % sobre los precios actuales', '1.3', 'Limitaremos por ley el precio del alquiler', '25 % de la renta neta media por hogar de la sección censal'),
    ('10 %', 'sobre el valor de los pisos', 'impuesto a las empresas desde el primer inmueble y a los particulares desde el cuarto, si suman más de 800.000 euros', '1.7', 'Crearemos un impuesto del 10 %', 'impuesto del 10 % sobre el valor de los pisos'),
    ('60 %', 'del salario medio neto', 'suelo legal del salario mínimo interprofesional', '4.1', 'Suelo legal del SMI', '60 % del salario medio neto'),
    ('37,5 h', 'semanales en 2026', 'jornada máxima inmediata, 35 horas en el sector público, en el camino hacia las 32 horas', '4.1', 'Implantación inmediata a 37,5', '37,5 horas en 2026'),
    ('20 %', 'tipo mínimo en Sociedades', 'para las grandes empresas y grupos, sobre el mínimo actual del 15 %', '3.1', 'Tipo mínimo real del 20 %', 'tipo mínimo efectivo del 20 %'),
    ('52 %', 'tipo marginal del IRPF', 'para las rentas a partir de 300.000 euros', '3.3', 'Ampliaremos el número de tramos del IRPF', '52 % para rentas a partir de 300.000 euros'),
    ('3 %', 'anual sobre el patrimonio', 'Tasa Zucman sobre el patrimonio neto individual de más de 50 millones de euros', '3.2', 'Implantaremos la Tasa Zucman', '3 % anual sobre el patrimonio neto individual que supere los 50 millones'),
    ('10 millones', 'de euros por heredero', 'tope a las herencias, con un tipo marginal del 100 % por encima', '3.2', 'Limitaremos las herencias', 'máximo de 10 millones de euros por heredero'),
    ('3,5 %', 'del PIB al año', 'inversión pública en transición ecológica', '5.0', 'La crisis climática es el gran desafío', '3,5 % del PIB'),
    ('8 %', 'del PIB', 'suelo del gasto sanitario público desde los Presupuestos', '2.4', 'Blindaje del gasto sanitario', '8 % del PIB'),
    ('7 %', 'del PIB', 'suelo legal del gasto educativo público, que debe alcanzarse en 2030', '2.5', 'Suelo legal de gasto educativo', '7 % del PIB en 2030'),
    ('200 €', 'al mes por menor', 'Prestación Universal por Crianza para cada menor de 18 años a cargo', '2.1', 'Aprobaremos la Ley de Prestación Universal', '200 € al mes por cada menor de 18 años'),
    ('65 años', 'edad de jubilación', 'vuelta a la edad de jubilación anterior a la reforma de 2011', '4.3', 'Devolveremos la edad de jubilación', 'edad de jubilación a los 65 años'),
]

# Plazos: solo cuándo se aplica la propuesta.
# (sección, inicio del texto de la propuesta, plazo, texto, prueba literal)
PLAZOS = [
    ('1.2', 'Pondremos en marcha de inmediato una Comisión', 'De inmediato', 'Comisión de Investigación Parlamentaria sobre la gestión de la SAREB', 'de inmediato'),
    ('1.7', 'Derogaremos de forma inmediata', 'De inmediato', 'Derogar el régimen fiscal especial de las SOCIMI', 'de forma inmediata'),
    ('2.1', 'Elevaremos de inmediato el Indicador', 'De inmediato', 'Elevar el IPREM', 'de inmediato'),
    ('2.5', 'Crearemos de forma prioritaria plazas públicas', 'De inmediato', 'Prohibir las cuotas obligatorias en los centros concertados', 'forma inmediata'),
    ('4.1', 'Implantación inmediata a 37,5', 'De inmediato', 'Jornada de 37,5 horas, y de 35 en el sector público', 'Implantación inmediata'),
    ('4.3', 'Publicaremos de inmediato el informe', 'De inmediato', 'Publicar el informe de auditoría de las cuentas de pensiones', 'de inmediato'),
    ('6.1', 'Adhesión al consorcio europeo', 'De inmediato', 'Solicitar el estatus de observadora en el consorcio europeo de bienes comunes digitales', 'de inmediato'),
    ('8.1', 'Transposición del IVA franquiciado', 'De inmediato', 'Transponer la directiva europea del IVA franquiciado para autónomos', 'de inmediato'),
    ('11.1', 'Impulsaremos de forma inmediata', 'De inmediato', 'Reforma del sistema de financiación autonómica', 'de forma inmediata'),
    ('11.3', 'Alta velocidad 100 % pública', 'De inmediato', 'Paralizar la segunda fase de liberalización del ferrocarril', 'de inmediato'),
    ('18.2', 'Pondremos en marcha inmediatamente', 'De inmediato', 'Autoridad de Protección del Informante', 'inmediatamente'),
    ('11.3', 'Auditoría independiente y plan acelerado', 'En 6 meses', 'Auditoría independiente de toda la red de alta velocidad', 'plazo de seis meses'),
    ('10.1', 'Reduciremos la temporalidad en el sector público', 'Primer año', 'Bajar 10 puntos la temporalidad en el sector público', 'primer año'),
    ('12.1', 'Aumentaremos la participación de los ayuntamientos', 'Primer año', 'Subir en 6.000 millones de euros la participación municipal en los tributos del Estado', 'el primer año'),
    ('1.2', 'Tramitaremos la extinción progresiva', 'En 3 años', 'Extinguir las licencias de pisos turísticos en las zonas tensionadas', 'plazo máximo de 3 años'),
    ('3.6', 'Duplicaremos en cuatro años', 'En 4 años', 'Duplicar la plantilla de la Agencia Tributaria', 'en cuatro años'),
    ('5.2', 'Reforzaremos las inversiones ferroviarias en Cercanías', 'En 4 años', 'Triplicar, como mínimo, la inversión anual en Cercanías', 'cuatro años'),
    ('12.1', 'Crearemos un Fondo de Convergencia Municipal', 'En 4 años', 'Fondo de Convergencia Municipal para igualar la financiación por habitante', 'en cuatro años'),
    ('2.2', 'Despliegue presupuestario del Sistema de Atención a la Dependencia', '2030', 'Inversión en dependencia del 0,8 % al 1,7 % del PIB', 'en 2030'),
    ('2.5', 'Suelo legal de gasto educativo', '2030', 'Gasto educativo público del 7 % del PIB', 'en 2030'),
    ('2.8', 'Calendario de cierre del acogimiento', '2030', 'Fin del acogimiento residencial de menores de 10 años', 'en 2030'),
    ('5.0', 'Aumentaremos la generación renovable', '2030', 'Generación renovable del 81 % (90 % en 2035 y 100 % en 2040)', '81 % en 2030'),
    ('5.1', 'Plan de Tejados Solares', '2030', 'Tejado solar en todas las comunidades de vecinos que tengan un tejado útil', 'Antes de 2030'),
    ('5.2', 'Electrificación integral y fin del diésel', '2030', 'Red ferroviaria estatal electrificada y sin locomotoras diésel', 'antes de 2030'),
    ('6.1', 'Alcanzaremos una inversión en I+D+i', '2030', 'Inversión en I+D+i del 3 % del PIB (4 % en la década siguiente)', 'en 2030'),
    ('7.2', 'Transición hacia una producción ganadera', '2030', '25 % de la superficie en ecológico (100 % en 2050)', 'para 2030'),
    ('5.0', 'Reduciremos las emisiones respecto a 1990', '2035', 'Emisiones un 38 % por debajo de 1990 (85 % en 2040 y neutralidad en 2050)', '38 % en 2035'),
    ('1.5', 'Pondremos en marcha el plan de adecuación', 'En 10 años', 'Rehabilitación energética de 2,5 millones de viviendas de familias vulnerables', 'en 10 años'),
    ('1.1', 'Ampliaremos el parque público', 'En 12 años', '1,5 millones de viviendas públicas, hasta el 20 % del parque en 2035', 'en 12 años'),
    ('5.1', 'Eliminaremos las subvenciones a los combustibles fósiles', '2045', 'Retirada de los ciclos combinados', 'hasta 2045'),
]
ORDEN_PLAZOS = ['De inmediato', 'En 6 meses', 'Primer año', 'En 3 años', 'En 4 años', '2030', '2035', 'En 10 años', 'En 12 años', '2045']

NO_VERBOS = {'veremos', 'cansaremos', 'tendremos', 'seremos', 'haremos'}

# El capítulo 5 abre con propuestas generales (3,5 % del PIB, PNIEC, Vicepresidencia de Transición Ecológica…) antes
# de la sección 5.1 y sin número de sección. Se agrupan como «5.0»; el título de esa sección es de este script.
SECCION_SIN_NUMERO = {5: ('5.0', 'Marco general de la transición ecológica')}

SEC_RE = re.compile(r'^(\d{1,2})\.(\d{1,2})\.\s*(.*)$')


# ---------------------------------------------------------------------------------------------------------------
# Lectura del PDF
# ---------------------------------------------------------------------------------------------------------------

def limpiar(texto):
    texto = texto.replace('\t', ' ').replace(' ', ' ')
    return re.sub(r'[ ]{2,}', ' ', texto).strip()


def unir_lineas(partes):
    """Une líneas de un párrafo: la sílaba cortada con guion blando («\\xad») no deja espacio."""
    texto = ''
    for parte in partes:
        parte = parte.strip()
        if not parte:
            continue
        if texto.endswith('­'):
            texto = texto[:-1] + parte
        elif texto:
            texto += ' ' + parte
        else:
            texto = parte
    return limpiar(texto.replace('­', ''))


def lineas(documento, primera, ultima):
    """Líneas del cuerpo con su estilo: (página, tipo, texto, y)."""
    resultado = []
    for indice in range(primera - 1, ultima):
        pagina = indice + 1
        filas = []
        for bloque in documento[indice].get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                piezas = sorted(linea['spans'], key=lambda s: s['bbox'][0])
                texto = ''
                for pieza in piezas:
                    if texto and not texto.endswith(' ') and not pieza['text'].startswith(' ') and pieza['bbox'][0] - prev_x1 > 1.5:
                        texto += ' '
                    texto += pieza['text']
                    prev_x1 = pieza['bbox'][2]
                if not texto.strip():
                    continue
                primero = piezas[0]
                filas.append((linea['bbox'][1], linea['bbox'][0], primero['font'], round(primero['size'], 1), texto))
        filas.sort()
        for y, x, fuente, tamano, texto in filas:
            if y < 70:  # cabecera de página
                continue
            if fuente.startswith('MarrSansCond-Bold') and tamano >= 70:
                tipo = 'capitulo_titulo'
            elif fuente.startswith('MarrSansCond-Bold'):
                tipo = 'capitulo_numero'
            elif fuente.startswith('MarrSans-Medium') and tamano == 15:
                tipo = 'seccion'
            elif fuente.startswith('MarrSans-Medium') and tamano == 12:
                tipo = 'epigrafe'
            elif fuente.startswith('Inter') and tamano == 5.2:
                tipo = 'viñeta'
            elif fuente.startswith('Inter') and tamano == 5.8:
                tipo = 'sublista'
            elif fuente.startswith('Inter') and tamano == 10:
                tipo = 'texto'
            else:
                raise ValueError(f'Línea con estilo desconocido en la página {pagina}: {fuente} {tamano} {texto!r}')
            resultado.append({'pagina': pagina, 'tipo': tipo, 'texto': texto, 'y': y, 'x': x})
    return resultado


def leer_indice(documento):
    """Secciones del índice (páginas 3-5): «1.1.» … en la columna de numeración, en orden de lectura."""
    codigos = []
    for indice in (2, 3, 4):
        for bloque in documento[indice].get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                texto = ''.join(s['text'] for s in sorted(linea['spans'], key=lambda s: s['bbox'][0])).strip()
                encontrado = re.match(r'^(\d{1,2}\.\d{1,2})\.$', texto)
                if encontrado:
                    codigos.append((linea['bbox'][1] + indice * 1000, encontrado.group(1)))
    codigos.sort()
    return [c for _, c in codigos]


def presentacion(documento):
    """Texto de la introducción (páginas 7-8): párrafos por separación vertical y lista de seis transformaciones."""
    parrafos = []
    for indice in range(PAGINA_INTRO[0] - 1, PAGINA_INTRO[1]):
        filas = []
        for bloque in documento[indice].get_text('dict')['blocks']:
            for linea in bloque.get('lines', []):
                piezas = sorted(linea['spans'], key=lambda s: s['bbox'][0])
                texto = ''.join(s['text'] for s in piezas)
                if texto.strip() and linea['bbox'][1] >= 70:
                    filas.append((linea['bbox'][1], piezas[0]['font'], texto))
        filas.sort()
        actual, anterior_y = [], None
        for y, fuente, texto in filas:
            if fuente.startswith('MarrSans-Medium'):
                if actual:
                    parrafos.append(unir_lineas(actual))
                    actual = []
                parrafos.append('## ' + limpiar(texto))
                anterior_y = None
                continue
            nuevo_item = re.match(r'^\d\.\s', texto.replace('\t', ' '))
            if actual and ((anterior_y is not None and y - anterior_y > 20) or nuevo_item):
                parrafos.append(unir_lineas(actual))
                actual = []
            actual.append(texto.replace('\t', ' '))
            anterior_y = y
        if actual:
            parrafos.append(unir_lineas(actual))
    # Un párrafo puede continuar en la página siguiente (no termina en punto): se une.
    unidos = []
    for parrafo in parrafos:
        if unidos and not unidos[-1].startswith('## ') and not parrafo.startswith('## ') \
                and not re.search(r'[.:!?»)]$', unidos[-1]) and not re.match(r'^\d\.\s', parrafo):
            unidos[-1] += ' ' + parrafo
        else:
            unidos.append(parrafo)
    return [p for p in unidos if not p.startswith('## ')] if False else unidos


def extraer(ruta):
    documento = fitz.open(ruta)
    filas = lineas(documento, PRIMERA_PAGINA_CUERPO, ULTIMA_PAGINA_CUERPO)

    bloques = {}
    secciones = []
    propuestas = []
    capitulo = None
    seccion = None
    subapartado = None
    actual = None  # propuesta abierta
    previa = None

    def cerrar():
        nonlocal actual
        actual = None

    i = 0
    while i < len(filas):
        fila = filas[i]
        tipo = fila['tipo']
        if tipo == 'capitulo_numero':
            numero = int(fila['texto'])
            bloques[numero] = {'id': numero, 'pagina': fila['pagina'], 'titulo_lineas': []}
            capitulo = numero
            seccion = subapartado = None
            cerrar()
        elif tipo == 'capitulo_titulo':
            bloques[capitulo]['titulo_lineas'].append(fila['texto'])
        elif tipo == 'seccion':
            partes = [fila['texto']]
            while i + 1 < len(filas) and filas[i + 1]['tipo'] == 'seccion' and filas[i + 1]['pagina'] == fila['pagina'] \
                    and filas[i + 1]['y'] - filas[i]['y'] < 25:
                i += 1
                partes.append(filas[i]['texto'])
            texto = unir_lineas(partes)
            encontrado = SEC_RE.match(texto)
            if not encontrado:
                raise ValueError(f'Sección sin código en la página {fila["pagina"]}: {texto!r}')
            codigo = f'{int(encontrado.group(1))}.{int(encontrado.group(2))}'
            if int(encontrado.group(1)) != capitulo:
                raise ValueError(f'La sección {codigo} está dentro del capítulo {capitulo} (página {fila["pagina"]})')
            seccion = {'id': codigo, 'bloque': capitulo, 'titulo': encontrado.group(3).strip(), 'intro': [],
                       'pagina': fila['pagina'], 'subapartados': []}
            secciones.append(seccion)
            subapartado = None
            cerrar()
        elif tipo in ('epigrafe', 'viñeta', 'sublista', 'texto') and seccion is None and capitulo in SECCION_SIN_NUMERO:
            codigo, titulo_implicito = SECCION_SIN_NUMERO[capitulo]
            seccion = {'id': codigo, 'bloque': capitulo, 'titulo': titulo_implicito, 'intro': [],
                       'pagina': fila['pagina'], 'subapartados': []}
            secciones.append(seccion)
            subapartado = None
            continue  # se vuelve a leer la misma fila, ya dentro de la sección
        elif tipo == 'epigrafe':
            partes = [fila['texto']]
            while i + 1 < len(filas) and filas[i + 1]['tipo'] == 'epigrafe' and filas[i + 1]['pagina'] == fila['pagina'] \
                    and filas[i + 1]['y'] - filas[i]['y'] < 20:
                i += 1
                partes.append(filas[i]['texto'])
            seccion['subapartados'].append({'titulo': unir_lineas(partes), 'intro': []})
            subapartado = len(seccion['subapartados']) - 1
            cerrar()
        elif tipo == 'viñeta':
            texto = fila['texto'].replace('●', '', 1)
            actual = {'bloque': capitulo, 'seccion': seccion['id'], 'subapartado': subapartado,
                      'pagina': fila['pagina'], 'parrafos': [[texto]], 'ultima_y': fila['y'], 'ultima_pagina': fila['pagina']}
            propuestas.append(actual)
        elif tipo == 'sublista':
            if actual is None:
                raise ValueError(f'Lista «▶» sin viñeta en la página {fila["pagina"]}: {fila["texto"]!r}')
            texto = re.sub(r'^[▶▷]\s*', '', fila['texto'])
            actual['parrafos'].append(['– ' + texto])
            actual['ultima_y'], actual['ultima_pagina'] = fila['y'], fila['pagina']
        elif tipo == 'texto':
            if actual is not None:
                es_lista = actual['parrafos'][-1][0].startswith('– ')
                salto = actual['ultima_pagina'] == fila['pagina'] and fila['y'] - actual['ultima_y'] > 22
                if salto and not es_lista:
                    actual['parrafos'].append([fila['texto']])
                else:
                    actual['parrafos'][-1].append(fila['texto'])
                actual['ultima_y'], actual['ultima_pagina'] = fila['y'], fila['pagina']
            elif seccion is not None and subapartado is not None:
                seccion['subapartados'][subapartado]['intro'].append(fila['texto'])
            elif seccion is not None:
                seccion['intro'].append(fila['texto'])
            else:
                raise ValueError(f'Texto fuera de una sección en la página {fila["pagina"]}: {fila["texto"]!r}')
        i += 1
        previa = fila

    if sorted(bloques) != list(range(1, TOTAL_BLOQUES + 1)):
        raise ValueError(f'Capítulos encontrados: {sorted(bloques)}')

    indice = leer_indice(documento)
    cuerpo = [s['id'] for s in secciones if not s['id'].endswith('.0')]
    if indice != cuerpo:
        faltan = [c for c in indice if c not in cuerpo]
        sobran = [c for c in cuerpo if c not in indice]
        raise ValueError(f'El índice y el cuerpo no coinciden. Faltan en el cuerpo: {faltan}. Sobran: {sobran}')

    for seccion in secciones:
        seccion['intro'] = unir_lineas(seccion['intro'])
        for sub in seccion['subapartados']:
            sub['intro'] = unir_lineas(sub['intro'])
    for propuesta in propuestas:
        propuesta['texto'] = '\n\n'.join(unir_lineas(p) for p in propuesta['parrafos'])
        propuesta['texto'] = re.sub(r'\n\n(– )', r'\n\1', propuesta['texto'])
    for numero, bloque in bloques.items():
        bloque['titulo_pdf'] = unir_lineas(bloque['titulo_lineas'])
    return documento, presentacion(documento), bloques, secciones, propuestas


# ---------------------------------------------------------------------------------------------------------------
# Análisis
# ---------------------------------------------------------------------------------------------------------------

def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def mayus_inicial(texto):
    return texto[:1].upper() + texto[1:]


def titulo_de(texto):
    """Rótulo de la viñeta («Servicios complementarios: …») o, si no lo tiene, su primera frase recortada."""
    primera = texto.split('\n')[0]
    rotulo = re.match(r'^([^:.]{8,110}):\s', primera)
    if rotulo and not re.search(r'\b(?:aremos|eremos|iremos)\b', rotulo.group(1)):
        return rotulo.group(1).strip()
    frase = re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])', primera)[0].strip().rstrip('.:;')
    if len(frase) > 125:
        frase = frase[:122].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'
    return frase


def categoria_de(seccion, titulo, texto):
    """Categoría de la sección, salvo que el asunto de la propuesta (su rótulo y su primera frase) sea otro."""
    asunto = f'{titulo} {texto.split(chr(10))[0][:220]}'
    for sec, patron, categoria in CATEGORIA_PROPUESTA:
        if sec == seccion and re.search(patron, asunto, re.IGNORECASE):
            return categoria
    return CATEGORIA[seccion]


def frase_con(texto, prueba):
    """La frase (o el punto de una lista) del texto que contiene la prueba de una cifra."""
    for parte in re.split(r'(?<=[.!?])\s+|\n', texto):
        if prueba in parte:
            return parte.strip().lstrip('– ').strip()
    return prueba


def buscar(propuestas_json, seccion, inicio):
    candidatas = [m for m in propuestas_json if m['seccion'] == seccion and m['texto'].startswith(inicio)]
    if len(candidatas) != 1:
        raise ValueError(f'«{inicio}» en la sección {seccion}: {len(candidatas)} coincidencias')
    return candidatas[0]


def crear_programa(pdf):
    documento, intro, bloques_pdf, secciones_pdf, propuestas_pdf = extraer(pdf)

    bloques = []
    for numero in range(1, TOTAL_BLOQUES + 1):
        b = bloques_pdf[numero]
        nombre = BLOQUES[numero]
        bloques.append({
            'id': numero,
            'titulo': nombre,
            'tituloMayus': nombre.upper(),
            'lema': b['titulo_pdf'],
            'cita': '',
            'intro': '',
            'pagina': b['pagina'],
        })

    secciones = []
    for s in secciones_pdf:
        secciones.append({
            'id': s['id'],
            'bloque': s['bloque'],
            'titulo': s['titulo'],
            'tituloFrase': titulo_de(s['titulo']) if len(s['titulo']) > 125 else s['titulo'],
            'intro': s['intro'],
            'pagina': s['pagina'],
            'subapartados': [{'titulo': t['titulo'], 'intro': t['intro']} for t in s['subapartados']],
        })

    medidas = []
    for n, p in enumerate(propuestas_pdf, start=1):
        if p['seccion'] not in CATEGORIA:
            raise ValueError(f'Falta la categoría de la sección {p["seccion"]}')
        titulo = titulo_de(p['texto'])
        completo = f"{titulo} {p['texto']}"
        medidas.append({
            'n': n,
            'bloque': p['bloque'],
            'seccion': p['seccion'],
            'pagina': p['pagina'],
            'subapartado': p['subapartado'],
            'titulo': titulo,
            'tituloFrase': titulo,
            'texto': p['texto'],
            'oculta': False,
            'categoria': categoria_de(p['seccion'], titulo, p['texto']),
            'colectivos': coincidencias(completo, COLECTIVOS),
            'palancas': coincidencias(completo, PALANCAS),
            'territorios': coincidencias(completo, TERRITORIOS),
            # Solo los compromisos cuantificados de `CIFRAS`: el programa cita muchos datos de contexto.
            'cifras': [],
            'plazo': None,
            'deroga': None,
        })

    for seccion, prueba, ley in DEROGA:
        candidatas = [m for m in medidas if m['seccion'] == seccion and prueba in m['texto']]
        if len(candidatas) != 1:
            raise ValueError(f'Deroga «{ley}»: {len(candidatas)} coincidencias en la sección {seccion}')
        if not re.search(r'derog', candidatas[0]['texto'], re.I):
            raise ValueError(f'La propuesta que deroga «{ley}» no dice «derogar»')
        candidatas[0]['deroga'] = ley

    cifras = []
    for valor, unidad, texto, seccion, inicio, prueba in CIFRAS:
        medida = buscar(medidas, seccion, inicio)
        if prueba not in medida['texto']:
            raise ValueError(f'La cifra «{valor}» no aparece en «{inicio}»: «{prueba}»')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': medida['n']})
        frase_cifra = frase_con(medida['texto'], prueba)
        if frase_cifra not in medida['cifras']:
            medida['cifras'].append(frase_cifra)

    plazos = []
    for seccion, inicio, plazo, texto, prueba in PLAZOS:
        medida = buscar(medidas, seccion, inicio)
        if prueba not in medida['texto']:
            raise ValueError(f'El plazo «{plazo}» no aparece en «{inicio}»: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': medida['n']})

    # El programa escribe en futuro de primera persona («crearemos», «garantizaremos»).
    verbos = Counter()
    for medida in medidas:
        for verbo in re.findall(r'\b([a-záéíóúñ]{3,}(?:aremos|eremos|iremos))\b', medida['texto'].lower()):
            if verbo not in NO_VERBOS:
                verbos[verbo] += 1

    return {
        'id': ID,
        'partido': 'Frente Amplio',
        'siglas': 'FA',
        'color': COLOR,
        'colorClaro': COLOR_CLARO,
        'programa': 'Un programa como una casa',
        'subtitulo': f'{len(medidas)} propuestas en {len(bloques)} bloques: vivienda, derechos sociales, reforma fiscal, '
                     'transición ecológica y democracia avanzada',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'El PDF se facilitó a la redacción: la web oficial del partido (frenteamplio.info/programa) solo mostraba ocho '
            'medidas y anunciaba el PDF como «disponible próximamente». La fecha es la de creación del PDF.',
            'El programa no numera ni titula sus propuestas: cada viñeta es una propuesta. El capítulo 5 abre con propuestas '
            'sin número de sección, que se agrupan como «5.0».',
            'La taxonomía común no tiene una categoría de protección animal ni de banca. Los animales van a la categoría '
            'más cercana (el marco legal y penal a «Justicia», la ganadería y la fauna a «Campo, mar y mundo rural», la '
            'tauromaquia y los zoos a «Lengua, cultura y memoria») y la banca pública a «Impuestos».',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {'titulo': 'Introducción', 'texto': '\n\n'.join(p for p in intro if not p.startswith('## '))},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [{'verbo': v, 'n': c} for v, c in verbos.most_common(15)],
        'bloques': bloques,
        'secciones': secciones,
        'medidas': medidas,
    }


def main():
    pdf, salida = sys.argv[1], sys.argv[2]
    programa = crear_programa(pdf)
    with open(salida, 'w', encoding='utf-8') as archivo:
        json.dump(programa, archivo, ensure_ascii=False, indent=1)
    if '--depurar' in sys.argv:
        volcado = sys.argv[sys.argv.index('--depurar') + 1]
        with open(volcado, 'w', encoding='utf-8') as archivo:
            for medida in programa['medidas']:
                archivo.write(f"\n### {medida['n']} [{medida['seccion']}] p.{medida['pagina']} {medida['categoria']} | {medida['titulo']}\n")
                archivo.write(medida['texto'] + '\n')
    print('páginas', programa['paginas'], 'bloques', len(programa['bloques']), 'secciones', len(programa['secciones']),
          'propuestas', len(programa['medidas']))
    print('categorías', Counter(m['categoria'] for m in programa['medidas']).most_common())


if __name__ == '__main__':
    main()
