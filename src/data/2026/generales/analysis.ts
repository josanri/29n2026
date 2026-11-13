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
        'Solo 14 medidas tienen un plazo explícito (100 días, 6 meses, 2029…), y 27 incluyen una cifra concreta. Ocho números del programa están reservados con el texto «Permanezca atento a la campaña para conocer esta nueva medida».',
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
};
