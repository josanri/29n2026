/**
 * Every URL of the site. The paths stay in Spanish because they are public links.
 * Build links with these functions and never write a path by hand.
 */

/** Query parameters of the measure explorer. The values are public URL parameters. */
export const MEASURE_FILTER_PARAMS = {
  search: 'q',
  block: 'bloque',
  category: 'cat',
  targetGroup: 'col',
  lever: 'pal',
  withFigures: 'cifras',
  withDeadline: 'plazo',
  pendingOnly: 'oculta',
} as const;

export type MeasureFilter = keyof typeof MEASURE_FILTER_PARAMS;

/** Query parameters of the home page. */
export const HOME_PARAMS = { province: 'provincia', showAll: 'todos', search: 'q' } as const;

/** Query parameter of the search page. */
export const SEARCH_PARAMS = { query: 'q', parties: 'partidos', categories: 'categorias' } as const;

/** Prefix of the HTML id of each measure: `m-123`. */
export const MEASURE_ID_PREFIX = 'm-';
export const SECTION_ID_PREFIX = 's-';
export const CANDIDACIES_HEADING_ID = 'candidaturas-titulo';

/**
 * Puts the base path of the site (`base` in astro.config.mjs) before a path that starts with «/».
 * On GitHub Pages of a repository, the site lives in «/repository/», not in «/».
 * Other values (an `https://` link, a relative path) stay as they are.
 */
export const withBase = (path: string) => {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
};

export const routes = {
  home: () => withBase('/'),
  /** Home page with the candidacies of one province open. */
  provinceCandidacies: (provinceCode: string) =>
    withBase(`/?${HOME_PARAMS.province}=${provinceCode}#${CANDIDACIES_HEADING_ID}`),
  party: (partyId: string) => withBase(`/${partyId}/`),
  measures: (partyId: string, filters: Partial<Record<MeasureFilter, string | number>> = {}) => {
    const query = Object.entries(filters)
      .map(([key, value]) => `${MEASURE_FILTER_PARAMS[key as MeasureFilter]}=${encodeURIComponent(String(value))}`)
      .join('&');
    return withBase(`/${partyId}/medidas/${query ? `?${query}` : ''}`);
  },
  measure: (partyId: string, measureNumber: number) =>
    withBase(`/${partyId}/medidas/#${MEASURE_ID_PREFIX}${measureNumber}`),
  block: (partyId: string, blockId: number) => withBase(`/${partyId}/bloque/${blockId}/`),
  section: (partyId: string, blockId: number, sectionId: string) =>
    withBase(`/${partyId}/bloque/${blockId}/#${SECTION_ID_PREFIX}${sectionId}`),
  search: (query = '') => withBase(`/buscar/${query ? `?${SEARCH_PARAMS.query}=${encodeURIComponent(query)}` : ''}`),
  /** JSON file with the text of every measure. The search page loads it on the first search. */
  searchIndex: () => withBase('/indice-busqueda.json'),
  categories: () => withBase('/categorias/'),
  category: (categoryId: string) => withBase(`/categorias/${categoryId}/`),
  calendar: () => withBase('/calendario/'),
  /** The `.ics` file of one event, or of the whole calendar when there is no id. */
  calendarIcs: (eventId?: string) => withBase(eventId ? `/calendario/${eventId}.ics` : '/calendario.ics'),
  simulator: () => withBase('/simulador/'),
  /** The page that lists the tests. */
  tests: () => withBase('/tests/'),
  /** «Temas que dividen»: the reader takes a side on each polarizing topic and compares the parties. */
  topicQuiz: () => withBase('/tests/temas/'),
  /** The tracking of the polls. */
  polls: () => withBase('/encuestas/'),
  /** «Sin siglas»: vote on measures without the party, then see the parties. */
  partyQuiz: () => withBase('/tests/sin-siglas/'),
  /** JSON file with the measures of one party for «Sin siglas». The page loads the parties of one province. */
  partyQuizData: (partyId: string) => withBase(`/tests/sin-siglas/datos/${partyId}.json`),
  accessibility: () => withBase('/accesibilidad/'),
  designSystem: () => withBase('/design-system/'),
  /** A file of the `public/` folder, for example `/datos-electorales/candidaturas.json`. */
  asset: (path: string) => withBase(path),
} as const;
