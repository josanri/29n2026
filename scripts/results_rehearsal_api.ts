/**
 * A local copy of the official diffusion API (`resultados.29neleccionesgenerales.es`) for a rehearsal of the
 * election night with `scripts/results_official.ts`.
 *
 * Usage:
 *   npm run resultados:simulacro:grabar                 records the real responses once (112 requests, ~95 MB)
 *   npm run resultados:simulacro:api -- [--puerto 8787] [--pasos 8]
 *   npm run resultados:oficial -- --base http://localhost:8787 --ensayo --cada 5
 *   then open /resultados/?ensayo
 *
 * `grabar` saves getConfig, the two catalogs and every Congress and Senate scope in `.cache/29n-api-grabacion/`
 * (outside git). Before the count the official responses are at 0: `servir` fills them. Each getConfig call is one
 * more step of the count, from 0 % to 100 %. The votes of each list are its 2023 votes, which the API itself gives
 * (`partidosEnfrentamiento`), with a regional swing and some noise; a new party with no 2023 list gets a few hundred
 * votes. The seats come from D'Hondt with the 3 % threshold; in the Senate, the most-voted candidates are elected.
 * These numbers are not a forecast: they only test the chain.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const recordingDir = join(root, option('--grabacion') ?? '.cache/29n-api-grabacion');
const OFFICIAL = 'https://resultados.29neleccionesgenerales.es';
const HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Origin: OFFICIAL,
  Referer: `${OFFICIAL}/`,
};

/** The file of a recorded scope: `getScopeData/<id>/1/2/1/1/90` → `scope/<id>_1_2_1_1_90.json`. */
const scopeFile = (scopePath: string) => join(recordingDir, 'scope', `${scopePath.split('/').join('_')}.json`);

type Scope = { c: string; co: string; l: number; ic?: number };

const record = async () => {
  mkdirSync(join(recordingDir, 'scope'), { recursive: true });
  const get = async (path: string) => {
    const response = await fetch(`${OFFICIAL}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} (${path})`);
    return response.text();
  };
  writeFileSync(join(recordingDir, 'config.json'), await get('/backend-difu/web/getConfig'));
  writeFileSync(join(recordingDir, 'nomenclator.json'), await get('/backend-difu/nomenclator/getNomenclator'));
  writeFileSync(join(recordingDir, 'partidos.json'), await get('/backend-difu/nomenclator/getPartidosColorAgrup'));
  const nomenclator = JSON.parse(readFileSync(join(recordingDir, 'nomenclator.json'), 'utf8'));
  const scopes = (election: number): Scope[] => nomenclator.amb.find((block: { elec: number }) => block.elec === election).ambitos;
  const paths = [
    ...scopes(2).filter((scope) => scope.l === 30 && /^\d{2}$/.test(scope.co)).map((scope) => `${scope.c}/1/2/1/1/90`),
    ...scopes(3).filter((scope) => scope.ic === 1 && (scope.l === 30 || scope.l === 70)).map((scope) => `${scope.c}/2/3/1/0`),
  ];
  let next = 0;
  let bytes = 0;
  const worker = async () => {
    while (next < paths.length) {
      const path = paths[next++];
      const body = await get(`/backend-difu/scope/data/getScopeData/${path}`);
      bytes += body.length;
      writeFileSync(scopeFile(path), body);
    }
  };
  await Promise.all([1, 2, 3, 4].map(worker));
  console.log(`${paths.length} ámbitos grabados (${(bytes / 1e6).toFixed(1)} MB) en ${recordingDir}`);
};

/** A deterministic number in [0, 1) from a text, so a step gives the same numbers every time. */
const hash = (text: string) => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
};
const pro = (value: number) => ({ pro: value, def: 0 });
const dhondt = (votes: number[], seats: number, threshold: number) => {
  const eligible = votes.map((value) => (value >= threshold ? value : 0));
  const won = votes.map(() => 0);
  for (let seat = 0; seat < seats; seat += 1) {
    let best = -1;
    let quotient = 0;
    eligible.forEach((value, index) => {
      const current = value / (won[index] + 1);
      if (value > 0 && current > quotient) {
        quotient = current;
        best = index;
      }
    });
    if (best < 0) break;
    won[best] += 1;
  }
  return won;
};

// The recorded responses have many more fields; these are the ones the rehearsal fills.
type Party = { codigo?: string; votos?: unknown; cargos?: unknown; porcentaje?: unknown; partidosEnfrentamiento?: { votos?: { pro?: number } }[] };
type Candidate = { codigo: string; orden?: number; partido?: { codigo?: string }; votos?: { pro: number }; cargo?: boolean };
type Scrutiny = Record<string, unknown> & { partidos?: Party[]; candidaturas?: Candidate[]; cargos?: number };

const serve = () => {
  const port = Number(option('--puerto') ?? 8787);
  const steps = Math.max(1, Number(option('--pasos') ?? 8));
  if (!existsSync(join(recordingDir, 'nomenclator.json'))) {
    console.error(`No hay grabación en ${recordingDir}. Ejecuta antes: npm run resultados:simulacro:grabar`);
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(join(recordingDir, 'config.json'), 'utf8'));
  const partidos = JSON.parse(readFileSync(join(recordingDir, 'partidos.json'), 'utf8'));
  const senateParties: Record<string, { agrupacion?: string }> =
    partidos.elecciones.find((item: { eleccion: number }) => item.eleccion === 3)?.convocatoria['11-26']?.partidos ?? {};
  let step = -1;

  const fillCongress = (scrutiny: Scrutiny | undefined, census: number, share: number, key: string, seats: number) => {
    if (!scrutiny) return;
    scrutiny.fecha = { pro: new Date().toISOString(), def: '' };
    const list = scrutiny.partidos ?? [];
    const votes = list.map((party) => {
      if (party.codigo === '00') return 0; // A 2023 list with no 2026 list.
      const previous = (party.partidosEnfrentamiento ?? []).reduce((sum, item) => sum + (item.votos?.pro ?? 0), 0);
      const base = previous || 40 + 400 * hash(key + party.codigo);
      const swing = 0.85 + 0.3 * hash(key.slice(0, 2) + party.codigo);
      const noise = 0.97 + 0.06 * hash(`${key}${party.codigo}${step}`);
      return Math.round(base * swing * noise * share);
    });
    const sum = votes.reduce((total, value) => total + value, 0);
    const blank = Math.round(sum * 0.012);
    const nullVotes = Math.round(sum * 0.01);
    const won = seats ? dhondt(votes, seats, 0.03 * (sum + blank)) : votes.map(() => 0);
    list.forEach((party, index) => {
      party.votos = pro(votes[index]);
      party.cargos = pro(won[index]);
      party.porcentaje = pro(sum ? Math.round((10000 * votes[index]) / (sum + blank)) / 100 : 0);
    });
    const counted = Math.round(census * share);
    Object.assign(scrutiny, {
      censoNocheEscrutado: pro(counted),
      porcCensoNocheEscrutado: pro(Math.round(share * 10000) / 100),
      porcMesasEscrutadas: pro(Math.round(share * 10000) / 100),
      votosPartidos: pro(sum),
      votosBlancos: pro(blank),
      votosNulos: pro(nullVotes),
      votosValidos: pro(sum + blank),
      votosTotales: pro(sum + blank + nullVotes),
      participacion: pro(counted ? Math.round((10000 * (sum + blank + nullVotes)) / counted) / 100 : 0),
    });
  };

  const fillSenate = (scrutiny: Scrutiny | undefined, census: number, share: number, key: string) => {
    if (!scrutiny) return;
    scrutiny.fecha = { pro: new Date().toISOString(), def: '' };
    // PP (group 7) and the lists of PSOE (group 1, Senado de Progreso and the island lists) lead; the rest are small.
    const weight = (code = '') => {
      const group = senateParties[code]?.agrupacion;
      if (group === '7') return 40;
      return ['1', '84', '87', '88', '89', '90'].includes(group ?? '') ? 36 : 3 + 10 * hash(code);
    };
    const candidates = scrutiny.candidaturas ?? [];
    const voters = Math.round(census * 0.66 * share);
    for (const candidate of candidates) {
      const noise = 0.9 + 0.2 * hash(`${key}${candidate.codigo}${step}`);
      candidate.votos = pro(Math.round(voters * (weight(candidate.partido?.codigo) / 100) * noise * (1 - 0.02 * (candidate.orden ?? 1))));
    }
    const elected = [...candidates].sort((a, b) => (b.votos?.pro ?? 0) - (a.votos?.pro ?? 0)).slice(0, scrutiny.cargos ?? 0);
    for (const candidate of candidates) candidate.cargo = share > 0 && elected.includes(candidate);
    Object.assign(scrutiny, {
      censoNocheEscrutado: pro(Math.round(census * share)),
      porcMesasEscrutadas: pro(Math.round(share * 10000) / 100),
      votosTotales: pro(voters),
      votosNulos: pro(Math.round(voters * 0.02)),
      votosBlancos: pro(Math.round(voters * 0.03)),
    });
  };

  createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const send = (body: string | Buffer) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(body);
    };
    if (url.pathname.endsWith('/web/getConfig')) {
      step = Math.min(step + 1, steps);
      console.log(`${new Date().toLocaleTimeString('es-ES')} · paso ${step} de ${steps} (${Math.round((100 * step) / steps)} %)`);
      return send(JSON.stringify({ ...config, isOpen: true, numeroDeFase: 2, polling: { isActive: true, interval_MS: 5000 } }));
    }
    if (url.pathname.endsWith('/getNomenclator')) return send(readFileSync(join(recordingDir, 'nomenclator.json')));
    if (url.pathname.endsWith('/getPartidosColorAgrup')) return send(readFileSync(join(recordingDir, 'partidos.json')));
    const match = url.pathname.match(/getScopeData\/(.+)$/);
    if (match && existsSync(scopeFile(match[1]))) {
      const data = JSON.parse(readFileSync(scopeFile(match[1]), 'utf8'));
      const share = Math.max(0, step) / steps;
      const scope = data.scope;
      if (match[1].split('/')[2] === '3') fillSenate(scope.escrutinio, scope.censoNoche ?? 0, share, scope.codigo);
      else {
        fillCongress(scope.escrutinio, scope.censoNoche ?? 0, share, scope.codigo, scope.escrutinio?.cargos ?? 0);
        for (const town of data.mapa ?? []) fillCongress(town.escrutinio, town.censoNoche ?? 0, share, town.codigo, 0);
      }
      return send(JSON.stringify(data));
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{}');
  }).listen(port, () => {
    console.log(`API de ensayo en http://localhost:${port} · ${steps} pasos · cada consulta a getConfig avanza uno`);
    console.log(`Captura: npm run resultados:oficial -- --base http://localhost:${port} --ensayo --cada 5`);
  });
};

const command = args[0];
if (command === 'grabar') await record();
else if (command === 'servir') serve();
else {
  console.error('Uso: node scripts/results_rehearsal_api.ts grabar | servir [--puerto 8787] [--pasos 8] [--grabacion <carpeta>]');
  process.exit(1);
}
