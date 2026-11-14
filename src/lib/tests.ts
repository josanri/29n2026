/** The tests of the site: the «Tests» menu of the header and the page `/tests/` list them from here. */
import { routes } from './routes';

export interface SiteTest {
  href: string;
  name: string;
  text: string;
}

export const siteTests: SiteTest[] = [
  {
    href: routes.partyQuiz(),
    name: 'Sin siglas',
    text: 'Vota medidas de los programas de tu provincia sin saber de qué partido son.',
  },
  {
    href: routes.topicQuiz(),
    name: 'Temas que dividen',
    text: 'Elige tu postura en los debates más polarizantes y compara qué dice cada programa.',
  },
];
