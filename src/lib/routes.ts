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
export const SEARCH_PARAMS = { query: 'q' } as const;

/** Prefix of the HTML id of each measure: `m-123`. */
export const MEASURE_ID_PREFIX = 'm-';
export const SECTION_ID_PREFIX = 's-';
export const CANDIDACIES_HEADING_ID = 'candidaturas-titulo';

export const routes = {
  home: () => '/',
  /** Home page with the candidacies of one province open. */
  provinceCandidacies: (provinceCode: string) =>
    `/?${HOME_PARAMS.province}=${provinceCode}#${CANDIDACIES_HEADING_ID}`,
  party: (partyId: string) => `/${partyId}/`,
  measures: (partyId: string, filters: Partial<Record<MeasureFilter, string | number>> = {}) => {
    const query = Object.entries(filters)
      .map(([key, value]) => `${MEASURE_FILTER_PARAMS[key as MeasureFilter]}=${encodeURIComponent(String(value))}`)
      .join('&');
    return `/${partyId}/medidas/${query ? `?${query}` : ''}`;
  },
  measure: (partyId: string, measureNumber: number) =>
    `/${partyId}/medidas/#${MEASURE_ID_PREFIX}${measureNumber}`,
  block: (partyId: string, blockId: number) => `/${partyId}/bloque/${blockId}/`,
  section: (partyId: string, blockId: number, sectionId: string) =>
    `/${partyId}/bloque/${blockId}/#${SECTION_ID_PREFIX}${sectionId}`,
  search: (query = '') => `/buscar/${query ? `?${SEARCH_PARAMS.query}=${encodeURIComponent(query)}` : ''}`,
  /** JSON file with the text of every measure. The search page loads it on the first search. */
  searchIndex: () => '/indice-busqueda.json',
  categories: () => '/categorias/',
  category: (categoryId: string) => `/categorias/${categoryId}/`,
  accessibility: () => '/accesibilidad/',
  designSystem: () => '/design-system/',
} as const;
