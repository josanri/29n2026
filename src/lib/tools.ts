/** The tools of the site: the last section of the home page and the Markdown of the home page read this list. */
import { ABSOLUTE_MAJORITY, CONGRESS_SEATS } from '@eleccion/congreso';
import { SENATE_ABSOLUTE_MAJORITY, SENATE_SEATS } from '@eleccion/senado';
import { routes } from './routes';

export const tools = [
  { name: 'Categorías', href: routes.categories(), text: 'Compara el peso de cada tema en cada programa.' },
  {
    name: 'Simulador',
    href: routes.simulator(),
    text: `Reparte los ${CONGRESS_SEATS} escaños del Congreso (mayoría en ${ABSOLUTE_MAJORITY}) o los ${SENATE_SEATS} del Senado (${SENATE_ABSOLUTE_MAJORITY}) y prueba pactos.`,
  },
  { name: 'Sin siglas', href: routes.partyQuiz(), text: 'Lee las medidas sin el nombre del partido y di si estás a favor o en contra.' },
  { name: 'Temas', href: routes.topicQuiz(), text: 'Elige tu postura en los debates que más dividen y mira qué partidos la defienden.' },
  { name: 'Encuestas', href: routes.polls(), text: 'La estimación de voto del CIS, 40dB., Sigma Dos, SocioMétrica y GAD3, y su evolución.' },
  { name: 'Calendario', href: routes.calendar(), text: 'Las fechas de la campaña y del voto, para añadirlas a tu agenda.' },
  { name: 'Info', href: routes.info(), text: 'Cómo votar: documentos, voto por correo, permiso laboral, accesibilidad y fechas.' },
];
