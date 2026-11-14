/**
 * Posturas de los partidos en los temas que dividen (`src/data/temas.ts`), según su programa electoral.
 *
 * Cada postura cita las medidas del programa en las que se apoya: el número de la medida en
 * `programas/<partido>.json`. La compilación falla si una medida no existe.
 * - `side: 'a'` o `'b'`: el partido defiende la postura A o la B del tema.
 * - `side: 'matiz'`: el programa trata el tema sin tomar del todo una de las dos posturas.
 * Un partido sin postura en un tema no aparece: su programa no dice nada sobre él.
 *
 * Para añadir una postura: una línea más, con el tema, el partido, el lado, las medidas y una nota corta
 * que explique la postura con las palabras del programa. Revisión editorial: 14 de noviembre de 2026 (segunda lectura completa de los programas).
 */

export interface Stance {
  topic: string;
  party: string;
  side: 'a' | 'b' | 'matiz';
  measures: number[];
  note: string;
}

export const stances: Stance[] = [
  // Inmigración y regularización
  { topic: 'inmigracion', party: 'adelante', side: 'a', measures: [547, 548, 549, 550, 553], note: 'Regularización extraordinaria, una ley de derechos en lugar de la Ley de Extranjería, vías legales y cierre de los CIE.' },
  { topic: 'inmigracion', party: 'ph', side: 'a', measures: [29, 30], note: 'Derogar la Ley de Extranjería, cerrar los CIE y regularizar a todas las personas migrantes residentes.' },
  { topic: 'inmigracion', party: 'mundo-mas-justo', side: 'a', measures: [54, 94, 96, 98], note: 'Facilitar la regularización, vías legales y seguras y fin de las devoluciones en caliente.' },
  { topic: 'inmigracion', party: 'bng', side: 'a', measures: [91, 95, 99], note: 'La regularización como vía contra la explotación, más derechos y cierre de los CIE.' },
  { topic: 'inmigracion', party: 'erc', side: 'a', measures: [51], note: 'Fin de la externalización de fronteras y vías legales y seguras para migrar.' },
  { topic: 'inmigracion', party: 'pfac', side: 'matiz', measures: [13], note: 'Control efectivo de las fronteras y, a la vez, vías seguras e integración.' },
  { topic: 'inmigracion', party: 'eaj-pnv', side: 'matiz', measures: [18], note: 'Una migración gestionada, con más competencias para Euskadi y permisos más rápidos.' },
  { topic: 'inmigracion', party: 'pp', side: 'b', measures: [37, 42, 43, 45], note: 'Prohibir por ley las regularizaciones masivas, arraigo excepcional, devoluciones en siete días y compromiso de integración.' },
  { topic: 'inmigracion', party: 'vox', side: 'b', measures: [10, 11, 13, 14, 19], note: 'Supresión del arraigo, «remigración», deportación y fin de toda ayuda a los inmigrantes en situación irregular.' },
  { topic: 'inmigracion', party: 'salf', side: 'b', measures: [39, 40, 44], note: 'Expulsión en 48 horas, fin de las regularizaciones y residencia y nacionalidad revocables.' },
  { topic: 'inmigracion', party: 'fo', side: 'b', measures: [101, 103], note: 'Control absoluto de las fronteras y expulsión de quien esté de forma irregular.' },
  { topic: 'inmigracion', party: 'ie', side: 'b', measures: [7], note: 'Reforzar el control de fronteras y cambiar las reglas de expulsión y asilo.' },
  { topic: 'inmigracion', party: 'pacma', side: 'matiz', measures: [100], note: 'Acceso unificado a la educación, la sanidad y el alojamiento, y más plazas de acogida, sin hablar de regularizar ni de vías legales.' },

  // Aborto
  { topic: 'aborto', party: 'adelante', side: 'a', measures: [47, 48], note: 'Aborto en centros públicos de todas las provincias y en la Constitución.' },
  { topic: 'aborto', party: 'mundo-mas-justo', side: 'matiz', measures: [80, 81, 82], note: 'Prevención de embarazos no deseados, apoyo a la maternidad y atención psicológica antes y después de una interrupción voluntaria, sin pedir más derechos.' },
  { topic: 'aborto', party: 'pp', side: 'matiz', measures: [159], note: 'No habla del aborto, pero el concebido no nacido contará para las ayudas a la familia.' },
  { topic: 'aborto', party: 'vox', side: 'b', measures: [98], note: 'Defensa del derecho a la vida «desde su concepción hasta la muerte natural» y objeción de conciencia de los sanitarios.' },

  // Monarquía o república
  { topic: 'monarquia', party: 'pfac', side: 'b', measures: [12], note: 'Avanzar hacia un Estado republicano, federal y laico.' },
  { topic: 'monarquia', party: 'erc', side: 'b', measures: [3, 9], note: 'Fiscalizar al rey y a la Casa Real y apoyar las iniciativas que puedan «poner fin a esta institución».' },
  { topic: 'monarquia', party: 'vox', side: 'a', measures: [105], note: 'La máxima protección jurídica para los símbolos de la Nación, entre ellos la Corona.' },

  // Cataluña y autodeterminación
  { topic: 'autodeterminacion', party: 'erc', side: 'a', measures: [1], note: 'Negociar un referéndum de autodeterminación en Cataluña con acompañamiento internacional.' },
  { topic: 'autodeterminacion', party: 'pp', side: 'b', measures: [17], note: 'Recuperar los delitos de sedición y de convocatoria de referéndum ilegal.' },
  { topic: 'autodeterminacion', party: 'salf', side: 'b', measures: [73], note: 'Prohibir las amnistías en la Constitución y los indultos por motivos políticos.' },
  { topic: 'autodeterminacion', party: 'vox', side: 'b', measures: [42], note: 'España es «un solo mercado y una sola Nación».' },
  { topic: 'autodeterminacion', party: 'bng', side: 'a', measures: [157], note: 'Cambiar las leyes para permitir referendos vinculantes, «incluído o dereito de autodeterminación».' },
  { topic: 'autodeterminacion', party: 'adelante', side: 'matiz', measures: [346], note: 'Un modelo confederal: «un Estado de pueblos libres e iguales».' },

  // Vivienda: control del alquiler
  { topic: 'vivienda', party: 'adelante', side: 'a', measures: [160, 161, 164], note: 'Alquiler social obligatorio, alquiler al 20 % del salario y zonas tensionadas obligatorias.' },
  { topic: 'vivienda', party: 'mundo-mas-justo', side: 'a', measures: [4], note: 'Regular los alquileres privados.' },
  { topic: 'vivienda', party: 'ph', side: 'a', measures: [7], note: 'Un tope legal del alquiler indexado al 30 % de los ingresos.' },
  { topic: 'vivienda', party: 'pfac', side: 'a', measures: [6], note: 'Limitar el precio de los alquileres y prorrogar los contratos de forma automática.' },
  { topic: 'vivienda', party: 'd21', side: 'matiz', measures: [22], note: 'Limitar los precios en zonas tensionadas solo de forma temporal, hasta que crezca la oferta.' },
  { topic: 'vivienda', party: 'eaj-pnv', side: 'matiz', measures: [2], note: 'Evitar los contratos de temporada que eluden los derechos del inquilino, sin tope de precio.' },
  { topic: 'vivienda', party: 'pp', side: 'b', measures: [145, 156], note: 'Derogar la Ley de Vivienda; incentivos al propietario que alquila de forma estable.' },
  { topic: 'vivienda', party: 'vox', side: 'b', measures: [30], note: 'Derogar la Ley de Vivienda y dar incentivos fiscales al alquiler de larga duración.' },
  { topic: 'vivienda', party: 'salf', side: 'b', measures: [3, 9], note: 'Desalojo de okupas en 48 horas y licencia de obra automática en 15 días.' },
  { topic: 'vivienda', party: 'bng', side: 'a', measures: [20], note: 'Renovación automática de los alquileres y contratos indefinidos por ley.' },
  { topic: 'vivienda', party: 'erc', side: 'matiz', measures: [62], note: 'Mejorar la regulación de los arrendamientos para proteger a los inquilinos, sin un tope de precio.' },
  { topic: 'vivienda', party: 'cc', side: 'matiz', measures: [24], note: 'Incentivos fiscales al pequeño propietario que alquila a precio asequible, sin tope general.' },
  { topic: 'vivienda', party: 'pacma', side: 'matiz', measures: [86], note: 'Construcción masiva de vivienda pública y límites a los pisos turísticos, pero con incentivos fiscales a los propietarios y sin tope general del alquiler.' },

  // Religión y educación
  { topic: 'religion-educacion', party: 'bng', side: 'a', measures: [167], note: 'La Religión fuera del currículo y renegociar el concordato con la Santa Sede.' },
  { topic: 'religion-educacion', party: 'adelante', side: 'a', measures: [73, 506], note: 'Escuela laica y fin de los privilegios religiosos.' },
  { topic: 'religion-educacion', party: 'pfac', side: 'a', measures: [12], note: 'Un Estado laico.' },
  { topic: 'religion-educacion', party: 'erc', side: 'a', measures: [8], note: 'El IBI para todas las propiedades de las confesiones religiosas.' },
  { topic: 'religion-educacion', party: 'pp', side: 'b', measures: [212], note: 'Los padres elegirán colegio y no se eliminará ningún concierto con demanda.' },
  { topic: 'religion-educacion', party: 'salf', side: 'b', measures: [101], note: 'Cheque escolar válido en la pública, la concertada y la privada.' },
  { topic: 'religion-educacion', party: 'pacma', side: 'a', measures: [69], note: 'Garantizar «una escuela pública realmente laica».' },

  // Feminismo y leyes de igualdad
  { topic: 'igualdad', party: 'bng', side: 'a', measures: [100, 101, 106], note: 'Cumplir las obligaciones internacionales y el Pacto de Estado contra la violencia machista y legislar el feminicidio.' },
  { topic: 'igualdad', party: 'adelante', side: 'a', measures: [508, 509, 510], note: 'Pacto de Estado con presupuesto, leyes integrales y VioGén reforzado.' },
  { topic: 'igualdad', party: 'mundo-mas-justo', side: 'a', measures: [158], note: 'Protección integral frente a todas las formas de violencia de género.' },
  { topic: 'igualdad', party: 'pfac', side: 'a', measures: [1], note: 'Acabar con la violencia machista en todas sus formas.' },
  { topic: 'igualdad', party: 'eaj-pnv', side: 'a', measures: [16], note: 'Protección frente a la violencia machista.' },
  { topic: 'igualdad', party: 'cc', side: 'a', measures: [17], note: 'Igualdad y protección frente a la violencia de género.' },
  { topic: 'igualdad', party: 'pp', side: 'matiz', measures: [28, 115], note: 'Proteger a las mujeres, pero revisar las normas de igualdad que han generado «inseguridad jurídica».' },
  { topic: 'igualdad', party: 'vox', side: 'b', measures: [47], note: 'Derogar «las leyes que han criminalizado a los hombres».' },
  { topic: 'igualdad', party: 'erc', side: 'a', measures: [87], note: 'Blindar las políticas feministas y los recursos contra las violencias machistas.' },
  { topic: 'igualdad', party: 'pacma', side: 'a', measures: [95], note: 'Más medios contra la violencia machista: unidades policiales especializadas las 24 horas y campañas contra los estereotipos de género.' },

  // Memoria histórica
  { topic: 'memoria', party: 'adelante', side: 'a', measures: [567, 572], note: 'Fin de la impunidad y la memoria en las aulas.' },
  { topic: 'memoria', party: 'bng', side: 'a', measures: [149, 152], note: 'Derogar la Ley de Amnistía de 1977 y reformar la Ley de Memoria contra la impunidad del franquismo.' },
  { topic: 'memoria', party: 'erc', side: 'a', measures: [6, 96], note: 'Terminar la auditoría de los bienes expoliados por el franquismo y una ley de memoria LGTBI.' },
  { topic: 'memoria', party: 'mundo-mas-justo', side: 'a', measures: [16], note: 'Una red pública de memoria, reparación y justicia restaurativa.' },
  { topic: 'memoria', party: 'pp', side: 'b', measures: [129], note: 'Derogar la Ley de Memoria Democrática y aprobar una Ley de Concordia.' },
  { topic: 'memoria', party: 'vox', side: 'b', measures: [46], note: 'Superar las «divisivas leyes ideológicas», como la de Memoria Democrática.' },

  // Energía nuclear
  { topic: 'nuclear', party: 'adelante', side: 'a', measures: [407], note: 'Ni un euro para la nuclear y cierre ordenado de El Cabril.' },
  { topic: 'nuclear', party: 'pp', side: 'b', measures: [228], note: 'Eliminar el calendario de cierre de Almaraz, Ascó, Vandellós, Cofrentes y Trillo.' },
  { topic: 'nuclear', party: 'fo', side: 'b', measures: [24], note: 'Apuesta por la nuclear como fuente fiable, estable y controlable.' },
  { topic: 'nuclear', party: 'ie', side: 'b', measures: [12], note: 'Defiende la energía nuclear y el fin de las subvenciones a las renovables.' },
  { topic: 'nuclear', party: 'vox', side: 'b', measures: [8], note: 'Recuperar el plan nuclear nacional y derogar el calendario de cierre de las centrales.' },
  { topic: 'nuclear', party: 'erc', side: 'matiz', measures: [147], note: 'Que el Estado contribuya al Fondo de Transición Nuclear de Cataluña.' },
  { topic: 'nuclear', party: 'pacma', side: 'a', measures: [43], note: 'El modelo basado en los combustibles fósiles y la energía nuclear «es insostenible»: apuesta por las renovables.' },

  // Impuestos y redistribución
  { topic: 'impuestos', party: 'adelante', side: 'a', measures: [232, 233], note: 'IRPF más progresivo y un impuesto sobre la riqueza.' },
  { topic: 'impuestos', party: 'mundo-mas-justo', side: 'a', measures: [46, 47], note: 'Un impuesto sobre el patrimonio más progresivo y una tributación mínima del 3 %.' },
  { topic: 'impuestos', party: 'bng', side: 'a', measures: [231], note: 'Mantener los impuestos a la banca, las energéticas y las grandes fortunas.' },
  { topic: 'impuestos', party: 'fo', side: 'a', measures: [30], note: 'Subir los impuestos de sociedades y de patrimonio a las grandes empresas.' },
  { topic: 'impuestos', party: 'pp', side: 'b', measures: [178, 183], note: 'Deflactar el IRPF y eliminar los impuestos que frenan la inversión.' },
  { topic: 'impuestos', party: 'salf', side: 'b', measures: [30, 86], note: 'Suprimir sucesiones, donaciones y patrimonio y bajar la cuña fiscal.' },
  { topic: 'impuestos', party: 'vox', side: 'b', measures: [2], note: 'Rebaja masiva de impuestos: IRPF, IVA y sociedades.' },

  // Lenguas cooficiales
  { topic: 'lenguas', party: 'erc', side: 'a', measures: [10, 11, 17], note: 'Una ley del plurilingüismo, el catalán oficial en la UE y blindar la inmersión lingüística.' },
  { topic: 'lenguas', party: 'bng', side: 'a', measures: [395], note: 'Normalizar el uso del gallego en la Administración central.' },
  { topic: 'lenguas', party: 'fo', side: 'matiz', measures: [41], note: 'Derecho a estudiar en castellano o en las lenguas cooficiales.' },
  { topic: 'lenguas', party: 'pp', side: 'b', measures: [96, 127], note: 'Garantizar la enseñanza en castellano en toda España y el castellano como lengua común de trabajo en el Congreso.' },
  { topic: 'lenguas', party: 'salf', side: 'b', measures: [97], note: 'Castellano garantizado, sin tener que ir a juicio.' },

  // Penas y facultades policiales
  { topic: 'seguridad', party: 'adelante', side: 'a', measures: [487, 496], note: 'Derogar la «ley mordaza» y la prisión permanente revisable.' },
  { topic: 'seguridad', party: 'bng', side: 'a', measures: [144, 145], note: 'Derogar la «ley mordaza» y la prisión permanente revisable.' },
  { topic: 'seguridad', party: 'eaj-pnv', side: 'matiz', measures: [14], note: 'Una respuesta judicial «proporcionada» a la multirreincidencia.' },
  { topic: 'seguridad', party: 'pp', side: 'b', measures: [20, 30], note: 'Respuesta penal más rápida a la multirreincidencia y más prisión permanente revisable.' },
  { topic: 'seguridad', party: 'vox', side: 'b', measures: [81], note: 'Ampliar la prisión permanente revisable.' },
  { topic: 'seguridad', party: 'salf', side: 'b', measures: [11, 12], note: 'Una macrocárcel y el cumplimiento íntegro de las penas.' },

  // Ley trans
  { topic: 'ley-trans', party: 'bng', side: 'a', measures: [142], note: 'Proteger a las personas trans menores, con su derecho a la autodeterminación de género.' },
  { topic: 'ley-trans', party: 'adelante', side: 'a', measures: [534], note: 'Desarrollar las leyes trans y LGTBI.' },
  { topic: 'ley-trans', party: 'pp', side: 'b', measures: [115], note: 'Revisar la Ley Trans y eliminar la libre autodeterminación registral del sexo.' },
  { topic: 'ley-trans', party: 'pfac', side: 'b', measures: [5], note: 'Derogar la ley trans.' },
  { topic: 'ley-trans', party: 'fo', side: 'b', measures: [58], note: 'Derogar la Ley Trans.' },

  // Gestación subrogada
  { topic: 'gestacion-subrogada', party: 'adelante', side: 'b', measures: [521], note: 'Prohibir la gestación subrogada.' },
  { topic: 'gestacion-subrogada', party: 'mundo-mas-justo', side: 'b', measures: [164], note: 'Mantener la prohibición de la gestación subrogada en España.' },
  { topic: 'gestacion-subrogada', party: 'fo', side: 'b', measures: [62], note: 'Prohibir y perseguir los vientres de alquiler.' },
  { topic: 'gestacion-subrogada', party: 'pfac', side: 'b', measures: [4], note: 'Perseguir la explotación reproductiva y no inscribir a los bebés comprados en otros países.' },

  // Tauromaquia
  { topic: 'tauromaquia', party: 'adelante', side: 'a', measures: [631, 632, 634], note: 'Que no sea patrimonio, ni un euro público y fuera los menores.' },
  { topic: 'tauromaquia', party: 'vox', side: 'b', measures: [77], note: 'Defensa y promoción de la tauromaquia.' },
  { topic: 'tauromaquia', party: 'pp', side: 'b', measures: [136], note: 'Restituir el Premio Nacional de Tauromaquia y proteger las fiestas y tradiciones populares.' },
  { topic: 'tauromaquia', party: 'pacma', side: 'a', measures: [7, 96], note: 'Abolir los festejos con animales, derogar la Ley 18/2013, retirar las subvenciones y prohibir la presencia de menores.' },

  // OTAN
  { topic: 'otan', party: 'ph', side: 'a', measures: [24], note: 'Neutralidad activa y salida de la OTAN.' },
  { topic: 'otan', party: 'fo', side: 'a', measures: [12], note: 'Salida inmediata de la OTAN.' },
  { topic: 'otan', party: 'adelante', side: 'a', measures: [579], note: 'Un referéndum sobre la permanencia en la OTAN.' },
  { topic: 'otan', party: 'ie', side: 'a', measures: [5], note: 'Revisar la relación con la OTAN con consultas ciudadanas y una política de neutralidad.' },
  { topic: 'otan', party: 'bng', side: 'matiz', measures: [506], note: 'Rechaza más gasto militar y las directrices de la OTAN, sin pedir la salida.' },
  { topic: 'otan', party: 'pp', side: 'b', measures: [54], note: 'Reforzar los contingentes españoles y el pilar europeo de la OTAN.' },

  // Burka
  { topic: 'burka', party: 'vox', side: 'b', measures: [71], note: 'Prohibir el burka y el niqab en los espacios públicos.' },
  { topic: 'burka', party: 'salf', side: 'b', measures: [47], note: 'Velo integral prohibido.' },

  // Eutanasia
  { topic: 'eutanasia', party: 'adelante', side: 'a', measures: [33], note: 'Plazos más ágiles para la eutanasia, sin recurso de familiares.' },
  { topic: 'eutanasia', party: 'mundo-mas-justo', side: 'b', measures: [74, 83], note: 'Cuidados paliativos universales: «que nadie pida morir por falta de cuidados».' },
  { topic: 'eutanasia', party: 'vox', side: 'b', measures: [98], note: 'El derecho a la vida «hasta la muerte natural» y más cuidados paliativos.' },
  { topic: 'eutanasia', party: 'pp', side: 'matiz', measures: [226], note: 'Garantizar los cuidados paliativos «respetando siempre la voluntad del paciente», sin hablar de la eutanasia.' },

  // Servicio militar
  { topic: 'servicio-militar', party: 'adelante', side: 'a', measures: [589], note: 'Ningún servicio militar, ni obligatorio ni voluntario.' },
  { topic: 'servicio-militar', party: 'bng', side: 'a', measures: [492], note: 'Abolir para siempre el servicio militar obligatorio y prohibir por ley que vuelva.' },
  { topic: 'servicio-militar', party: 'salf', side: 'b', measures: [17, 18], note: 'Una «mili voluntaria» de seis a doce meses, pagada y con ventajas fiscales.' },
];
