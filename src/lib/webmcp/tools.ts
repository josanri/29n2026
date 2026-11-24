/**
 * The WebMCP tools of the whole site: an AI agent of the browser can search the measures, read them in full,
 * get the summary of a program, compare the parties on the topics that divide, and check polls, debates and calendar.
 * Every tool here only reads: they use the static files built with the site (`agent-data.ts`, the search index).
 * The pages with a tool of their own add page tools: «filtrar_medidas» in `/<partido>/medidas/`,
 * «simular_investidura» in `/simulador/` and the declarative search form in `/buscar/`.
 *
 * Loaded only when the browser has WebMCP (see `BaseLayout.astro`), so the other readers do not download it.
 */
import Fuse from 'fuse.js';
import { fuzzyOptions, MIN_FUZZY_LENGTH } from '@/lib/fuzzy';
import { normalizeForSearch } from '@/lib/format';
import { routes } from '@/lib/routes';
import { registerTools, type WebMcpTool } from './context';

// ---- The data, loaded once on the first call ----

export interface ProvinceEntry {
  codigo: string;
  nombre: string;
  comunidad: string;
}

type ChamberPresence = 'todas' | string[];

interface PartyEntry {
  id: string;
  siglas: string;
  nombre: string;
  ambito: string;
  comunidades: string[];
  congreso?: ChamberPresence;
  senado?: ChamberPresence;
  tienePrograma: boolean;
  programa: string | null;
  medidas: number;
  unidad: string;
  url: string;
}

interface PartiesData {
  provincias?: ProvinceEntry[];
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

interface PollAverageEntry {
  id: string;
  siglas: string;
  voto: { media: number; min: number; max: number; encuestadoras: number } | null;
  escanos: { media: number; min: number; max: number; encuestadoras: number } | null;
}

interface PollEntry {
  id: string;
  encuestadora: string;
  nombreEncuestadora: string;
  medio: string | null;
  fecha: string;
  muestra: number | null;
  verificadaEnFuente: boolean;
  urlFuente: string;
  url: string;
  voto: Record<string, number | null>;
  escanos: Record<string, number | [number, number] | null> | null;
}

interface PollsData {
  mediaActual: { fecha: string; ventanaDias: number; partidos: PollAverageEntry[] };
  frenteAmplioDesde: string;
  partidos: { id: string; siglas: string; nombreCorto: string | null }[];
  encuestadoras: { id: string; nombre: string; medio: string; url: string }[];
  encuestas: PollEntry[];
  vedaDesde: string;
  url: string;
  aviso: string;
}

interface DebateSpeakerEntry {
  id: string;
  nombre: string;
  rol: string;
  partido: string | null;
  esModeracion: boolean;
  minutos: number;
  palabras: number;
  turnos: number;
  interrupcionesHechas: number;
  interrupcionesRecibidas: number;
  cortesModeracion: number;
}

interface DebateTopicEntry {
  id: string;
  etiqueta: string;
  menciones: number;
  interrupciones: number;
}

interface DebateSummaryEntry {
  slug: string;
  titulo: string;
  fecha: string | null;
  cadena: string | null;
  duracionSegundos: number;
  url: string;
  videoUrl: string | null;
  ponentes: DebateSpeakerEntry[];
  temas: DebateTopicEntry[];
  minutoDeOro: { ponente: string; inicio: number; fin: number }[];
  totalIntervenciones: number;
  interrupcionesCandidatos: number;
  cortesModeracion: number;
}

interface DebatesIndexData {
  total: number;
  debates: DebateSummaryEntry[];
  url: string;
  aviso: string;
}

interface DebateInterventionEntry {
  indice: number;
  ponente: string;
  nombre: string;
  partido: string | null;
  inicio: number;
  fin: number;
  temas: string[];
  esInterrupcion: boolean;
  esCorteModeracion: boolean;
  esMinutoDeOro: boolean;
  texto: string;
}

interface DebateDetailData extends DebateSummaryEntry {
  intervenciones: DebateInterventionEntry[];
  aviso: string;
}

interface CalendarEventEntry {
  id: string;
  fecha: string;
  fechaFin: string | null;
  horario: string | null;
  titulo: string;
  descripcion: string;
  origen: 'oficial' | 'derivado';
  baseLegal: string | null;
  documento: string | null;
  urlOficial: string | null;
  urlIcs: string;
}

interface CalendarData {
  eleccion: string;
  fechaVotacion: string;
  urlCalendario: string;
  urlIcs: string;
  total: number;
  eventos: CalendarEventEntry[];
  aviso: string;
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
const pollsData = () => load<PollsData>(routes.agentPolls());
const debatesIndex = () => load<DebatesIndexData>(routes.agentDebates());
const debateDetail = (slug: string) => load<DebateDetailData>(routes.agentDebate(slug));
const calendarData = () => load<CalendarData>(routes.agentCalendar());

/** Common Spanish names for provinces whose official INE name is co-official or in another language. */
const PROVINCE_ALIASES: Record<string, string> = {
  alava: '01',
  araba: '01',
  alicante: '03',
  alacant: '03',
  baleares: '07',
  'islas baleares': '07',
  castellon: '12',
  castello: '12',
  coruna: '15',
  'la coruna': '15',
  gerona: '17',
  guipuzcoa: '20',
  lerida: '25',
  orense: '32',
  valencia: '46',
  vizcaya: '48',
};

/** Finds a Spanish province by INE code (e.g. «28»), full name, co-official half («Araba» / «Álava») or common alias. */
export function findProvince(provinces: readonly ProvinceEntry[], text: unknown): ProvinceEntry {
  const raw = String(text ?? '').trim();
  const wanted = normalizeForSearch(raw);
  const paddedCode = /^\d{1,2}$/.test(raw) ? raw.padStart(2, '0') : '';
  const aliasCode = PROVINCE_ALIASES[wanted];
  const targetCode = paddedCode || aliasCode;

  const found = provinces.find((province) => {
    if (targetCode && province.codigo === targetCode) return true;
    const normalized = normalizeForSearch(province.nombre);
    if (normalized === wanted) return true;
    return province.nombre.split('/').some((part) => normalizeForSearch(part) === wanted);
  });

  if (!found) {
    throw new Error(
      `No hay ninguna provincia «${raw}». Indica el nombre o el código INE de dos cifras, por ejemplo «Teruel», «Illes Balears» o «28».`,
    );
  }
  return found;
}

const runsInProvince = (presence: ChamberPresence | undefined, code: string) =>
  presence === 'todas' || (Array.isArray(presence) && presence.includes(code));

const hasAnyList = (presence: ChamberPresence | undefined) =>
  presence === 'todas' || (Array.isArray(presence) && presence.length > 0);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(value: unknown, field: string): string {
  const text = String(value ?? '').trim();
  if (!ISO_DATE.test(text)) {
    throw new Error(`El campo «${field}» debe tener formato AAAA-MM-DD, por ejemplo «2026-11-24».`);
  }
  return text;
}

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
// The text of the programs and debate transcripts is spoken or written by the parties, not by the site.
const PROGRAM_TEXT = { readOnlyHint: true, untrustedContentHint: true } as const;

/** Bridges program ids (`eh-bildu`, `jxcat`, `eaj-pnv`) to poll ids (`bildu`, `junts`, `pnv`). */
const POLL_PARTY_ALIASES: Record<string, string> = {
  'eh-bildu': 'bildu',
  'eh bildu': 'bildu',
  jxcat: 'junts',
  'junts per catalunya': 'junts',
  'eaj-pnv': 'pnv',
  'frente amplio': 'fa',
  'adelante andalucia': 'adelante',
};

// ---- The tools ----

const listParties: WebMcpTool = {
  name: 'listar_partidos',
  title: 'Listar los partidos',
  description:
    'Lista los partidos que se presentan a las elecciones generales del 29 de noviembre de 2026 (29N): id, siglas, nombre, ámbito (estatal o autonómico), comunidades, presencia al Congreso y al Senado, si han publicado su programa y cuántas medidas tiene. Permite filtrar por provincia o por cámara. Usa el id o las siglas en las demás herramientas.',
  inputSchema: {
    type: 'object',
    properties: {
      conPrograma: { type: 'boolean', description: 'Solo los partidos que han publicado su programa.' },
      comunidad: { type: 'string', description: 'Solo los partidos que se presentan en esta comunidad autónoma, por ejemplo «Cataluña».' },
      provincia: {
        type: 'string',
        description: 'Nombre o código INE de la provincia, por ejemplo «Teruel», «Alicante» o «28». Más preciso que «comunidad».',
      },
      camara: {
        type: 'string',
        enum: ['congreso', 'senado'],
        description: 'Filtra por cámara («congreso» o «senado»). Con «provincia», comprueba si presenta lista en esa cámara y provincia.',
      },
    },
  },
  annotations: READ_ONLY,
  async execute(input) {
    const { partidos, provincias = [], aviso } = await partiesData();
    const chamber = input.camara ? String(input.camara) : '';
    if (chamber && chamber !== 'congreso' && chamber !== 'senado') {
      throw new Error(`Cámara no válida: «${chamber}». Usa «congreso» o «senado».`);
    }
    const region = input.comunidad ? normalizeForSearch(String(input.comunidad)) : '';
    const province = input.provincia ? findProvince(provincias, input.provincia) : null;

    const list = partidos
      .filter((party) => {
        if (input.conPrograma && !party.tienePrograma) return false;
        if (region && party.ambito !== 'estatal' && !party.comunidades.some((name) => normalizeForSearch(name) === region)) {
          return false;
        }
        if (province) {
          const inCongress = runsInProvince(party.congreso, province.codigo);
          const inSenate = runsInProvince(party.senado, province.codigo);
          if (chamber === 'congreso') return inCongress;
          if (chamber === 'senado') return inSenate;
          return inCongress || inSenate;
        }
        if (chamber === 'congreso') return hasAnyList(party.congreso);
        if (chamber === 'senado') return hasAnyList(party.senado);
        return true;
      })
      .map((party) => {
        const { congreso, senado, ...base } = party;
        if (!province) return base;
        return {
          ...base,
          enProvincia: {
            congreso: runsInProvince(congreso, province.codigo),
            senado: runsInProvince(senado, province.codigo),
          },
        };
      });

    return {
      total: list.length,
      ...(province ? { provincia: province } : {}),
      partidos: list,
      aviso,
    };
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

const queryPolls: WebMcpTool = {
  name: 'consultar_encuestas',
  title: 'Consultar las encuestas del 29N',
  description:
    'Devuelve la media móvil de encuestas (última encuesta de cada encuestadora en los 21 días previos) y las encuestas individuales más recientes de voto y escaños para el 29N. Permite filtrar por partido, por encuestadora o solo por encuestas con escaños.',
  inputSchema: {
    type: 'object',
    properties: {
      partido: { type: 'string', description: 'Id, siglas o nombre del partido, por ejemplo «pp», «PSOE» o «fa». Vacío: todos.' },
      encuestadora: { type: 'string', description: 'Id o nombre de la encuestadora, por ejemplo «cis», «40db» o «GAD3». Vacío: todas.' },
      ultimas: { type: 'integer', minimum: 1, maximum: 50, description: 'Número máximo de encuestas individuales que se devuelven (10 si no se indica).' },
      soloConEscanos: { type: 'boolean', description: 'Solo las encuestas que publican estimación de escaños.' },
    },
  },
  annotations: READ_ONLY,
  async execute(input) {
    const data = await pollsData();
    let partyId = '';
    if (input.partido) {
      const wanted = normalizeForSearch(String(input.partido));
      const alias = POLL_PARTY_ALIASES[wanted];
      const found = data.partidos.find((candidate) =>
        [candidate.id, candidate.siglas, candidate.nombreCorto ?? ''].some((value) => normalizeForSearch(value) === wanted) ||
        (alias && candidate.id === alias),
      );
      if (!found) {
        const options = data.partidos.map((item) => `${item.id} (${item.siglas})`).join(', ');
        throw new Error(`No hay datos de encuestas para «${String(input.partido)}». Partidos disponibles: ${options}.`);
      }
      partyId = found.id;
    }

    let pollsterId = '';
    if (input.encuestadora) {
      const wanted = normalizeForSearch(String(input.encuestadora));
      const found = data.encuestadoras.find((candidate) =>
        [candidate.id, candidate.nombre, candidate.medio].some((value) => normalizeForSearch(value) === wanted) ||
        normalizeForSearch(candidate.nombre).includes(wanted),
      );
      if (!found) {
        const options = data.encuestadoras.map((item) => `${item.id} (${item.nombre})`).join(', ');
        throw new Error(`No hay ninguna encuestadora «${String(input.encuestadora)}». Disponibles: ${options}.`);
      }
      pollsterId = found.id;
    }

    const filtered = data.encuestas.filter((poll) => {
      if (pollsterId && poll.encuestadora !== pollsterId) return false;
      if (input.soloConEscanos && !poll.escanos) return false;
      if (partyId && poll.voto[partyId] == null && poll.escanos?.[partyId] == null) return false;
      return true;
    });

    const limit = Math.min(Math.max(Number(input.ultimas) || 10, 1), 50);
    const mediaPartidos = partyId
      ? data.mediaActual.partidos.filter((entry) => entry.id === partyId)
      : data.mediaActual.partidos;

    return {
      mediaActual: { ...data.mediaActual, partidos: mediaPartidos },
      encuestadoras: data.encuestadoras,
      totalEncuestas: filtered.length,
      mostradas: Math.min(limit, filtered.length),
      encuestas: filtered.slice(0, limit),
      vedaDesde: data.vedaDesde,
      url: data.url,
      aviso: data.aviso,
    };
  },
};

function findDebate(debates: readonly DebateSummaryEntry[], text: unknown): DebateSummaryEntry {
  const wanted = normalizeForSearch(String(text ?? ''));
  const exact = debates.find((debate) => normalizeForSearch(debate.slug) === wanted || normalizeForSearch(debate.titulo) === wanted);
  if (exact) return exact;
  const words = wanted.split(/\s+/).filter(Boolean);
  const partial = debates.filter((debate) => {
    const haystack = normalizeForSearch(`${debate.slug} ${debate.titulo} ${debate.cadena ?? ''} ${debate.fecha ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
  if (partial.length === 1) return partial[0];
  const options = (partial.length ? partial : debates).map((debate) => `${debate.slug} (${debate.titulo})`).join('; ');
  throw new Error(
    partial.length
      ? `«${String(text)}» encaja con varios debates: ${options}. Indica el slug.`
      : `No hay ningún debate «${String(text)}». Los debates son: ${options}.`,
  );
}

const queryDebates: WebMcpTool = {
  name: 'consultar_debates',
  title: 'Consultar los debates electorales',
  description:
    'Consulta los debates electorales del 29N: ponentes, tiempos de intervención, palabras, interrupciones entre candidatos, cortes de moderación, temas y transcripciones. Sin «debate», lista los debates con sus estadísticas. Con «debate» y algún filtro («ponente», «tema», «texto», «soloInterrupciones» o «soloMinutoDeOro»), devuelve las intervenciones coincidentes.',
  inputSchema: {
    type: 'object',
    properties: {
      debate: { type: 'string', description: 'Slug o palabras del debate, por ejemplo «rtve» o «cara-a-cara». Vacío: lista todos los debates con sus estadísticas.' },
      ponente: { type: 'string', description: 'Id, nombre o partido del ponente, por ejemplo «rufian», «Ester Muñoz» o «pp».' },
      tema: { type: 'string', description: 'Id o etiqueta del tema, por ejemplo «vivienda» o «pensiones».' },
      texto: { type: 'string', description: 'Palabra o frase que debe aparecer en la intervención.' },
      soloInterrupciones: { type: 'boolean', description: 'Solo las interrupciones entre candidatos (excluye cortes de moderación).' },
      soloMinutoDeOro: { type: 'boolean', description: 'Solo las intervenciones del minuto de oro.' },
      limite: { type: 'integer', minimum: 1, maximum: 30, description: 'Máximo de intervenciones que se devuelven (10 si no se indica).' },
    },
  },
  annotations: PROGRAM_TEXT,
  async execute(input) {
    const index = await debatesIndex();
    if (!input.debate) return index;

    const summary = findDebate(index.debates, input.debate);
    const hasFilter = Boolean(input.ponente || input.tema || input.texto || input.soloInterrupciones || input.soloMinutoDeOro);
    if (!hasFilter) {
      return {
        ...summary,
        aviso:
          'Este resumen no incluye la transcripción completa. Añade «ponente», «tema», «texto», «soloInterrupciones» o «soloMinutoDeOro» para leer intervenciones concretas.',
      };
    }

    const detail = await debateDetail(summary.slug);
    let speakerIds: Set<string> | null = null;
    if (input.ponente) {
      const wanted = normalizeForSearch(String(input.ponente));
      const matched = detail.ponentes.filter((speaker) => {
        const fields = [speaker.id, speaker.nombre, speaker.partido ?? ''].map(normalizeForSearch);
        return fields.some((field) => field === wanted || (wanted.length >= 3 && field.includes(wanted)));
      });
      if (!matched.length) {
        const options = detail.ponentes.map((speaker) => `${speaker.id} (${speaker.nombre})`).join(', ');
        throw new Error(`No hay ningún ponente «${String(input.ponente)}» en este debate. Ponentes: ${options}.`);
      }
      speakerIds = new Set(matched.map((speaker) => speaker.id));
    }

    let topicId = '';
    if (input.tema) {
      const wanted = normalizeForSearch(String(input.tema));
      const found = detail.temas.find(
        (topic) => normalizeForSearch(topic.id) === wanted || normalizeForSearch(topic.etiqueta) === wanted || normalizeForSearch(topic.etiqueta).includes(wanted),
      );
      if (!found) {
        const options = detail.temas.map((topic) => `${topic.id} (${topic.etiqueta})`).join(', ');
        throw new Error(`No hay ningún tema «${String(input.tema)}» en este debate. Temas: ${options}.`);
      }
      topicId = found.id;
    }

    const needle = input.texto ? normalizeForSearch(String(input.texto)) : '';
    const matches = detail.intervenciones.filter((item) => {
      if (speakerIds && !speakerIds.has(item.ponente)) return false;
      if (topicId && !item.temas.includes(topicId)) return false;
      if (input.soloInterrupciones && !item.esInterrupcion) return false;
      if (input.soloMinutoDeOro && !item.esMinutoDeOro) return false;
      if (needle && !normalizeForSearch(item.texto).includes(needle)) return false;
      return true;
    });

    const limit = Math.min(Math.max(Number(input.limite) || 10, 1), 30);
    const { intervenciones: _all, ...rest } = detail;
    return {
      ...rest,
      filtrosAplicados: {
        ponente: input.ponente ? String(input.ponente) : null,
        tema: topicId || null,
        texto: input.texto ? String(input.texto) : null,
        soloInterrupciones: Boolean(input.soloInterrupciones),
        soloMinutoDeOro: Boolean(input.soloMinutoDeOro),
      },
      totalCoincidencias: matches.length,
      mostradas: Math.min(limit, matches.length),
      intervenciones: matches.slice(0, limit),
    };
  },
};

const queryCalendar: WebMcpTool = {
  name: 'consultar_calendario',
  title: 'Consultar el calendario electoral',
  description:
    'Devuelve las fechas y los plazos clave de las elecciones generales del 29N (voto por correo, CERA, campaña, jornada de reflexión, escrutinio y constitución de las Cortes), con su base legal y sus enlaces oficiales. Permite filtrar por rango de fechas o palabra clave.',
  inputSchema: {
    type: 'object',
    properties: {
      desde: { type: 'string', description: 'Fecha mínima en formato AAAA-MM-DD. Incluye eventos activos en o después de esa fecha.' },
      hasta: { type: 'string', description: 'Fecha máxima en formato AAAA-MM-DD. Incluye eventos que empiezan en o antes de esa fecha.' },
      texto: { type: 'string', description: 'Palabra clave para filtrar eventos, por ejemplo «correo», «cera», «mesa» o «escrutinio».' },
    },
  },
  annotations: READ_ONLY,
  async execute(input) {
    const data = await calendarData();
    const from = input.desde ? assertIsoDate(input.desde, 'desde') : '';
    const to = input.hasta ? assertIsoDate(input.hasta, 'hasta') : '';
    const needle = input.texto ? normalizeForSearch(String(input.texto)) : '';

    const filtered = data.eventos.filter((event) => {
      if (from && (event.fechaFin ?? event.fecha) < from) return false;
      if (to && event.fecha > to) return false;
      if (needle) {
        const haystack = normalizeForSearch(`${event.id} ${event.titulo} ${event.descripcion} ${event.baseLegal ?? ''}`);
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    return {
      ...data,
      total: filtered.length,
      eventos: filtered,
    };
  },
};

export const siteTools = [
  listParties,
  searchMeasures,
  readMeasures,
  partySummary,
  listCategories,
  topicStances,
  queryPolls,
  queryDebates,
  queryCalendar,
];

export const registerSiteTools = () => registerTools(siteTools);
