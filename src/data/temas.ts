/**
 * Temas que dividen: los debates más polarizantes, cada uno con dos posturas opuestas.
 * Es común a todas las elecciones. Las posturas de los partidos de cada elección están en
 * `src/data/<año>/<tipo>/posturas.ts`, con la medida del programa en la que se apoya cada una.
 *
 * Para añadir un tema: una entrada más en `topics`, con un `id` nuevo. Para quitarlo del test sin borrar
 * sus posturas: `active: false`. `featured: true` lo pone entre los temas principales del test.
 */

export interface Topic {
  id: string;
  /** Nombre corto: «Aborto». */
  title: string;
  /** La pregunta del test, que se responde con una de las dos posturas. */
  question: string;
  /** Postura A y postura B: un nombre corto y la frase que la explica. */
  a: { label: string; text: string };
  b: { label: string; text: string };
  /** `eje`: un gran eje del debate político. `dilema`: una pregunta concreta, de sí o no. */
  kind: 'eje' | 'dilema';
  featured?: boolean;
  active?: boolean;
}

export const topics: Topic[] = [
  {
    id: 'inmigracion',
    title: 'Inmigración y regularización',
    question: '¿Hay que regularizar a los inmigrantes que ya viven y trabajan en España?',
    a: { label: 'Regularizar', text: 'Regularizar a los inmigrantes que ya viven y trabajan en España y abrir vías legales.' },
    b: { label: 'Endurecer', text: 'Endurecer los requisitos, limitar la regularización y priorizar el control migratorio.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'aborto',
    title: 'Aborto',
    question: '¿El aborto debe ser un derecho garantizado?',
    a: { label: 'Garantizarlo', text: 'Defender el aborto como un derecho y garantizar su acceso en la sanidad pública.' },
    b: { label: 'Restringirlo', text: 'Restringirlo y reforzar la protección jurídica del no nacido.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'monarquia',
    title: 'Monarquía o república',
    question: '¿España debe mantener la monarquía parlamentaria?',
    a: { label: 'Monarquía', text: 'Mantener la monarquía parlamentaria y proteger la Corona.' },
    b: { label: 'República', text: 'Celebrar un referéndum y avanzar hacia una república.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'autodeterminacion',
    title: 'Cataluña y autodeterminación',
    question: '¿Debe reconocerse el derecho a decidir de Cataluña y de otros territorios?',
    a: { label: 'Derecho a decidir', text: 'Reconocer el derecho a decidir y negociar un referéndum o más soberanía.' },
    b: { label: 'Unidad', text: 'Defender la unidad de España y rechazar la autodeterminación unilateral.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'vivienda',
    title: 'Control del precio del alquiler',
    question: '¿Hay que limitar por ley el precio de los alquileres?',
    a: { label: 'Limitar', text: 'Limitar los alquileres y regular el mercado para garantizar el acceso a la vivienda.' },
    b: { label: 'Más oferta', text: 'Priorizar la propiedad privada y la seguridad jurídica, y aumentar la oferta sin controles generales.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'religion-educacion',
    title: 'Religión y educación',
    question: '¿La escuela debe ser laica y la religión salir del currículo?',
    a: { label: 'Escuela laica', text: 'Una educación pública laica y menos presencia institucional de la religión.' },
    b: { label: 'Libre elección', text: 'Preservar la libre elección de centro, la concertada y la enseñanza religiosa.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'igualdad',
    title: 'Feminismo y leyes de igualdad',
    question: '¿Hay que mantener las leyes específicas contra la violencia de género?',
    a: { label: 'Mantenerlas', text: 'Mantener y reforzar las políticas de igualdad y de protección frente a la violencia de género.' },
    b: { label: 'Revisarlas', text: 'Revisar las políticas basadas en el género y legislar sin diferencias por sexo.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'memoria',
    title: 'Memoria histórica',
    question: '¿Hay que mantener las políticas públicas de memoria democrática?',
    a: { label: 'Memoria', text: 'Mantener y ampliar las políticas de memoria democrática y de reparación.' },
    b: { label: 'Concordia', text: 'Derogar o sustituir las leyes de memoria por una interpretación común del pasado.' },
    kind: 'eje',
  },
  {
    id: 'nuclear',
    title: 'Energía nuclear',
    question: '¿Hay que cerrar las centrales nucleares?',
    a: { label: 'Cerrarlas', text: 'Cerrar progresivamente las centrales nucleares y apostar por las renovables.' },
    b: { label: 'Prolongarlas', text: 'Prolongar su funcionamiento para garantizar el suministro y reducir emisiones.' },
    kind: 'eje',
  },
  {
    id: 'impuestos',
    title: 'Impuestos y redistribución',
    question: '¿Deben pagar más impuestos las rentas y los patrimonios altos?',
    a: { label: 'Más a quien más tiene', text: 'Aumentar la contribución de las rentas altas y los grandes patrimonios.' },
    b: { label: 'Bajar impuestos', text: 'Reducir impuestos para favorecer la inversión, el ahorro y la actividad.' },
    kind: 'eje',
  },
  {
    id: 'lenguas',
    title: 'Lenguas cooficiales',
    question: '¿Hay que reforzar las lenguas cooficiales en la escuela y en la administración?',
    a: { label: 'Reforzarlas', text: 'Reforzar la presencia y la protección de las lenguas cooficiales.' },
    b: { label: 'Castellano', text: 'Garantizar la enseñanza en castellano y la libre elección de lengua.' },
    kind: 'eje',
  },
  {
    id: 'seguridad',
    title: 'Penas y facultades policiales',
    question: '¿Hay que endurecer las penas y ampliar las facultades de la policía?',
    a: { label: 'Garantías', text: 'Priorizar las garantías individuales: derogar la «ley mordaza» y la prisión permanente revisable.' },
    b: { label: 'Mano dura', text: 'Endurecer las penas contra la delincuencia y la reincidencia y ampliar la prisión permanente revisable.' },
    kind: 'eje',
    featured: true,
  },
  {
    id: 'ley-trans',
    title: 'Ley trans',
    question: '¿Debe mantenerse la libre autodeterminación del sexo en el registro?',
    a: { label: 'Mantenerla', text: 'Mantener la autodeterminación de género y proteger a las personas trans.' },
    b: { label: 'Derogarla', text: 'Derogar o revisar la ley trans y eliminar la autodeterminación registral del sexo.' },
    kind: 'dilema',
  },
  {
    id: 'gestacion-subrogada',
    title: 'Gestación subrogada',
    question: '¿Debería permitirse la gestación subrogada?',
    a: { label: 'Permitirla', text: 'Regular y permitir la gestación subrogada.' },
    b: { label: 'Prohibirla', text: 'Mantener la prohibición y perseguir los «vientres de alquiler».' },
    kind: 'dilema',
    featured: true,
  },
  {
    id: 'tauromaquia',
    title: 'Tauromaquia',
    question: '¿Debería dejar de protegerse la tauromaquia?',
    a: { label: 'Retirar el apoyo', text: 'Quitar la protección de patrimonio, el dinero público y la presencia de menores.' },
    b: { label: 'Protegerla', text: 'Defender y promocionar la tauromaquia como patrimonio cultural.' },
    kind: 'dilema',
    featured: true,
  },
  {
    id: 'otan',
    title: 'OTAN',
    question: '¿Debería España salir de la OTAN?',
    a: { label: 'Salir', text: 'Salir de la OTAN o someter la permanencia a referéndum, con una política de neutralidad.' },
    b: { label: 'Quedarse', text: 'Seguir en la OTAN y reforzar la contribución española con los aliados.' },
    kind: 'dilema',
  },
  {
    id: 'burka',
    title: 'Burka en espacios públicos',
    question: '¿Debería prohibirse el burka en los espacios públicos?',
    a: { label: 'No prohibirlo', text: 'No prohibir prendas religiosas en el espacio público.' },
    b: { label: 'Prohibirlo', text: 'Prohibir el burka y el niqab en los espacios y servicios públicos.' },
    kind: 'dilema',
  },
  {
    id: 'eutanasia',
    title: 'Eutanasia',
    question: '¿Hay que facilitar el acceso a la eutanasia?',
    a: { label: 'Facilitarla', text: 'Agilizar la eutanasia y garantizar el testamento vital.' },
    b: { label: 'Cuidados primero', text: 'Priorizar los cuidados paliativos para que nadie pida morir por falta de cuidados.' },
    kind: 'dilema',
  },
  {
    id: 'servicio-militar',
    title: 'Servicio militar',
    question: '¿Debería recuperarse el servicio militar obligatorio?',
    a: { label: 'No a la mili', text: 'Ningún servicio militar, ni obligatorio ni voluntario, para la juventud.' },
    b: { label: 'Recuperarlo', text: 'Recuperar alguna forma de servicio militar.' },
    kind: 'dilema',
  },
];

/** Los temas activos, primero los principales. */
export const activeTopics = topics.filter((topic) => topic.active !== false);
