/**
 * The WebMCP tools of the whole site: an AI agent of the browser can search the measures, read them in full,
 * get the summary of a program and compare the parties on the topics that divide.
 * Every tool only reads: they use the same static files as the pages (`agent-data.ts`, the search index).
 * The pages with a form of their own add page tools: «filtrar_medidas» in `/<partido>/medidas/` and the search form.
 *
 * Loaded only when the browser has WebMCP (see `BaseLayout.astro`), so the other readers do not download it.
 */
import Fuse from 'fuse.js';
import { fuzzyOptions, MIN_FUZZY_LENGTH } from '@/lib/fuzzy';
import { normalizeForSearch } from '@/lib/format';
import { routes } from '@/lib/routes';
import { registerTools, type WebMcpTool } from './context';

// ---- The data, loaded once on the first call ----

interface PartyEntry {
  id: string;
  siglas: string;
  nombre: string;
  ambito: string;
  comunidades: string[];
  tienePrograma: boolean;
  programa: string | null;
  medidas: number;
  unidad: string;
  url: string;
}

interface PartiesData {
  partidos: PartyEntry[];
  categorias: { id: string; nombre: string }[];
  temas: { id: string; titulo: string; pregunta: string; posturas: unknown[]; sinPostura: string[] }[];
  aviso: string;
}

interface ProgramMeasure {
  n: number;
  titulo: string;
  texto: string;
  [key: string]: unknown;
}

interface ProgramData {
  id: string;
  medidas: ProgramMeasure[];
  [key: string]: unknown;
}

interface SearchIndex {
  parties: { id: string; acronym: string }[];
  items: { p: number; n: number; c: string; d: string; t: string; x: string; k: string; s: string }[];
}

const cache = new Map<string, Promise<unknown>>();
const load = <T>(url: string): Promise<T> => {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) {
          cache.delete(url);
          throw new Error(`No se pudo cargar ${url} (${response.status})`);
        }
        return response.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
};

const absolute = (path: string) => new URL(path, location.origin).href;
const partiesData = () => load<PartiesData>(routes.agentParties());

/** A party by its id, its acronym or its name, written in any case and with or without accents. */
async function findParty(text: unknown): Promise<PartyEntry> {
  const wanted = normalizeForSearch(String(text ?? ''));
  const { partidos } = await partiesData();
  const party = partidos.find((candidate) =>
    [candidate.id, candidate.siglas, candidate.nombre].some((value) => normalizeForSearch(value) === wanted),
  );
  if (!party) {
    throw new Error(`No hay ningún partido «${String(text)}». Usa «listar_partidos» para ver los id y las siglas.`);
  }
  return party;
}

async function programOf(text: unknown): Promise<{ party: PartyEntry; program: ProgramData }> {
  const party = await findParty(text);
  if (!party.tienePrograma) {
    throw new Error(`${party.nombre} (${party.siglas}) aún no ha publicado su programa electoral.`);
  }
  return { party, program: await load<ProgramData>(routes.agentProgram(party.id)) };
}

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [];

const READ_ONLY = { readOnlyHint: true } as const;
// The text of the programs is written by the parties, not by the site.
const PROGRAM_TEXT = { readOnlyHint: true, untrustedContentHint: true } as const;

// ---- The tools ----

const listParties: WebMcpTool = {
  name: 'listar_partidos',
  title: 'Listar los partidos',
  description:
    'Lista los partidos que se presentan a las elecciones generales del 29 de noviembre de 2026 (29N): id, siglas, nombre, ámbito (estatal o autonómico), comunidades, si han publicado su programa y cuántas medidas tiene. Usa el id o las siglas en las demás herramientas.',
  inputSchema: {
    type: 'object',
    properties: {
      conPrograma: { type: 'boolean', description: 'Solo los partidos que han publicado su programa.' },
      comunidad: { type: 'string', description: 'Solo los partidos que se presentan en esta comunidad autónoma, por ejemplo «Cataluña».' },
    },
  },
  annotations: READ_ONLY,
  async execute(input) {
    const { partidos, aviso } = await partiesData();
    const region = input.comunidad ? normalizeForSearch(String(input.comunidad)) : '';
    const list = partidos.filter(
      (party) =>
        (!input.conPrograma || party.tienePrograma) &&
        (!region || party.ambito === 'estatal' || party.comunidades.some((name) => normalizeForSearch(name) === region)),
    );
    return { total: list.length, partidos: list, aviso };
  },
};

const searchMeasures: WebMcpTool = {
  name: 'buscar_medidas',
  title: 'Buscar en los programas',
  description:
    'Busca una palabra o un tema en las medidas de todos los programas electorales del 29N. Tolera erratas. Devuelve, para cada medida, el partido, el número, el título, la categoría, el principio del texto y su enlace. Para leer el texto completo, usa «leer_medidas».',
  inputSchema: {
    type: 'object',
    properties: {
      texto: { type: 'string', description: 'Lo que se busca, por ejemplo «alquiler» o «salario mínimo». Puede ir vacío si hay filtros.' },
      partidos: { type: 'array', items: { type: 'string' }, description: 'Id o siglas de los partidos, por ejemplo ["pp", "VOX"]. Vacío: todos.' },
      categorias: {
        type: 'array',
        items: { type: 'string' },
        description: 'Id o nombre de las categorías, por ejemplo ["vivienda"]. Vacío: todas. «listar_categorias» da la lista.',
      },
      limite: { type: 'integer', minimum: 1, maximum: 50, description: 'Número máximo de medidas (20 si no se indica).' },
    },
  },
  annotations: PROGRAM_TEXT,
  async execute(input) {
    const [index, { categorias }] = await Promise.all([load<SearchIndex>(routes.searchIndex()), partiesData()]);
    const query = normalizeForSearch(String(input.texto ?? ''));
    const partyIds = new Set(await Promise.all(asList(input.partidos).map(async (text) => (await findParty(text)).id)));
    const categoryIds = new Set(
      asList(input.categorias).map((text) => {
        const wanted = normalizeForSearch(text);
        const category = categorias.find((candidate) => [candidate.id, candidate.nombre].some((value) => normalizeForSearch(value) === wanted));
        if (!category) throw new Error(`No hay ninguna categoría «${text}». Usa «listar_categorias».`);
        return category.id;
      }),
    );
    if (query.length < MIN_FUZZY_LENGTH && !partyIds.size && !categoryIds.size) {
      throw new Error('Escribe al menos dos letras en «texto», o filtra por partido o por categoría.');
    }
    const found =
      query.length >= MIN_FUZZY_LENGTH
        ? new Fuse(index.items, { ...fuzzyOptions, keys: [{ name: 'k', weight: 2 }, { name: 's', weight: 1 }] })
            .search(query)
            .map((result) => result.item)
        : index.items;
    const matches = found.filter(
      (item) => (!partyIds.size || partyIds.has(index.parties[item.p].id)) && (!categoryIds.size || categoryIds.has(item.d)),
    );
    const limit = Math.min(Math.max(Number(input.limite) || 20, 1), 50);
    return {
      total: matches.length,
      mostradas: Math.min(limit, matches.length),
      medidas: matches.slice(0, limit).map((item) => {
        const party = index.parties[item.p];
        return {
          partido: party.id,
          siglas: party.acronym,
          n: item.n,
          titulo: item.t,
          categoria: item.c,
          extracto: item.x,
          url: absolute(routes.measure(party.id, item.n)),
        };
      }),
    };
  },
};

const readMeasures: WebMcpTool = {
  name: 'leer_medidas',
  title: 'Leer medidas completas',
  description:
    'Devuelve el texto completo de una o varias medidas del programa de un partido, con su bloque, su sección, su categoría, sus cifras, su plazo, la ley que deroga, la página del PDF oficial y los enlaces. El texto es el del programa del partido.',
  inputSchema: {
    type: 'object',
    properties: {
      partido: { type: 'string', description: 'Id o siglas del partido, por ejemplo «psoe» o «PP».' },
      numeros: { type: 'array', items: { type: 'integer' }, maxItems: 50, description: 'Números de las medidas, por ejemplo [12, 40].' },
    },
    required: ['partido', 'numeros'],
  },
  annotations: PROGRAM_TEXT,
  async execute(input) {
    const { party, program } = await programOf(input.partido);
    const numbers = (Array.isArray(input.numeros) ? input.numeros : [input.numeros]).map(Number).slice(0, 50);
    const byNumber = new Map(program.medidas.map((measure) => [measure.n, measure]));
    return {
      partido: party.id,
      siglas: party.siglas,
      medidas: numbers.flatMap((number) => byNumber.get(number) ?? []),
      noEncontradas: numbers.filter((number) => !byNumber.has(number)),
    };
  },
};

const partySummary: WebMcpTool = {
  name: 'ficha_partido',
  title: 'Ficha de un programa',
  description:
    'Resume el programa electoral de un partido para el 29N: documento oficial y fecha, número de medidas, reparto por categoría, «Las claves» (lectura editorial con las medidas que la prueban), cifras comprometidas, plazos, leyes que deroga y bloques.',
  inputSchema: {
    type: 'object',
    properties: { partido: { type: 'string', description: 'Id o siglas del partido.' } },
    required: ['partido'],
  },
  annotations: PROGRAM_TEXT,
  async execute(input) {
    const party = await findParty(input.partido);
    if (!party.tienePrograma) {
      return { ...party, aviso: `${party.nombre} aún no ha publicado su programa electoral.` };
    }
    const { medidas: _measures, ...summary } = await load<ProgramData>(routes.agentProgram(party.id));
    return summary;
  },
};

const listCategories: WebMcpTool = {
  name: 'listar_categorias',
  title: 'Listar las categorías',
  description: 'Lista las categorías temáticas (vivienda, sanidad, fiscalidad…) con las que Electosfera clasifica las medidas de todos los programas.',
  inputSchema: { type: 'object', properties: {} },
  annotations: READ_ONLY,
  async execute() {
    return (await partiesData()).categorias;
  },
};

/** A topic by its id or its title, or the only topic whose title or question has the words («alquiler»). */
function findTopic(topics: PartiesData['temas'], text: unknown) {
  const wanted = normalizeForSearch(String(text ?? ''));
  const exact = topics.find((topic) => [topic.id, topic.titulo].some((value) => normalizeForSearch(value) === wanted));
  if (exact) return exact;
  const words = wanted.split(/\s+/).filter(Boolean);
  const partial = topics.filter((topic) => {
    const haystack = normalizeForSearch(`${topic.id} ${topic.titulo} ${topic.pregunta}`);
    return words.every((word) => haystack.includes(word));
  });
  if (partial.length === 1) return partial[0];
  const options = (partial.length ? partial : topics).map((topic) => `${topic.id} (${topic.titulo})`).join('; ');
  throw new Error(
    partial.length
      ? `«${String(text)}» encaja con varios temas: ${options}. Indica el id.`
      : `No hay ningún tema «${String(text)}». Los temas son: ${options}.`,
  );
}

const topicStances: WebMcpTool = {
  name: 'posturas_por_tema',
  title: 'Posturas en los temas que dividen',
  description:
    'Compara a los partidos en los temas más polarizantes del test «Temas que dividen» de Electosfera (inmigración, aborto, alquiler, impuestos, lenguas…). Sin «tema», lista los temas. Con «tema», da la pregunta, las dos posturas (A y B) y la de cada partido: «a», «b» o «matiz» (el programa trata el tema sin tomar del todo una postura), con una nota editorial y las medidas de su programa que la prueban. El lado se decide por el texto de A y B, que puede ser más amplio que la pregunta: léelo antes de resumir. «sinPostura» son los partidos con programa que no toman partido en ese tema; los partidos sin programa publicado no aparecen. Es una clasificación editorial: para citar a un partido, cita sus medidas.',
  inputSchema: {
    type: 'object',
    properties: {
      tema: { type: 'string', description: 'Id, título o palabras del tema, por ejemplo «vivienda» o «alquiler». Vacío: la lista de temas.' },
    },
  },
  annotations: READ_ONLY,
  async execute(input) {
    const { temas, aviso } = await partiesData();
    if (!input.tema) {
      return {
        temas: temas.map(({ id, titulo, pregunta, posturas }) => ({ id, titulo, pregunta, partidosConPostura: posturas.length })),
        aviso,
      };
    }
    return { ...findTopic(temas, input.tema), aviso };
  },
};

export const siteTools = [listParties, searchMeasures, readMeasures, partySummary, listCategories, topicStances];

export const registerSiteTools = () => registerTools(siteTools);
