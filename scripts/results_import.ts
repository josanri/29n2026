/**
 * The results of the election night for /resultados/: reads the source, converts it to the normalized format
 * (`electosfera-resultados/1`, see `src/lib/results.ts`) and writes the files:
 *   espana.json                  the 52 constituencies of the Congress
 *   municipios-<province>.json   the municipalities of one province
 *   senado.json                  the candidates of the 59 constituencies of the Senate (`electosfera-senado/1`)
 * in `public/<ELECTION>/resultados/datos/`. They are static files: a build and a deploy of the site publish them, and
 * `npm run dev` shows them at once.
 *
 *   npm run resultados:importar -- --fuente <url o archivo> [--municipios <url o archivo>] [--senado <url o archivo>] [--cada 60]
 *
 *   --fuente       the results of the Congress by constituency (province).
 *   --senado       the results of the Senate: the candidates of each province and island.
 *   --municipios   the results by municipality: one file for all, or one for each province with «{provincia}» in the
 *                  address (it is replaced by 01 … 52).
 *   --cada <s>     repeats every <s> seconds until Ctrl+C.
 *   --definitivo   marks the data as the general count (escrutinio general).
 *   --ensayo <p>   no source: an invented night with <p> % counted, to test the whole chain. The page shows these
 *                  data only with `?ensayo` in its address.
 *
 * If the source uses field names that the adapter does not know, the script stops with the error: add the names to
 * `FIELD_ALIASES` in `src/lib/results.ts`.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  nationalTotal,
  normalizeFeed,
  normalizeMunicipalFeed,
  normalizeSenateFeed,
  senateTotal,
  simulateMunicipalities,
  simulateNight,
  simulateSenate,
  type ResultsFeed,
  type SenateFeed,
} from '../src/lib/results.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const election = process.env.ELECTION || '2026/generales';
const { constituencySeats, resultsParties, senateConstituencies } = await import(`../src/data/${election}/resultados.ts`);
const geography = JSON.parse(readFileSync(join(root, 'src/data', election, 'provincias.json'), 'utf8'));
const names: Record<string, string> = Object.fromEntries(
  geography.provincias.map((province: { codigo: string; nombre: string }) => [province.codigo, province.nombre]),
);
const provinces = Object.keys(constituencySeats).sort();

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const source = option('--fuente');
const municipalSource = option('--municipios');
const senateSource = option('--senado');
const everySeconds = Number(option('--cada') ?? 0);
const rehearsal = option('--ensayo');
const kind = args.includes('--definitivo') ? 'definitivo' : 'provisional';

if (!source && rehearsal === undefined) {
  console.error('Uso: npm run resultados:importar -- --fuente <url o archivo> [--municipios <url o archivo>] [--senado <url o archivo>] [--cada <segundos>] [--definitivo]');
  console.error('     npm run resultados:importar -- --ensayo <porcentaje escrutado>');
  process.exit(1);
}

const outDir = join(root, 'public', election, 'resultados', 'datos');
const read = async (address: string) => {
  if (!/^https?:\/\//.test(address)) return JSON.parse(readFileSync(address, 'utf8'));
  const response = await fetch(address, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} al leer ${address}`);
  return response.json();
};

/** The files of one import, by name. */
const build = async (): Promise<Map<string, ResultsFeed | SenateFeed>> => {
  const files = new Map<string, ResultsFeed | SenateFeed>();
  if (rehearsal !== undefined) {
    const shares = { pp: 32, psoe: 28, vox: 17, fa: 7, podemos: 2, salf: 1.8, erc: 2, junts: 1.4, bildu: 1.4, pnv: 1, bng: 0.9, cc: 0.4, upn: 0.3 };
    const national = simulateNight({ shares, catalog: resultsParties, seatsByCode: constituencySeats, names, progress: Number(rehearsal), seed: 2026 });
    files.set('espana', national);
    files.set('senado', simulateSenate(national, senateConstituencies, 2026));
    for (const area of national.areas) {
      const map = JSON.parse(readFileSync(join(root, 'public', election, 'mapas', 'municipios', `${area.code}.json`), 'utf8'));
      const towns = map.municipios.map((town: { codigo: string; nombre: string; compartido?: boolean }) => ({ code: town.codigo, name: town.nombre, shared: town.compartido }));
      files.set(`municipios-${area.code}`, simulateMunicipalities(area, towns, 2026));
    }
    return files;
  }
  files.set('espana', normalizeFeed(await read(source!), { catalog: resultsParties, seatsByCode: constituencySeats, names, kind }));
  if (senateSource) {
    files.set('senado', normalizeSenateFeed(await read(senateSource), { catalog: resultsParties, constituencies: senateConstituencies, names, kind }));
  }
  if (municipalSource) {
    const inputs = municipalSource.includes('{provincia}')
      ? await Promise.all(
          provinces.map((code) =>
            read(municipalSource.replaceAll('{provincia}', code)).catch((error) => {
              console.error(`Municipios de ${code}: ${error}`);
              return null;
            }),
          ),
        )
      : [await read(municipalSource)];
    for (const input of inputs) {
      if (!input) continue;
      const byProvince = normalizeMunicipalFeed(input, { catalog: resultsParties, provinces, kind });
      for (const [code, feed] of Object.entries(byProvince)) files.set(`municipios-${code}`, feed);
    }
  }
  return files;
};

const writtenHashes = new Map<string, string>();
const importOnce = async () => {
  const files = await build();
  mkdirSync(outDir, { recursive: true });
  let changed = 0;
  for (const [name, feed] of files) {
    // The time of the import changes in every run: the hash leaves it out, so an unchanged file is not written again.
    const hash = createHash('sha1').update(JSON.stringify({ ...feed, updatedAt: '' })).digest('hex');
    if (writtenHashes.get(name) === hash) continue;
    // Write to a temporary file and rename it: the dev server never sends a half-written file.
    writeFileSync(join(outDir, `${name}.json.tmp`), JSON.stringify(feed));
    renameSync(join(outDir, `${name}.json.tmp`), join(outDir, `${name}.json`));
    writtenHashes.set(name, hash);
    changed += 1;
  }
  // The preview of the seats: the deputies and, when there are data of the Senate, the senators of each party.
  const list = (parties: { acronym: string; seats?: number }[]) => parties.filter((party) => party.seats).map((party) => `${party.acronym} ${party.seats}`).join(', ');
  const total = nationalTotal((files.get('espana') as ResultsFeed).areas);
  const senate = files.get('senado') as SenateFeed | undefined;
  const senators = senate ? senateTotal(senate.areas) : undefined;
  const municipal = [...files.keys()].filter((name) => name.startsWith('municipios-')).length;
  console.log(
    `${new Date().toLocaleTimeString('es-ES')} · ${total.counted.toFixed(2)} % escrutado · ${municipal} provincias con municipios · ${changed} cambiados`,
  );
  console.log(`  Congreso (350): ${list(total.parties) || 'sin escaños todavía'}`);
  if (senators) console.log(`  Senado (${senators.assigned} de ${senators.seats} asignados, ${senators.counted.toFixed(2)} % escrutado): ${list(senators.parties) || 'sin senadores todavía'}`);
};

await importOnce();
if (everySeconds > 0) {
  let running = false;
  setInterval(() => {
    if (running) return; // A slow source: the next run waits for this one.
    running = true;
    importOnce()
      .catch((error) => console.error(String(error)))
      .finally(() => (running = false));
  }, everySeconds * 1000);
}
