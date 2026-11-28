/**
 * Polls the official election results API (`https://resultados.29neleccionesgenerales.es`) and writes the
 * normalized Electosfera feeds (`espana.json`, `senado.json`, `municipios-<provincia>.json`) into
 * `public/<ELECTION>/resultados/datos/`.
 *
 * Usage:
 *   npm run resultados:oficial -- [--cada <segundos>] [--una-vez] [--forzar] [--sin-senado] [--sin-municipios]
 *                                 [--definitivo] [--concurrencia <n>] [--raw <carpeta>] [--dry-run]
 *                                 [--base <url>] [--ensayo]
 *
 * Rehearsal: `--ensayo` marks every file as a simulation (`kind: 'simulacion'`), so `/resultados/` shows it only
 * with `?ensayo` in its address. With `--base http://localhost:8787` it reads the local copy of the API of
 * `scripts/results_rehearsal_api.ts` instead of the official one.
 *
 * Behaviour:
 *   1. Polls `GET /backend-difu/web/getConfig` at `polling.interval_MS` (default 30s, or `--cada`).
 *   2. Caches `getNomenclator` and `getPartidosColorAgrup` and refreshes them only when `versionNomenclator`
 *      or `versionPartidosColor` changes.
 *   3. Waits while `isOpen` is `false` (unless `--forzar` is passed).
 *   4. Fetches the 52 Congress provinces (with `/1/90` to include all municipalities in the same requests)
 *      and the Senate circumscriptions, writing files atomically only when their content hash changes.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEvolutionSnapshot,
  createEvolutionSnapshot,
  EVOLUTION_FORMAT,
  nationalTotal,
  senateTotal,
  type EvolutionFeed,
  type ResultsFeed,
  type SenateFeed,
} from '../src/lib/results.ts';
import {
  buildCongressFeed,
  buildMunicipalFeedFromScope,
  buildPartyMap,
  buildSenateFeed,
  extractCongressProvinces,
  extractSenateTargets,
  OFFICIAL_ELECTION,
  type CongressConversionEntry,
  type OfficialConfig,
  type OfficialNomenclator,
  type OfficialPartidosCatalog,
  type OfficialScopeDataResponse,
  type OfficialSource,
  type SenateConversionEntry,
} from '../src/lib/results_official.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const election = process.env.ELECTION || '2026/generales';
const { constituencySeats, resultsParties, senateConstituencies } = await import(`../src/data/${election}/resultados.ts`);
const geography = JSON.parse(readFileSync(join(root, 'src/data', election, 'provincias.json'), 'utf8'));
const names: Record<string, string> = Object.fromEntries(
  geography.provincias.map((province: { codigo: string; nombre: string }) => [province.codigo, province.nombre]),
);

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const baseUrl = (option('--base') ?? 'https://resultados.29neleccionesgenerales.es').replace(/\/+$/, '');
const overrideSeconds = option('--cada') !== undefined ? Number(option('--cada')) : undefined;
const runOnce = args.includes('--una-vez');
const force = args.includes('--forzar');
const skipSenate = args.includes('--sin-senado');
const skipMunicipalities = args.includes('--sin-municipios');
const archiveMunicipalities = args.includes('--historico-municipios');
const skipHistory = args.includes('--sin-historico');
const forceDefinitive = args.includes('--definitivo');
const dryRun = args.includes('--dry-run');
const rehearsal = args.includes('--ensayo');
const rawDir = option('--raw');
const concurrency = Math.max(1, Math.min(20, Number(option('--concurrencia') ?? 8) || 8));

const outDir = join(root, 'public', election, 'resultados', 'datos');
const evolutionPath = join(outDir, 'evolucion.json');

const loadExistingEvolution = (): EvolutionFeed | null => {
  if (!existsSync(evolutionPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(evolutionPath, 'utf8')) as EvolutionFeed;
    if (parsed.format !== EVOLUTION_FORMAT || !Array.isArray(parsed.snapshots)) return null;
    // A rehearsal continues only a rehearsal, and the real night never continues a rehearsal.
    if ((parsed.kind === 'simulacion') === rehearsal) return parsed;
    if (!rehearsal) {
      console.warn(
        `Aviso: ${evolutionPath} es de un ensayo. Bórralo (con todo resultados/datos/) antes de la captura real; esta empieza una evolución nueva.`,
      );
    }
  } catch {
    // Ignore corrupted or incompatible evolution file; a fresh one will be written.
  }
  return null;
};

let evolutionFeed: EvolutionFeed | null = loadExistingEvolution();

const writeAtomicJson = (filePath: string, payload: unknown) => {
  if (dryRun) return;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(`${filePath}.tmp`, JSON.stringify(payload));
  renameSync(`${filePath}.tmp`, filePath);
};

const stampFor = (isoDate: string) => isoDate.replace(/[:.]/g, '-');

const HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Origin: baseUrl,
  Referer: `${baseUrl}/`,
};

const fetchJson = async <T>(path: string, retries = 2): Promise<T> => {
  const url = `${baseUrl}${path}`;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25_000) });
      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText} (${path})`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
};

const mapPool = async <T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
};

const saveRaw = (filename: string, data: unknown) => {
  if (!rawDir) return;
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(join(rawDir, filename), JSON.stringify(data));
};

let cachedNomenclatorVersion: number | undefined;
let cachedNomenclator: OfficialNomenclator | undefined;
let cachedPartidosVersion: number | undefined;
let cachedPartidos: OfficialPartidosCatalog | undefined;

const ensureCatalogs = async (config: OfficialConfig) => {
  // A catalog is kept only if it has the expected shape: a wrong body (an error page or `{}`) is not cached, so the
  // next cycle downloads it again instead of failing all night.
  if (!cachedNomenclator || (config.versionNomenclator !== undefined && config.versionNomenclator !== cachedNomenclatorVersion)) {
    const nomenclator = await fetchJson<OfficialNomenclator>('/backend-difu/nomenclator/getNomenclator');
    if (!Array.isArray(nomenclator?.amb)) throw new Error('getNomenclator: la respuesta no tiene «amb»');
    cachedNomenclator = nomenclator;
    cachedNomenclatorVersion = config.versionNomenclator ?? nomenclator.ver;
    saveRaw('nomenclator.json', nomenclator);
  }
  if (!cachedPartidos || (config.versionPartidosColor !== undefined && config.versionPartidosColor !== cachedPartidosVersion)) {
    const catalog = await fetchJson<OfficialPartidosCatalog>('/backend-difu/nomenclator/getPartidosColorAgrup');
    if (!Array.isArray(catalog?.elecciones)) throw new Error('getPartidosColorAgrup: la respuesta no tiene «elecciones»');
    cachedPartidos = catalog;
    cachedPartidosVersion = config.versionPartidosColor ?? catalog.version;
    saveRaw('partidos.json', catalog);
  }
  return { nomenclator: cachedNomenclator, partidos: cachedPartidos };
};

const writtenHashes = new Map<string, string>();
const writeFeedIfChanged = (name: string, feed: ResultsFeed | SenateFeed): boolean => {
  const hash = createHash('sha1').update(JSON.stringify({ ...feed, updatedAt: '' })).digest('hex');
  if (writtenHashes.get(name) === hash) return false;
  if (!dryRun) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${name}.json.tmp`), JSON.stringify(feed));
    renameSync(join(outDir, `${name}.json.tmp`), join(outDir, `${name}.json`));
  }
  writtenHashes.set(name, hash);
  return true;
};

/** With `--ensayo`, a feed is a simulation: the page shows it only with `?ensayo`. */
const markRehearsal = <T extends ResultsFeed | SenateFeed>(feed: T): T => {
  if (rehearsal) feed.kind = 'simulacion';
  return feed;
};

const PHASE_LABELS: Record<number, string> = {
  0: 'constitución',
  1: 'avances',
  2: 'escrutinio',
};

const pollOnce = async (): Promise<number> => {
  const time = new Date().toLocaleTimeString('es-ES');
  const config = await fetchJson<OfficialConfig>('/backend-difu/web/getConfig');
  saveRaw('config.json', config);

  const intervalMs =
    overrideSeconds !== undefined && overrideSeconds > 0
      ? overrideSeconds * 1000
      : Math.max(5_000, config.polling?.interval_MS ?? 30_000);

  const phase = PHASE_LABELS[config.numeroDeFase ?? -1] ?? `fase ${config.numeroDeFase ?? '?'}`;
  const source: OfficialSource = forceDefinitive ? 'def' : (config.source ?? 'pro');

  if (!config.isOpen && !force) {
    console.log(
      `${time} · web cerrada (isOpen: false · ${phase} · source: ${source} · polling: ${config.polling?.isActive ? 'on' : 'off'}) · próximo chequeo en ${Math.round(intervalMs / 1000)} s`,
    );
    return intervalMs;
  }

  const { nomenclator, partidos } = await ensureCatalogs(config);
  const congressPartyMap = buildPartyMap(partidos, OFFICIAL_ELECTION.CONGRESS.electionCode);
  const senatePartyMap = buildPartyMap(partidos, OFFICIAL_ELECTION.SENATE.electionCode);

  const provinces = extractCongressProvinces(nomenclator);
  const congressSuffix = skipMunicipalities ? '0' : '1/90';

  const congressEntries = await mapPool(provinces, concurrency, async (province): Promise<CongressConversionEntry> => {
    const path = `/backend-difu/scope/data/getScopeData/${province.c}/${OFFICIAL_ELECTION.CONGRESS.order}/${OFFICIAL_ELECTION.CONGRESS.electionCode}/1/${congressSuffix}`;
    const response = await fetchJson<OfficialScopeDataResponse>(path);
    return { provinceCode: province.co, response };
  });

  const files = new Map<string, ResultsFeed | SenateFeed>();
  const congressFeed = markRehearsal(buildCongressFeed(congressEntries, {
    partyMap: congressPartyMap,
    catalog: resultsParties,
    seatsByCode: constituencySeats,
    names,
    source,
  }));
  files.set('espana', congressFeed);

  let municipalCount = 0;
  if (!skipMunicipalities) {
    for (const entry of congressEntries) {
      const municipalFeed = buildMunicipalFeedFromScope(entry.provinceCode, entry.response, {
        partyMap: congressPartyMap,
        catalog: resultsParties,
        source,
      });
      if (municipalFeed) markRehearsal(municipalFeed);
      if (municipalFeed) {
        files.set(`municipios-${entry.provinceCode}`, municipalFeed);
        municipalCount += 1;
      }
    }
  }

  let senateFeed: SenateFeed | undefined;
  if (!skipSenate) {
    const senateTargets = extractSenateTargets(nomenclator);
    const senateEntries = await mapPool(senateTargets, concurrency, async (target): Promise<SenateConversionEntry> => {
      const path = `/backend-difu/scope/data/getScopeData/${target.scope.c}/${OFFICIAL_ELECTION.SENATE.order}/${OFFICIAL_ELECTION.SENATE.electionCode}/1/0`;
      const response = await fetchJson<OfficialScopeDataResponse>(path);
      return { constituencyCode: target.constituencyCode, response };
    });
    senateFeed = markRehearsal(buildSenateFeed(senateEntries, {
      partyMap: senatePartyMap,
      catalog: resultsParties,
      constituencies: senateConstituencies,
      names,
      source,
    }));
    files.set('senado', senateFeed);
  }

  let changed = 0;
  for (const [name, feed] of files) {
    if (writeFeedIfChanged(name, feed)) changed += 1;
  }

  let historySaved = false;
  // Before the first counted votes there are no seats: such a moment is not a step of the count.
  if (!skipHistory && nationalTotal(congressFeed.areas).counted > 0) {
    const snapshotAt = congressFeed.updatedAt || new Date().toISOString();
    const stamp = stampFor(snapshotAt);
    const snapshotRel = `historico/${rehearsal ? 'ensayo-' : ''}${stamp}`;
    const candidate = createEvolutionSnapshot(congressFeed, senateFeed, { at: snapshotAt, snapshot: snapshotRel });
    const next = appendEvolutionSnapshot(evolutionFeed, candidate, congressFeed.kind);
    if (next.appended) {
      evolutionFeed = next.feed;
      writeAtomicJson(join(outDir, snapshotRel, 'espana.json'), congressFeed);
      if (senateFeed) writeAtomicJson(join(outDir, snapshotRel, 'senado.json'), senateFeed);
      if (archiveMunicipalities) {
        for (const [name, feed] of files) {
          if (name.startsWith('municipios-')) writeAtomicJson(join(outDir, snapshotRel, `${name}.json`), feed);
        }
      }
      writeAtomicJson(evolutionPath, evolutionFeed);
      historySaved = true;
    }
  }

  const list = (parties: { acronym: string; seats?: number }[]) =>
    parties
      .filter((party) => party.seats)
      .map((party) => `${party.acronym} ${party.seats}`)
      .join(', ');

  const total = nationalTotal(congressFeed.areas);
  const senators = senateFeed ? senateTotal(senateFeed.areas) : undefined;
  const modeTag = `${dryRun ? ' [dry-run]' : ''}${rehearsal ? ' [ensayo]' : ''}`;
  const historyTag = evolutionFeed ? ` · ${evolutionFeed.snapshots.length} instantáneas${historySaved ? ' (+1)' : ''}` : '';
  console.log(
    `${time}${modeTag} · ${phase} (${source}) · ${total.counted.toFixed(2)} % escrutado · ${municipalCount} provincias con municipios · ${changed} cambiados${historyTag}`,
  );
  console.log(`  Congreso (350): ${list(total.parties) || 'sin escaños todavía'}`);
  if (senators) {
    console.log(
      `  Senado (${senators.assigned} de ${senators.seats} asignados, ${senators.counted.toFixed(2)} % escrutado): ${list(senators.parties) || 'sin senadores todavía'}`,
    );
  }

  return intervalMs;
};

let stopped = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const stop = () => {
  stopped = true;
  if (timer) clearTimeout(timer);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const loop = async () => {
  while (!stopped) {
    let waitMs = (overrideSeconds ?? 30) * 1000;
    try {
      waitMs = await pollOnce();
    } catch (error) {
      console.error(`${new Date().toLocaleTimeString('es-ES')} · error: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (runOnce || stopped) break;
    await new Promise<void>((resolve) => {
      timer = setTimeout(resolve, waitMs);
    });
  }
};

await loop();
