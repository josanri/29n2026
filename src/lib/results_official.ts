/**
 * Adapter for the official Ministerio del Interior diffusion API (`resultados.29neleccionesgenerales.es`).
 *
 * Converts responses from:
 *   - GET /backend-difu/web/getConfig
 *   - GET /backend-difu/nomenclator/getNomenclator
 *   - GET /backend-difu/nomenclator/getPartidosColorAgrup
 *   - GET /backend-difu/scope/data/getScopeData/{scopeId}/{order}/{electionCode}/1/{0|1/90}
 * into the normalized Electosfera formats (`electosfera-resultados/1` and `electosfera-senado/1`).
 */
import {
  partyIdOf,
  RESULTS_FORMAT,
  SENATE_FORMAT,
  sortCandidates,
  sortParties,
  withElected,
  type AreaResult,
  type CandidateResult,
  type PartyRef,
  type PartyResult,
  type ResultsFeed,
  type ResultsKind,
  type SenateArea,
  type SenateConstituencyRef,
  type SenateFeed,
} from './results.ts';

export type OfficialSource = 'pro' | 'def';
export type OfficialValue<T = number> = { pro?: T | null; def?: T | null } | T | null | undefined;

export interface OfficialConfig {
  version?: number;
  grupo?: number;
  versionNomenclator?: number;
  versionPartidosColor?: number;
  numeroDeAvance?: number;
  numeroDeFase?: number;
  isOpen?: boolean;
  source?: OfficialSource;
  polling?: {
    isActive?: boolean;
    interval_MS?: number;
  };
}

export interface OfficialScopeRef {
  i: number;
  c: string;
  co: string;
  n: string;
  l: number;
  ic?: number;
  ma?: number[];
}

export interface OfficialNomenclator {
  ver?: number;
  elec?: Array<{ elec: number; idElec?: number; ord: number; n: string }>;
  amb: Array<{
    elec: number;
    ord: number;
    ambitos: OfficialScopeRef[];
  }>;
}

export interface OfficialPartyEntry {
  nombre: string;
  siglas: string;
  agrupacion?: string | number;
  color?: string;
}

export interface OfficialPartidosCatalog {
  version?: number;
  elecciones: Array<{
    eleccion: number;
    convocatoria: Record<string, { partidos: Record<string, OfficialPartyEntry> }>;
  }>;
}

export interface OfficialPartyMetric {
  codigo?: string | null;
  cargos?: OfficialValue<number>;
  porcentaje?: OfficialValue<number>;
  votos?: OfficialValue<number>;
}

export interface OfficialCandidateMetric {
  codigo: string;
  nombre?: string;
  apellido1?: string;
  apellido2?: string;
  votos?: OfficialValue<number>;
  porcentaje?: OfficialValue<number>;
  partido?: { codigo: string } | null;
  cargo?: boolean;
}

export interface OfficialScrutiny {
  envio?: number;
  fecha?: OfficialValue<string>;
  cargos?: number | null;
  censoNocheEscrutado?: OfficialValue<number>;
  porcCensoNocheEscrutado?: OfficialValue<number>;
  mesasEscrutadas?: OfficialValue<number>;
  porcMesasEscrutadas?: OfficialValue<number>;
  participacion?: OfficialValue<number>;
  abstencion?: OfficialValue<number>;
  votosTotales?: OfficialValue<number>;
  votosValidos?: OfficialValue<number>;
  votosPartidos?: OfficialValue<number>;
  votosBlancos?: OfficialValue<number>;
  votosNulos?: OfficialValue<number>;
  partidos?: OfficialPartyMetric[] | null;
  candidaturas?: OfficialCandidateMetric[] | null;
}

export interface OfficialMapItem {
  id?: string;
  codigo: string;
  nombre: string;
  nivel?: number;
  escrutinio?: OfficialScrutiny | null;
}

export interface OfficialScopeDataResponse {
  scope?: {
    id?: string;
    codigo?: string;
    nombre?: string;
    nivel?: number;
    escrutinio?: OfficialScrutiny | null;
  };
  codigo?: string;
  nombre?: string;
  nivel?: number;
  escrutinio?: OfficialScrutiny | null;
  mapa?: OfficialMapItem[] | null;
}

/** Election codes in the official nomenclator. */
export const OFFICIAL_ELECTION = {
  CONGRESS: { electionCode: 2, order: 1 },
  SENATE: { electionCode: 3, order: 2 },
} as const;

/** The party code of a 2023 list that has no 2026 list (`orden` 9999); it never has votes in 2026. */
export const NO_PARTY_CODE = '00';

/** Maps official level-70 island codes (`co`) to Electosfera Senate constituency codes. */
export const ISLAND_CODE_MAP: Record<string, string> = {
  '071': 'mallorca',
  '072': 'menorca',
  '073': 'ibiza',
  '074': 'formentera',
  '351': 'gran-canaria',
  '352': 'lanzarote',
  '353': 'fuerteventura',
  '384': 'tenerife',
  '385': 'la-palma',
  '386': 'la-gomera',
  '387': 'el-hierro',
};

export const pickSource = <T>(value: OfficialValue<T>, source: OfficialSource): T | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object' && ('pro' in value || 'def' in value)) {
    const selected = (value as { pro?: T | null; def?: T | null })[source];
    return selected === null || selected === undefined ? undefined : selected;
  }
  return value as T;
};

export const numSource = (value: OfficialValue<number | string>, source: OfficialSource): number => {
  const picked = pickSource(value, source);
  if (typeof picked === 'number') return Number.isFinite(picked) ? picked : 0;
  if (typeof picked === 'string') {
    const parsed = Number(picked.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const parseIsoDate = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
};

const sortConvocatoriaDesc = (a: string, b: string) => {
  const toSortable = (key: string) => {
    const [mm, yy] = key.split('-');
    return `${yy ?? ''}-${mm ?? ''}`;
  };
  return toSortable(b).localeCompare(toSortable(a));
};

/** Extracts the party code -> party metadata map for an election from `getPartidosColorAgrup`. */
export const buildPartyMap = (
  catalog: OfficialPartidosCatalog,
  electionCode: number,
  preferredConvocatoria = '11-26',
): Record<string, OfficialPartyEntry> => {
  const election = catalog.elecciones.find((item) => item.eleccion === electionCode);
  if (!election) return {};
  const convocatorias = election.convocatoria ?? {};
  if (convocatorias[preferredConvocatoria]?.partidos) {
    return convocatorias[preferredConvocatoria].partidos;
  }
  const latestKey = Object.keys(convocatorias).sort(sortConvocatoriaDesc)[0];
  return latestKey ? (convocatorias[latestKey]?.partidos ?? {}) : {};
};

/** Returns the 52 province scopes (level 30) for the Congress. */
export const extractCongressProvinces = (nomenclator: OfficialNomenclator): OfficialScopeRef[] => {
  const block = nomenclator.amb.find((item) => item.elec === OFFICIAL_ELECTION.CONGRESS.electionCode);
  if (!block) return [];
  return block.ambitos
    .filter((scope) => scope.l === 30 && /^\d{2}$/.test(scope.co))
    .sort((a, b) => a.co.localeCompare(b.co));
};

export interface SenateScopeTarget {
  constituencyCode: string;
  scope: OfficialScopeRef;
}

/**
 * Returns all Senate circumscription scopes (`ic === 1`), mapped to Electosfera's 60 constituency codes.
 * Since 29N, Eivissa (`073`) and Formentera (`074`) are two constituencies with one senator each.
 */
export const extractSenateTargets = (nomenclator: OfficialNomenclator): SenateScopeTarget[] => {
  const block = nomenclator.amb.find((item) => item.elec === OFFICIAL_ELECTION.SENATE.electionCode);
  if (!block) return [];
  const targets: SenateScopeTarget[] = [];
  for (const scope of block.ambitos) {
    if (scope.ic !== 1) continue;
    if (scope.l === 30 && /^\d{2}$/.test(scope.co)) {
      targets.push({ constituencyCode: scope.co, scope });
    } else if (scope.l === 70 && ISLAND_CODE_MAP[scope.co]) {
      targets.push({ constituencyCode: ISLAND_CODE_MAP[scope.co], scope });
    }
  }
  return targets.sort((a, b) => a.constituencyCode.localeCompare(b.constituencyCode) || a.scope.co.localeCompare(b.scope.co));
};

/** A color of `getPartidosColorAgrup` as `#rrggbb`, or nothing if it is not a valid color. */
const officialColor = (value: string | undefined) => {
  const hex = value?.trim().replace(/^#?/, '#');
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : undefined;
};

/**
 * The Electosfera id of an official party code. First its acronym; if no party of the catalog has it, the
 * acronym of its official group (`agrupacion`, for example 13 for every Frente Amplio list) and then its name.
 * A party that is not in the catalog takes the id and the acronym of its group.
 */
export const officialPartyId = (
  code: string,
  partyMap: Record<string, OfficialPartyEntry>,
  catalog: readonly PartyRef[],
): { id: string; acronym: string; color?: string } => {
  const meta = code ? partyMap[code] : undefined;
  const acronym = (meta?.siglas ?? code).trim();
  const id = partyIdOf(acronym, catalog);
  if (!id.startsWith('x-') || !meta) return { id, acronym };
  const group = meta.agrupacion !== undefined && meta.agrupacion !== null ? partyMap[String(meta.agrupacion)] : undefined;
  for (const alternative of [group?.siglas, meta.nombre]) {
    if (!alternative?.trim()) continue;
    const alternativeId = partyIdOf(alternative.trim(), catalog);
    if (!alternativeId.startsWith('x-')) return { id: alternativeId, acronym };
  }
  // A party outside the catalog: its group gives one id to its lists (F.I.A. and FIA, PCTE and ELAK/PCTE), and the
  // official color of the group (or of the list) goes with it.
  const groupAcronym = group?.siglas?.trim();
  const color = officialColor(group?.color) ?? officialColor(meta.color);
  const result = groupAcronym ? { id: partyIdOf(groupAcronym, catalog), acronym: groupAcronym } : { id, acronym };
  return color ? { ...result, color } : result;
};

const convertParties = (
  rawParties: OfficialPartyMetric[] | null | undefined,
  options: {
    partyMap: Record<string, OfficialPartyEntry>;
    catalog: readonly PartyRef[];
    source: OfficialSource;
    includeSeats: boolean;
  },
): PartyResult[] => {
  const merged = new Map<string, PartyResult>();
  for (const raw of rawParties ?? []) {
    const code = raw.codigo ? String(raw.codigo) : '';
    // `00` is a list of 2023 with no list in 2026: it is there only for `partidosEnfrentamiento`.
    if (code === NO_PARTY_CODE) continue;
    const meta = code ? options.partyMap[code] : undefined;
    const { id, acronym, color } = officialPartyId(code, options.partyMap, options.catalog);
    if (!acronym) continue;
    const known = options.catalog.find((ref) => ref.id === id);
    const votes = numSource(raw.votos, options.source);
    const seats = options.includeSeats ? numSource(raw.cargos, options.source) : undefined;
    const prev = merged.get(id);
    merged.set(id, {
      id,
      acronym: known?.acronym ?? acronym,
      name: known?.name ?? meta?.nombre,
      votes: (prev?.votes ?? 0) + votes,
      ...(options.includeSeats ? { seats: (prev?.seats ?? 0) + (seats ?? 0) } : {}),
      ...(known || !color ? {} : { color }),
    });
  }
  return sortParties([...merged.values()]);
};

const convertScrutinyToArea = (
  scrutiny: OfficialScrutiny | null | undefined,
  options: {
    code: string;
    name: string;
    seats: number;
    partyMap: Record<string, OfficialPartyEntry>;
    catalog: readonly PartyRef[];
    source: OfficialSource;
  },
): AreaResult => {
  const counted =
    pickSource(scrutiny?.porcMesasEscrutadas, options.source) !== undefined
      ? numSource(scrutiny?.porcMesasEscrutadas, options.source)
      : numSource(scrutiny?.porcCensoNocheEscrutado, options.source);
  return {
    code: options.code,
    name: options.name,
    seats: options.seats,
    counted,
    census: numSource(scrutiny?.censoNocheEscrutado, options.source),
    voters: numSource(scrutiny?.votosTotales, options.source),
    null: numSource(scrutiny?.votosNulos, options.source),
    blank: numSource(scrutiny?.votosBlancos, options.source),
    parties: convertParties(scrutiny?.partidos, {
      partyMap: options.partyMap,
      catalog: options.catalog,
      source: options.source,
      includeSeats: options.seats > 0,
    }),
  };
};

export interface CongressConversionEntry {
  provinceCode: string;
  response: OfficialScopeDataResponse;
}

/** Converts the 52 province responses into `espana.json` (`ResultsFeed`). */
export const buildCongressFeed = (
  entries: CongressConversionEntry[],
  options: {
    partyMap: Record<string, OfficialPartyEntry>;
    catalog: readonly PartyRef[];
    seatsByCode: Record<string, number>;
    names: Record<string, string>;
    source: OfficialSource;
  },
): ResultsFeed => {
  let latestDate: string | undefined;
  const areas: AreaResult[] = [];
  for (const { provinceCode, response } of entries) {
    const scrutiny = response.scope?.escrutinio ?? response.escrutinio;
    const iso = parseIsoDate(pickSource(scrutiny?.fecha, options.source));
    if (iso && (!latestDate || iso > latestDate)) latestDate = iso;
    areas.push(
      convertScrutinyToArea(scrutiny, {
        code: provinceCode,
        name: options.names[provinceCode] ?? response.scope?.nombre ?? response.nombre ?? provinceCode,
        seats: options.seatsByCode[provinceCode] ?? 0,
        partyMap: options.partyMap,
        catalog: options.catalog,
        source: options.source,
      }),
    );
  }
  const kind: ResultsKind = options.source === 'def' ? 'definitivo' : 'provisional';
  return {
    format: RESULTS_FORMAT,
    kind,
    updatedAt: latestDate ?? new Date().toISOString(),
    areas: areas.sort((a, b) => a.code.localeCompare(b.code)),
  };
};

/** Converts the `mapa` array of a province response (fetched with `/1/90`) into `municipios-<prov>.json`. */
export const buildMunicipalFeedFromScope = (
  provinceCode: string,
  response: OfficialScopeDataResponse,
  options: {
    partyMap: Record<string, OfficialPartyEntry>;
    catalog: readonly PartyRef[];
    source: OfficialSource;
  },
): ResultsFeed | null => {
  const mapa = response.mapa;
  if (!Array.isArray(mapa) || mapa.length === 0) return null;
  const scopeScrutiny = response.scope?.escrutinio ?? response.escrutinio;
  let latestDate = parseIsoDate(pickSource(scopeScrutiny?.fecha, options.source));
  const areas: AreaResult[] = [];
  for (const item of mapa) {
    const code = String(item.codigo ?? '').replace(/\D/g, '');
    if (code.length !== 5 || !code.startsWith(provinceCode)) continue;
    const iso = parseIsoDate(pickSource(item.escrutinio?.fecha, options.source));
    if (iso && (!latestDate || iso > latestDate)) latestDate = iso;
    areas.push(
      convertScrutinyToArea(item.escrutinio, {
        code,
        name: item.nombre || code,
        seats: 0,
        partyMap: options.partyMap,
        catalog: options.catalog,
        source: options.source,
      }),
    );
  }
  if (areas.length === 0) return null;
  const kind: ResultsKind = options.source === 'def' ? 'definitivo' : 'provisional';
  return {
    format: RESULTS_FORMAT,
    kind,
    updatedAt: latestDate ?? new Date().toISOString(),
    province: provinceCode,
    areas: areas.sort((a, b) => a.code.localeCompare(b.code)),
  };
};

export interface SenateConversionEntry {
  constituencyCode: string;
  response: OfficialScopeDataResponse;
}

const fullCandidateName = (candidate: OfficialCandidateMetric) =>
  [candidate.nombre, candidate.apellido1, candidate.apellido2]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');

/**
 * Converts Senate scope responses into `senado.json` (`SenateFeed`).
 * Multiple scopes mapping to the same constituency are merged (no official scope does it in 2026).
 */
export const buildSenateFeed = (
  entries: SenateConversionEntry[],
  options: {
    partyMap: Record<string, OfficialPartyEntry>;
    catalog: readonly PartyRef[];
    constituencies: readonly SenateConstituencyRef[];
    names: Record<string, string>;
    source: OfficialSource;
  },
): SenateFeed => {
  const refByCode = new Map(options.constituencies.map((item) => [item.code, item]));
  const grouped = new Map<string, OfficialScopeDataResponse[]>();
  for (const entry of entries) {
    if (!refByCode.has(entry.constituencyCode)) continue;
    const list = grouped.get(entry.constituencyCode) ?? [];
    list.push(entry.response);
    grouped.set(entry.constituencyCode, list);
  }

  let latestDate: string | undefined;
  const areas: SenateArea[] = [];

  for (const [code, responses] of grouped) {
    const ref = refByCode.get(code)!;
    let census = 0;
    let voters = 0;
    let nullVotes = 0;
    let blank = 0;
    let countedWeighted = 0;
    let weightSum = 0;
    const candidatesByKey = new Map<string, CandidateResult>();

    for (const response of responses) {
      const scrutiny = response.scope?.escrutinio ?? response.escrutinio;
      const iso = parseIsoDate(pickSource(scrutiny?.fecha, options.source));
      if (iso && (!latestDate || iso > latestDate)) latestDate = iso;

      const areaCensus = numSource(scrutiny?.censoNocheEscrutado, options.source);
      const areaCounted =
        pickSource(scrutiny?.porcMesasEscrutadas, options.source) !== undefined
          ? numSource(scrutiny?.porcMesasEscrutadas, options.source)
          : numSource(scrutiny?.porcCensoNocheEscrutado, options.source);
      const weight = areaCensus > 0 ? areaCensus : 1;
      countedWeighted += areaCounted * weight;
      weightSum += weight;

      census += areaCensus;
      voters += numSource(scrutiny?.votosTotales, options.source);
      nullVotes += numSource(scrutiny?.votosNulos, options.source);
      blank += numSource(scrutiny?.votosBlancos, options.source);

      for (const raw of scrutiny?.candidaturas ?? []) {
        const partyCode = raw.partido?.codigo ? String(raw.partido.codigo) : '';
        const { id: officialId, acronym: rawAcronym, color } = officialPartyId(partyCode, options.partyMap, options.catalog);
        const name = fullCandidateName(raw) || rawAcronym || raw.codigo;
        const partyId = rawAcronym ? officialId : partyIdOf(name, options.catalog);
        const known = options.catalog.find((item) => item.id === partyId);
        const key = raw.codigo || `${partyId}:${name.toLowerCase()}`;
        const prev = candidatesByKey.get(key);
        const votes = numSource(raw.votos, options.source);
        const elected = typeof raw.cargo === 'boolean' ? raw.cargo : undefined;
        candidatesByKey.set(key, {
          name: prev?.name ?? name,
          partyId,
          acronym: known?.acronym ?? rawAcronym,
          votes: (prev?.votes ?? 0) + votes,
          ...(elected !== undefined || prev?.elected !== undefined ? { elected: Boolean(prev?.elected || elected) } : {}),
          ...(known || !color ? {} : { color }),
        });
      }
    }

    const baseArea: SenateArea = {
      code: ref.code,
      name: options.names[ref.code] ?? ref.name,
      province: ref.province,
      seats: ref.seats,
      counted: weightSum > 0 ? Math.round((countedWeighted / weightSum) * 100) / 100 : 0,
      census,
      voters,
      null: nullVotes,
      blank,
      candidates: sortCandidates([...candidatesByKey.values()]),
    };
    areas.push(withElected(baseArea));
  }

  const kind: ResultsKind = options.source === 'def' ? 'definitivo' : 'provisional';
  return {
    format: SENATE_FORMAT,
    kind,
    updatedAt: latestDate ?? new Date().toISOString(),
    areas: areas.sort((a, b) => a.code.localeCompare(b.code)),
  };
};
