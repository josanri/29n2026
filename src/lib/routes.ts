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
  territory: 'ter',
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
/**
 * The HTML id of each poll in the table of all the polls: `encuesta-gad3-2026-11-22`. Two polls of the same
 * pollster on the same day (two reports of a daily tracking) must not share an id: the second one, in the order
 * of the list, takes `-2`, the third `-3`. The page and the RSS feed take the ids from here, so they stay the same.
 */
export const pollIds = <T extends { pollster: string; date: string }>(polls: readonly T[]): Map<T, string> => {
  const seen = new Map<string, number>();
  return new Map(
    polls.map((poll) => {
      const base = `encuesta-${poll.pollster}-${poll.date}`;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return [poll, count === 1 ? base : `${base}-${count}`];
    }),
  );
};
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
  /** The page of one measure, made to be shared: its own link preview (a quote of the measure) and the card open. */
  measureShare: (partyId: string, measureNumber: number) => withBase(`/${partyId}/medidas/${measureNumber}/`),
  block: (partyId: string, blockId: number) => withBase(`/${partyId}/bloque/${blockId}/`),
  section: (partyId: string, blockId: number, sectionId: string) =>
    withBase(`/${partyId}/bloque/${blockId}/#${SECTION_ID_PREFIX}${sectionId}`),
  search: (query = '') => withBase(`/buscar/${query ? `?${SEARCH_PARAMS.query}=${encodeURIComponent(query)}` : ''}`),
  /** JSON file with the text of every measure. The search page loads it on the first search. */
  searchIndex: () => withBase('/indice-busqueda.json'),
  /** Data for the AI agents of the browser (WebMCP): every party, the categories and the topics. */
  agentParties: () => withBase('/agentes/partidos.json'),
  /** Data for the AI agents of the browser (WebMCP): one program, with the full text of each measure. */
  agentProgram: (partyId: string) => withBase(`/agentes/${partyId}.json`),
  /** Data for the AI agents of the browser (WebMCP): poll averages and individual polls. */
  agentPolls: () => withBase('/agentes/encuestas.json'),
  /** Data for the AI agents of the browser (WebMCP): index and statistics of every published debate. */
  agentDebates: () => withBase('/agentes/debates.json'),
  /** Data for the AI agents of the browser (WebMCP): interventions and interruptions of one debate. */
  agentDebate: (slug: string) => withBase(`/agentes/debates/${slug}.json`),
  /** Data for the AI agents of the browser (WebMCP): key dates and deadlines of the election. */
  agentCalendar: () => withBase('/agentes/calendario.json'),
  categories: () => withBase('/categorias/'),
  category: (categoryId: string) => withBase(`/categorias/${categoryId}/`),
  calendar: () => withBase('/calendario/'),
  /** The `.ics` file of one event, or of the whole calendar when there is no id. */
  calendarIcs: (eventId?: string) => withBase(eventId ? `/calendario/${eventId}.ics` : '/calendario.ics'),
  /** Practical information to vote: documents, mail vote, leave from work and dates. */
  info: () => withBase('/info/'),
  simulator: (chamber?: 'congreso' | 'senado') => withBase(chamber === 'senado' ? '/simulador/?camara=senado' : '/simulador/'),
  /** The page that lists the tests. */
  tests: () => withBase('/tests/'),
  /** «Temas que dividen»: the reader takes a side on each polarizing topic and compares the parties. */
  topicQuiz: () => withBase('/tests/temas/'),
  /** The tracking of the polls. */
  polls: () => withBase('/encuestas/'),
  /** One poll in the table of all the polls. The page opens the table when the link points into it. */
  poll: (pollId: string) => withBase(`/encuestas/#${pollId}`),
  /** The RSS feed: the programs, the polls and the debates, the newest first. */
  feed: () => withBase('/novedades.xml'),
  /** The list of the debates, or one debate (its transcript, charts and filter) when it has a slug. */
  debate: (slug?: string) => withBase(slug ? `/debates/${slug}/` : '/debates/'),
  /** «Sin siglas»: vote on measures without the party, then see the parties. */
  partyQuiz: () => withBase('/tests/sin-siglas/'),
  /** JSON file with the measures of one party for «Sin siglas». The page loads the parties of one province. */
  partyQuizData: (partyId: string) => withBase(`/tests/sin-siglas/datos/${partyId}.json`),
  accessibility: () => withBase('/accesibilidad/'),
  legal: () => withBase('/aviso-legal/'),
  designSystem: () => withBase('/design-system/'),
  /** A file of the `public/` folder, for example `/datos-electorales/candidaturas.json`. */
  asset: (path: string) => withBase(path),
} as const;
