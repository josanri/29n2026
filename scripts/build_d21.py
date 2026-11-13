"""Build src/data/2026/generales/programas/d21.json for Democracia 21 (democracia21.es/#soluciones).

The four source PDFs have no shared layout, so the measures are listed here by hand.
Each measure text is a short summary of its PDF section. Each measure links to its PDF.

Usage: python scripts/build_d21.py src/data/2026/generales/programas/d21.json
"""
import json
import sys

SECTIONS = {
    "limpieza": {"bloque": 1, "pdf": "/programas/d21-espana-limpia-2026.pdf",
                 "titulo": "España Limpia", "tituloFrase": "Una limpieza política radical",
                 "intro": "Medidas contra el clientelismo, la corrupción y el reparto de cargos, y para devolver el control a la ciudadanía."},
    "vivienda": {"bloque": 2, "pdf": "/programas/d21-vivienda-2026.pdf",
                 "titulo": "Vivienda, prioridad nº1",
                 "tituloFrase": "Alivio hoy. Solución para siempre: un plan de choque en dos fases",
                 "intro": "Fase 1: medidas excepcionales de alivio inmediato. Fase 2: un Plan Nacional de Barrios a 10 años."},
    "educacion": {"bloque": 2, "pdf": "/programas/d21-educacion-2026.pdf",
                  "titulo": "La educación en el centro", "tituloFrase": "Una educación para el siglo 21",
                  "intro": "Medidas sobre tecnología, convivencia, docencia, universidad y formación profesional."},
    "sanidad": {"bloque": 2, "pdf": "/programas/d21-sanidad-2026.pdf",
                "titulo": "Sanidad pública: cuidar a quienes nos cuidan",
                "tituloFrase": "Que cada euro salve vidas",
                "intro": "Gestión eficiente, dignidad para los profesionales y especialización con inteligencia artificial."},
}

# (título, categoría, sección, página, texto, plazo)
MEASURES = [
    # España Limpia
    ("Punto y final al tsunami de asesores", "administracion", "limpieza", 3,
     "Los ministros tendrán como máximo 4 asesores, los vicepresidentes 7 y el gabinete del Presidente 20. Los asesores no tendrán chóferes ni otras prebendas, y sus datos serán públicos.", None),
    ("Fuera cargos de carnet y delito de enchufismo", "administracion", "limpieza", 3,
     "Todos los cargos de la Administración y de las empresas públicas se asignarán por mérito y capacidad. El enchufismo será delito. Los nombramientos existentes se revisarán en un plazo de 6 meses.", "6 meses"),
    ("No más impuestos revolucionarios para los partidos políticos", "democracia", "limpieza", 4,
     "Se prohíbe que parlamentarios, cargos públicos y asesores paguen a los partidos un porcentaje de su sueldo.", None),
    ("Nuevos juzgados especializados en corrupción", "justicia", "limpieza", 5,
     "Se crearán juzgados especializados en corrupción, con medios suficientes. Un órgano revisará cada dos meses los procedimientos impugnados. Los casos de políticos se juzgarán en una comunidad autónoma vecina.", None),
    ("El mismo control para el político que para el ciudadano", "administracion", "limpieza", 5,
     "La IGAE tendrá los mismos medios tecnológicos, de cruce de datos e inteligencia artificial que la Agencia Tributaria. Sus funcionarios tendrán pluses ligados a resultados de control.", None),
    ("Fiscalía y Oficina Anticorrupción, más fuertes que nunca", "justicia", "limpieza", 6,
     "Se doblarán los recursos de la Fiscalía Anticorrupción. Una Oficina Anticorrupción con poder de inspección podrá sancionar hasta el 10 % del volumen de negocios. Los fondos recuperados por corrupción irán a combatirla.", None),
    ("Los corruptos no tendrán refugio", "justicia", "limpieza", 6,
     "Será delito camuflar la corrupción. Todo cargo público que no denuncie irregularidades tendrá responsabilidad penal. La contratación pública tendrá un control basado en inteligencia artificial.", None),
    ("Los partidos políticos no saldrán impunes", "democracia", "limpieza", 7,
     "Los partidos responderán civilmente por los delitos de corrupción de sus dirigentes, salvo que demuestren controles anuales auditados. Se suspenderá la financiación pública de un partido con dirigentes investigados por corrupción.", None),
    ("Quien robe a lo público, no volverá nunca a lo público", "justicia", "limpieza", 7,
     "Los delitos de corrupción no prescribirán. Todo político condenado por sentencia firme por corrupción será inelegible e inhabilitado de por vida.", None),
    ("Un Consejo General del Poder Judicial despolitizado", "justicia", "limpieza", 8,
     "Los vocales judiciales serán elegidos por los jueces, sin intervención de las asociaciones judiciales. Los vocales no judiciales comparecerán en el Congreso antes de ser votados.", None),
    ("Una fiscalía independiente", "justicia", "limpieza", 8,
     "El Congreso elegirá una terna por mayoría de tres quintos. El Gobierno elegirá al Fiscal General entre esa terna, previo informe del CGPJ.", None),
    ("Unos organismos de control independientes", "democracia", "limpieza", 8,
     "Los organismos independientes se nombrarán con comparecencia pública y mayoría de tres quintos. Si el Congreso bloquea un nombramiento más de tres meses, se elegirá por sorteo entre los candidatos.", "3 meses"),
    ("Todos fuera", "justicia", "limpieza", 9,
     "Se eliminarán los aforamientos no previstos en la Constitución. Se reformará la Constitución para quitar el aforamiento de diputados y senadores, y limitarlo para el Gobierno a las acciones penales por funciones del cargo.", None),
    ("Escuchar será obligatorio", "democracia", "limpieza", 10,
     "Diputados y senadores deberán dedicar una jornada cada dos semanas a reuniones abiertas con ciudadanos. El Presidente del Gobierno se someterá cada año a una asamblea ciudadana elegida por sorteo.", None),
    ("No más bloqueos", "democracia", "limpieza", 10,
     "Si los partidos bloquean de forma reiterada asuntos de orden mayor, la ciudadanía podrá activar una Asamblea Ciudadana con firmas del 1 % del censo. Sus propuestas se someterán a referéndum consultivo.", "12 meses"),
    ("Si no trabajan, no cobran", "democracia", "limpieza", 10,
     "Diputados y senadores no cobrarán su sueldo mensual si no asisten a las sesiones plenarias y de comisión, salvo por enfermedad o fuerza mayor. Las ausencias se publicarán cada mes.", None),
    ("No habrá gobierno sin presupuestos", "administracion", "limpieza", 11,
     "Si el Gobierno no presenta los Presupuestos Generales del Estado, se suspenderá el sueldo de todo el Gobierno. Si el incumplimiento dura más de un año, el Gobierno cesará.", "1 año"),
    ("Menos promesas, más resultados", "administracion", "limpieza", 11,
     "Los programas de gasto se evaluarán. Cada Ministerio explicará qué prometió, qué recursos usó y qué resultados obtuvo. Un Portal de Evaluación será accesible para toda la ciudadanía.", None),
    ("Código ético de Gobierno obligatorio", "administracion", "limpieza", 12,
     "Los cargos políticos cumplirán el Código Ético del Gobierno de España. Una Comisión Ética y un experto independiente vigilarán su cumplimiento.", None),
    ("Ocho años como máximo", "democracia", "limpieza", 12,
     "Nadie podrá ejercer el mismo cargo público durante más de dos mandatos completos o más de ocho años en total.", None),
    ("Adiós listas cerradas, hola listas flexibles", "democracia", "limpieza", 13,
     "Se reformará la Ley Electoral para reducir el peso de las listas cerradas. Se introducirán listas desbloqueadas y listas abiertas, para que los ciudadanos elijan a sus representantes.", None),
    # Vivienda
    ("Pacto de reconciliación del alquiler: limitación temporal de precios", "vivienda", "vivienda", 4,
     "Se limitarán de forma general y temporal los alquileres en zonas tensionadas, con el índice estatal SERPAVI. La medida se levantará de forma gradual cuando aumente la oferta de vivienda.", None),
    ("Justicia especializada en 90 días y fin a la inquiokupación", "justicia", "vivienda", 4,
     "Se creará un servicio de mediación de arrendamientos gratuito y vinculante, con resolución máxima en 30 días. Los juzgados de arrendamientos resolverán en 60 días más. Firmar un contrato con intención de impago será estafa.", "30 días"),
    ("Garantía pública de alquiler", "vivienda", "vivienda", 4,
     "El Servicio Social de Garantía de Arrendamientos asegurará el cobro del alquiler al propietario si un inquilino vulnerable no tiene alternativa habitacional de la Administración.", None),
    ("Vigilancia del alquiler por habitaciones y falsos contratos temporales", "vivienda", "vivienda", 5,
     "El alquiler por habitaciones se incorporará a la Ley de Arrendamientos Urbanos, con estándares de habitabilidad. Los contratos se cruzarán con el padrón municipal para evitar falsos alquileres temporales.", None),
    ("Fondo Soberano de Vivienda Protegida y 10.000 M€ de fondos europeos", "vivienda", "vivienda", 5,
     "Se reasignarán a un Fondo Público Soberano de Vivienda los fondos europeos no ejecutados o en riesgo de devolución. El fondo solo financiará vivienda protegida y asequible.", None),
    ("Cero impuestos en la compra para menores de 35 años", "vivienda", "vivienda", 5,
     "Se eliminarán el IVA, el ITP y el AJD en la compra de vivienda habitual para menores de 35 años, hasta un máximo de 400.000 €.", None),
    ("Rebaja excepcional de impuestos en la compra de vivienda habitual", "fiscalidad", "vivienda", 5,
     "El ITP se fijará en un tipo único del 2 % y el AJD en el 0 %. El IVA superreducido del 4 % se aplicará a la compra de vivienda habitual, hasta 400.000 €.", None),
    ("Alivio fiscal para el alquiler asequible", "fiscalidad", "vivienda", 5,
     "Habrá bonificaciones en el IRPF y reducciones en el IBI para los propietarios que pongan sus viviendas en alquiler asequible.", None),
    ("Rehabilitación a cambio de usufructo temporal", "vivienda", "vivienda", 6,
     "La Administración avalará acuerdos de usufructo temporal. Empresas rehabilitadoras reformarán viviendas antiguas a cambio de alquilarlas a precio asequible durante un tiempo pactado.", None),
    ("Recargo para compradores no residentes y competencia justa en vivienda turística", "fiscalidad", "vivienda", 6,
     "Se aplicará un recargo mínimo del 10 % a la compra de vivienda no habitual por inversores extracomunitarios. Las comunidades podrán subirlo hasta el 25 %. El alquiler turístico de corta estancia tendrá el IVA general del 10 %.", None),
    ("Colaboración público-privada a escala industrial", "vivienda", "vivienda", 7,
     "El suelo público se cederá mediante concesiones o derechos de superficie a 75 años. Empresas públicas y privadas construirán barrios de mil viviendas, con el Fondo Soberano de Vivienda.", None),
    ("Barrios completos y política industrial a 10 años", "vivienda", "vivienda", 7,
     "Los barrios integrarán transporte público, colegios, centros de salud y zonas verdes. Una demanda pública estable durante una década permitirá industrializar la construcción.", "10 años"),
    ("IVA superreducido del 4 % para la construcción de vivienda asequible", "fiscalidad", "vivienda", 8,
     "Se aplicará el IVA del 4 % a la obra nueva o a la rehabilitación integral destinada a vivienda asequible. También se reducirán tasas municipales, ICIO y plusvalías.", None),
    ("Responsabilidad municipal vinculante", "administracion", "vivienda", 8,
     "Si un Ayuntamiento retiene suelo público, paraliza proyectos o bloquea licencias, su competencia urbanística pasará a la Comunidad Autónoma de forma automática.", None),
    ("Licencias de obra mayor en 30 días", "administracion", "vivienda", 8,
     "Los Ayuntamientos tendrán 30 días para revisar las licencias de obra mayor. Si no cumplen el plazo, la solicitud pasará a una Oficina Central Autonómica de Urbanismo.", "30 días"),
    ("Supresión de licencias para obra menor", "administracion", "vivienda", 8,
     "Las obras menores que no requieran proyecto arquitectónico no necesitarán licencia previa. Bastará una declaración responsable digital.", None),
    ("Ley urgente de desbloqueo urbanístico", "administracion", "vivienda", 9,
     "Un defecto formal no anulará un Plan General de Ordenación Urbana. Habrá silencio administrativo positivo de tres meses para autorizaciones sectoriales.", "3 meses"),
    ("Desbloqueo de suelo público retenido e incentivos al sector privado", "vivienda", "vivienda", 9,
     "Las Administraciones y empresas públicas deberán auditar y liberar su suelo parado. Los propietarios que activen parcelas para vivienda asequible tendrán bonificaciones en la plusvalía y el IBI.", None),
    ("Portal Nacional de Trazabilidad Urbanística", "democracia", "vivienda", 9,
     "Una plataforma pública mostrará en tiempo real el estado legal, las licencias y los bloqueos de cada desarrollo urbanístico. Incluirá un canal para denunciar bloqueos injustificados.", None),
    # Educación
    ("Una educación para el siglo 21: tecnología en el currículo", "educacion", "educacion", 2,
     "La tecnología será un pilar del currículo: fundamentos de inteligencia artificial, ciberseguridad, ética digital y pensamiento computacional, con convivencia entre lo analógico y lo digital.", None),
    ("Inteligencia artificial educativa", "educacion", "educacion", 2,
     "Se desarrollará un modelo de inteligencia artificial propio para la educación, financiado y auditado por el Estado. Actuará como tutor de refuerzo personalizado y protegerá la privacidad.", None),
    ("Saber comunicar será una prioridad absoluta", "educacion", "educacion", 3,
     "Un programa transversal enseñará a estructurar ideas, argumentar, debatir y hablar en público en todas las asignaturas.", None),
    ("Educación económica para la vida", "educacion", "educacion", 3,
     "Se creará una materia obligatoria de Cultura Económica y Financiera en la ESO, con economía personal, social y profesional.", None),
    ("Respeto, corresponsabilidad y convivencia escolar", "educacion", "educacion", 3,
     "Se acordarán compromisos entre docentes, alumnos y familias al inicio de cada curso. Habrá un Premio Nacional a los centros que fomenten la convivencia y una caja de herramientas pública.", None),
    ("Aprendizaje práctico en el mundo real", "educacion", "educacion", 3,
     "Los negocios locales dedicarán al menos una jornada al año a tener contacto con los estudiantes, mediante visitas, retos o micro-prácticas.", None),
    ("Objetivo PISA: España en el top 10 europeo", "educacion", "educacion", 3,
     "Un Plan Estatal Educativo llevará a España al top 10 europeo en matemáticas, comprensión lectora y ciencias. Se reforzarán las materias instrumentales y los métodos avalados por la evidencia.", "8 años"),
    ("Nuevas especialidades", "educacion", "educacion", 4,
     "Se restablecerán las menciones de Matemáticas, Lengua y Ciencias en el grado de Educación, y se creará una especialidad en Tecnología. Habrá formación continua para acreditar a los docentes actuales.", None),
    ("Educación infantil (0-3 años) como primer ascensor social", "educacion", "educacion", 4,
     "La etapa 0-3 será pedagógica. Se revalorizarán los educadores infantiles, se revisarán las ratios y se incorporará la pareja educativa de apoyo en el aula.", None),
    ("Plan de renovación de infraestructuras educativas", "educacion", "educacion", 4,
     "Un plan estatal rehabilitará colegios e institutos públicos, con eficiencia energética, climatización y la eliminación definitiva de los barracones.", None),
    ("Sistema de medición para el apoyo educativo", "educacion", "educacion", 4,
     "Se evaluarán los conocimientos a nivel nacional. Las comunidades que caigan más de dos puntos por debajo de la media recibirán apoyo estatal. Un Índice Socioeducativo determinará la financiación de cada centro.", None),
    ("Escudos de apoyo docente", "educacion", "educacion", 5,
     "Los centros con más necesidades recibirán Equipos Permanentes de Refuerzo, con educadores sociales, orientadores y profesores de lenguas extranjeras.", None),
    ("Reconocer el mérito y el esfuerzo", "educacion", "educacion", 5,
     "Se codiseñará con los docentes un nuevo modelo de carrera profesional que deje atrás la antigüedad como único criterio de progreso.", None),
    ("Pruebas de acceso a las facultades de educación", "educacion", "educacion", 5,
     "Los aspirantes a los grados de Educación pasarán pruebas de competencia comunicativa, comprensión lectora, expresión escrita y perfil vocacional.", None),
    ("MIR educativo", "educacion", "educacion", 5,
     "Se implantará un periodo de dos años de formación práctica remunerada en colegios e institutos, guiado por profesores en activo.", None),
    ("Profesionalizar y respaldar la dirección educativa", "educacion", "educacion", 5,
     "La dirección de los centros tendrá formación específica, remuneración acorde a su responsabilidad y apoyo administrativo e institucional.", None),
    ("Grados flexibles e interuniversitarios", "educacion", "educacion", 6,
     "Se implantará un primer curso optativo común por ramas de conocimiento. Los grados combinarán microcredenciales, menciones flexibles e itinerarios con otras universidades.", None),
    ("Aprendizaje práctico en la universidad", "educacion", "educacion", 6,
     "Todos los títulos incorporarán prácticas tutorizadas. Se eliminarán trabas burocráticas y se incentivará a las empresas que ofrezcan prácticas con garantías de remuneración y supervisión.", None),
    ("Expansión internacional", "educacion", "educacion", 6,
     "Se apoyarán los acuerdos entre universidades públicas para abrir campus internacionales, sobre todo en países de habla hispana.", None),
    ("Becas que lleguen a tiempo en septiembre", "educacion", "educacion", 6,
     "Las becas se pagarán al inicio del curso. Se unificarán los calendarios académicos antes del verano y la revisión de la renta corresponderá al Ministerio de Hacienda.", None),
    ("Comparador público de titulaciones", "educacion", "educacion", 7,
     "Una plataforma estatal mostrará, por grado y universidad, la satisfacción estudiantil, la inserción laboral a 1, 3 y 5 años y los salarios de los egresados.", None),
    ("Talento docente y sexenio de innovación docente", "educacion", "educacion", 7,
     "La contratación de profesorado tendrá estándares internacionales y tribunales independientes. Se creará un sexenio de innovación docente con impacto salarial.", None),
    ("Atracción y estabilidad del talento docente en FP", "educacion", "educacion", 7,
     "Se dará prioridad a la experiencia técnica en las bolsas docentes de FP. Habrá un complemento salarial para retener profesionales en especialidades críticas.", None),
    ("Flexibilización de la FP y tutor compartido para las pymes", "educacion", "educacion", 7,
     "Las prácticas de FP pasarán al segundo curso. Se creará la figura del tutor compartido sectorial, financiado por la Administración, para ayudar a las pymes.", None),
    ("Créditos de retorno empresarial", "fiscalidad", "educacion", 8,
     "Las pymes y autónomos acumularán saldo por cada hora de mentoría certificada. Ese saldo se canjeará por deducciones fiscales, formación o puntuación en la contratación pública.", None),
    ("Financiación plurianual estratégica para las FP", "educacion", "educacion", 8,
     "La inversión en plazas, infraestructuras, materiales y profesorado se planificará a varios años, según el interés del alumnado, las necesidades de las empresas y los sectores estratégicos.", None),
    ("Hucha de formación para jóvenes", "educacion", "educacion", 8,
     "El Bono Cultural Joven y el Verano Joven se integrarán en una cuenta digital de unos 500 € por joven al cumplir 18 años, para formación y materiales de estudio.", None),
    # Sanidad
    ("Despolitización total de la dirección hospitalaria", "administracion", "sanidad", 2,
     "La dirección de hospitales y áreas de salud se cubrirá solo por concurso público de mérito y capacidad. Los mandatos se evaluarán según resultados y satisfacción.", None),
    ("Cero huecos perdidos: reasignación automática de citas y quirófanos", "sanidad", "sanidad", 2,
     "Un sistema automatizado detectará las cancelaciones previsibles y asignará el hueco al siguiente paciente en espera.", None),
    ("Rendimiento máximo de quirófanos y reinversión en listas de espera", "sanidad", "sanidad", 3,
     "Los quirófanos públicos abrirán por las tardes, con profesionales voluntarios bien pagados. Los ingresos extra se reinvertirán por ley en listas de espera, sueldos y tecnología.", None),
    ("Auditar, optimizar y reinvertir", "administracion", "sanidad", 3,
     "Una Red Sanitaria Compartida digitalizará los procesos de gestión. Una IA de auditoría continua, con supervisión humana, detectará ineficiencias y cuellos de botella.", "1 legislatura"),
    ("No más centros sanitarios fantasma", "sanidad", "sanidad", 3,
     "Se auditará la red de infraestructuras sanitarias. No se podrá abrir ningún centro sin presupuesto y plantilla médica garantizados.", None),
    ("Fin progresivo de las guardias de 24 horas", "sanidad", "sanidad", 3,
     "Los turnos se reducirán de forma progresiva a un máximo de 12 horas, empezando por los servicios más sobrecargados. Habrá unidades de respuesta rápida entre hospitales.", None),
    ("Reconocimiento del Grupo A1 y especialidades para enfermería", "sanidad", "sanidad", 3,
     "La enfermería tendrá la categoría del Grupo A1 por su titulación de Grado. Se ampliará el catálogo oficial de especialidades de enfermería.", None),
    ("Estatuto de la profesión médica para el siglo 21", "sanidad", "sanidad", 4,
     "Se elaborará, con los facultativos, un nuevo estatuto para la profesión médica. Garantizará autonomía organizativa, protegerá el tiempo de atención frente a la burocracia y una retribución acorde a su formación.", None),
    ("Auditoría de ratios y convergencia europea", "sanidad", "sanidad", 4,
     "Se auditarán las cargas de trabajo por comunidad y se adecuarán las ratios de médicos, enfermeros y TCAE a los estándares medios de la Unión Europea.", None),
    ("Bolsas de empleo del siglo 21 y fin a las penalizaciones abusivas", "sanidad", "sanidad", 4,
     "Los llamamientos telefónicos se sustituirán por plataformas digitales, con tiempo razonable para aceptar las ofertas. Se eliminarán las sanciones por rechazar contratos cortos o de alta complejidad.", None),
    ("Blindaje legal contra las agresiones", "seguridad", "sanidad", 4,
     "Una Ley Estatal de Protección del Personal Sanitario endurecerá las penas, impondrá órdenes de alejamiento inmediatas y creará un Registro Nacional de Agresores.", None),
    ("Bono fiscal para el retorno del talento sanitario", "fiscalidad", "sanidad", 4,
     "Los profesionales sanitarios españoles que trabajan en el extranjero tendrán deducciones en el IRPF durante tres años tras su vuelta al Sistema Nacional de Salud.", None),
    ("Tu historial clínico, contigo en cualquier parte de España", "sanidad", "sanidad", 5,
     "Un estándar común y obligatorio permitirá que cualquier profesional autorizado acceda al historial del paciente, con su tarjeta. El paciente decidirá quién lo consulta y verá cada acceso.", None),
    ("Triaje inteligente en tu móvil con lenguaje natural", "innovacion", "sanidad", 5,
     "Una aplicación de uso voluntario evaluará los síntomas por voz o chat, con un Comité Científico Médico. Indicará si conviene pedir cita en Atención Primaria o acudir a urgencias, y a qué hospital.", None),
    ("IA clínica para liberar tiempo", "innovacion", "sanidad", 5,
     "Asistentes de inteligencia artificial redactarán borradores de informes, altas y registros de enfermería. El profesional siempre los revisará y validará.", None),
    ("Red de hospitales monotemáticos y de proximidad", "sanidad", "sanidad", 5,
     "Se crearán redes de hospitales de referencia por área crítica y por procedimiento quirúrgico rutinario. Los hospitales generales y comarcales reforzarán la atención integral y las urgencias.", None),
    ("Monitorización domiciliaria y tele-enfermería proactiva", "sanidad", "sanidad", 6,
     "Los pacientes crónicos tendrán dispositivos conectados y seguimiento diario por enfermería. Algoritmos de alerta temprana evitarán ingresos urgentes.", None),
    ("Centro Nacional de Trasplantes para descongestionar los hospitales", "sanidad", "sanidad", 6,
     "Un Centro Nacional de Trasplantes, impulsado por la ONT, concentrará los trasplantes más complejos y liberará quirófanos en la red hospitalaria.", None),
]

# (valor, unidad, texto, título de la medida)
FIGURES = [
    ("4,5 %", "del PIB", "Coste anual de la corrupción, según el FMI", "Fiscalía y Oficina Anticorrupción, más fuertes que nunca"),
    ("250.000", "cargos", "Cargos y autoridades con un fuero judicial especial", "Todos fuera"),
    ("10.000", "M€", "Fondos europeos reasignados a vivienda protegida", "Fondo Soberano de Vivienda Protegida y 10.000 M€ de fondos europeos"),
    ("400.000", "€", "Tope de precio de la vivienda habitual para las rebajas de impuestos", "Cero impuestos en la compra para menores de 35 años"),
    ("850.000", "pacientes", "Pacientes que esperan una operación en listas de espera quirúrgica", "Rendimiento máximo de quirófanos y reinversión en listas de espera"),
    ("10.000", "profesionales", "Profesionales sanitarios que han emigrado en los últimos años", "Bono fiscal para el retorno del talento sanitario"),
    ("Top 10", "europeo", "Objetivo de posición de España en PISA", "Objetivo PISA: España en el top 10 europeo"),
]

BLOCKS = [
    {"id": 1, "titulo": "Una limpieza política radical",
     "lema": "La política, por fin, en el siglo que toca.",
     "cita": "",
     "intro": "El sistema político beneficia hoy a los políticos. Esta limpieza corta el clientelismo y la corrupción, despolitiza las instituciones y devuelve el control a la ciudadanía."},
    {"id": 2, "titulo": "Venimos a solucionar lo que de verdad importa",
     "lema": "Vivienda, educación y sanidad.",
     "cita": "",
     "intro": "Medidas detalladas en vivienda, educación en el centro y sanidad pública. Democracia 21 anunciará nuevas soluciones para el país."},
]


def build():
    numbered = []
    for index, (titulo, categoria, seccion, pagina, texto, plazo) in enumerate(MEASURES, start=1):
        numbered.append({
            "n": index,
            "bloque": SECTIONS[seccion]["bloque"],
            "seccion": seccion,
            "pagina": pagina,
            "subapartado": None,
            "titulo": titulo,
            "tituloFrase": titulo,
            "texto": texto,
            "oculta": False,
            "categoria": categoria,
            "colectivos": [],
            "palancas": [],
            "territorios": [],
            "cifras": [],
            "plazo": plazo,
            "deroga": None,
            "fuente": SECTIONS[seccion]["pdf"],
        })
    by_title = {measure["titulo"]: measure["n"] for measure in numbered}
    cifras = []
    for valor, unidad, texto, titulo in FIGURES:
        if titulo not in by_title:
            raise SystemExit(f"Cifra sin medida: {titulo}")
        cifras.append({"valor": valor, "unidad": unidad, "texto": texto, "medida": by_title[titulo]})
    plazos = [{"plazo": m["plazo"], "texto": m["titulo"], "medida": m["n"]} for m in numbered if m["plazo"]]
    orden = list(dict.fromkeys(item["plazo"] for item in plazos))
    secciones = [{
        "id": sid,
        "bloque": data["bloque"],
        "titulo": data["titulo"],
        "tituloFrase": data["tituloFrase"],
        "intro": data["intro"],
        "pagina": 2,
        "subapartados": [],
    } for sid, data in SECTIONS.items()]
    return {
        "id": "d21",
        "partido": "Democracia para el siglo 21",
        "siglas": "D21",
        "observaciones": [
            "El texto de cada medida es un resumen del PDF de su área. Cada medida enlaza a ese PDF.",
            "El programa se publica en cuatro documentos: España Limpia, Vivienda, Educación y Sanidad. Faltan los textos del bloque Modernización del país, que no tiene PDF.",
        ],
        "color": "#0A0B0D",
        "colorClaro": "#FFFD38",
        "programa": "Soluciones de Democracia 21",
        "subtitulo": f"{len(numbered)} medidas en {len(BLOCKS)} bloques",
        "elecciones": "Elecciones generales · 29 de noviembre de 2026",
        "pdf": "/programas/d21-espana-limpia-2026.pdf",
        "fuentePdf": "https://democracia21.es/#soluciones",
        "paginas": 36,
        "unidadMedida": "medida",
        "unidadMedidas": "medidas",
        "presentacion": {
            "titulo": "Una democracia que funcione para todos",
            "texto": (
                f"Democracia 21 propone {len(numbered)} medidas en dos bloques: una limpieza política "
                "radical y soluciones en vivienda, educación y sanidad. Cada ficha resume el PDF de su área."
            ),
        },
        "cifras": cifras,
        "plazos": plazos,
        "ordenPlazos": orden,
        "verbos": [],
        "bloques": BLOCKS,
        "secciones": secciones,
        "medidas": numbered,
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python scripts/build_d21.py <salida.json>")
    program = build()
    with open(sys.argv[1], "w", encoding="utf-8") as output:
        json.dump(program, output, ensure_ascii=False, indent=1)
    print(f"medidas {len(program['medidas'])}; bloques {len(program['bloques'])}; cifras {len(program['cifras'])}; plazos {len(program['plazos'])}")


if __name__ == "__main__":
    main()
