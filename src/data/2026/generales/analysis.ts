/**
 * Editorial reading of each program: key findings that summarize the analysis.
 * Each finding cites the measures it relies on. The text is in Spanish because it is site content.
 */
export interface KeyFinding {
  title: string;
  text: string;
  /** Numbers of the measures that support the finding. */
  measureNumbers: number[];
}

/** Key findings by program id. */
export const keyFindingsByParty: Record<string, KeyFinding[]> = {
  pp: [
    {
      title: 'La economía cotidiana ocupa casi la mitad',
      text:
        'El bloque 4, «Recuperar la ambición y la autoestima», reúne 106 de las 249 medidas (43 %). Es el bloque de vivienda, familia, empleo, impuestos, campo, educación, sanidad, energía y política exterior, y es donde el programa pone casi todas sus cifras.',
      measureNumbers: [144, 158, 177, 209, 219],
    },
    {
      title: 'Regenerar las instituciones pesa más que bajar impuestos',
      text:
        '«Instituciones y democracia» es la categoría con más medidas (27): Tribunal Constitucional, Fiscalía, CIS, RTVE, INE, Tribunal de Cuentas, prórrogas presupuestarias y control del Gobierno en las Cortes. Los impuestos tienen 8 medidas propias, aunque las rebajas fiscales aparecen también en vivienda, familia y empleo.',
      measureNumbers: [65, 67, 70, 75, 76, 78],
    },
    {
      title: 'Ley y orden: 40 medidas',
      text:
        'Seguridad ciudadana, justicia e inmigración suman 40 medidas. Endurecen el Código Penal (sedición, desórdenes públicos, multirreincidencia, prisión permanente revisable), refuerzan la frontera sur y limitan las regularizaciones y el arraigo.',
      measureNumbers: [17, 20, 21, 30, 36, 42],
    },
    {
      title: 'Vivienda: la apuesta más cuantificada',
      text:
        'Un millón de viviendas, IVA del 4 % para la primera vivienda de menores de 40 años, aval público del 20 %, la «Hucha Hogar Joven» con 2.000 € al año y desalojo de ocupas en 48 horas. Es la sección con más detalle numérico del programa.',
      measureNumbers: [144, 153, 154, 155, 157],
    },
    {
      title: 'Tres derogaciones explícitas',
      text:
        'El programa deroga la Ley de Amnistía, la Ley de Memoria Democrática (para aprobar una «Ley de Concordia») y la Ley de Vivienda. También recupera el delito de sedición y la agravante de ocultar el rostro.',
      measureNumbers: [60, 129, 145, 17, 22],
    },
    {
      title: 'Pocas fechas y ocho huecos en blanco',
      text:
        'Solo 13 medidas tienen un plazo explícito (100 días, 6 meses, 2029…), y 27 incluyen una cifra concreta. Ocho números del programa están reservados con el texto «Permanezca atento a la campaña para conocer esta nueva medida».',
      measureNumbers: [1, 228, 83, 109, 132],
    },
  ],
  salf: [
    {
      title: '119 propuestas repartidas en diez compromisos',
      text:
        'El contrato simplificado organiza sus propuestas en vivienda (10), seguridad (14), impuestos (14), inmigración (10), pensiones (10), sanidad (12), corrupción (15), empleo (10), educación (10) y geopolítica (14). La web asigna identificadores consecutivos porque el PDF reinicia la numeración en cada compromiso.',
      measureNumbers: [1, 11, 25, 39, 49, 59, 71, 86, 96, 106],
    },
    {
      title: 'Vivienda: diez medidas y varias rebajas de costes',
      text:
        'El bloque de vivienda propone, entre otras medidas, reducir el precio de la primera vivienda un 35 %, desalojar ocupaciones en 48 horas, avalar la entrada hipotecaria y eliminar el IBI.',
      measureNumbers: [1, 3, 7, 10],
    },
    {
      title: 'Seguridad: penas, policía y justicia rápida',
      text:
        'Las 14 propuestas de seguridad abarcan cumplimiento íntegro de penas, macrocárceles, expulsión de extranjeros condenados, refuerzo de las fuerzas de seguridad y juicios rápidos.',
      measureNumbers: [11, 12, 14, 17, 19, 20, 22, 24],
    },
    {
      title: 'Impuestos: exención de IRPF hasta 35.000 euros',
      text:
        'El compromiso fiscal reúne 14 medidas, entre ellas una exención de IRPF para los primeros 35.000 euros, la eliminación de la cuota de autónomos y cambios en Sociedades, IVA y tributos patrimoniales.',
      measureNumbers: [25, 28, 29, 30, 31, 32, 38],
    },
    {
      title: 'El contrato fija una comprobación en 2030',
      text:
        'La cláusula de penalización de la página 4 afirma que en junio de 2030 se compararán las 119 medidas del contrato con los votos de Alvise Pérez.',
      measureNumbers: [1, 119],
    },
  ],
  ie: [
    {
      title: 'Quince compromisos, no quince medidas aisladas',
      text:
        'El índice del contrato organiza sus propuestas en quince compromisos temáticos. La ficha agrupa cada capítulo como una unidad para mantener la estructura original, y enlaza el documento completo para consultar su desarrollo.',
      measureNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    },
    {
      title: 'Reformas institucionales y participación ciudadana',
      text:
        'Los primeros compromisos proponen cambios constitucionales y en la selección de instituciones, junto con ampliar la participación ciudadana y la acción popular.',
      measureNumbers: [1, 2, 3, 4],
    },
    {
      title: 'La economía incluye gasto, pensiones, autónomos y vivienda',
      text:
        'El bloque económico combina la reducción del gasto político y administrativo con reformas sobre subvenciones, pensiones, cuotas de autónomos y acceso a la vivienda.',
      measureNumbers: [6],
    },
    {
      title: 'Propuestas para inmigración, seguridad y justicia',
      text:
        'El contrato incluye cambios en extranjería y control fronterizo, un nuevo modelo policial y una reorganización de juzgados y oficinas judiciales.',
      measureNumbers: [7, 8, 11],
    },
    {
      title: 'Energía, sector primario y soberanía',
      text:
        'Los compromisos finales abordan el modelo energético, la protección del sector primario, las relaciones con organizaciones supranacionales y las libertades públicas.',
      measureNumbers: [5, 12, 13, 14, 15],
    },
  ],
  'mundo-mas-justo': [
    {
      title: '32 ejes y 191 propuestas',
      text:
        'El programa recorre 32 ámbitos temáticos. La ficha asigna números consecutivos a las 191 propuestas porque el documento reinicia la numeración en cada eje; cada una conserva el enlace a su página del PDF.',
      measureNumbers: [1, 12, 77, 106, 191],
    },
    {
      title: 'Vivienda: once propuestas',
      text:
        'El primer eje reúne propuestas sobre vivienda pública y asequible, suelo, alquileres, especulación, construcción, vivienda vacía y desahucios.',
      measureNumbers: [1, 2, 3, 4, 8, 11],
    },
    {
      title: 'El programa también concreta metas y plazos',
      text:
        'Además de las propuestas, varios ejes incluyen cuadros de compromisos medibles para 2026–2030. Esas cifras de seguimiento no se cuentan como propuestas adicionales.',
      measureNumbers: [1, 39, 77, 106, 191],
    },
  ],
  'eaj-pnv': [
    {
      title: 'Cinco ámbitos, seis propuestas en cada uno',
      text:
        'La página oficial organiza las 30 propuestas en cinco bloques: vivienda, empleo y oportunidades; industria y economía; seguridad, derechos y migración; cuidados y bienestar; y autogobierno y relación con el Estado.',
      measureNumbers: [1, 7, 13, 19, 25, 30],
    },
    {
      title: 'El autogobierno es una prioridad propia',
      text:
        'El último bloque plantea completar el Estatuto de Gernika, defender el Concierto Económico, exigir el cumplimiento de los acuerdos y reforzar la voz de Euskadi en Europa.',
      measureNumbers: [25, 26, 27, 28, 29, 30],
    },
    {
      title: 'Medidas para vivienda, empleo y bienestar',
      text:
        'Entre las propuestas concretas figuran más vivienda asequible, ampliar a 36 meses la prestación contributiva por desempleo, proteger pensiones y reforzar la formación sanitaria.',
      measureNumbers: [1, 4, 19, 20, 22],
    },
  ],
  'tercera-edad': [
    {
      title: 'Pensiones, mayores y cuidados reúnen 11 de 63 medidas',
      text:
        'Es el área más extensa del documento. Combina suficiencia de las pensiones y protección del poder adquisitivo con dependencia, atención domiciliaria, vivienda adaptada y lucha contra la soledad.',
      measureNumbers: [6, 7, 8, 11, 12, 13, 14, 15, 16],
    },
    {
      title: 'El documento pide concretar costes y umbrales',
      text:
        'Una de las propuestas plantea publicar, antes de aprobar cada medida, sus requisitos, umbrales pendientes, calendario, coste anual e indicadores. Es una exigencia del propio texto, no un dato cuantificado por la ficha.',
      measureNumbers: [12],
    },
    {
      title: 'Un programa político amplio, no solo sobre pensiones',
      text:
        'Las 13 áreas cubren también instituciones, sanidad, empleo, vivienda, educación, fiscalidad, seguridad, migración, mundo rural, energía, información y política exterior. El PDF se titula «Programa político En Acción 3e 2026» y no se identifica expresamente como programa electoral del 29N.',
      measureNumbers: [1, 17, 21, 25, 29, 33, 38, 42, 45, 50, 55, 60, 63],
    },
  ],
  pfac: [
    {
      title: 'Cinco propuestas abordan violencias y autonomía',
      text:
        'Las cinco primeras medidas tratan violencia machista, prostitución, pornografía y menores, explotación reproductiva y la ley trans. El feminismo y la protección de las mujeres estructuran el inicio del documento.',
      measureNumbers: [1, 2, 3, 4, 5],
    },
    {
      title: 'Vivienda, salarios y protección social',
      text:
        'El programa propone limitar los alquileres y formula un SMI un 30 % superior al coste medio de los alquileres, vinculado al IPC. También plantea avanzar hacia una jornada de 30 horas sin pérdida salarial y ampliar el Ingreso Mínimo Vital y las ayudas a la crianza y la dependencia.',
      measureNumbers: [6, 7, 8],
    },
    {
      title: 'Las propuestas también cubren servicios públicos y política exterior',
      text:
        'Las seis medidas restantes tratan financiación de servicios públicos, cultura y ciencia, modelo de Estado, emergencia climática, migración y política exterior.',
      measureNumbers: [9, 10, 11, 12, 13, 14],
    },
  ],
  autonomos: [
    {
      title: 'El decálogo se centra en condiciones para el trabajo autónomo',
      text:
        'Derechos sociales, fiscalidad, burocracia y formación forman el núcleo de las propuestas dirigidas a autónomos y pequeños negocios.',
      measureNumbers: [1, 2, 3, 4],
    },
    {
      title: 'Emprendimiento e iniciativa privada',
      text:
        'El partido propone impulsar la iniciativa privada, mejorar la valoración social de empresarios y autónomos y facilitar la puesta en marcha de negocios.',
      measureNumbers: [5, 6, 7],
    },
    {
      title: 'Administración y justicia',
      text:
        'Las últimas propuestas piden una gestión pública profesional, reducir el gasto considerado superfluo y contar con una justicia independiente y ágil.',
      measureNumbers: [8, 9, 10],
    },
  ],
  'escanos-en-blanco': [
    {
      title: 'Un programa de artículo único para dejar escaños vacíos',
      text:
        'La propuesta central es no tomar posesión del cargo ni percibir remuneración, y que el partido renuncie a subvenciones públicas. La web oficial presenta esta fórmula como una manera de representar a quienes no se sienten representados.',
      measureNumbers: [1],
    },
  ],
  vox: [
    {
      title: 'Tres ejes: prioridad nacional, desregulación y remigración',
      text:
        'Los tres lemas de campaña tienen bloque propio: «Inmigración» (9 medidas), «Prioridad nacional» (8) y «Desregulación» (12). Suman 29 de las 115 medidas. Incluyen prohibir las regularizaciones masivas, un plan de retorno para los extranjeros que no contribuyan o vivan de subsidios y derogar tres normas por cada una que se apruebe.',
      measureNumbers: [9, 13, 14, 18, 40],
    },
    {
      title: 'La preferencia por los españoles llega a varios servicios',
      text:
        'El criterio de prioridad nacional aparece también fuera de su bloque: vivienda protegida y ayudas al alquiler, plazas de guardería y becas, el Ingreso Mínimo Vital y la atención sanitaria, que excluiría a los extranjeros en situación ilegal salvo urgencia grave.',
      measureNumbers: [18, 20, 22, 27, 74],
    },
    {
      title: 'Seguridad y Defensa es el bloque más largo',
      text:
        'Tiene 15 medidas: rebajar la edad de responsabilidad penal, ampliar la prisión permanente revisable, proteger las fronteras con participación de las Fuerzas Armadas, aumentar la inversión en Defensa y presionar para recuperar Gibraltar.',
      measureNumbers: [80, 81, 88, 89, 93],
    },
    {
      title: 'Bajar impuestos y recortar normas y gasto',
      text:
        'El programa propone rebajar el IRPF, el IVA y el Impuesto de Sociedades, IVA del 0 % en la compra de la primera vivienda nueva, silencio administrativo positivo como regla general y una auditoría de las administraciones para recortar el gasto superfluo.',
      measureNumbers: [2, 34, 41, 43],
    },
    {
      title: 'Cuatro medidas piden derogar leyes',
      text:
        'El texto pide derogar la Ley de Vivienda, las leyes de género, la LOMLOE y la legislación laboral del Gobierno, además del calendario de cierre de las centrales nucleares. Otras medidas hablan de «superar» o modificar leyes, como la de Memoria Democrática, sin nombrar su derogación.',
      measureNumbers: [8, 30, 46, 47, 69],
    },
    {
      title: 'Diez medidas sin desarrollo',
      text:
        'Diez de las 115 medidas son solo un enunciado, sin texto que las desarrolle. Entre ellas, suprimir el arraigo, prohibir el burka y el niqab, acabar con los menús halal en los comedores escolares y defender la tauromaquia.',
      measureNumbers: [11, 19, 23, 54, 57, 71, 72, 73, 77, 111],
    },
  ],
  psoe: [
    {
      title: 'El bienestar ocupa más de una quinta parte',
      text:
        'El capítulo del Estado de bienestar reúne 109 de los 500 compromisos: la senda fiscal y los impuestos que lo financian, la sanidad, la educación, la universidad, la dependencia, la infancia, la discapacidad y la financiación autonómica. Fija la financiación pública de la sanidad en torno al 7 % del PIB, una primera consulta de psicología en 30 días como máximo, una cuenta pública de 1.000 euros para cada niño al nacer y la asunción por el Estado de 83.000 millones de euros de deuda autonómica.',
      measureNumbers: [136, 143, 193, 231],
    },
    {
      title: 'Vivienda: 100.000 pisos públicos y el 1 % del PIB al año',
      text:
        'Los 50 compromisos de vivienda prometen movilizar cada año el 1 % del PIB, un parque público estatal de 100.000 viviendas y más de 25.000 millones de euros del ICO en avales y préstamos. Gravan con un impuesto progresivo las viviendas de grandes propietarios y fondos que no se alquilen a precio asequible, y refuerzan las inspecciones de los precios del alquiler en las zonas tensionadas.',
      measureNumbers: [38, 42, 55, 70, 77],
    },
    {
      title: 'Más impuestos a las rentas del capital y a los más ricos',
      text:
        'El programa sube el tipo máximo de las rentas del capital hasta el 35 % a partir de 300.000 euros, dobla la tasa Tobin del 0,2 % al 0,4 %, amplía los impuestos a las grandes tecnológicas y crea una tasa a los jets privados y los megayates. Una Ley de Salarios Justos sube la tributación de las empresas cotizadas cuyo directivo gane más de 100 veces la mediana de su plantilla.',
      measureNumbers: [130, 131, 132, 133, 135],
    },
    {
      title: 'Jornada de 37,5 horas y SMI por ley',
      text:
        'El PSOE completaría la reducción de la jornada a 37,5 horas semanales, con las 35 horas como horizonte de la negociación colectiva, y blindaría por ley el salario mínimo por encima del 60 % del salario medio. También eleva la pensión de orfandad del 20 al 30 % y pretende blindar en la Constitución el sistema público de pensiones.',
      measureNumbers: [87, 106, 108, 365],
    },
    {
      title: 'Nuevos derechos en la Constitución',
      text:
        'El programa propone reformar la Constitución para blindar el derecho al aborto y el sistema público de pensiones, hacer de la vivienda y la salud derechos fundamentales y reconocer el derecho a la seguridad climática y al acceso al agua potable. Además, suprime los aforamientos de los cargos públicos para los delitos ajenos a su cargo.',
      measureNumbers: [37, 327, 365, 366, 367, 373],
    },
    {
      title: 'Sustituir, no derogar',
      text:
        'Ninguno de los 500 compromisos usa la palabra «derogar». La Ley de Seguridad Ciudadana de 2015, la llamada «ley mordaza», no se deroga: el programa propone una ley nueva que la sustituya. En energía mantiene el calendario de cierre de las nucleares hasta 2035 y fija un 81 % de electricidad renovable para 2030.',
      measureNumbers: [431, 240, 234],
    },
  ],
  pcte: [
    {
      title: 'Un programa de lucha, no de gobierno',
      text:
        'El PCTE presenta su texto como «programa de lucha» y no como programa electoral: «Estas no son una serie de medidas para aplicar desde las instituciones». Las 95 medidas son reivindicaciones para una «oposición obrera» organizada desde los centros de trabajo, y el último bloque pide más derechos sindicales: representantes también en las empresas de menos de seis trabajadores, 10 horas de asamblea retribuidas al año y consultas vinculantes antes de firmar convenios o ERE.',
      measureNumbers: [89, 90, 91, 94],
    },
    {
      title: 'Menos tiempo de trabajo',
      text:
        'El primer bloque reduce la jornada a 35 horas semanales «ya», como paso hacia las 30, con un tope de 1.540 horas al año; da cinco semanas de vacaciones y adelanta la jubilación ordinaria a los 60 años (a los 55 en los trabajos penosos o peligrosos). Si una máquina produce lo mismo en menos tiempo, «el resultado debe ser menos jornada y no menos empleo».',
      measureNumbers: [2, 3, 4, 16],
    },
    {
      title: 'Ningún desahucio y alquileres a la mitad',
      text:
        'Las 12 medidas de vivienda prohíben todo desahucio de la vivienda habitual de los hogares trabajadores, «sea cual sea la causa», bajan los alquileres un 50 % de inmediato y expropian sin indemnización las viviendas vacías de bancos, fondos y grandes tenedores. El parque público de alquiler debe llegar al 10 % de las viviendas y la vivienda turística no puede pasar del 0,5 %.',
      measureNumbers: [17, 21, 23, 24, 25],
    },
    {
      title: 'Propiedad estatal bajo control obrero',
      text:
        'El programa pasa a propiedad estatal, bajo «mecanismos de control obrero», los sectores estratégicos (energía, transporte y telecomunicaciones) y las empresas viables que sus dueños quieran cerrar. Recupera con gestión pública directa los servicios privatizados y quiere un sistema educativo «exclusivamente público», que integre los centros concertados en una red pública única.',
      measureNumbers: [13, 14, 30, 34, 37],
    },
    {
      title: 'Fuera de la OTAN y de la UE',
      text:
        'El bloque de paz pide salir de la OTAN y de la Unión Europea, reducir el gasto militar, anular los Programas Especiales de Modernización y llevar los fondos de I+D militar a salud, energía, alimentación y medio ambiente. También un embargo militar total a Israel y el reconocimiento de la República Árabe Saharaui Democrática.',
      measureNumbers: [72, 73, 75, 79, 80],
    },
    {
      title: 'Cuatro derogaciones',
      text:
        'El programa deroga la Ley de Seguridad Ciudadana («Ley Mordaza»), la Ley de Convivencia Universitaria, la Ley 15/1997, que abre la sanidad a la gestión privada, y los delitos de injurias a la Corona y de ultrajes a símbolos. Pide además ilegalizar las organizaciones fascistas y franquistas y las empresas de desocupación.',
      measureNumbers: [29, 81, 82, 83, 86, 87],
    },
  ],
  pctc: [
    {
      title: 'Un programa de lucha, no de gobierno',
      text:
        'El PCTE publica una edición en catalán de su «Programa de lucha» (el PDF lleva «PCTC» en el nombre) y la presenta como algo distinto de un programa electoral: «Aquestes no són un seguit de mesures per aplicar des de les institucions». Las 95 medidas son reivindicaciones para una «oposició obrera» organizada desde los centros de trabajo, y el último bloque pide más derechos sindicales: representantes también en las empresas de menos de seis trabajadores, 10 horas de asamblea retribuidas al año y consultas vinculantes antes de firmar convenios o ERE.',
      measureNumbers: [89, 90, 91, 94],
    },
    {
      title: 'Menos tiempo de trabajo',
      text:
        'El primer bloque reduce la jornada a 35 horas semanales «ja», como paso hacia las 30, con un tope de 1.540 horas al año; da cinco semanas de vacaciones y adelanta la jubilación ordinaria a los 60 años (a los 55 en los trabajos penosos o peligrosos). Si una máquina produce lo mismo en menos tiempo, «el resultat ha de ser menys jornada i no menys ocupació».',
      measureNumbers: [2, 3, 4, 16],
    },
    {
      title: 'Ningún desahucio y alquileres a la mitad',
      text:
        'Las 12 medidas del bloque de vivienda prohíben todo desahucio de la vivienda habitual de los hogares trabajadores, «sigui quina sigui la causa», bajan los alquileres un 50 % de inmediato y expropian sin indemnización las viviendas vacías de bancos, fondos y grandes tenedores. El parque público de alquiler debe llegar al 10 % de las viviendas y la vivienda turística no puede pasar del 0,5 %.',
      measureNumbers: [17, 21, 23, 24, 25],
    },
    {
      title: 'Propiedad estatal bajo control obrero',
      text:
        'El programa pasa a propiedad estatal, bajo «mecanismes de control obrer», los sectores estratégicos (energía, transporte y telecomunicaciones) y las empresas viables que sus dueños quieran cerrar. Recupera con gestión pública directa los servicios privatizados y quiere un sistema educativo «exclusivament públic», que integre los centros concertados en una red pública única.',
      measureNumbers: [13, 14, 30, 34, 37],
    },
    {
      title: 'Fuera de la OTAN y de la UE',
      text:
        'El bloque de paz pide salir de la OTAN y de la Unión Europea, reducir el gasto militar y anular los Programas Especiales de Modernización; el bloque de cultura y ciencia lleva los fondos de I+D militar a salud, energía, alimentación y medio ambiente. También pide un embargo militar total a Israel y el reconocimiento de la República Árabe Saharaui Democrática.',
      measureNumbers: [72, 73, 75, 79, 80],
    },
    {
      title: 'Cuatro derogaciones',
      text:
        'El programa deroga la Ley de Seguridad Ciudadana («Llei mordassa»), la Ley de Convivencia Universitaria, la Ley 15/1997, que abre la sanidad a la gestión privada, y los delitos de injurias a la Corona y de ultrajes a símbolos. Pide además ilegalizar las organizaciones fascistas y franquistas y las empresas de desocupación.',
      measureNumbers: [29, 81, 82, 83, 86, 87],
    },
  ],
  pctg: [
    {
      title: 'Un programa de lucha, no de gobierno',
      text:
        'El PCTE publica una edición en gallego de su «Programa de lucha» (el PDF lleva «PCTG» en el nombre) y la presenta como algo distinto de un programa electoral: «Estas non son unha serie de medidas para aplicar dende as institucións». Las 95 medidas son reivindicaciones para una «oposició obrera» organizada desde los centros de trabajo, y el último bloque pide más derechos sindicales: representantes también en las empresas de menos de seis trabajadores, 10 horas de asamblea retribuidas al año y consultas vinculantes antes de firmar convenios o ERE.',
      measureNumbers: [89, 90, 91, 94],
    },
    {
      title: 'Menos tiempo de trabajo',
      text:
        'El primer bloque reduce la jornada a 35 horas semanales «xa», como paso hacia las 30, con un tope de 1.540 horas al año; da cinco semanas de vacaciones y adelanta la jubilación ordinaria a los 60 años (a los 55 en los trabajos penosos o peligrosos). Si una máquina produce lo mismo en menos tiempo, «o resultado debe ser menos xornada e non menos emprego».',
      measureNumbers: [2, 3, 4, 16],
    },
    {
      title: 'Ningún desahucio y alquileres a la mitad',
      text:
        'Las 12 medidas del bloque de vivienda prohíben todo desahucio de la vivienda habitual de los hogares trabajadores, «sexa cal sexa a causa», bajan los alquileres un 50 % de inmediato y expropian sin indemnización las viviendas vacías de bancos, fondos y grandes tenedores. El parque público de alquiler debe llegar al 10 % de las viviendas y la vivienda turística no puede pasar del 0,5 %.',
      measureNumbers: [17, 21, 23, 24, 25],
    },
    {
      title: 'Propiedad estatal bajo control obrero',
      text:
        'El programa pasa a propiedad estatal, bajo «mecanismos de control obreiro», los sectores estratégicos (energía, transporte y telecomunicaciones) y las empresas viables que sus dueños quieran cerrar. Recupera con gestión pública directa los servicios privatizados y quiere un sistema educativo «exclusivamente público», que integre los centros concertados en una red pública única.',
      measureNumbers: [13, 14, 30, 34, 37],
    },
    {
      title: 'Fuera de la OTAN y de la UE',
      text:
        'El bloque de paz pide salir de la OTAN y de la Unión Europea, reducir el gasto militar y anular los Programas Especiales de Modernización; el bloque de cultura y ciencia lleva los fondos de I+D militar a salud, energía, alimentación y medio ambiente. También pide un embargo militar total a Israel y el reconocimiento de la República Árabe Saharaui Democrática.',
      measureNumbers: [72, 73, 75, 79, 80],
    },
    {
      title: 'Cuatro derogaciones',
      text:
        'El programa deroga la Ley de Seguridad Ciudadana («Lei Mordaza»), la Ley 3/2022, de convivencia universitaria, la Ley 15/1997, que abre la sanidad a la gestión privada, y los delitos de injurias a la Corona y de ultrajes a símbolos. Pide además ilegalizar las organizaciones fascistas y franquistas y las empresas de desocupación.',
      measureNumbers: [29, 81, 82, 83, 86, 87],
    },
  ],
  'fe-jons': [
    {
      title: 'La remigración abre el programa',
      text:
        '34 de las 262 medidas tratan de inmigración: el capítulo 1 y su Anexo I, el Plan Nacional de Remigración, que reparte 25 medidas en tres fases. En los primeros cinco años, expulsar a todo inmigrante con antecedentes penales o en paro y retirar las ayudas sociales y las pensiones no contributivas a los extranjeros; en diez años, retirar la nacionalidad concedida a quien no cumpla el ius sanguinis; después, una tasa máxima de inmigración del 1,5 %.',
      measureNumbers: [4, 13, 14, 23, 30, 34],
    },
    {
      title: 'Fuera de la UE, el euro, la OTAN y la ONU',
      text:
        'El programa pide el abandono inmediato de la OTAN, el FMI, la UE y la ONU y de los tratados que limiten la soberanía, la salida inmediata del euro y una salida «escalonada y pactada» de la Unión. También propone romper relaciones con la OMS, abandonar el acuerdo UE-Mercosur y desmantelar las bases militares extranjeras, Gibraltar incluido.',
      measureNumbers: [46, 48, 56, 57, 136, 227],
    },
    {
      title: 'Un régimen nuevo en lugar de la Constitución de 1978',
      text:
        'El bloque «Ruptura con el Régimen del 78» (48 medidas) propone abolir la monarquía para alumbrar un Estado «republicano Nacional-Sindicalista», disolver el régimen y su Constitución y sustituir la democracia de partidos por una representación a través de la familia, el municipio y el sindicato. Pide además disolver las comunidades autónomas y el Tribunal Constitucional.',
      measureNumbers: [59, 145, 150, 151, 152, 181],
    },
    {
      title: 'Nacionalizar los sectores estratégicos',
      text:
        'Siete medidas nacionalizan algo: la banca, los sectores y las industrias estratégicos, la producción, el transporte y la distribución de la energía, los yacimientos estratégicos, las redes troncales de telecomunicaciones y la industria farmacéutica. El programa se opone «frontalmente al sistema capitalista» y quiere sustituirlo por una economía nacional-sindicalista.',
      measureNumbers: [96, 97, 114, 126, 128, 226],
    },
    {
      title: 'Cinco derogaciones y cinco ilegalizaciones',
      text:
        'El programa deroga la Ley de Extranjería, las reformas laborales de PP, PSOE y Podemos/Sumar, las leyes LGTBI y de «género» (incluida la Ley de Violencia de Género), las leyes de memoria y el decreto de las zonas de bajas emisiones. Ilegaliza las ONG que faciliten el tráfico de personas, los grupos de presión al servicio de intereses extranjeros, los movimientos separatistas, las ETT y las leyes del aborto y la eutanasia.',
      measureNumbers: [10, 68, 87, 231, 251, 90],
    },
    {
      title: 'Servicio militar de 18 meses',
      text:
        'El programa recupera el servicio militar obligatorio para hombres y mujeres de 18 a 22 años, de 18 meses, remunerado y cotizado, con al menos cuatro meses en tareas civiles y reserva activa hasta los 45 años. También aumenta el presupuesto de defensa y militariza las fronteras de Ceuta, Melilla y Canarias.',
      measureNumbers: [167, 171, 172, 173],
    },
  ],
  pacma: [
    {
      title: 'Los animales ocupan casi la mitad del programa',
      text:
        'El bloque «Nuestro compromiso con los Animales» reúne 42 de las 102 propuestas, y 13 de las 18 del bloque de medio ambiente también hablan de animales: macrogranjas, piscifactorías, granjas de pulpos o fauna silvestre. La pieza central es una Ley de Bienestar y Protección de los Animales sin exclusiones, frente a la Ley 7/2023, que según el programa deja fuera a los animales de producción, de caza y de espectáculos.',
      measureNumbers: [1, 25, 26, 47, 48, 50],
    },
    {
      title: 'Prohibir es la herramienta principal',
      text:
        '18 de las 102 propuestas anuncian en su título una prohibición, un «fin», un «cese», un «veto» o una «abolición»: la compraventa de animales de compañía, los zoológicos, los espectáculos y festejos con animales, las granjas peleteras, el foie gras, los sacrificios halal y kosher, la experimentación animal, el glifosato y la pirotecnia, entre otros.',
      measureNumbers: [2, 6, 7, 11, 33, 35, 39, 51, 60],
    },
    {
      title: 'Contra la caza, también en sus formas indirectas',
      text:
        'PACMA se presenta como el único partido que se opone a la caza. Propone prohibir el uso de perros y otros animales para cazar, la caza del lobo y del zorro, la caza durante 30 años en los terrenos incendiados por intereses cinegéticos y la presencia de menores en la caza y la tauromaquia. Mientras tanto, pide controles de alcoholemia a los cazadores y prohibir la munición de plomo.',
      measureNumbers: [8, 9, 10, 57, 96],
    },
    {
      title: 'Una sola derogación: la ley que protege la tauromaquia',
      text:
        'El programa pide derogar una sola ley: la Ley 18/2013, que declara la tauromaquia patrimonio cultural. Pide además retirar de inmediato las subvenciones a los espectáculos con animales, prohibir su retransmisión y prohibir que los menores asistan o participen en festejos taurinos.',
      measureNumbers: [7, 74, 96],
    },
    {
      title: 'Los animales entran en la política social',
      text:
        '16 de las 42 propuestas del bloque «Personas» mencionan a los animales. Entre ellas: entrar con animales en el transporte público, los albergues, las residencias y las casas de acogida para víctimas de violencia de género, recibir su visita en el hospital, anular las cláusulas de alquiler que prohíben tener animales y ofrecer menús vegetales en los comedores públicos.',
      measureNumbers: [22, 23, 86, 95, 97, 102],
    },
    {
      title: 'Impuestos con criterio animal',
      text:
        'El programa baja el IVA de los servicios veterinarios del 21 % al 4 % (o lo exime) y propone deducir en el IRPF hasta el 10 % de los gastos veterinarios. Sube el IVA de los lácteos de origen animal y baja el de sus equivalentes vegetales, crea un impuesto climático para las explotaciones ganaderas según sus emisiones y retira las subvenciones a las macrogranjas y a la pesca.',
      measureNumbers: [41, 46, 47, 48],
    },
  ],
  'cha-fa': [
    {
      title: 'La movilidad es el bloque más largo: 34 de 146 propuestas',
      text:
        'El bloque «Derecho a la movilidad» reúne 34 de las 146 propuestas (el 23 %), por delante de derechos sociales (26) y de territorio y paisajes (22). Veintidós están en la sección de ferrocarril y transporte público (Corredor Cantábrico-Mediterráneo con doble vía Zaragoza-Teruel-Sagunto, Canfranc, Cercanías, el tranvía de Zaragoza) once de carreteras con tramos concretos (A-68, N-211, A-15, A-25, A-40, A-21 y A-23) y una de ruta ciclable. Diez piden licitar o adjudicar proyectos y obras.',
      measureNumbers: [18, 20, 35, 40, 46, 49],
    },
    {
      title: 'Casi una de cada cuatro propuestas se dirige al Estado',
      text:
        'Treinta y seis de las 146 propuestas (el 25 %) mencionan al Estado, al Gobierno central, a un ministerio o a una competencia estatal. El primer bloque se apoya en el Estado: hasta 22 competencias nuevas, un acuerdo económico-financiero bilateral con la Agencia Tributaria Aragonesa recaudando todos los impuestos y el pago de la «deuda histórica». La Agenda se presenta como el complemento aragonés del programa de Frente Amplio.',
      measureNumbers: [2, 4, 5, 24, 38, 93],
    },
    {
      title: 'Moratorias y límites a las renovables y a los centros de datos',
      text:
        'Los bloques de energía y de territorio suman 26 propuestas. La más amplia propone una moratoria de los centros de datos, las renovables de más de 5 MW, el biogás, las minas de arcilla y las líneas de transporte eléctrico hasta que haya una planificación, y otra moratoria para los proyectos judicializados. Ocho propuestas citan los centros de datos, seis de ellas en una sección propia. A la vez, el programa crea una empresa pública de energía con las hidroeléctricas cuando acaben sus concesiones y una red de comunidades energéticas.',
      measureNumbers: [52, 56, 57, 63, 67, 71],
    },
    {
      title: '15.000 viviendas de alquiler público, sin medidas sobre el precio del alquiler',
      text:
        'El bloque de vivienda tiene doce propuestas. La meta es incorporar 15.000 viviendas al parque público de alquiler asequible en esta legislatura, con el suelo y las fincas de la SAREB en Aragón (1.612 viviendas y 757 suelos) pasando a la empresa pública Casa 47, suelo público cedido a cooperativas y a entidades sin ánimo de lucro y ayudas a los pequeños municipios para llegar al 20 % de vivienda pública. Ninguna propuesta de la Agenda habla de limitar el precio del alquiler: se presenta como complemento del programa de Frente Amplio.',
      measureNumbers: [6, 7, 8, 12, 13],
    },
    {
      title: 'Pocos números: 13 cifras en 146 propuestas',
      text:
        'Solo 13 propuestas llevan un compromiso cuantificado (el 9 %) y 11 llevan un plazo. Las cifras son 22 competencias nuevas, 15.000 viviendas, el 30 % del tranvía de Zaragoza, 2.000 millones de euros para un fondo municipal contra la despoblación y 600 euros de bono cultural. No hay una memoria económica ni un coste de la «deuda histórica», de la empresa pública de energía o de las obras ferroviarias y de carreteras.',
      measureNumbers: [2, 7, 20, 98, 146],
    },
    {
      title: 'Lo rural también aparece fuera de su bloque',
      text:
        'El bloque de medio rural tiene 19 propuestas, pero otras once fuera de él nombran lo rural, los pueblos o la despoblación: programas piloto de vivienda en el medio rural, transporte rural gratuito de lunes a viernes, un Fondo Público de Inversión en Energías Renovables destinado al desarrollo territorial en el medio rural o la llegada a las comarcas rurales de la financiación de las entidades LGTBIQ+. El bloque rural propone un Pacto de Estado como el de Toledo, un Estatuto Básico de los Municipios de Menor Población en el primer periodo de sesiones y detraer 2.000 millones del Fondo de Participación de Tributos.',
      measureNumbers: [17, 30, 65, 87, 89, 98],
    },
  ],
  fa: [
    {
      title: 'Derechos sociales y transición ecológica pesan más que todo lo demás',
      text:
        'Los bloques «Derechos sociales para una vida digna» (182 propuestas) y «Transición ecológica justa» (150) suman 332 de las 908 propuestas: el 37 %. La sección con más propuestas es la de sanidad (47), por delante del empleo (44 en la de salarios y tiempo de trabajo) y del bienestar animal (35). Vivienda, el primer capítulo y el que el programa pone en cabeza, tiene 61.',
      measureNumbers: [101, 148, 62, 388, 357],
    },
    {
      title: 'Un suelo de gasto fijado en porcentaje del PIB',
      text:
        'Dieciséis propuestas citan un porcentaje del PIB. Los suelos que fijan son el 1 % para el parque público de vivienda, el 8 % para la sanidad pública, el 7 % para la educación (en 2030), el 3,5 % para la transición ecológica, el 2,4 % para infancia y familias (hoy el 1,5 %) y el 3 % para I+D+i (en 2030). Rechaza de forma expresa el 5 % del PIB en gasto militar que pide la OTAN.',
      measureNumbers: [1, 101, 148, 356, 223, 761],
    },
    {
      title: 'La reforma fiscal es un bloque entero: 48 propuestas',
      text:
        'El bloque «Una reforma fiscal en profundidad» reúne 48 propuestas, y 77 de las 908 pertenecen a la categoría de impuestos. Suben el tipo mínimo del Impuesto sobre Sociedades al 20 % para las grandes empresas, crean la Tasa Zucman (3 % anual sobre patrimonios de más de 50 millones), limitan las herencias a 10 millones por heredero y elevan el IRPF al 52 % a partir de 300.000 euros. A cambio bajan el IRPF a las rentas del trabajo de hasta 27.000 euros y el IVA de bienes y servicios básicos.',
      measureNumbers: [244, 259, 261, 265, 264, 270],
    },
    {
      title: 'Lo público como herramienta: de la banca a la luz',
      text:
        'La primera frase de 228 de las 908 propuestas (el 25 %) menciona lo público. El programa crea un Banco Postal Estatal a partir de Correos y de las acciones de CaixaBank en manos del FROB, una comercializadora eléctrica pública, una Agencia Estatal de la Vivienda, una empresa pública de materias primas estratégicas y una industria farmacéutica pública, y pide la titularidad pública de las redes de distribución de electricidad y gas.',
      measureNumbers: [537, 381, 379, 18, 536, 131],
    },
    {
      title: 'Diez propuestas derogan una norma de forma explícita',
      text:
        'Derogan el régimen fiscal especial de las SOCIMI, la Ley 15/1997 de nuevas formas de gestión sanitaria, la Ley 18/2013 de la tauromaquia (aparece dos veces, en cultura y en bienestar animal), el rechazo en frontera de la Ley de Extranjería, la Ley Mordaza, los delitos del Código Penal contra los sentimientos religiosos y contra la Corona, el Código Penal Militar en las tareas policiales, las exenciones del IBI a bienes confesionales y la Ley de Libertad Religiosa.',
      measureNumbers: [51, 103, 178, 741, 843, 845, 908],
    },
    {
      title: 'Treinta plazos: once son «de inmediato» y ocho caen en 2030',
      text:
        'Treinta propuestas llevan un plazo explícito. Once se aplican de inmediato (la Comisión de Investigación de la SAREB, derogar el régimen de las SOCIMI, la jornada de 37,5 horas, la reforma de la financiación autonómica) y ocho fijan 2030 como meta (el 7 % del PIB en educación, el 81 % de generación renovable, la electrificación del ferrocarril). El resto va de los seis meses a 2045, con la retirada de los ciclos combinados.',
      measureNumbers: [24, 51, 334, 621, 148, 359, 399],
    },
  ],
  jxcat: [
    {
      title: 'Pedir competencias: una de cada seis propuestas',
      text:
        '103 de las 620 propuestas (el 17 %) hablan de traspasos, transferencias, delegaciones o competencias, y 52 empiezan por «Exigir» o «Reclamar». Entre ellas: un concierto económico con una ley específica, la delegación de las competencias de inmigración, el traspaso del 100 % de Rodalies y de los aeropuertos, la gestión de la Seguridad Social y un Consejo de Justicia de Cataluña. La introducción avisa de que Junts «no serem part de cap govern espanyol» y quiere «continuar sent decisius a Madrid».',
      measureNumbers: [446, 309, 501, 504, 488, 11],
    },
    {
      title: 'Bajar impuestos, sin subir ninguno',
      text:
        '47 propuestas están en la categoría Impuestos y ninguna de las 620 sube un impuesto: deflactar el IRPF, eliminar Sucesiones y Donaciones, acelerar la rebaja de Sociedades a pymes, el IVA de la luz al 10 %, el de las peluquerías del 21 % al 10 %, una deducción del 15 % en el IRPF por el alquiler y el IVA de la vivienda nueva del 10 % al 5 %.',
      measureNumbers: [450, 454, 457, 459, 463, 464],
    },
    {
      title: 'Vivienda: más oferta, sin topes de precio',
      text:
        'La única norma de vivienda que el programa deroga son los artículos de la Ley 12/2023 que contienen los precios y crean zonas tensionadas, «que redueixen l’oferta de lloguer per als joves». La alternativa es más oferta y seguridad jurídica: incentivos fiscales a los propietarios, la cesión a la Generalitat de las viviendas y el suelo de la Sareb y Casa 47, desalojar las ocupaciones en 48 horas y, hasta 2028, prohibir que bancos y fondos compren vivienda.',
      measureNumbers: [396, 72, 48, 60, 62],
    },
    {
      title: 'Inmigración: gestionarla desde Cataluña y limitarla',
      text:
        'El programa pide una ley de delegación para que la Generalitat gestione los permisos de residencia y trabajo, los expedientes de expulsión, las devoluciones y los CIE, y que los Mossos d’Esquadra controlen las fronteras Schengen de puertos y aeropuertos, hasta 26.800 agentes en 2032. Se opone a las regularizaciones masivas por decreto, exige el catalán en el arraigo y la renovación de permisos y propone prohibir en el espacio público el niqab y el burka, con el hiyab fuera de la prohibición.',
      measureNumbers: [309, 311, 315, 321, 322, 325],
    },
    {
      title: 'El catalán, en 38 propuestas de todos los capítulos',
      text:
        'La lengua no se queda en el capítulo propio: 38 propuestas la nombran, desde el requisito de catalán para jueces y fiscales, la Administración del Estado en Cataluña y los permisos de residencia hasta sanciones a las plataformas que no atiendan en catalán. También piden una cuota de plazas para catalanoparlantes en la Administración de Justicia y seguir presionando para la oficialidad del catalán en la UE.',
      measureNumbers: [32, 34, 84, 85, 88, 321],
    },
    {
      title: 'Diez derogaciones, siete de ellas en justicia y libertades',
      text:
        'Diez propuestas derogan una norma de forma explícita: la «ley mordaza» (dos veces), la prisión permanente revisable, la ley franquista de secretos oficiales, el artículo 384 bis de la LECrim, los delitos de expresión política, la inelegibilidad sobrevenida de la LOREG, la declaración de la tauromaquia como patrimonio cultural, artículos de la Ley de Vivienda y la LRSAL, la ley de racionalización de la Administración local. Nueve de los catorce plazos son «de inmediato» y cinco de ellos son traspasos a la Generalitat.',
      measureNumbers: [10, 39, 9, 2, 272, 592],
    },
  ],
  convergents: [
    {
      title: 'Diecisiete condiciones para apoyar a un Gobierno',
      text:
        'El primer compromiso avisa de que Convergents no apoyará a ningún partido que no asuma sus 17 propuestas. Entre ellas: una resolución de las Cortes que reconozca la nación catalana y un Estado plurinacional, un concierto económico como el vasco, la amnistía «total», que los Mossos y la Policía Local sustituyan en cuatro años a la Policía Nacional y la Guardia Civil, el traspaso de los aeropuertos y selecciones deportivas catalanas oficiales.',
      measureNumbers: [2, 3, 9, 11, 12, 13],
    },
    {
      title: 'Pedir al Estado: traspasos y gestión propia',
      text:
        '60 de las 300 propuestas empiezan por «Exigirem», «Reclamarem» o «Demanarem», y 24 piden traspasar a Cataluña una competencia, un servicio o sus recursos: la inmigración, la sanidad y la enseñanza, la cultura, los impuestos generados en Cataluña, la Inspección de Trabajo, el Ingreso Mínimo Vital, las ayudas de la PAC, las plazas MIR, la red ferroviaria, los puertos, la justicia y la seguridad ciudadana.',
      measureNumbers: [8, 10, 72, 97, 247, 270],
    },
    {
      title: 'Bajar impuestos, sin subir ninguno',
      text:
        'Unas 24 propuestas bajan un impuesto o una cotización o crean una deducción, una bonificación o un incentivo fiscal: eliminar Sucesiones, Donaciones y Patrimonio, rebajar Transmisiones Patrimoniales y el tramo autonómico del IRPF, una tarifa plana de dos años para los nuevos autónomos, la Seguridad Social gratis por el primer empleado de un autónomo y deducir en el IRPF las mutuas de salud. Ninguna propuesta sube un impuesto; la fiscalidad de las SOCIMI solo se «revisa».',
      measureNumbers: [77, 78, 82, 86, 218],
    },
    {
      title: 'Vivienda: una derogación y 48 horas contra la ocupación',
      text:
        'La única ley que el programa pide derogar es la Ley 12/2023 por el derecho a la vivienda, por los controles de precios del alquiler. La oferta llega con vivienda protegida, cesiones de la Sareb e incentivos fiscales a los promotores privados. La ocupación aparece tres veces: una ley para devolver la posesión en 48 horas (24 si es la primera vivienda o un centro productivo), la misma promesa en el bloque de economía y una reforma del Código Penal contra la ocupación ligada a mafias.',
      measureNumbers: [60, 51, 57, 16, 71, 64],
    },
    {
      title: 'Inmigración con «valores occidentales»',
      text:
        'El sexto compromiso se presenta como «defensor dels valors occidentals». Propone que la residencia y la nacionalidad dependan de la integración lingüística y de adoptar esos valores, y una gestión migratoria «sin complejos», lejos de las políticas «bonistas». La expulsión de los inmigrantes en situación irregular que hayan delinquido aparece dos veces, con el mismo texto. A la vez, quiere una Cataluña de acogida para los refugiados y la contratación en origen.',
      measureNumbers: [190, 191, 17, 194, 188, 293],
    },
    {
      title: 'El catalán, obligatorio y oficial en Europa',
      text:
        'El programa quiere reformar el Estatuto para que conocer el catalán sea obligatorio, como el castellano, y que el Gobierno use incluso el veto para que sea oficial en las instituciones europeas. Pide acabar con la distinción entre valenciano y catalán en el Estado, preservar la inmersión lingüística y que todos los profesionales sanitarios dominen el catalán.',
      measureNumbers: [4, 5, 7, 145, 202],
    },
  ],
  'teruel-existe': [
    {
      title: 'Infraestructuras, el capítulo más largo',
      text:
        'Infraestructuras y agua es la categoría con más medidas: 26 de 140. El programa enumera las obras que reclama para la provincia: los tramos de la A-68 hasta el Mediterráneo, desbloquear la A-40 Cuenca-Teruel, la A-25 hasta Alcolea del Pinar, una nueva autovía Teruel–Requena–Almansa, el corredor Cantábrico-Mediterráneo con doble vía electrificada y un tren directo Teruel–Madrid «de forma inmediata».',
      measureNumbers: [54, 55, 56, 57, 61, 67],
    },
    {
      title: 'Renovables sí, pero no así',
      text:
        'El programa pide una moratoria en los grandes parques renovables y las líneas de muy alta tensión, se opone al clúster del Maestrazgo y a los parques eólicos del Matarraña, y quiere que los macroparques paguen un canon para el desarrollo local. Reserva el 20 % de la capacidad de la red para las pequeñas instalaciones y pide garantías máximas a los centros de datos. La moratoria y el canon aparecen dos veces, casi con el mismo texto, en los bloques 2 y 10.',
      measureNumbers: [7, 8, 11, 14, 125, 126],
    },
    {
      title: 'Impuestos más bajos para quien vive en los pueblos',
      text:
        'En las localidades despobladas de menos de 5.000 habitantes, los residentes con rentas bajas y medias podrían quedar exentos del IBI, pagar un 80 % menos de transmisiones patrimoniales al comprar vivienda y un 25 % menos de IRPF. Las empresas y autónomos de Teruel recibirían ayudas al funcionamiento hasta el máximo de la UE, el 20 % de los costes laborales.',
      measureNumbers: [116, 94, 30],
    },
    {
      title: 'Dinero del Estado para el reequilibrio territorial',
      text:
        'La medida más cuantiosa es un Pacto de Estado que destine al menos el 2 % del PIB cada año, durante 30 años, a corregir los desequilibrios territoriales. Se suman un Fondo de Inversiones de Teruel de 100 millones de euros, un plan estatal específico para la provincia, la negociación de una «deuda histórica» y una reforma de la financiación que pague el coste real de prestar servicios en territorios dispersos.',
      measureNumbers: [115, 29, 28, 27, 24],
    },
    {
      title: 'Servicios a menos de 30 minutos',
      text:
        'El Plan 300/30/30 promete 300 megas simétricos en todos los municipios, servicios públicos básicos a 30 minutos como máximo y una vía de alta capacidad a menos de 30 kilómetros. Pide vivienda pública de alquiler en todos los municipios, al menos cuatro viviendas en los pequeños, el 25 % del presupuesto sanitario para la atención primaria y un complemento salarial para los empleados públicos de las zonas menos pobladas.',
      measureNumbers: [117, 45, 32, 120],
    },
  ],
  'compromis-front-valencia': [
    {
      title: 'Democracia y derechos pesan más que la economía',
      text:
        'El bloque 5, «Més democràcia, més drets, més llibertats», reúne 189 de las 547 medidas (35 %), más que ningún otro. Incluye juventud (31 medidas, el apartado más largo), administración pública, feminismo, violencias machistas, laicismo, derechos animales y memoria democrática. La vivienda, el empleo y las pensiones, que abren el programa, suman 44.',
      measureNumbers: [326, 330, 355, 361, 455, 482],
    },
    {
      title: 'Vivienda: fondos, tope a la acumulación y 18.000 M€',
      text:
        'La vivienda tiene 24 medidas. Prohíben que fondos y sociedades especulativas compren vivienda, proponen una ley de expropiación de grandes tenedores, destinan el 1 % del PIB a vivienda pública o protegida, crean un fondo de inversión de 18.000 M€ y gravan con un 10 % del valor catastral las viviendas desde la tercera propiedad.',
      measureNumbers: [1, 3, 4, 15, 18],
    },
    {
      title: 'Más impuestos a patrimonios, rentas del capital y grandes empresas',
      text:
        'El apartado de fiscalidad tiene 19 medidas: deflactar el IRPF por debajo de 30.000 €, ampliar el impuesto a las grandes fortunas hacia una tasa tipo Zucman, igualar la tributación de las rentas financieras a las del trabajo, un impuesto sobre los beneficios de las empresas oligopolísticas y una tasa de 2 € por noche en viviendas turísticas.',
      measureNumbers: [138, 139, 143, 144, 148, 150],
    },
    {
      title: 'Energía: recuperar lo público',
      text:
        'Frente a la transición solo con incentivos, el programa propone una empresa pública de generación, distribución y comercialización, recuperar de forma progresiva la titularidad pública de las grandes eléctricas, el 100 % de Red Eléctrica y un fondo soberano de renovables. Mantiene el calendario de cierre nuclear y fija el 100 % de electrificación del sistema en 2030.',
      measureNumbers: [240, 241, 245, 254, 255, 248],
    },
    {
      title: 'Un País Valencià con más financiación y más competencias',
      text:
        'Treinta medidas nombran el País Valenciano o el valenciano. Piden un sistema de financiación o un concierto económico propio, la condonación de la deuda histórica de la Generalitat, un fondo transitorio de nivelación, inversiones del Estado proporcionales a la población y un plan de Rodalies de 1.500 M€ con 58 trenes nuevos, en un Estado plurinacional.',
      measureNumbers: [493, 494, 495, 496, 501, 507],
    },
    {
      title: 'Siete derogaciones y pocas fechas',
      text:
        'El programa deroga la Ley de Amnistía de 1977, la ley mordaza, la ley de secretos oficiales, el delito de ofensa a los sentimientos religiosos, la ley de la tauromaquia como patrimonio cultural, la Ley 15/1997 de gestión sanitaria y la normativa que limita las plantillas públicas. Solo 9 medidas tienen un plazo (inmediato, primer año, 2030, 2040, 2050) y 28 una cifra.',
      measureNumbers: [45, 320, 335, 357, 361, 377, 382],
    },
  ],
  'geroa-bai': [
    {
      title: 'Bases políticas, no un programa de medidas',
      text:
        'El documento tiene cinco capítulos en prosa y ninguna medida numerada, cifra ni fecha de aplicación. Este análisis cuenta 17 compromisos: lo que la coalición dice que exigirá, defenderá o mantendrá en las Cortes. El primer capítulo explica el contexto, el avance de la ultraderecha y lo que a su juicio ha fallado en la gestión del Gobierno, sin ningún compromiso.',
      measureNumbers: [1, 5, 6],
    },
    {
      title: 'Autogobierno y Convenio Económico',
      text:
        'Cinco compromisos tratan del autogobierno de Navarra: las transferencias que marca la LORAFNA, la competencia de becas, mantener el Convenio Económico frente a una reforma constitucional que, según el texto, Vox pondría como condición, y la presencia de Navarra con voz y voto en las instituciones europeas que deciden sobre competencias forales, como el Ecofin.',
      measureNumbers: [2, 5, 10, 3, 11],
    },
    {
      title: 'Lo que el Estado debe a Navarra',
      text:
        'Cuatro compromisos reclaman al Estado obras y decisiones pendientes: las infraestructuras ferroviarias y de regadío, la conexión ferroviaria con la Y vasca, los compromisos con el regadío navarro y la posición de Navarra en la planificación eléctrica 2030.',
      measureNumbers: [1, 8, 9, 7],
    },
    {
      title: 'Frente a la ultraderecha',
      text:
        'El último capítulo enumera lo que significa «combatir a la ultraderecha»: acabar con la Ley de Secretos Oficiales, mantener los derechos civiles del colectivo LGTBI, reforzar la protección de las mujeres víctimas de maltrato, seguir siendo tierra de acogida y reforzar las políticas de cambio climático y de memoria. La Ley de Secretos Oficiales aparece dos veces, también para reparar casos como el de Mikel Zabalza.',
      measureNumbers: [12, 13, 14, 15, 17, 4],
    },
  ],
  upc: [
    {
      title: 'Un manifiesto de 16 ejes',
      text:
        'El documento es un manifiesto de cuatro páginas de texto, no un programa extenso: 16 ejes de uno o dos párrafos, cada uno contado aquí como una propuesta. Solo un eje lleva una cifra, consignar al menos el 0,7 % de los Presupuestos Generales del Estado a la cooperación internacional, y ninguno fija una fecha.',
      measureNumbers: [15, 1, 16],
    },
    {
      title: 'Canarias, sujeto político',
      text:
        'Los cuatro primeros ejes tratan del lugar de Canarias en el Estado y en la UE: su reconocimiento como sujeto político y el pleno desarrollo del Estatuto, la mediana con Marruecos y el reconocimiento de sus aguas, fondos marinos y espacio aéreo, una financiación que respete el REF y compense la insularidad, unos Presupuestos que «cumplan con Canarias» y el trato de región ultraperiférica en el próximo marco financiero europeo.',
      measureNumbers: [1, 2, 3, 4],
    },
    {
      title: 'Vivienda y límites al turismo',
      text:
        'El manifiesto pide regular los precios del alquiler en zonas tensionadas, ampliar el parque público de vivienda con protección permanente e intervenir el mercado. Lo une al modelo turístico: límites efectivos al crecimiento turístico, una moratoria de nuevas instalaciones y camas y una tasa turística para los no residentes.',
      measureNumbers: [5, 7, 8],
    },
    {
      title: 'Más impuestos a las grandes fortunas',
      text:
        'Propone una reforma fiscal progresiva para que contribuyan más las grandes empresas, los grandes patrimonios y las rentas del capital, más tributación a la banca y las energéticas, y mejores deducciones por alquiler para las rentas medias y bajas. En lo laboral, rechaza que el Estado deje de actualizar el salario mínimo.',
      measureNumbers: [9, 10],
    },
    {
      title: 'Derechos, migración y paz',
      text:
        'El manifiesto defiende los derechos sexuales y reproductivos y los de las personas LGTBIQA+, «especialmente de las personas trans», una política migratoria con vías legales y seguras y sin externalización de fronteras, el voto a los 16 años y la solidaridad con los pueblos palestino y saharaui «en su lucha por la autodeterminación y la independencia».',
      measureNumbers: [11, 12, 16, 15],
    },
  ],
  d21: [
    {
      title: 'La limpieza política abre el programa: 21 medidas',
      text:
        'El bloque 1, «Una limpieza política radical», reúne 21 de las 95 medidas (22 %). Se doblarán los recursos de la Fiscalía Anticorrupción, los delitos de corrupción no prescribirán y sus condenados quedarán inhabilitados de por vida, se eliminarán los aforamientos no previstos en la Constitución, nadie podrá ejercer el mismo cargo más de ocho años y los parlamentarios no cobrarán si no asisten a las sesiones.',
      measureNumbers: [6, 9, 13, 16, 20],
    },
    {
      title: 'Educación es la sección más larga: 27 medidas',
      text:
        'Educación suma 27 de las 95 medidas (28 %), más que España Limpia (21), Vivienda (19), Sanidad (18) o Energía (10). Fija como objetivo el top 10 europeo en PISA en ocho años, y propone pruebas de acceso a las facultades de educación, un MIR educativo de dos años remunerado, becas pagadas en septiembre, un comparador público de titulaciones y una cuenta de unos 500 € por joven.',
      measureNumbers: [47, 54, 55, 60, 61, 67],
    },
    {
      title: 'Vivienda: alivio hoy y un plan a diez años',
      text:
        'Las 19 medidas de vivienda se ordenan en dos fases. La primera limita de forma temporal los alquileres en zonas tensionadas, elimina el IVA, el ITP y el AJD a los menores de 35 años en la compra de vivienda habitual (hasta 400.000 €) y reasigna 10.000 M€ de fondos europeos. La segunda levanta barrios completos con un Plan Nacional a diez años y da a los ayuntamientos 30 días para revisar las licencias de obra mayor.',
      measureNumbers: [22, 26, 27, 33, 36],
    },
    {
      title: 'La inteligencia artificial aparece en cuatro de las cinco secciones',
      text:
        'Ocho medidas usan inteligencia artificial o algoritmos, entre ellas el control de la contratación pública, un tutor de IA para la educación, la auditoría continua de la sanidad, los asistentes clínicos, la alerta temprana de pacientes crónicos y la gestión de la red eléctrica. Solo Vivienda no la menciona.',
      measureNumbers: [7, 42, 71, 82, 84, 92],
    },
    {
      title: 'Energía: reglas estables y neutralidad tecnológica',
      text:
        'Las 10 medidas de energía prohíben por ley los cambios retroactivos sobre proyectos ya comprometidos, piden que el Estado fije objetivos sin elegir tecnología, sustituyen la intervención indiscriminada de precios por un bono social eléctrico automático y piden bajar la carga fiscal de la electricidad. El documento no menciona la energía nuclear.',
      measureNumbers: [86, 87, 88, 89],
    },
  ],
  'eh-bildu': [
    {
      title: 'Cuatro de cada cinco propuestas son de derechos y libertades',
      text:
        '151 de las 188 propuestas (el 80 %) están en el capítulo «Derechos y libertades»; «Nación y autogobierno» tiene 19 y «Paz y convivencia», 18. Las secciones más largas son servicios públicos (35 propuestas, 20 de ellas de salud) y transición ecosocial (31).',
      measureNumbers: [37, 57, 90, 107, 152],
    },
    {
      title: 'Diez propuestas piden traspasar competencias',
      text:
        'Diez propuestas hablan de una transferencia: la Inspección de Trabajo (21), las políticas pasivas de empleo para Navarra (22), el régimen económico de la Seguridad Social (28), la formación sanitaria especializada (48), Sanidad Exterior (56), el Ingreso Mínimo Vital (77), las competencias migratorias (139), las ferroviarias, aeroportuarias y portuarias (106), todas las pendientes del Estatuto Vasco y del Amejoramiento Navarro (157) y que asuman las instituciones vascas cualquier nueva figura, ley o medida estatal que interfiera con las suyas (159). Además propone asumir como nuevas migración, Seguridad Social, protección social y desempleo, puertos y aeropuertos, energía y el Marco Vasco y Navarro de Relaciones Laborales (158).',
      measureNumbers: [21, 28, 56, 77, 139, 157],
    },
    {
      title: 'Vivienda: regular el alquiler y frenar la compra especulativa',
      text:
        'La vivienda abre el programa con 11 propuestas, casi todas de regulación: contratos de alquiler con prórroga automática (1), prohibición permanente de los desahucios de familias vulnerables sin alternativa (2), prohibición de la compra especulativa por empresas, fondos y grandes tenedores (5), un máximo del 2 % de actualización anual de la renta cuando el IPC lo supere (8) y la eliminación de las SOCIMIs (11). El IVA del 21 % a los alojamientos turísticos de corta duración aparece dos veces: en vivienda (10) y en política fiscal (86).',
      measureNumbers: [1, 2, 5, 8, 10, 11],
    },
    {
      title: 'Los impuestos nuevos apuntan a la banca, las energéticas y la distribución',
      text:
        'El programa recupera de forma permanente el impuesto a las energéticas (83), sube el de la banca y las grandes fortunas (84), crea uno sobre los beneficios de las grandes distribuidoras alimentarias (85) y propone gravar los beneficios extraordinarios de las corporaciones energéticas (116) y los vuelos privados (119). Pide además que cualquier figura o cambio fiscal ambiental del Estado pase por la concertación previa con el Concierto y el Convenio (120).',
      measureNumbers: [83, 84, 85, 116, 119, 120],
    },
    {
      title: 'Paz: rechazo a la OTAN, sin bases y con embargo de armas a Israel',
      text:
        'La sección de paz (3.2) reúne 13 propuestas, todas en prosa y en futuro: rechazar la OTAN y el aumento del gasto en defensa que exige (177, 179), cerrar el campo de tiro de las Bardenas (181), impedir el uso de las bases de EEUU en Europa, incluidas Rota y Morón (182), adherirse al Tratado sobre la Prohibición de Armas Nucleares (183) y romper el Tratado de Amistad entre la UE e Israel, con un embargo de armas total (184, 185).',
      measureNumbers: [177, 179, 181, 182, 183, 184],
    },
    {
      title: 'Pocas cifras, casi ningún plazo y tres derogaciones',
      text:
        'Solo 14 de las 188 propuestas llevan un compromiso cuantificado y solo 2 un plazo: la jornada de 32 horas, que las pymes alcanzarían en 3 años como máximo (12), y adelantar la descarbonización al menos a 2045 (90). Las cifras se concentran en pensiones y vivienda: una pensión mínima de 1.220 € (25) y al menos un 15 % más para las de viudedad y las no contributivas (26). Hay tres derogaciones explícitas: la Ley 15/1997 sobre gestión sanitaria (50), la reforma del artículo 135 de la Constitución (88) y la Ley de Secretos Oficiales (172).',
      measureNumbers: [12, 25, 26, 90, 50, 88],
    },
  ],
  comuns: [
    {
      title: 'Drets: el capítulo más largo',
      text:
        'El capítulo «Drets» tiene 250 de las 1.097 medidas (23 %). Incluye también las medidas sobre agricultura y compra pública alimentaria, como las medidas 518 a 522.',
      measureNumbers: [518, 519, 520, 521, 522],
    },
    {
      title: 'Energía y empleo, las categorías con más medidas',
      text:
        'La categoría «energía y clima» tiene 136 medidas y «empleo y emprendimiento», 119. Juntas suman 255 medidas (23 %).',
      measureNumbers: [66, 69, 75, 98, 106],
    },
    {
      title: 'Prohibir: 42 medidas',
      text:
        '42 medidas usan la palabra «prohibir» o «prohibición» en su texto. La medida 31, por ejemplo, propone prohibir la compra de vivienda que no sea para vivir en zonas tensionadas.',
      measureNumbers: [19, 30, 31, 32, 89],
    },
    {
      title: '85 medidas tienen una cifra en porcentaje',
      text:
        '85 de las 1.097 medidas (8 %) llevan un porcentaje en el texto. La medida 1 fija una inversión de al menos el 1 % del PIB durante diez años.',
      measureNumbers: [1, 3, 16, 19, 20],
    },
  ],
  ixlg: [
    {
      title: 'Vivienda y transporte abren el programa: 6 de las 22 medidas',
      text:
        'El primer bloque, «Compromisos para La Gomera», reúne 6 de las 22 medidas (27 %). Tres son de vivienda: un plan estatal para las islas no capitalinas (1), más alquiler público permanente (2) y rehabilitación y bolsa pública de alquiler asequible, con prioridad al uso residencial frente al alquiler turístico (3). Las otras dos tratan del transporte: compensaciones al transporte aéreo y marítimo y medidas para la doble insularidad (4), y frecuencias mínimas, también en fines de semana y festivos (5).',
      measureNumbers: [1, 2, 3, 4, 5],
    },
    {
      title: 'Seis medidas piden un fondo, un plan o una financiación del Estado',
      text:
        'En 6 de las 22 medidas el texto remite al Estado: un plan estatal de vivienda (1), una financiación estatal de los servicios esenciales según su coste real y no solo según los habitantes (6), un fondo estatal plurianual contra el abandono rural (8), un plan estatal de garantía hídrica para las islas menores (13), la financiación estatal de la dependencia (16) y partidas estatales para vivienda, transporte, cuidados, agricultura y prevención de incendios (20).',
      measureNumbers: [1, 6, 8, 13, 16, 20],
    },
    {
      title: 'El bloque económico es una sola medida, sobre el REF',
      text:
        'El bloque «Una economía que te ayude a vivir» contiene una única medida, la 7, un texto largo sobre el Régimen Económico y Fiscal (REF) de Canarias. Dice que no lo cuestiona, pero sí que se haya confundido su defensa con la de determinados intereses, y pide un REF que llegue también a autónomos, pequeñas empresas, trabajadores, familias y jóvenes. El empleo aparece en otros bloques: empleo local ligado a la restauración de bancales y la gestión forestal (10), apoyo a la agricultura familiar, la ganadería y la pesca artesanal (9) y empleo estable y formación profesional en cuidados (18).',
      measureNumbers: [7, 9, 10, 18],
    },
    {
      title: 'Agua, incendios y abandono rural, en 8 medidas',
      text:
        'El bloque «Una isla habitable, productiva y cuidada» tiene 8 medidas, el más largo del programa. Incluye el fondo contra el abandono rural insular (8), el empleo local ligado a bancales, gestión forestal y prevención de incendios (10), finalizar las obras hidráulicas pendientes y poner en funcionamiento las conexiones ya instaladas entre depósitos (12), el plan de garantía hídrica (13) y la financiación estable para la prevención de incendios y la restauración del monteverde (15).',
      measureNumbers: [8, 10, 12, 13, 15],
    },
    {
      title: 'Una ponencia en el Senado y un balance cada seis meses',
      text:
        'El último bloque propone impulsar en el Senado una ponencia sobre las necesidades de las islas menores (19), defender partidas estatales y presentar iniciativas y preguntas parlamentarias sobre los compromisos pendientes (20), abrir una oficina territorial con atención presencial periódica y publicar cada seis meses un balance de actividad (21) y consultar a la ciudadanía y a los municipios sobre las iniciativas que afecten a La Gomera (22). Ninguna de las 22 medidas lleva cifra, plazo ni derogación.',
      measureNumbers: [19, 20, 21, 22],
    },
  ],
  nex: [
    {
      title: 'Vivienda: congelar alquileres, acabar con las SOCIMIs y ceder vivienda vacía',
      text:
        'El bloque de vivienda tiene 16 de las 150 medidas (11 %). Propone congelar los alquileres mientras dure la emergencia habitacional (2), acabar con el régimen fiscal especial de las SOCIMIs (5), la cesión obligatoria del uso de la vivienda vacía de los grandes propietarios para alquiler social (7), precios de referencia del alquiler por código postal en las zonas tensionadas (9) y un Plan Estatal de Vivienda para un parque público de alquiler social a precio de coste (13).',
      measureNumbers: [2, 5, 7, 9, 13],
    },
    {
      title: 'Trabajo: salario mínimo de 1.500 euros, 32 horas y baja pagada al 100 %',
      text:
        'El bloque de trabajo reúne 16 medidas y la categoría «empleo» es la mayor del programa, con 20. Fija un salario mínimo de 1.500 euros en 14 pagas (19), una jornada de 32 horas en todas las empresas y de 30 en las grandes, sin bajar el sueldo (21), la baja médica cobrada al 100 % desde el primer día (28) y 30 días de vacaciones pagadas al año mediante una nueva prestación de la Seguridad Social (29). La medida 26 aplica las 32 horas a la Administración General del Estado.',
      measureNumbers: [19, 21, 26, 28, 29],
    },
    {
      title: 'Nueve de las 13 medidas de la deuda histórica son de ferrocarril',
      text:
        'El bloque «Deuda histórica» tiene 13 medidas y 9 son de ferrocarril (42 a 50). Piden reabrir la Ruta de la Plata con partidas y fechas en los Presupuestos (42), vía doble en los grandes ejes (44), el traspaso a la Junta de los servicios ferroviarios regionales (45), la reapertura de líneas y estaciones clausuradas (49) y un tren de Media Distancia y Regional Exprés gratuito dentro de Extremadura, financiado por el Estado (50). La medida 38 pide cuantificar oficialmente la deuda y un calendario de pago anual.',
      measureNumbers: [38, 42, 44, 45, 49, 50],
    },
    {
      title: 'Energía: el Estado entra con un 30 % en cada nueva planta renovable',
      text:
        'El bloque «Energía y agua» tiene 14 medidas. Fija la independencia energética en 2040 (51), una entrada del Estado del 30 % en cada nueva planta renovable y de almacenamiento (52), una consulta vecinal vinculante para las plantas de más de 50 MW y ninguna en suelo agrícola (53), un peaje eléctrico a las megaplantas (55) y la reversión pública de los saltos hidroeléctricos del Tajo y el Guadiana al vencer las concesiones (56).',
      measureNumbers: [51, 52, 53, 55, 56],
    },
    {
      title: 'Campo y paisajes: el bloque más largo, con 17 medidas',
      text:
        'Es el bloque con más medidas (17). Rechaza Mercosur y cualquier tratado comercial sin cláusulas espejo (65), plantea 6 millones de hectáreas ecológicas en 2030 (66), una normativa básica contra las macrogranjas (74), una Ley de Herbivoría con pastoreo de conservación en montes públicos (78) y un Cuerpo Civil de Regeneración con 20.000 empleos al año dentro del Trabajo Garantizado (81).',
      measureNumbers: [65, 66, 74, 78, 81],
    },
    {
      title: '17 medidas con cifra, 2 con plazo y una derogación',
      text:
        '17 de las 150 medidas (11 %) llevan un compromiso cuantificado. Solo 2 tienen plazo: la independencia energética en 2040 (51) y las hectáreas ecológicas en 2030 (66). La única derogación explícita es la de la Ley 15/1997, que abrió la puerta a la gestión privada de la sanidad pública (127). Entre las cifras están una pensión mínima por encima de 1.200 euros (120) y el 0,7 % de la Renta Nacional Bruta para cooperación al desarrollo (146).',
      measureNumbers: [51, 66, 120, 127, 146],
    },
  ],
  eguzkilore: [
    {
      title: 'Sanidad y familia suman 28 de las 64 medidas',
      text:
        'El programa tiene un único bloque de 64 medidas. Las categorías «sanidad» (15) y «familia» (13) reúnen 28 de ellas (44 %). Entre las de familia están que la Administración garantice y sufrague de 0 a 3 años la excedencia o la reducción de jornada de uno de los progenitores (6), poder reducir hasta un 50 % la jornada hasta los 18 años (18), y el derecho a estar en casa con un hijo enfermo (19) o con un mayor enfermo (28).',
      measureNumbers: [2, 6, 18, 19, 28],
    },
    {
      title: 'Educación: ratios, sin tareas y respeto a los ritmos',
      text:
        'La propuesta de reducir progresivamente las ratios fija 5 alumnos por educador en el primer ciclo de Infantil, 9 en el segundo, 12 en Primaria y 15 en Secundaria (8). Otras piden respeto a los ritmos y procesos de aprendizaje (9), eliminar las tareas salvo excepciones acordadas con cada alumno (12) y tener en cuenta la necesidad de movimiento y el contacto con la naturaleza (13).',
      measureNumbers: [8, 9, 12, 13],
    },
    {
      title: 'Consentimiento y libertad de tratamiento',
      text:
        'Un grupo de medidas defiende el consentimiento y la libertad sanitaria: que se respete el consentimiento recogido en el Código de Núremberg y el Convenio de Oviedo (21), la libertad de elección de los propios tratamientos o pruebas (22), no al pasaporte de vacunación ni a la obligatoriedad de mascarillas (23) y asesoramiento al Parlamento y al Gobierno de Navarra por profesionales de la salud independientes (24). La medida 63 añade la objeción de conciencia para respetar ese consentimiento.',
      measureNumbers: [21, 22, 23, 24, 63],
    },
    {
      title: 'Política exterior: competencias de la UE, Rusia y BRICS',
      text:
        'Cuatro medidas tratan de política exterior: que los Estados recuperen las competencias trasladadas a la Unión Europea, como antes de Maastricht (53), oponerse al euro digital (54), que la Unión incluya a Rusia (55) y que España participe en los BRICS (56). La medida 41 propone además promover la salida de la OTAN y eliminar el uso militar del polígono de tiro de las Bardenas Reales.',
      measureNumbers: [41, 53, 54, 55, 56],
    },
    {
      title: 'Democracia directa, derogar la ley mordaza y recuperar empresas públicas',
      text:
        'Entre las medidas de organización política figuran derogar la ley mordaza y revisar la ley de Bienestar Animal y la «ley trans» (57), la separación de poderes (58), abolir los sueldos vitalicios y suprimir el aforamiento (59), recuperar las empresas públicas privatizadas (60) y una consulta ciudadana que se aplica si obtiene más del 50 % de los votos a favor, a petición del 5 % de los censados (62). Ninguna de las 64 medidas lleva plazo.',
      measureNumbers: [57, 58, 59, 60, 62],
    },
  ],
  fia: [
    {
      title: 'Cinco temas aparecen en los dos bloques',
      text:
        'El programa tiene 20 medidas en dos bloques de 10: «Nuestros 10 compromisos para Aragón» y «Programa político». Cinco temas se repiten: vivienda (2 y 11), salarios y pensiones (1 y 12), campo (6 y 16), sanidad pública y listas de espera (3 y 17) y eliminación de las subvenciones a los partidos (8 y 20).',
      measureNumbers: [1, 2, 3, 6, 8, 20],
    },
    {
      title: 'Vivienda: alquiler municipal y dos derogaciones',
      text:
        'La medida 2 propone construir vivienda social para alquiler con derecho a compra y la 11, viviendas municipales en alquiler. La 7 pide derogar la ley okupa, garantizando el derecho a la propiedad privada, y el reciente Real Decreto-ley sobre el alquiler de viviendas.',
      measureNumbers: [2, 7, 11],
    },
    {
      title: 'Salarios, pensiones, impuestos y cuotas de autónomos',
      text:
        'El primer compromiso propone la subida de salarios y pensiones y la bajada de impuestos (1). El programa político añade un aumento del salario mínimo y sueldos y pensiones con el IPC (12) y una reducción de las cuotas fiscales a los autónomos (18). El compromiso sobre empleo pide empleo estable y de calidad e inversión en I+D (4).',
      measureNumbers: [1, 4, 12, 18],
    },
    {
      title: 'Cuatro medidas nombran obras o lugares concretos',
      text:
        'Cuatro medidas del programa político citan un lugar: usar el aeropuerto de Huesca para tráfico de mercancías (13), terminar la autovía del Pirineo (14), industrializar la ciudad de Huesca (15) y potenciar las empresas del Aragón oriental (19).',
      measureNumbers: [13, 14, 15, 19],
    },
    {
      title: 'Subvenciones a partidos, sindicatos y patronal, y cita presencial',
      text:
        'Dos medidas piden eliminar las subvenciones públicas a los partidos (8, 20) y la 8 extiende la petición a sindicatos y patronal. La 9 mantiene la cita presencial y elimina la obligatoriedad de la cita previa, y la 10 pide una gestión profesional y transparente de lo público, con responsabilidad directa de los gestores. Ninguna de las 20 medidas lleva cifra ni plazo.',
      measureNumbers: [8, 9, 10, 20],
    },
  ],
  alhora: [
    {
      title: 'La independencia, también en inmigración y vivienda',
      text:
        'El programa tiene 41 medidas en 6 bloques, y el primero, «Independència», reúne 5 (1 a 5): una malla municipalista nacional, el uso estratégico de las instituciones, nuevos liderazgos, la confrontación continuada con el Estado y «la pedagogia del no». Otras dos medidas de bloques distintos se titulan «Assolir la independència per gestionar la immigració» (19) y «Assolir la independència per gestionar l\'habitatge» (33).',
      measureNumbers: [1, 4, 5, 19, 33],
    },
    {
      title: 'Lengua: escuelas 100 % en catalán y contratos solo a quien respete el catalán',
      text:
        'El bloque «Llengua i educació» propone una red de escuelas 100 % en catalán (6), una Escola Superior de Magisteri de Catalunya y formar 5.000 nuevos profesores de lengua y cultura catalanas (7), TV3 y Catalunya Ràdio exclusivamente en catalán (8), una regidoria de política lingüística con el 10 % del presupuesto municipal (9) y que ninguna empresa que no respete el catalán reciba contratos públicos (10).',
      measureNumbers: [6, 7, 8, 9, 10],
    },
    {
      title: 'Inmigración: catalanización de adultos y de las familias',
      text:
        'El bloque de inmigración tiene 7 medidas. Una invierte 1.000 millones de euros en un plan remunerado de enseñanza de lengua y cultura catalanas, con el objetivo de formar 100.000 personas al año (22). Otras piden formación profesional para la segunda generación (23), facilitar la inserción laboral de las mujeres inmigrantes como vía para la catalanización de las familias (24) y una estrategia demográfica centrada en vivienda, estabilidad laboral, transporte y cuidados (25).',
      measureNumbers: [19, 22, 23, 24, 25],
    },
    {
      title: 'Vivienda: parque público de alquiler, fiscalidad y moratoria turística',
      text:
        'El bloque de vivienda tiene 8 medidas. Propone un gran parque público de alquiler para rentas mixtas, que crezca construyendo y comprando vivienda privada (26), un mercado de alquiler con garantías públicas ante el impago (29), estudiar rebajar el ITP y el AJD en la primera vivienda habitual (31) y una tasa turística disuasoria y una moratoria de licencias turísticas (32).',
      measureNumbers: [26, 29, 31, 32],
    },
    {
      title: 'Ferrocarril: 8 de las 41 medidas, de «Fora Renfe» a una sola red catalana',
      text:
        'El bloque «Mobilitat i territori» tiene 8 medidas (20 %), todas sobre transporte. Plantea que la Generalitat decida quién opera Rodalies, con la plataforma «Fora Renfe» y su iniciativa legislativa popular (34), horarios cadenciados de tres niveles como en Suiza (35), un interregional exprés por la línea de alta velocidad (36), una red en malla entre capitales de comarca (37) y un único ancho de vía y un único voltaje (38).',
      measureNumbers: [34, 35, 36, 37, 38],
    },
  ],
  'agenda-valenciana': [
    {
      title: 'Financiación: un nuevo modelo, compensar la deuda e igualar a Madrid y Barcelona',
      text:
        'Cuatro de las 16 medidas piden recursos al Estado: reformar de inmediato el sistema de financiación con una igualación transitoria (1), compensar la deuda valenciana por infrafinanciación (2), dotaciones para el área metropolitana equivalentes a las de Madrid y Barcelona (7) y equiparar la financiación estatal del Palau de les Arts a la del Teatro Real o el Liceu (14).',
      measureNumbers: [1, 2, 7, 14],
    },
    {
      title: 'Menos trabas y fondos más rápidos',
      text:
        'Varias medidas buscan agilizar: reformas en el Congreso para eliminar trabas burocráticas y agilizar la contratación de obras y personal en los ayuntamientos (3), acelerar la ejecución de los fondos asignados a los municipios (4), reducir las cargas administrativas de pymes y autónomos (11) y crear plazas judiciales para reducir los retrasos procesales (13).',
      measureNumbers: [3, 4, 11, 13],
    },
    {
      title: 'Identidad: derecho civil, Policía Valenciana y lengua',
      text:
        'El bloque «Autogobierno, Derecho Civil e Identidad» tiene 3 de las 16 medidas: recuperar el Derecho Civil Valenciano (8), impulsar una Policía Valenciana capacitada para responder a emergencias (9) y proteger y fomentar el uso de la lengua valenciana y profundizar en el autogobierno (10).',
      measureNumbers: [8, 9, 10],
    },
    {
      title: 'Cercanías y Metrovalencia, con las líneas C1, C2, C3 y C6',
      text:
        'El bloque de movilidad tiene 3 medidas. La primera amplía frecuencias, capacidad y fiabilidad en las líneas C1, C2, C3 y C6 de Renfe y mejora Metrovalencia, con atención a los municipios de l\'Horta (5). Las otras finalizan las actuaciones en la C3 y aceleran el corredor ferroviario con Europa (6) y piden dotaciones metropolitanas equivalentes a las de Madrid y Barcelona (7).',
      measureNumbers: [5, 6, 7],
    },
    {
      title: 'Regeneración y voz propia: el bloque más largo, con 4 medidas',
      text:
        'El último bloque es el más largo (4 de las 16 medidas). Propone justicia más eficaz (13), más canales temáticos en À Punt (14), una reducción drástica de los aforamientos y más transparencia (15) y votar en Madrid a favor de cualquier iniciativa que beneficie a los municipios valencianos, con independencia de su origen partidista (16). Ninguna de las 16 medidas lleva cifra ni plazo.',
      measureNumbers: [13, 14, 15, 16],
    },
  ],
  podemos: [
    {
      title: 'Casi seis de cada diez medidas son de «vida y planeta»',
      text:
        'El bloque «Vida solo hay una. Planeta solo hay uno» reúne 261 de las 442 medidas (el 59 %): violencias machistas y aborto, cuidados, migración, cultura (44 medidas), educación, sanidad, clima, transporte, campo y protección animal. Los cinco bloques restantes suman entre 29 (vivienda) y 41 (paz) medidas cada uno.',
      measureNumbers: [146, 190, 205, 278, 300, 328],
    },
    {
      title: 'Vivienda: alquileres un 40 % más baratos por ley',
      text:
        'El primer bloque (29 medidas, cinco de ellas remisiones al bloque de precios) propone rebajar el alquiler un 40 % en contratos vigentes y nuevos, sin que baje del 60 % del precio medio de la zona (1), hacer indefinidos los contratos de vivienda habitual (2) y prohibir comprar casas que no sean para vivir (3). Impulsa la expropiación de uso de las viviendas de grandes tenedores con más de diez (4), prohíbe los pisos turísticos mientras dure la emergencia habitacional (7) y crea una Inmobiliaria Pública con renta máxima del 30 % de la renta media del municipio (8).',
      measureNumbers: [1, 2, 3, 4, 7, 8],
    },
    {
      title: 'Más sector público: banca, energía, supermercados y tren',
      text:
        'Varias medidas crean o amplían titularidad pública: una Banca Pública con el ICO, CDTI y ENISA (33), una red pública de supermercados (34), una Empresa Pública de Energía con la mayoría del capital de Repsol (36 y 37), el 100 % del capital de Red Eléctrica (329) y un operador ferroviario único, con la revocación de las licencias de Ouigo e Iryo (345). La Inmobiliaria Pública (8) y la industria sanitaria y farmacéutica pública (301) siguen la misma línea.',
      measureNumbers: [8, 33, 34, 36, 37, 329, 345],
    },
    {
      title: 'Paz: salida de la OTAN y gasto militar congelado',
      text:
        'Las 41 medidas del bloque de paz piden denunciar el Tratado del Atlántico Norte y cerrar las bases de Rota y Morón (70), revertir el rearme y congelar el gasto militar durante la legislatura (72) y rechazar el 5 % del PIB en 2035 (73). También proponen un Estatuto de Neutralidad con una reforma constitucional «No a la Guerra» (71), un embargo de armas a Israel (95) y la ruptura de relaciones con ese país (94).',
      measureNumbers: [70, 71, 72, 73, 94, 95],
    },
    {
      title: 'Trabajar menos: SMI de 1.800 euros, 30 horas y jubilación a los 63',
      text:
        'El bloque laboral fija un SMI de 1.800 euros al mes en una legislatura y nunca inferior al 75 % del salario mediano (111), una jornada de 30 horas semanales, empezando por 35 (113), y la edad ordinaria de jubilación a los 63 años (116). Añade la pensión mínima equiparada al SMI (127), la prohibición de las horas extra sin compensación en descanso (119) y una renta universal incondicionada a partir del Ingreso Mínimo Vital (135).',
      measureNumbers: [111, 113, 116, 119, 127, 135],
    },
    {
      title: '10 medidas derogan leyes y 16 llevan «prohibir» en el título',
      text:
        'Diez medidas anuncian derogaciones explícitas: la Ley de Extranjería (205), la «Ley Beckham» (51), la reforma del artículo 135 de la Constitución (62), los efectos de las reformas laborales de 2010 y 2012 (117), las leyes privatizadoras de la sanidad (300), la ley de la tauromaquia (404), la Ley Mordaza (427) y otras. Otras 16 llevan «prohibición» o «prohibir» en su título, entre ellas los pisos turísticos (7), las horas extra (119) y los vuelos cortos con alternativa ferroviaria (341).',
      measureNumbers: [51, 62, 117, 205, 300, 427],
    },
  ],
};
