/**
 * Results of the Congress and the Senate: the normalized formats of the page /resultados/, the adapters for the data
 * of the Ministerio del Interior, the D'Hondt rule, the elected senators and the simulation of an election night.
 *
 * The file has no imports: the page, the tests and `scripts/results_import.ts` (plain Node) all use it.
 *
 * Normalized format `electosfera-resultados/1`:
 * {
 *   format: 'electosfera-resultados/1',
 *   kind: 'provisional' | 'definitivo' | 'simulacion',
 *   updatedAt: ISO date,
 *   areas: [{ code: '28', name: 'Madrid', seats: 38, counted: 87.31, census, voters, null, blank,
 *             parties: [{ id, acronym, name?, votes, seats? }] }]
 * }
 * `areas` has one item for each constituency (INE code of the province). The total of Spain is the sum of the
 * provinces: `nationalTotal`. When a party has no `seats`, `withSeats` gives the D'Hondt seats of its votes.
 *
 * Senate format `electosfera-senado/1` (see «Senate» below): the same fields for each of the 59 constituencies, with
 * `province` and `candidates: [{ name, partyId, acronym, votes, elected? }]` in place of `parties`.
 */

export const RESULTS_FORMAT = 'electosfera-resultados/1';
/** LOREG, art. 163.1.a: a list needs 3 % of the valid votes of the constituency (blank votes are valid). */
export const THRESHOLD = 0.03;

export type ResultsKind = 'provisional' | 'definitivo' | 'simulacion';

export interface PartyResult {
  id: string;
  acronym: string;
  name?: string;
  votes: number;
  seats?: number;
}

export interface AreaResult {
  code: string;
  name: string;
  /** Seats of the constituency. */
  seats: number;
  /** Counted share of the polling stations (mesas), 0 to 100. */
  counted: number;
  /** Census of the counted polling stations, as the Ministry gives it: the turnout is `voters / census`. */
  census: number;
  voters: number;
  null: number;
  blank: number;
  parties: PartyResult[];
}

export interface ResultsFeed {
  format: typeof RESULTS_FORMAT;
  kind: ResultsKind;
  updatedAt: string;
  /** Only in the file of the municipalities of one province: its INE code. The areas are then municipalities. */
  province?: string;
  areas: AreaResult[];
}

export interface PartyRef {
  id: string;
  acronym: string;
  name: string;
  aliases: string[];
  territory?: string[];
}

// ---------- D'Hondt ----------

/**
 * The D'Hondt seats of a constituency (LOREG, art. 163). A list under the threshold gets no seat.
 * A tie of quotients goes to the list with more votes. With the same votes, the law asks for a draw: here the
 * first list of the input wins, so the result is stable.
 */
export const dhondt = (votes: Record<string, number>, seats: number, validVotes: number, threshold = THRESHOLD) => {
  const result: Record<string, number> = Object.fromEntries(Object.keys(votes).map((id) => [id, 0]));
  const lists = Object.entries(votes).filter(([, count]) => count > 0 && count >= threshold * validVotes);
  if (lists.length === 0) return result;
  for (let seat = 0; seat < seats; seat += 1) {
    let best = lists[0];
    let bestQuotient = best[1] / (result[best[0]] + 1);
    for (const list of lists.slice(1)) {
      const quotient = list[1] / (result[list[0]] + 1);
      if (quotient > bestQuotient || (quotient === bestQuotient && list[1] > best[1])) {
        best = list;
        bestQuotient = quotient;
      }
    }
    result[best[0]] += 1;
  }
  return result;
};

/** Valid votes: the votes of the lists and the blank votes. */
export const validVotes = (area: AreaResult) => area.parties.reduce((sum, party) => sum + party.votes, 0) + area.blank;

/** An area with the seats of each party: the seats of the source when it gives them, D'Hondt when it does not. */
export const withSeats = (area: AreaResult): AreaResult => {
  if (area.parties.every((party) => typeof party.seats === 'number')) return area;
  const seats = dhondt(Object.fromEntries(area.parties.map((party) => [party.id, party.votes])), area.seats, validVotes(area));
  return { ...area, parties: area.parties.map((party) => ({ ...party, seats: seats[party.id] ?? 0 })) };
};

/** The total of Spain: the sum of the constituencies. `counted` is weighted by the seats of each one. */
export const nationalTotal = (areas: AreaResult[]): AreaResult => {
  const parties = new Map<string, PartyResult>();
  let seatWeight = 0;
  const sum = { seats: 0, census: 0, voters: 0, null: 0, blank: 0 };
  for (const raw of areas) {
    const area = withSeats(raw);
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += area[key];
    seatWeight += area.counted * area.seats;
    for (const party of area.parties) {
      const total = parties.get(party.id) ?? { id: party.id, acronym: party.acronym, name: party.name, votes: 0, seats: 0 };
      total.votes += party.votes;
      total.seats = (total.seats ?? 0) + (party.seats ?? 0);
      parties.set(party.id, total);
    }
  }
  return {
    code: 'ES',
    name: 'España',
    ...sum,
    counted: sum.seats ? seatWeight / sum.seats : 0,
    parties: sortParties([...parties.values()]),
  };
};

/** Seats first, then votes. */
export const sortParties = (parties: PartyResult[]) =>
  [...parties].sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0) || b.votes - a.votes);

/** Share of the valid votes, 0 to 100. */
export const share = (votes: number, area: AreaResult) => {
  const valid = validVotes(area);
  return valid ? (100 * votes) / valid : 0;
};

/** Turnout over the census, 0 to 100. */
export const turnout = (area: AreaResult) => (area.census ? (100 * area.voters) / area.census : 0);

// ---------- Adapter ----------

const normalizeAcronym = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/** The id of a candidacy from its acronym: a known party by its aliases, or a slug of the acronym. */
export const partyIdOf = (acronym: string, catalog: readonly PartyRef[]) => {
  const key = normalizeAcronym(acronym);
  const known = catalog.find((party) => party.aliases.some((alias) => normalizeAcronym(alias) === key));
  if (known) return known.id;
  return `x-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-siglas'}`;
};

type Raw = Record<string, unknown>;
const pick = (object: Raw, names: string[]): unknown => {
  for (const name of names) if (object[name] !== undefined && object[name] !== null) return object[name];
  return undefined;
};
/** A number from a number or a Spanish text («1.234.567», «87,31»). */
const num = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const text = value.trim().replace(/%$/, '');
  const normalized = /,\d+$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(/\.(?=\d{3}(\D|$))/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The names of the fields that the adapter accepts, from the most usual names of the data of the provisional count
 * (Ministerio del Interior and the media that redistribute it). The Ministry gives the specification to the media
 * before the night; if a name changes, add it here and run the tests.
 */
export const FIELD_ALIASES = {
  areas: ['areas', 'ambitos', 'circunscripciones', 'provincias'],
  municipalities: ['municipios', 'areas', 'ambitos'],
  code: ['code', 'codigo', 'codigoINE', 'codProvincia', 'cod_provincia', 'id'],
  municipalityCode: ['codMunicipio', 'cod_municipio', 'codigoMunicipio', 'codigoINE', 'code', 'codigo', 'id'],
  provinceCode: ['codProvincia', 'cod_provincia', 'codigoProvincia'],
  name: ['name', 'nombre', 'descripcion'],
  seats: ['seats', 'escanos', 'escaños', 'diputados', 'escanosAElegir', 'numEscanos'],
  counted: ['counted', 'escrutado', 'porcentajeEscrutado', 'pctEscrutado', 'mesasEscrutadasPct'],
  pollingStations: ['mesas', 'mesasTotales', 'totalMesas'],
  countedStations: ['mesasEscrutadas', 'mesasContabilizadas'],
  // The census of the counted stations comes first: with the full census, the turnout is low until the count ends.
  census: ['census', 'censoEscrutado', 'censo', 'censoTotal'],
  voters: ['voters', 'votantes', 'votosEmitidos', 'totalVotantes'],
  null: ['null', 'nulos', 'votosNulos'],
  blank: ['blank', 'blancos', 'votosBlanco', 'votosEnBlanco'],
  parties: ['parties', 'partidos', 'candidaturas', 'resultados'],
  acronym: ['acronym', 'siglas', 'sigla', 'nombreCorto'],
  partyName: ['name', 'nombre', 'denominacion'],
  votes: ['votes', 'votos', 'numVotos'],
  partySeats: ['seats', 'escanos', 'escaños', 'electos', 'diputados'],
  updatedAt: ['updatedAt', 'actualizado', 'fechaActualizacion', 'horaActualizacion', 'timestamp'],
} as const;

/**
 * Converts the data of a source (the normalized format, or a JSON with the usual Spanish field names) to the
 * normalized format. A province code can come as «28», «2800» or «028»: the result keeps two digits.
 * Areas that are not one of `seatsByCode` (the total of Spain, a region) are left out: the total is the sum.
 */
export const normalizeFeed = (
  input: unknown,
  options: { catalog: readonly PartyRef[]; seatsByCode: Record<string, number>; names?: Record<string, string>; kind?: ResultsKind },
): ResultsFeed => {
  const root = (input ?? {}) as Raw;
  const list = listOf(input, FIELD_ALIASES.areas);
  if (!list) throw new Error('Los datos no tienen una lista de circunscripciones (areas, ambitos…).');

  const areas: AreaResult[] = [];
  for (const raw of list) {
    const code = provinceCode(String(pick(raw, [...FIELD_ALIASES.code]) ?? ''), options.seatsByCode);
    if (!code) continue;
    areas.push(parseArea(raw, code, options.names?.[code], options.seatsByCode[code], options.catalog));
  }
  if (areas.length === 0) throw new Error('Ninguna circunscripción de los datos coincide con las 52 provincias.');
  return feedOf(root, areas, options.kind);
};

/**
 * Converts the results by municipality (one list for one province, or for all of them) to one normalized file for
 * each province. The code of a municipality is the INE code of five digits: «29067». The adapter also reads it as
 * a province code and a municipality code in two fields, as «0129067» (region, province, municipality) or as the
 * INE code with its check digit («290670»). A municipality has no seats: `seats` is 0.
 */
export const normalizeMunicipalFeed = (
  input: unknown,
  options: { catalog: readonly PartyRef[]; provinces: readonly string[]; kind?: ResultsKind },
): Record<string, ResultsFeed> => {
  const root = (input ?? {}) as Raw;
  const list = listOf(input, FIELD_ALIASES.municipalities);
  if (!list) throw new Error('Los datos no tienen una lista de municipios (municipios, areas…).');
  const byProvince: Record<string, AreaResult[]> = {};
  for (const raw of list) {
    const code = municipalityCode(raw);
    if (!code || !options.provinces.includes(code.slice(0, 2))) continue;
    (byProvince[code.slice(0, 2)] ??= []).push(parseArea(raw, code, undefined, 0, options.catalog));
  }
  if (Object.keys(byProvince).length === 0) throw new Error('Ningún municipio de los datos tiene un código INE válido.');
  return Object.fromEntries(
    Object.entries(byProvince).map(([province, areas]) => [province, { ...feedOf(root, areas, options.kind), province }]),
  );
};

const listOf = (input: unknown, names: readonly string[]) => {
  const list = Array.isArray(input) ? input : pick((input ?? {}) as Raw, [...names]);
  return Array.isArray(list) ? (list as Raw[]) : undefined;
};

/** The count, the census, the voters, and the null and blank votes of an area of the source. */
const areaNumbers = (raw: Raw) => {
  const stations = num(pick(raw, [...FIELD_ALIASES.pollingStations]));
  const countedStations = num(pick(raw, [...FIELD_ALIASES.countedStations]));
  const countedField = pick(raw, [...FIELD_ALIASES.counted]);
  return {
    counted: countedField !== undefined ? num(countedField) : stations ? (100 * countedStations) / stations : 0,
    census: num(pick(raw, [...FIELD_ALIASES.census])),
    voters: num(pick(raw, [...FIELD_ALIASES.voters])),
    null: num(pick(raw, [...FIELD_ALIASES.null])),
    blank: num(pick(raw, [...FIELD_ALIASES.blank])),
  };
};

const parseArea = (raw: Raw, code: string, name: string | undefined, seats: number, catalog: readonly PartyRef[]): AreaResult => {
  const partiesRaw = (pick(raw, [...FIELD_ALIASES.parties]) ?? []) as Raw[];
  const parties = new Map<string, PartyResult>();
  for (const party of partiesRaw) {
    const acronym = String(pick(party, [...FIELD_ALIASES.acronym]) ?? '').trim();
    if (!acronym) continue;
    const id = partyIdOf(acronym, catalog);
    const known = catalog.find((ref) => ref.id === id);
    const seatsField = seats ? pick(party, [...FIELD_ALIASES.partySeats]) : undefined;
    // Two lists of the same party in one area (it does not happen in the Congress, but a source can split a
    // coalition): their votes and seats add up.
    const previous = parties.get(id);
    const partySeats = seatsField === undefined ? undefined : num(seatsField);
    parties.set(id, {
      id,
      acronym: known?.acronym ?? acronym,
      name: known?.name ?? (pick(party, [...FIELD_ALIASES.partyName]) as string | undefined),
      votes: (previous?.votes ?? 0) + num(pick(party, [...FIELD_ALIASES.votes])),
      seats: partySeats === undefined && previous?.seats === undefined ? undefined : (previous?.seats ?? 0) + (partySeats ?? 0),
    });
  }
  return {
    code,
    name: name ?? String(pick(raw, [...FIELD_ALIASES.name]) ?? code),
    seats,
    ...areaNumbers(raw),
    parties: [...parties.values()],
  };
};

/** The kind and the time of a file of the source. */
const feedHeader = (root: Raw, kindOption?: ResultsKind) => {
  const kindField = String(root.kind ?? root.tipo ?? '');
  const kind: ResultsKind = kindOption ?? (['provisional', 'definitivo', 'simulacion'].includes(kindField) ? (kindField as ResultsKind) : 'provisional');
  const updated = pick(root, [...FIELD_ALIASES.updatedAt]);
  return {
    kind,
    updatedAt: typeof updated === 'string' && !Number.isNaN(Date.parse(updated)) ? new Date(updated).toISOString() : new Date().toISOString(),
  };
};

const feedOf = (root: Raw, areas: AreaResult[], kindOption?: ResultsKind): ResultsFeed => ({
  format: RESULTS_FORMAT,
  ...feedHeader(root, kindOption),
  areas: areas.sort((a, b) => a.code.localeCompare(b.code)),
});

const provinceCode = (value: string, seatsByCode: Record<string, number>) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  const candidates = [digits.padStart(2, '0'), digits.slice(0, 2), digits.slice(-2)];
  return candidates.find((code) => code in seatsByCode);
};

const municipalityCode = (raw: Raw) => {
  const municipality = String(pick(raw, [...FIELD_ALIASES.municipalityCode]) ?? '').replace(/\D/g, '');
  const province = String(pick(raw, [...FIELD_ALIASES.provinceCode]) ?? '').replace(/\D/g, '');
  if (province && municipality && municipality.length <= 3) return province.padStart(2, '0').slice(-2) + municipality.padStart(3, '0');
  const code = municipality || String(pick(raw, [...FIELD_ALIASES.code]) ?? '').replace(/\D/g, '');
  if (code.length === 5) return code;
  if (code.length === 6) return code.slice(0, 5); // INE code with its check digit
  if (code.length === 7) return code.slice(2); // region + province + municipality
  return undefined;
};

// ---------- Senate ----------

export const SENATE_FORMAT = 'electosfera-senado/1';

export interface CandidateResult {
  name: string;
  partyId: string;
  acronym: string;
  votes: number;
  /** The source says if the candidate is elected. Without it, `withElected` gives the seats by votes. */
  elected?: boolean;
}

export interface SenateArea extends Omit<AreaResult, 'parties'> {
  /** The INE code of the province of the constituency (an island has its own `code`). */
  province: string;
  candidates: CandidateResult[];
}

export interface SenateFeed {
  format: typeof SENATE_FORMAT;
  kind: ResultsKind;
  updatedAt: string;
  areas: SenateArea[];
}

/** A constituency of the Senate, as `senateConstituencies` in the data of the election gives it. */
export interface SenateConstituencyRef {
  code: string;
  name: string;
  province: string;
  seats: number;
  share?: number;
  aliases?: string[];
}

/**
 * The candidates that each voter can mark (LOREG, art. 166.1.a): 3 in a province of 4 senators; 2 in Gran Canaria,
 * Mallorca, Tenerife, Ceuta and Melilla; 1 in the other islands.
 */
export const senateVotesPerVoter = (seats: number) => (seats >= 4 ? 3 : seats >= 2 ? 2 : 1);

/**
 * A constituency with its elected senators. The seats go to the candidates with the most votes (LOREG, art. 166.1.b),
 * whatever their party. With the same votes, the first candidate of the input wins, so the result is stable.
 * When the source marks the elected candidates, the marks of the source stay.
 */
export const withElected = (area: SenateArea): SenateArea => {
  if (area.candidates.some((candidate) => typeof candidate.elected === 'boolean')) return area;
  const ranked = area.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.votes > 0)
    .sort((a, b) => b.candidate.votes - a.candidate.votes || a.index - b.index)
    .slice(0, area.seats);
  const elected = new Set(ranked.map(({ index }) => index));
  return { ...area, candidates: area.candidates.map((candidate, index) => ({ ...candidate, elected: elected.has(index) })) };
};

/** The elected candidates first, then by votes. */
export const sortCandidates = (candidates: CandidateResult[]) =>
  [...candidates].sort((a, b) => Number(Boolean(b.elected)) - Number(Boolean(a.elected)) || b.votes - a.votes);

/**
 * The total of the Senate: the elected senators of each party in all the constituencies. A voter marks up to three
 * candidates, so the votes of a party are not the sum of its candidates: `votes` is the sum of its most-voted
 * candidate in each constituency, the usual way to compare parties in the Senate.
 */
export const senateTotal = (areas: SenateArea[]): { seats: number; assigned: number; counted: number; parties: PartyResult[] } => {
  const parties = new Map<string, PartyResult>();
  let seats = 0;
  let seatWeight = 0;
  for (const raw of areas) {
    const area = withElected(raw);
    seats += area.seats;
    seatWeight += area.counted * area.seats;
    const best = new Map<string, number>();
    for (const candidate of area.candidates) {
      const total = parties.get(candidate.partyId) ?? { id: candidate.partyId, acronym: candidate.acronym, votes: 0, seats: 0 };
      if (candidate.elected) total.seats = (total.seats ?? 0) + 1;
      parties.set(candidate.partyId, total);
      best.set(candidate.partyId, Math.max(best.get(candidate.partyId) ?? 0, candidate.votes));
    }
    for (const [id, votes] of best) parties.get(id)!.votes += votes;
  }
  const list = sortParties([...parties.values()]);
  return { seats, assigned: list.reduce((sum, party) => sum + (party.seats ?? 0), 0), counted: seats ? seatWeight / seats : 0, parties: list };
};

/** The names of the fields of the candidates of the Senate in the source. */
export const SENATE_FIELD_ALIASES = {
  candidates: ['candidates', 'candidatos', 'senadores', 'resultados'],
  candidateName: ['name', 'nombre', 'nombreCandidato', 'candidato', 'apellidosNombre'],
  elected: ['elected', 'electo', 'elegido'],
} as const;

const plainName = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Converts the results of the Senate of a source to the normalized format. The adapter finds each constituency by
 * its code (the INE code of a province, or the short code of an island) or by its name. Areas that are not one of
 * `constituencies` (the total of Spain, a whole island province) are left out.
 */
export const normalizeSenateFeed = (
  input: unknown,
  options: { catalog: readonly PartyRef[]; constituencies: readonly SenateConstituencyRef[]; names?: Record<string, string>; kind?: ResultsKind },
): SenateFeed => {
  const root = (input ?? {}) as Raw;
  const list = listOf(input, FIELD_ALIASES.areas);
  if (!list) throw new Error('Los datos del Senado no tienen una lista de circunscripciones (areas, ambitos…).');
  const byCode = new Map(options.constituencies.map((constituency) => [constituency.code, constituency]));
  const byName = new Map<string, SenateConstituencyRef>();
  for (const constituency of options.constituencies) {
    for (const name of [constituency.name, options.names?.[constituency.code] ?? '', ...(constituency.aliases ?? [])]) {
      if (name && !/^\d+$/.test(name)) byName.set(plainName(name), constituency);
    }
  }
  // The name goes first: a whole island province (07, 35, 38) is not a constituency, and its code must not match.
  const find = (raw: Raw) => {
    const code = String(pick(raw, [...FIELD_ALIASES.code]) ?? '');
    const byItsName = byName.get(plainName(String(pick(raw, [...FIELD_ALIASES.name]) ?? '')));
    if (byItsName) return byItsName;
    if (byCode.has(code)) return byCode.get(code);
    const digits = code.replace(/\D/g, '');
    return digits ? [digits.padStart(2, '0'), digits.slice(0, 2)].map((value) => byCode.get(value)).find(Boolean) : undefined;
  };

  const areas = new Map<string, SenateArea>();
  for (const raw of list) {
    const constituency = find(raw);
    if (!constituency || areas.has(constituency.code)) continue;
    const candidates: CandidateResult[] = [];
    for (const item of (pick(raw, [...SENATE_FIELD_ALIASES.candidates]) ?? []) as Raw[]) {
      const acronym = String(pick(item, [...FIELD_ALIASES.acronym]) ?? '').trim();
      const name = String(pick(item, [...SENATE_FIELD_ALIASES.candidateName]) ?? '').trim();
      if (!acronym && !name) continue;
      const partyId = partyIdOf(acronym || name, options.catalog);
      const elected = pick(item, [...SENATE_FIELD_ALIASES.elected]);
      candidates.push({
        name: name || acronym,
        partyId,
        acronym: options.catalog.find((ref) => ref.id === partyId)?.acronym ?? acronym,
        votes: num(pick(item, [...FIELD_ALIASES.votes])),
        ...(elected === undefined ? {} : { elected: elected === true || elected === 1 || /^(s|s[ií]|true|1)$/i.test(String(elected)) }),
      });
    }
    areas.set(constituency.code, {
      code: constituency.code,
      name: options.names?.[constituency.code] ?? constituency.name,
      province: constituency.province,
      seats: constituency.seats,
      ...areaNumbers(raw),
      candidates,
    });
  }
  if (areas.size === 0) throw new Error('Ninguna circunscripción de los datos coincide con las del Senado.');
  return { format: SENATE_FORMAT, ...feedHeader(root, options.kind), areas: [...areas.values()].sort((a, b) => a.code.localeCompare(b.code)) };
};

/**
 * An invented night of the Senate from an invented night of the Congress (for the rehearsal of the import script).
 * Each party with 1 % of the votes of the province puts as many candidates as a voter can mark, and each candidate
 * gets the votes of the party with a small personal swing. An island gets its `share` of the votes of its province.
 */
export const simulateSenate = (congress: ResultsFeed, constituencies: readonly SenateConstituencyRef[], seed = 29): SenateFeed => {
  const provinces = new Map(congress.areas.map((area) => [area.code, area]));
  const areas = constituencies.flatMap((constituency): SenateArea[] => {
    const province = provinces.get(constituency.province);
    if (!province) return [];
    const random = seededRandom(hash(`${seed}-senado-${constituency.code}`));
    const part = constituency.share ?? 1;
    const scale = (value: number) => Math.round(value * part);
    const valid = validVotes(province);
    const slots = senateVotesPerVoter(constituency.seats);
    const candidates: CandidateResult[] = [];
    for (const party of province.parties) {
      if (party.id === 'otros' || party.votes < 0.01 * valid) continue;
      // On an island the vote moves away from the province.
      const local = part < 1 ? 0.7 + random() * 0.6 : 1;
      for (let index = 0; index < slots; index += 1) {
        const swing = 0.95 + random() * 0.08 - index * 0.015;
        candidates.push({
          name: `${party.acronym} · candidatura ${index + 1}`,
          partyId: party.id,
          acronym: party.acronym,
          votes: Math.round(party.votes * part * local * swing),
        });
      }
    }
    return [
      withElected({
        code: constituency.code,
        name: constituency.name,
        province: constituency.province,
        seats: constituency.seats,
        counted: province.counted,
        census: scale(province.census),
        voters: scale(province.voters),
        null: scale(province.null),
        blank: scale(province.blank),
        candidates,
      }),
    ];
  });
  return { format: SENATE_FORMAT, kind: 'simulacion', updatedAt: congress.updatedAt, areas };
};

// ---------- Simulation ----------

/** A small seeded random generator (mulberry32): the same seed gives the same night. */
export const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash = (text: string) => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
};

export interface SimulationInput {
  /** National vote share of each party, 0 to 100 (for example, the poll average). */
  shares: Record<string, number>;
  catalog: readonly PartyRef[];
  seatsByCode: Record<string, number>;
  names: Record<string, string>;
  /** Counted share of the whole country, 0 to 100. */
  progress: number;
  seed?: number;
  /** Census of Spain (residents), shared out by the size of each constituency. */
  census?: number;
  turnout?: number;
}

/**
 * An invented election night. It is not a forecast: it only gives the page data in the same format as the real night.
 * - The census of each province is in proportion to its seats beyond the two minimum seats (LOREG, art. 162).
 * - A regional party gets its national share only in its territory, so its local share is higher.
 * - Each province has its own error and its own speed of count. The early count has a larger error,
 *   which goes down to the final value as the count goes on.
 */
export const simulateNight = (input: SimulationInput): ResultsFeed => {
  const { shares, catalog, seatsByCode, names, progress, seed = 29, census = 37_500_000, turnout: baseTurnout = 0.68 } = input;
  const codes = Object.keys(seatsByCode).sort();
  const weight = (code: string) => Math.max(seatsByCode[code] - 1.6, 0.25);
  const totalWeight = codes.reduce((sum, code) => sum + weight(code), 0);
  const territoryWeight = (party: PartyRef) =>
    party.territory ? party.territory.reduce((sum, code) => sum + weight(code), 0) / totalWeight : 1;
  const known = catalog.filter((party) => (shares[party.id] ?? 0) > 0);
  const otherShare = Math.max(0, 100 - known.reduce((sum, party) => sum + shares[party.id], 0));
  const at = Math.max(0, Math.min(100, progress)) / 100;

  const areas = codes.map((code): AreaResult => {
    const random = seededRandom(hash(`${seed}-${code}`));
    // Rural provinces count first: a province with few seats goes faster.
    const speed = 0.75 + random() * 0.5 + (seatsByCode[code] <= 5 ? 0.25 : 0);
    const counted = at <= 0 ? 0 : Math.min(100, 100 * Math.pow(at, 1 / speed));
    const areaCensus = Math.round((census * weight(code)) / totalWeight);
    const areaTurnout = baseTurnout + (random() - 0.5) * 0.12;
    const early = 1 - counted / 100;

    const raw: Record<string, number> = {};
    let regional = 0;
    for (const party of known) {
      if (party.territory && !party.territory.includes(code)) continue;
      const base = party.territory ? shares[party.id] / territoryWeight(party) : shares[party.id];
      const noise = 1 + (random() - 0.5) * 0.5 + (random() - 0.5) * 0.3 * early;
      raw[party.id] = Math.max(0.05, base * noise);
      if (party.territory) regional += raw[party.id];
    }
    // The national parties take what the regional parties and the small lists leave.
    const others = otherShare * (0.6 + random() * 0.8);
    const nationalRoom = Math.max(5, 100 - regional - others);
    const nationalSum = Object.entries(raw).reduce(
      (sum, [id, value]) => (catalog.find((party) => party.id === id)?.territory ? sum : sum + value),
      0,
    );
    for (const party of known) {
      if (!party.territory && raw[party.id] !== undefined) raw[party.id] *= nationalRoom / nationalSum;
    }

    const voters = Math.round(areaCensus * areaTurnout * (counted / 100));
    const nullVotes = Math.round(voters * 0.011);
    const blank = Math.round(voters * 0.008);
    const toLists = voters - nullVotes - blank;
    const total = Object.values(raw).reduce((sum, value) => sum + value, 0) + others;
    const parties: PartyResult[] = known
      .filter((party) => raw[party.id] !== undefined)
      .map((party) => ({ id: party.id, acronym: party.acronym, name: party.name, votes: Math.round((toLists * raw[party.id]) / total) }));
    parties.push({ id: 'otros', acronym: 'Otros', name: 'Otras candidaturas', votes: Math.round((toLists * others) / total) });

    return {
      code,
      name: names[code] ?? code,
      seats: seatsByCode[code],
      counted: Math.round(counted * 100) / 100,
      census: Math.round(areaCensus * (counted / 100)),
      voters,
      null: nullVotes,
      blank,
      parties,
    };
  });

  return withAllSeats({ format: RESULTS_FORMAT, kind: 'simulacion', updatedAt: new Date().toISOString(), areas });
};

/** D'Hondt for a simulated area. «Otros» is a sum of small lists, never one list, so it never takes a seat. */
const withAllSeats = (feed: ResultsFeed): ResultsFeed => ({
  ...feed,
  areas: feed.areas.map((area) => {
    const lists = area.parties.filter((party) => party.id !== 'otros');
    const seats = dhondt(Object.fromEntries(lists.map((party) => [party.id, party.votes])), area.seats, validVotes(area));
    return { ...area, parties: area.parties.map((party) => ({ ...party, seats: seats[party.id] ?? 0 })) };
  }),
});

/**
 * Invented results by municipality for one simulated province. The sums of the municipalities are the votes of the
 * province (each party, the census, the voters, the null and blank votes), so the two levels agree.
 * - The size of a municipality is random (a log-normal draw): there are no population data in the page.
 * - Each municipality moves each party away from the province share; a small town moves more.
 * - The count of each municipality goes faster or slower than the province, and is 100 % when the province is.
 * Shared land (`shared`) has no voters and gets no data.
 */
export const simulateMunicipalities = (
  province: AreaResult,
  municipalities: readonly { code: string; name: string; shared?: boolean }[],
  seed = 29,
): ResultsFeed => {
  const towns = municipalities.filter((town) => !town.shared);
  const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const provinceNames = province.name.split('/').map(plain);
  const draws = towns.map((town) => {
    const random = seededRandom(hash(`${seed}-${town.code}`));
    const normal = () => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
    // The town with the name of the province is usually its capital and its largest town.
    const capital = town.name.split('/').map(plain).some((name) => provinceNames.includes(name));
    const size = Math.exp(normal() * 1.5) * (capital ? 60 : 1);
    const swing = 0.15 + 0.45 / Math.sqrt(1 + size);
    const counted = province.counted >= 100 ? 100 : Math.max(0, Math.min(100, province.counted * (0.6 + random() * 0.8)));
    const tilt = Object.fromEntries(province.parties.map((party) => [party.id, Math.exp(normal() * swing)]));
    return { town, size, counted, tilt };
  });
  const scaled = (total: number, weights: number[]) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum) return weights.map(() => 0);
    // Largest remainder: the integers add up to the total.
    const exact = weights.map((weight) => (total * weight) / sum);
    const result = exact.map(Math.floor);
    let left = total - result.reduce((a, b) => a + b, 0);
    const order = exact.map((value, index) => [value - Math.floor(value), index] as const).sort((a, b) => b[0] - a[0]);
    for (const [, index] of order) {
      if (left <= 0) break;
      result[index] += 1;
      left -= 1;
    }
    return result;
  };
  const countedWeights = draws.map((draw) => draw.size * draw.counted);
  const census = scaled(province.census, countedWeights);
  const nullVotes = scaled(province.null, countedWeights);
  const blank = scaled(province.blank, countedWeights);
  const partyVotes = Object.fromEntries(
    province.parties.map((party) => [party.id, scaled(party.votes, draws.map((draw, index) => countedWeights[index] * draw.tilt[party.id]))]),
  );
  // The voters of a town are its votes: lists, blank and null. So the shares and the turnout of the town agree.
  const voters = draws.map((_, index) => nullVotes[index] + blank[index] + province.parties.reduce((sum, party) => sum + partyVotes[party.id][index], 0));
  return {
    format: RESULTS_FORMAT,
    kind: 'simulacion',
    updatedAt: new Date().toISOString(),
    province: province.code,
    areas: draws.map((draw, index) => ({
      code: draw.town.code,
      name: draw.town.name,
      seats: 0,
      counted: Math.round(draw.counted * 100) / 100,
      census: census[index],
      voters: voters[index],
      null: nullVotes[index],
      blank: blank[index],
      parties: province.parties.map((party) => ({ id: party.id, acronym: party.acronym, name: party.name, votes: partyVotes[party.id][index] })),
    })),
  };
};
