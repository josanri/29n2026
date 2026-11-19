"""Extract and categorize the proposals of the «Agenda Aragonesa» of CHA-Frente Amplio Aragón.

Usage: python scripts/extract_cha_fa.py PDF SALIDA.json [--depurar volcado.txt]

El PDF se exporta de Google Docs (Skia/PDF). Estructura del documento:
- Páginas 1-2 (portada) y 39-40 (contraportada): solo imagen, sin texto.
- Página 3: presentación (fuente «Special Gothic Expanded», 15 pt).
- Diez bloques. Cada uno abre con una página de portada con el número en grande (100 pt) y el lema
  («Special Gothic Condensed», 24-30 pt).
- Dentro de un bloque, los epígrafes van en «Special Gothic Expanded One» de 11 pt (línea entera en esa fuente) y
  el texto en «Special Gothic Regular» de 11 pt. Un párrafo es una propuesta; varios empiezan con un rótulo en
  negrita o en Expanded («Ayudas especiales a los pequeños municipios,»). Los párrafos se separan con una línea en
  blanco, salvo en unos pocos sitios donde no hay línea en blanco y el párrafo anterior acaba en punto y es corto.
- El documento no numera ni titula sus propuestas: cada párrafo que propone algo es una propuesta; los
  párrafos de introducción (INTRODUCCIONES) no se cuentan.
- Los bloques 2, 9 y 10 no tienen epígrafes y el 5 empieza con propuestas sin epígrafe: se agrupan en una sección
  implícita (SECCION_IMPLICITA).
"""
import json
import re
import sys
from collections import Counter

import pymupdf

ID = 'cha-fa'
PDF_PUBLICO = '/programas/cha-fa-agenda-aragonesa-2026.pdf'
FUENTE = 'https://frenteamplio.info/programa/'
FECHA_PDF = '2026-11-19'
TOTAL_BLOQUES = 10
TOTAL_SECCIONES = 31
TOTAL_MEDIDAS = 146

BLOQUES = {
    1: 'Autogobierno y financiación',
    2: 'Vivienda',
    3: 'Movilidad',
    4: 'Transición energética',
    5: 'Territorio y paisajes',
    6: 'Agua',
    7: 'Medio rural',
    8: 'Derechos sociales y cuidados',
    9: 'Juventud',
    10: 'Cultura y lenguas',
}

# Bloques sin epígrafe en su primera parte: sección implícita (código, título).
SECCION_IMPLICITA = {
    2: 'Un gran parque público de vivienda en alquiler',
    5: 'Moratorias y planificación frente a los macroproyectos',
    9: 'Una política integral de juventud',
    10: 'Patrimonio, lenguas y cultura aragonesa',
}

# Epígrafes que son subapartado del epígrafe anterior de su nivel, no una sección nueva.
SUBAPARTADOS_DE_FERROCARRIL = {
    'Impulso definitivo al Corredor Cantábrico-Mediterráneo',
    'Ampliación y mejora del transporte urbano e interurbano de Zaragoza',
    'Nuevos servicios y mejora de los actuales',
    'Defensa del ferrocarril y de la intermodalidad de Teruel',
    'Compromiso con el ferrocarril de Aragón',
}

# Párrafos que no proponen nada: contexto, principios o la frase que presenta una lista.
INTRODUCCIONES = [
    'La vivienda debe dejar de ser un activo financiero',
    'La vivienda también debe ser una palanca de vertebración',
    'Aragón merece respeto',
    'Implantar un modelo energético renovable que democratice',
    'Aragón no puede ser territorio de sacrificio',
    'El agricultor profesional está dejando de ser dueño',
    'Defenderemos que vivir en un pueblo',
    'Desde CHA-Frente Amplio Aragón vemos a la juventud',
]
# De las introducciones, las que preceden al primer epígrafe del bloque son la introducción del bloque;
# las demás son la introducción de su sección.

# Categoría de cada sección (código) y excepciones medida a medida (sección, inicio del texto, categoría).
CATEGORIA = {
    '1.1': 'territorio', '1.2': 'territorio', '1.3': 'territorio', '1.4': 'territorio',
    '2.1': 'vivienda',
    '3.1': 'infraestructuras', '3.2': 'infraestructuras', '3.3': 'infraestructuras',
    '4.1': 'energia',
    '5.1': 'energia', '5.2': 'energia', '5.3': 'energia', '5.4': 'energia', '5.5': 'defensa',
    '6.1': 'infraestructuras', '6.2': 'emergencias',
    '7.1': 'rural', '7.2': 'innovacion', '7.3': 'rural', '7.4': 'rural', '7.5': 'territorio', '7.6': 'rural',
    '7.7': 'rural',
    '8.1': 'social', '8.2': 'identidad', '8.3': 'seguridad', '8.4': 'social', '8.5': 'social', '8.6': 'exterior',
    '9.1': 'social',
    '10.1': 'identidad',
}
CATEGORIA_MEDIDA = [
    ('2.1', 'Programas sociales contra el sinhogarismo', 'social'),
    ('5.2', 'Proponemos incluir los centros de datos como un nuevo grupo', 'fiscalidad'),
    ('5.3', 'Compensar económicamente y mediante incentivos ambientales', 'rural'),
    ('7.1', 'Aprobar en el primer periodo de sesiones', 'territorio'),
    ('7.1', 'Líneas de subvenciones para ayuntamientos', 'vivienda'),
    ('8.1', 'Garantizar una atención integral, pública y coordinada', 'sanidad'),
    ('8.1', 'Reforzar la atención psicológica', 'sanidad'),
    ('8.1', 'Desarrollar un programa para revalorizar', 'educacion'),
    ('8.1', 'Exigir financiación estatal plurianual para adaptar', 'educacion'),
    ('8.2', 'Empleo digno', 'empleo'),
    ('8.3', 'Justicia especializada', 'justicia'),
    ('8.3', 'Aumentar las plazas judiciales', 'justicia'),
    ('8.3', 'Mejorar la financiación y especialización del turno de oficio', 'justicia'),
    ('8.4', 'Igualdad en los convenios colectivos', 'empleo'),
    ('8.4', 'Presupuestos con perspectiva de género', 'administracion'),
    ('8.4', 'Seguimiento parlamentario', 'democracia'),
    ('9.1', 'Asegurar la protección y continuidad de los apoyos a las personas jóvenes migrantes', 'inmigracion'),
    ('10.1', 'Reconocer oficialmente por el Ministerio de Educación', 'educacion'),
]

COLECTIVOS = {
    'jovenes': r'\bj[oó]venes\b|\bjuventud\b|\bjuvenil\w*|\bemancipaci[oó]n\b',
    'mujeres': r'\bmujeres?\b|\bMujer\b|violencia de g[eé]nero|violencia machista|violencia vicaria|\bmachistas?\b',
    'rural': r'\bagricultor\w*|\bganader\w+|\bexplotaciones (?:familiares|agrarias)|\bmedio rural\b|\bmundo rural\b|\bpueblos?\b|\bmunicipios (?:rurales|pequeños|de menor población)|\brurales\b|despoblaci[oó]n',
    'mayores': r'\bpersonas mayores\b|\benvejecid\w+|\bpensionistas?\b',
    'discapacidad': r'\bdiscapacidad\b|\bdependencia\b',
    'pacientes': r'\bpacientes?\b|\bELA\b|COVID persistente|enfermedades de alta complejidad',
    'victimas': r'\bv[ií]ctimas?\b|revictimiz\w+',
    'inmigrantes': r'\bmigrantes?\b|\binmigrantes?\b',
    'autonomos': r'\baut[oó]nomos\b|\btrabajadores aut[oó]nomos\b',
    'empresas': r'\bempresas(?! p[uú]blicas)\b|\bempresa(?! p[uú]blica)\b|\bindustri\w+|\bpolígonos\b',
    'funcionarios': r'\bfuncionari[oa]s?\b|empleados p[uú]blicos|profesorado|\bdocente\b',
    'familias': r'\bfamilias?\b',
    'infancia': r'\binfancia\b|\bni[ñn][oa]s?\b|\bmenores\b',
}

PALANCAS = {
    'ley': r'\bley\b|\blegislar\b|\bleyes?\b|\bEstatuto\b|\bnormativ\w+|\bregul\w+|reformar|\breforma\b|\bmoratorias?\b|\bprohib\w+|\btransposici[oó]n\b|\btranspon\w+',
    'impuestos': r'\bIBI\b|\bimpuestos?\b|\btribut\w+|\bfiscal(?!-|es\b)\w*|\bexenci[oó]n\b|recaud\w+|\bcatastral\b',
    'gasto': r'\bfinanci\w+|\binversi[oó]n(?:es)?\b|\bsubvenci\w+|\bayudas?\b|\bfondos?\b|\bcofinanciar\b|\bdotaci[oó]n\b|\bpresupuestari\w+|\bcompensar\b',
    'organizacion': r'\bcrear\b|\bcreaci[oó]n\b|\bempresa p[uú]blica\b|\boficinas?\b|\bobservatorio\b|\bcomisi[oó]n\b|\bsede\b|\bconsorcio\b|\bagencia\b|\bmapa\b',
    'plan': r'\bplan(?:es)?\b|\bestrategia\b|\bconvenio\b|\bpacto\b|\bplanificaci[oó]n\b|\bprograma\b|\bprogramas\b|\bacuerdo\b',
}

TERRITORIOS = {
    'Zaragoza': r'\bZaragoza\b|\bCuarte\b|\bCasetas\b|\bAlagón\b|\bCaspe\b|\bMequinenza\b|\bBorja\b|\bTarazona\b|\bGallur\b|\bMallén\b|\bAljafería\b|\bSijena\b|Pinares de Venecia',
    'Huesca': r'\bHuesca\b|\bCanfranc\b|\bSomport\b|\bJánovas\b|\bPirineos?\b|\bAlto Aragón\b|\bMonzón\b|\bBinéfar\b|\bTardienta\b|\bSariñena\b|\bGrañén\b|\bCanal Roya\b|\bLoarre\b',
    'Teruel': r'\bTeruel\b|\bAlcañiz\b|\bMonreal del Campo\b|\bJavalambre\b|\bValderrobres\b',
    'Aragón': r'\bAragón\b|\baragonesa?s?\b',
    'Cataluña': r'\bCatalunya\b|\bCataluña\b|\bBarcelona\b|\bTarragona\b|\bLleida\b',
    'Navarra': r'\bNavarra\b|\bBardenas\b',
    'Francia': r'\bPau\b|\bOloron\b|\bToulouse\b|\bFrancia\b',
    'Unión Europea': r'\bUni[oó]n Europea\b|\bDirectiva\b|\bEuroVelo\b|\bFondos europeos\b|\beuropeos?\b',
}

# Títulos escritos a mano para las propuestas cuya primera frase es demasiado larga o no dice de qué va.
# (sección, inicio del texto, título corto). Es un rótulo editorial: el texto de la propuesta no cambia.
TITULOS = [
    ('1.1', 'Utilizar de forma decidida los instrumentos', 'Usar la Comisión Bilateral Aragón-Estado y la Comisión Mixta de Asuntos Económico-Financieros'),
    ('2.1', 'Nuestra prioridad será recuperar viviendas vacías', 'Recuperar vivienda vacía y pasar el suelo y las fincas de la SAREB a Casa 47'),
    ('2.1', 'Usando todas estas herramientas', '15.000 viviendas más en el parque público de alquiler asequible'),
    ('2.1', 'Cesión de suelo público a cooperativas', 'Suelo público para cooperativas de vivienda'),
    ('2.1', 'Cesión de suelo público a asociaciones', 'Suelo público para asociaciones sin ánimo de lucro'),
    ('2.1', 'Garantía de viviendas adecuadas', 'Viviendas adecuadas para todas las situaciones familiares'),
    ('3.1', 'Retirada del estudio informativo', 'Retirar el estudio de vía única Teruel-Sagunto y proyectar doble vía electrificada'),
    ('3.1', 'Cofinanciar, al menos en un 30%', 'Cofinanciar al menos el 30 % del tranvía de Zaragoza'),
    ('3.1', 'Mejorar infraestructura, frecuencias, horarios y material rodante en la línea de Cercanías C1', 'Mejorar la Cercanías C1 Casetas-Miraflores'),
    ('3.1', 'Mejora integral de los accesos ferroviarios', 'Accesos ferroviarios a PLAZA y Ronda Sur Ferroviaria de Zaragoza'),
    ('3.1', 'Mejorar infraestructura, frecuencias, horarios y material rodante en la línea Zaragoza-Huesca,', 'Más servicios en la línea Zaragoza-Huesca'),
    ('3.1', 'Mejorar infraestructura, frecuencias, horarios y material rodante en la línea Zaragoza-Monzón', 'Más servicios en la línea Zaragoza-Monzón-Binéfar-Lleida'),
    ('3.1', 'Mejorar infraestructura, frecuencias, horarios y material rodante en la línea convencional', 'Mejorar la línea Zaragoza-Caspe-Tarragona-Barcelona'),
    ('3.1', 'En la formalización de las Obligaciones de Servicio', 'Incluir todos los servicios aragoneses en las Obligaciones de Servicio Público de Renfe'),
    ('3.1', 'Finalización de las mejoras y la adaptación', 'Terminar las mejoras de la línea internacional de Canfranc'),
    ('3.1', 'Mejorar las frecuencias, horarios y material rodante en la línea Zaragoza-Huesca-Canfranc', 'Mejorar los servicios Zaragoza-Huesca-Canfranc'),
    ('3.1', 'Puesta en servicio, tras su modernización', 'Poner en servicio la línea convencional Zaragoza-Teruel-Sagunto, con 4 servicios al día'),
    ('3.1', 'El Gobierno de España y el Ministerio', 'Ningún cierre de líneas ni estaciones ferroviarias en Aragón'),
    ('3.2', 'Finalización de la redacción de los proyectos pendientes', 'Licitar de inmediato los tramos aragoneses de la A-68'),
    ('3.2', 'Licitación y aprobación del estudio informativo y redacción', 'Estudio informativo de la A-68 entre Ventas de Valdealgorfa y Vinaroz'),
    ('3.2', 'Ejecución inmediata de las obras de mejora de curvas', 'Mejora de curvas de la N-211 en Valmayor (Caspe-Mequinenza)'),
    ('3.2', 'Impulso a las rotondas', 'Rotondas de pacificación del tráfico en carreteras nacionales'),
    ('3.2', 'Intervención para adecuar, extender', 'Seguridad vial en el acceso a la A-68 en Alagón'),
    ('3.2', 'Licitación y aprobación del estudio informativo para la conexión entre Monreal', 'Autovía A-25 Monreal del Campo-Alcolea del Pinar'),
    ('3.2', 'Licitación y aprobación de un nuevo estudio informativo', 'Autovía A-40 Teruel-Cuenca'),
    ('3.2', 'Culminación viaria del Pirineo', 'Terminar las autovías A-21 y A-23 antes de 2030'),
    ('4.1', 'Crear (planificar, tramitar y financiar)', 'Red aragonesa de comunidades energéticas y autoconsumo industrial'),
    ('5.1', 'Crear un mapa para el gestor', 'Mapa de subestaciones limitado a los entornos urbanos e industriales'),
    ('5.1', 'Aprobar una planificación de generación renovable', 'Renovables solo de consumo de proximidad y sustituir centrales dañinas'),
    ('5.1', 'Suspender cautelarmente la autorización de nuevas plantas de biogás', 'Suspender las nuevas plantas de biogás hasta tener un Plan de Ordenación'),
    ('5.1', 'Oponerse a la proliferación de la minería', 'Oponerse a la minería de arcillas'),
    ('5.2', 'Diseñar y publicar, con participación pública', 'Planificación general de los centros de datos'),
    ('5.2', 'Elaborar un mapa situacional y zonal', 'Mapa de zonas saturadas por centros de datos y zonas vetadas'),
    ('5.2', 'Regular la tipificación urbanística', 'Suelo para centros de datos y distancias mínimas a los núcleos urbanos'),
    ('5.2', 'Proponemos incluir los centros de datos', 'Centros de datos como bien inmueble de características especiales (BICE)'),
    ('5.3', 'Compensar económicamente y mediante incentivos', 'Compensar a los municipios y propietarios que conservan el territorio'),
    ('5.4', 'Garantizar una financiación estatal plurianual', 'Financiación estatal para limpiar el lindano y la cuenca del Gállego'),
    ('6.1', 'Cumplir los objetivos de buen estado ecológico', 'Cumplir la Directiva Marco del Agua'),
    ('6.1', 'Impulsar la aprobación de Planes de Restitución', 'Planes de Restitución Territorial de las obras hidráulicas'),
    ('6.1', 'Elaborar planes de actuación que recojan', 'Planes de restitución por obras anteriores a 1999 y por el «coste de expectativas»'),
    ('6.2', 'Defender ante las riadas del Ebro', 'Motas con compuertas y tratamiento uniforme de las márgenes del Ebro'),
    ('6.2', 'Intervenir, con diligencia', 'Reparar las infraestructuras agrícolas y ganaderas dañadas por avenidas y danas'),
    ('7.1', 'Aprobar en el primer periodo de sesiones', 'Ley del Estatuto Básico de los Municipios de Menor Población'),
    ('7.1', 'Instar a los órganos competentes de la Unión Europea', 'Fondos europeos directos contra la despoblación'),
    ('7.1', 'Estudiar y promover medidas de apoyo a la generación de empleo', 'Empleo y servicios que hagan atractiva la vida en la provincia de Teruel'),
    ('7.2', 'Impulsar la vertebración del territorio desde la Ciencia', 'Financiar el Laboratorio de Canfranc y el Observatorio de Javalambre'),
    ('7.3', 'Exigir el cumplimiento de los compromisos', 'Reactivar la Ley 45/2007 y los planes de zona'),
    ('7.6', 'Implantar una política forestal', 'Política forestal de prevención y adaptación al cambio climático'),
    ('8.1', 'Asegurar financiación estable y plantillas', 'Financiación y plantillas suficientes para los servicios sociales'),
    ('8.1', 'Desarrollar un programa para revalorizar', 'Revalorizar la función y la carrera docente'),
    ('8.1', 'Exigir financiación estatal plurianual para adaptar', 'Adaptar los centros educativos al calor'),
    ('8.3', 'Garantizar que las administraciones estatales', 'Reconocer todas las formas de acreditación de la violencia de género'),
    ('8.3', 'Mejorar la financiación y especialización del turno', 'Financiar y especializar el turno de oficio'),
    ('8.5', 'Garantizar la continuidad y mejora de los recursos', 'Mantener y mejorar los recursos contra la LGTBIfobia y por la atención integral'),
    ('8.5', 'Revisar y fortalecer la Estrategia estatal', 'Revisar la Estrategia estatal para la igualdad de trato LGTBIQ+'),
    ('9.1', 'Desarrollar una política integral de juventud', 'Una política integral de juventud'),
    ('10.1', 'Profundizar por parte del Gobierno estatal', 'Proteger el aragonés y las lenguas no cooficiales, y financiar la Academia Aragonesa de la Lengua'),
    ('10.1', 'Demandar a la Administración General del Estado', 'Ceder a Aragón los Arcos de la Aljafería'),
    ('10.1', 'Reclamar la construcción de un edificio', 'Un edificio para el Archivo Nacional de Aragón'),
    ('10.1', 'Exigir al Ministerio de Ciencia que se establezca', 'Sede filial del Museo Cajal en Huesca'),
    ('10.1', 'Demandar la rehabilitación de la Capilla', 'Capilla de Santa Rosa y ampliación del Archivo Histórico de Huesca'),
    ('10.1', 'Reconocer oficialmente por el Ministerio de Educación', 'Reconocer los títulos de la Escuela de Violería de Zaragoza'),
    ('5.1', 'Impedir que los proyectos con DIA', 'Impedir que un proyecto con DIA cambie de objeto, por ejemplo a centros de datos'),
    ('8.1', 'Reforzar la atención psicológica', 'Reforzar la atención psicológica y psiquiátrica pública'),
    ('8.5', 'Impulsar, en coordinación con el Gobierno de Aragón', 'Información y acompañamiento LGTBIQ+ de proximidad, con atención al medio rural'),
    ('9.1', 'Impulsar medidas que favorezcan la emancipación', 'Emancipación, empleo digno, formación y vivienda para la juventud'),
    ('10.1', 'Impulsar la colaboración de todas las administraciones', 'Colaborar en el Bicentenario de Goya, en 2028'),
    ('3.1', 'Subvención en favor del Consorcio', 'Subvencionar el Consorcio de Transporte del Área de Zaragoza y poner en marcha Aratrén'),
    ('4.1', 'Adoptar las medidas normativas', 'Que las distribuidoras eléctricas no frenen la generación local'),
    ('5.2', 'Establecer como requisito vinculante', 'Sostenibilidad ambiental obligatoria para los centros de datos'),
    ('5.4', 'Rechazar la unión de estaciones', 'Rechazar la unión de estaciones de esquí por Canal Roya'),
    ('6.1', 'Impulsar una política hidráulica respetuosa', 'Política hidráulica con unidad de cuenca y contra cualquier trasvase, en especial el del Ebro'),
    ('6.1', 'Apostar por la construcción de embalses', 'Embalses, canales y regadíos sostenibles, con restitución territorial'),
    ('6.1', 'Considerar prioritario, en el caso de Jánovas', 'Plan de Desarrollo Sostenible de Jánovas y reversión de sus bienes'),
    ('7.5', 'Impulsar un nuevo sistema de financiación local', 'Nuevo sistema de financiación local, con fondo de compensación del efecto capital'),
    ('7.7', 'Exigir una valoración del impacto social agrario', 'Valoración del impacto social agrario en los proyectos que afecten al campo'),
    ('8.6', 'Defender una acción humanitaria', 'Acción humanitaria centrada en las personas y conforme al Derecho Internacional Humanitario'),
    ('9.1', 'Situar a la juventud en el centro', 'Situar a la juventud en el centro de las políticas públicas'),
    ('10.1', 'Ampliar el Bono cultural', 'Bono cultural de 600 € durante tres años'),
]

# Compromisos cuantificados: (sección, inicio del texto de la propuesta, valor, unidad, texto, prueba literal).
CIFRAS = [
    ('1.2', 'Desarrollar plenamente el actual Estatuto', 'hasta 22', 'nuevas competencias', 'traspaso de hasta 22 competencias nuevas a Aragón, con su financiación', 'traspaso de hasta 22 nuevas competencias'),
    ('2.1', 'Nuestra prioridad será recuperar viviendas vacías', '1.612', 'viviendas de la SAREB', 'viviendas y 757 suelos de la SAREB en Aragón que pasarían a la empresa pública Casa 47', '1.612 viviendas y anejos y 757 suelos en Aragón'),
    ('2.1', 'Usando todas estas herramientas', '15.000', 'viviendas', 'nuevas viviendas en el parque público de alquiler asequible en esta legislatura', '15.000 viviendas'),
    ('2.1', 'Ayudas especiales a los pequeños municipios', '20 %', 'de vivienda pública', 'proporción que deben alcanzar los pequeños municipios a corto y medio plazo', 'proporción del 20% de vivienda pública'),
    ('3.1', 'Cofinanciar, al menos en un 30%', '30 %', 'del coste del tranvía', 'cofinanciación mínima de la línea 1, la línea 2 y las futuras líneas del tranvía de Zaragoza', 'al menos en un 30%'),
    ('3.1', 'Mejorar infraestructura, frecuencias, horarios y material rodante en la línea Zaragoza-Huesca,', '4', 'servicios más por sentido', 'en la línea Zaragoza-Huesca', '4 servicios más por sentido'),
    ('3.1', 'Mejorar infraestructura, frecuencias, horarios y material rodante en la línea Zaragoza-Monzón', '4', 'servicios más por sentido', 'en la línea Zaragoza-Monzón-Binéfar-Lleida', '4 servicios más por sentido'),
    ('3.1', 'Puesta en servicio, tras su modernización', '4', 'servicios al día', 'como mínimo, en la línea Zaragoza-Teruel-Sagunto', '4 servicios al día como mínimo'),
    ('3.1', 'Implantación de servicios directos competitivos', '2 + 2', 'trenes directos', 'al menos dos de ida y dos de vuelta entre Teruel y Madrid', 'Al menos, 2 de ida y 2 de vuelta'),
    ('5.1', 'Establecer moratorias de todos los proyectos', '5 MW', 'de potencia', 'umbral de la moratoria de instalaciones de generación renovable', 'potencia superior a 5 MW'),
    ('7.1', 'Impulsar un gran consenso', '30 minutos', 'de acceso a servicios esenciales', 'tiempo máximo para llegar a los servicios esenciales en el medio rural', 'tiempo máximo de treinta minutos'),
    ('7.5', 'Detraer 2.000 millones de euros', '2.000 millones', 'de euros', 'del Fondo de Participación de Tributos para un Fondo Municipal contra la Despoblación', '2.000 millones de euros'),
    ('10.1', 'Ampliar el Bono cultural a 600', '600 €', 'de bono cultural', 'ampliado a tres años, a los 18, 19 y 20 años', 'Bono cultural a 600 €'),
]
# Plazos: (sección, inicio del texto, plazo, texto, prueba literal).
PLAZOS = [
    ('2.1', 'Usando todas estas herramientas', 'En la legislatura', '15.000 viviendas en el parque público de alquiler asequible', 'en esta legislatura'),
    ('2.1', 'Ayudas especiales a los pequeños municipios', 'A corto y medio plazo', 'Que los pequeños municipios alcancen el 20 % de vivienda pública', 'a corto y medio plazo'),
    ('3.1', 'Elaborar un Plan de Modernización', '2035', 'Plan de Modernización del Tren Convencional de Aragón', 'hasta 2035'),
    ('3.2', 'Finalización de la redacción de los proyectos pendientes', 'De inmediato', 'Licitar las obras de la A-68 en Aragón', 'licitación inmediata'),
    ('3.2', 'Ejecución inmediata de las obras de mejora de curvas', 'De inmediato', 'Obras de mejora de curvas de la N-211 en Valmayor', 'Ejecución inmediata'),
    ('3.2', 'Culminación viaria del Pirineo', '2030', 'Terminar las autovías A-21 y A-23 en Aragón', 'antes de 2030'),
    ('4.1', 'Crear una empresa pública de energía aragonesa', 'Al acabar las concesiones', 'Pasar a la empresa pública las hidroeléctricas cuando venzan sus concesiones', 'conforme vayan finalizando las concesiones'),
    ('5.2', 'Exigimos transparencia y control', 'De inmediato', 'Transponer las directivas europeas sobre consumo energético e hídrico de los centros de datos', 'de forma inmediata'),
    ('7.1', 'Implantar de forma inmediata el Mecanismo Rural', 'De inmediato', 'Mecanismo Rural de Garantía', 'de forma inmediata'),
    ('7.1', 'Aprobar en el primer periodo de sesiones', 'Primer periodo de sesiones', 'Ley del Estatuto Básico de los Municipios de Menor Población', 'primer periodo de sesiones'),
    ('10.1', 'Impulsar la colaboración de todas las administraciones', '2028', 'Bicentenario del fallecimiento de Goya', 'de cara a 2028'),
]
ORDEN_PLAZOS = ['De inmediato', 'Primer periodo de sesiones', 'En la legislatura', 'A corto y medio plazo', '2028', '2030', '2035', 'Al acabar las concesiones']
DEROGA = []

LEAD_FONTS = ('Bold', 'Expanded')

# La Agenda no titula sus propuestas: el título es la primera frase, cortada en la primera coma o nexo
# que deje entre MIN_TITULO y MAX_TITULO caracteres; si no hay, se recorta con «…».
MIN_TITULO, MAX_TITULO = 58, 105
CORTES = [r', ', r': ', r' para ', r' con ', r' que ', r' mediante ', r' dejando ', r' de modo ', r' así como ',
          r' y seguir ', r' al suponer ', r' en coherencia ', r' como ', r' destinada ', r' destinado ']


def limpiar(texto):
    return re.sub(r'\s+', ' ', texto).strip()


def leer_lineas(documento):
    """Líneas del PDF con su clase: D (portada de bloque), H (epígrafe), T (texto) o BLANK."""
    filas = []
    for numero, pagina in enumerate(documento, start=1):
        lineas = []
        for bloque in pagina.get_text('dict')['blocks']:
            if bloque['type'] != 0:
                continue
            for linea in bloque['lines']:
                spans = [s for s in linea['spans'] if s['text'].strip()]
                lineas.append((linea['bbox'][1], linea['bbox'][0], linea['bbox'][2],
                               ''.join(s['text'] for s in linea['spans']), spans))
        lineas.sort(key=lambda r: (round(r[0]), r[1]))
        for _y, x, x1, texto, spans in lineas:
            if not spans:
                filas.append({'pagina': numero, 'tipo': 'BLANK', 'x': x, 'x1': x1, 'texto': '', 'lead': ''})
                continue
            tamano = max(s['size'] for s in spans)
            todo_expanded = all('Expanded' in s['font'] for s in spans)
            tipo = 'D' if tamano >= 20 else ('H' if todo_expanded else 'T')
            lead = ''
            for s in spans:
                if any(f in s['font'] for f in LEAD_FONTS):
                    lead += s['text']
                else:
                    break
            filas.append({'pagina': numero, 'tipo': tipo, 'x': x, 'x1': x1, 'texto': limpiar(texto), 'lead': limpiar(lead)})
    return filas


def une(lineas):
    """Une las líneas de un párrafo: palabras cortadas con guion y espacio entre líneas."""
    texto = ''
    for linea in lineas:
        if re.search(r'[A-Za-zÁÉÍÓÚáéíóúñÑ]-$', texto):
            texto = texto + linea      # «Zaragoza-Monzón-» + «Binéfar-Lleida»: compuesto, sin espacio
        else:
            texto = (texto + ' ' + linea).strip()
    return limpiar(texto)


def parrafos(filas):
    """Párrafos del cuerpo (páginas 4 en adelante): portadas de bloque, epígrafes y textos."""
    items = []
    cur = None

    def cerrar():
        nonlocal cur
        if cur:
            items.append(cur)
            cur = None

    for fila in filas:
        if fila['pagina'] < 4 or fila['pagina'] > 38:
            continue
        tipo = fila['tipo']
        if tipo == 'D':
            cerrar()
            items.append({'tipo': 'D', 'pagina': fila['pagina'], 'lineas': [fila['texto']]})
            continue
        if tipo == 'BLANK':
            cerrar()
            continue
        if tipo == 'H':
            if cur and cur['tipo'] == 'T' and not cur['lineas'][-1].endswith(('.', ':')):
                cur['lineas'].append(fila['texto'])      # énfasis en medio de una propuesta
                continue
            if cur and cur['tipo'] == 'H':
                cur['lineas'].append(fila['texto'])
            else:
                cerrar()
                cur = {'tipo': 'H', 'pagina': fila['pagina'], 'lineas': [fila['texto']]}
            continue
        # texto normal
        if cur and cur['tipo'] == 'T':
            ultima = cur['lineas'][-1]
            if ultima.endswith(('.', ':')) and fila['texto'][:1].isupper() and cur['ultimo_ancho'] < 400 and fila['x'] <= 75:
                cerrar()
        elif cur and cur['tipo'] == 'H':
            cerrar()
        if cur is None:
            cur = {'tipo': 'T', 'pagina': fila['pagina'], 'lineas': [], 'lead': fila['lead'], 'ultimo_ancho': 0}
        cur['lineas'].append(fila['texto'])
        cur['ultimo_ancho'] = fila['x1'] - fila['x']
    cerrar()

    # Continuaciones: un texto que empieza en minúscula tras un salto de página sigue al anterior.
    unidos = []
    for item in items:
        if item['tipo'] == 'T' and unidos and unidos[-1]['tipo'] == 'T' and item['lineas'][0][:1].islower() \
                and item['pagina'] != unidos[-1]['pagina']:
            unidos[-1]['lineas'] += item['lineas']
            continue
        unidos.append(item)

    # Un epígrafe que continúa en el texto siguiente («… defensa de la red» + «pública. Tomar medidas…»).
    resultado = []
    i = 0
    while i < len(unidos):
        item = unidos[i]
        if item['tipo'] == 'H' and i + 1 < len(unidos) and unidos[i + 1]['tipo'] == 'T' \
                and unidos[i + 1]['lineas'][0][:1].islower() and not item['lineas'][-1].endswith('.'):
            siguiente = unidos[i + 1]
            primera = limpiar(' '.join(siguiente['lineas'])).split('. ')[0]
            lead = limpiar(' '.join(item['lineas']) + ' ' + primera)
            resultado.append({'tipo': 'T', 'pagina': item['pagina'], 'lineas': item['lineas'] + siguiente['lineas'],
                              'lead': lead})
            i += 2
            continue
        if item['tipo'] == 'H' and item['lineas'][-1].endswith('.'):
            item = {'tipo': 'T', 'pagina': item['pagina'], 'lineas': item['lineas'], 'lead': ''}   # destacado, es texto
        resultado.append(item)
        i += 1
    return resultado


def es_introduccion(texto):
    return any(texto.startswith(inicio) for inicio in INTRODUCCIONES)


def estructura(filas):
    """Bloques, secciones (con subapartados) y propuestas en bruto."""
    bloques, secciones, propuestas = {}, [], []
    bloque = seccion = None
    subapartado = None
    lema_actual = None
    antes_de_epigrafe = False

    for item in parrafos(filas):
        if item['tipo'] == 'D':
            if re.fullmatch(r'\d{1,2}', item['lineas'][0]):
                numero = int(item['lineas'][0])
                bloque = {'id': numero, 'pagina': item['pagina'], 'lema': [], 'intro': []}
                bloques[numero] = bloque
                seccion = subapartado = None
                antes_de_epigrafe = True
            else:
                bloque['lema'].append(item['lineas'][0])
            continue

        texto = une(item['lineas'])
        if item['tipo'] == 'H':
            titulo = texto
            antes_de_epigrafe = False
            if titulo in SUBAPARTADOS_DE_FERROCARRIL and seccion is not None and bloque['id'] == 3:
                seccion['subapartados'].append({'titulo': titulo, 'intro': []})
                subapartado = len(seccion['subapartados']) - 1
                continue
            seccion = {'id': f"{bloque['id']}.{sum(1 for s in secciones if s['bloque'] == bloque['id']) + 1}",
                       'bloque': bloque['id'], 'titulo': titulo, 'intro': [], 'pagina': item['pagina'],
                       'subapartados': []}
            secciones.append(seccion)
            subapartado = None
            continue

        if es_introduccion(texto):
            if antes_de_epigrafe or seccion is None:
                bloque['intro'].append(texto)
            else:
                seccion['intro'].append(texto)
            continue

        if seccion is None:
            if bloque['id'] not in SECCION_IMPLICITA:
                raise ValueError(f"Propuesta sin sección en el bloque {bloque['id']}: {texto[:60]!r}")
            seccion = {'id': f"{bloque['id']}.1", 'bloque': bloque['id'], 'titulo': SECCION_IMPLICITA[bloque['id']],
                       'intro': [], 'pagina': item['pagina'], 'subapartados': []}
            secciones.append(seccion)
            subapartado = None
        antes_de_epigrafe = False
        propuestas.append({'bloque': bloque['id'], 'seccion': seccion['id'], 'pagina': item['pagina'],
                           'subapartado': subapartado, 'texto': texto, 'lead': item.get('lead', '')})
    return bloques, secciones, propuestas


def titulo_de(propuesta):
    """Rótulo de la propuesta (negrita inicial) o, si no lo tiene, su primera frase recortada."""
    texto, lead = propuesta['texto'], propuesta['lead']
    for seccion, inicio, titulo in TITULOS:
        if propuesta['seccion'] == seccion and texto.startswith(inicio):
            return titulo
    if lead and 8 <= len(lead) <= 130 and texto.startswith(lead[:20]):
        return lead.rstrip(' .,:;')
    rotulo = re.match(r'^([^:.]{8,110}):\s', texto)
    if rotulo:
        return rotulo.group(1).strip()
    frase = re.split(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])', texto)[0].strip().rstrip('.:;')
    if len(frase) > MAX_TITULO:
        corte = None
        for separador in CORTES:
            for encontrado in re.finditer(separador, frase):
                if MIN_TITULO <= encontrado.start() <= MAX_TITULO and (corte is None or encontrado.start() > corte):
                    corte = encontrado.start()
        if corte is not None:
            frase = frase[:corte].rstrip(' ,;:')
        else:
            frase = frase[:MAX_TITULO].rsplit(' ', 1)[0].rstrip(' ,;:') + '…'
    return frase


def coincidencias(texto, patrones):
    return [clave for clave, patron in patrones.items() if re.search(patron, texto, re.IGNORECASE)]


def categoria_de(seccion, texto):
    for sec, inicio, categoria in CATEGORIA_MEDIDA:
        if sec == seccion and texto.startswith(inicio):
            return categoria
    return CATEGORIA[seccion]


def buscar(medidas, seccion, inicio):
    candidatas = [m for m in medidas if m['seccion'] == seccion and m['texto'].startswith(inicio)]
    if len(candidatas) != 1:
        raise ValueError(f'«{inicio}» en la sección {seccion}: {len(candidatas)} coincidencias')
    return candidatas[0]


def frase_con(texto, prueba):
    for parte in re.split(r'(?<=[.!?])\s+', texto):
        if prueba in parte:
            return parte.strip()
    return prueba


def crear_programa(pdf):
    documento = pymupdf.open(pdf)
    filas = leer_lineas(documento)
    bloques_pdf, secciones_pdf, propuestas = estructura(filas)

    if len(bloques_pdf) != TOTAL_BLOQUES:
        raise ValueError(f'{len(bloques_pdf)} bloques, se esperaban {TOTAL_BLOQUES}')
    if len(secciones_pdf) != TOTAL_SECCIONES:
        raise ValueError(f'{len(secciones_pdf)} secciones, se esperaban {TOTAL_SECCIONES}')
    if len(propuestas) != TOTAL_MEDIDAS:
        raise ValueError(f'{len(propuestas)} propuestas, se esperaban {TOTAL_MEDIDAS}')

    # La presentación (página 3) va toda en la fuente Expanded: se lee sin mirar la clase de la línea.
    presentacion = limpiar(' '.join(l['texto'] for l in filas if l['pagina'] == 3 and l['tipo'] != 'BLANK' and l['texto']))

    bloques = []
    for numero in range(1, TOTAL_BLOQUES + 1):
        b = bloques_pdf[numero]
        nombre = BLOQUES[numero]
        bloques.append({
            'id': numero,
            'titulo': nombre,
            'tituloMayus': nombre.upper(),
            'lema': une(b['lema']),
            'cita': '',
            'intro': '\n\n'.join(b['intro']),
            'pagina': b['pagina'],
        })

    secciones = []
    for s in secciones_pdf:
        secciones.append({
            'id': s['id'],
            'bloque': s['bloque'],
            'titulo': s['titulo'],
            'tituloFrase': s['titulo'],
            'intro': '\n\n'.join(s['intro']),
            'pagina': s['pagina'],
            'subapartados': [{'titulo': t['titulo'], 'intro': ''} for t in s['subapartados']],
        })

    medidas = []
    for n, p in enumerate(propuestas, start=1):
        if p['seccion'] not in CATEGORIA:
            raise ValueError(f"Falta la categoría de la sección {p['seccion']}")
        titulo = titulo_de(p)
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
            'categoria': categoria_de(p['seccion'], p['texto']),
            'colectivos': coincidencias(completo, COLECTIVOS),
            'palancas': coincidencias(completo, PALANCAS),
            'territorios': coincidencias(completo, TERRITORIOS),
            'cifras': [],
            'plazo': None,
            'deroga': None,
        })

    for seccion, inicio, ley in DEROGA:
        medida = buscar(medidas, seccion, inicio)
        if not re.search(r'derog', medida['texto'], re.I):
            raise ValueError(f'La propuesta que deroga «{ley}» no dice «derogar»')
        medida['deroga'] = ley

    cifras = []
    for seccion, inicio, valor, unidad, texto, prueba in CIFRAS:
        medida = buscar(medidas, seccion, inicio)
        if prueba not in medida['texto']:
            raise ValueError(f'La cifra «{valor}» no aparece en «{inicio}»: «{prueba}»')
        cifras.append({'valor': valor, 'unidad': unidad, 'texto': texto, 'contexto': prueba, 'medida': medida['n']})
        frase = frase_con(medida['texto'], prueba)
        if frase not in medida['cifras']:
            medida['cifras'].append(frase)

    plazos = []
    for seccion, inicio, plazo, texto, prueba in PLAZOS:
        medida = buscar(medidas, seccion, inicio)
        if prueba not in medida['texto']:
            raise ValueError(f'El plazo «{plazo}» no aparece en «{inicio}»: «{prueba}»')
        medida['plazo'] = plazo
        plazos.append({'plazo': plazo, 'texto': texto, 'medida': medida['n']})

    return {
        'id': ID,
        'partido': 'Chunta Aragonesista-Frente Amplio Aragón',
        'siglas': 'CHA-FA',
        'color': '#a7513a',
        'colorClaro': '#d7b1a6',
        'comunidad': 'Aragón',
        'programa': 'Agenda Aragonesa',
        'subtitulo': f'{len(medidas)} propuestas en {len(bloques)} bloques: autogobierno y financiación, vivienda, ferrocarril y carreteras, '
                     'energía y territorio, agua, medio rural y derechos sociales',
        'elecciones': 'Elecciones generales · 29 de noviembre de 2026',
        'observaciones': [
            'El PDF se facilitó a la redacción en exclusiva: la Agenda Aragonesa complementa el programa de Frente Amplio y '
            'no figuraba en la web oficial (frenteamplio.info/programa), que es el enlace de la fuente. La fecha es la del día '
            'en que se recibió: el PDF no trae fecha.',
            'La Agenda no numera ni titula sus propuestas: cada párrafo que propone algo es una propuesta. Los párrafos de '
            'contexto o que presentan una lista no se cuentan. El título corto es el rótulo en negrita con que empieza la '
            'propuesta, si lo tiene, o un resumen editorial de su primera frase (79 de 146 están escritos a mano); los nombres de '
            'los bloques y de las secciones sin epígrafe también son editoriales: el PDF solo tiene número y lema.',
            'Los bloques 2, 9 y 10 no tienen epígrafes y el 5 empieza con propuestas sin epígrafe: se agrupan en una sección '
            'única. El texto de la propuesta sobre «viviendas adecuadas» repite una frase tal como está en el PDF.',
        ],
        'pdf': PDF_PUBLICO,
        'fuentePdf': FUENTE,
        'paginas': len(documento),
        'fechaPdf': FECHA_PDF,
        'unidadMedida': 'propuesta',
        'unidadMedidas': 'propuestas',
        'presentacion': {'titulo': 'Presentación', 'texto': presentacion},
        'cifras': cifras,
        'plazos': plazos,
        'ordenPlazos': ORDEN_PLAZOS,
        'verbos': [],
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
