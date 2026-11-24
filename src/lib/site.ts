/** Site-wide constants. The names of the election come from its data folder (`@eleccion/eleccion`). */
import { election } from '@eleccion/eleccion';

/** The brand. It does not carry the election, so the site can host other elections. */
export const SITE_NAME = 'Electosfera';

/** Other names of the brand, for the structured data (`src/lib/structured-data.ts`). */
export const SITE_ALTERNATE_NAMES = ['electosfera.es'];

export const DEFAULT_DESCRIPTION = `Los programas electorales de las ${election.name.toLowerCase()} del ${election.longDate} (${election.shortName}), medida a medida: categorías, cifras, plazos y diagramas.`;

/** The title of the RSS feed (`src/pages/novedades.xml.ts`): the head of each page and the footer use it too. */
export const FEED_TITLE = `${SITE_NAME}: programas, encuestas y debates`;

/** Where the reader's theme choice is stored. The key stays the same so saved choices still work. */
export const THEME_STORAGE_KEY = 'tema';

/** The accounts of the site on social networks: the footer links them and link previews on X name the first. */
export const SOCIAL_ACCOUNTS = [
  { id: 'x', network: 'X', handle: '@Electosfera', url: 'https://x.com/Electosfera' },
  { id: 'instagram', network: 'Instagram', handle: '@Electosfera', url: 'https://www.instagram.com/electosfera/' },
] as const;
export const X_HANDLE = SOCIAL_ACCOUNTS[0].handle;

/** A link preview: a 1200 × 675 PNG (16:9 for Google Discover and social cards), its path under the base of the site and its text. The site and section cards come from `scripts/og_sections.ts` (`npm run og:secciones`); those of a party or a measure, from the Worker (`worker/og/card.ts`). */
export interface ShareImage {
  path: string;
  alt: string;
}
export const DEFAULT_SHARE_IMAGE: ShareImage = {
  path: '/og/portada.png',
  alt: 'Electosfera: el 29N en datos, punto por punto — programas, encuestas, debates, simulador de escaños y tests electorales.',
};

/** Dedicated link previews for the main sections of the site (`scripts/og_sections.ts`). */
export const SECTION_SHARE_IMAGES = {
  simulator: {
    path: '/og/simulador.png',
    alt: 'Simulador de Congreso y Senado del 29N en Electosfera: reparte los 350 escaños del Congreso o los 266 del Senado y prueba pactos y mayorías.',
  },
  polls: {
    path: '/og/encuestas.png',
    alt: 'Encuestas del 29N en Electosfera: seguimiento de la estimación de voto y evolución con enlace a cada fuente.',
  },
  debates: {
    path: '/og/debates.png',
    alt: 'Debates del 29N en Electosfera: transcripción íntegra, reparto de tiempos, interrupciones y temas.',
  },
  categories: {
    path: '/og/categorias.png',
    alt: 'Categorías del 29N en Electosfera: las medidas de todos los programas agrupadas en 21 temas comunes.',
  },
  tests: {
    path: '/og/tests.png',
    alt: 'Tests electorales del 29N en Electosfera: Sin siglas y Temas que dividen para comparar tu postura con los programas.',
  },
  calendar: {
    path: '/og/calendario.png',
    alt: 'Calendario electoral del 29N en Electosfera: fechas clave de voto por correo, campaña y jornada electoral.',
  },
} as const satisfies Record<string, ShareImage>;
