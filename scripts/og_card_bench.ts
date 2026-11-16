/**
 * Draws a link preview with the code of the Worker (`worker/og/card.ts`) and measures its CPU time, to check it
 * stays far below the 10 ms of the free plan of Cloudflare Workers.
 *
 * Use: node scripts/og_card_bench.ts pp 144 [out.png]   (one measure)
 *      node scripts/og_card_bench.ts pp [out.png]       (the party)
 *      node scripts/og_card_bench.ts --all              (the CPU time of every card, without writing files)
 *      node scripts/og_card_bench.ts --all --out <dir>  (also writes every card: <dir>/<party>.png and <dir>/<party>/<n>.png,
 *                                                        and the square ones for WhatsApp in <dir>/whatsapp/)
 *      npm run og:preview                               (the same, in .cache/og-tarjetas/, to look at all of them)
 *      --cold: without the warm-up that the Worker makes when an isolate starts
 *
 * The clock is `performance.now()`: the work is synchronous, on one thread, so its time is CPU time
 * (`process.cpuUsage` counts in steps of 15.6 ms on Windows). It runs the same code as the Worker.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadAtlas } from '../worker/og/atlas.ts';
import { drawMeasureCard, drawPartyCard, drawSquareCard, HEIGHT, measureCardPng, partyCardPng, SQUARE, squareMeasureCardPng, squarePartyCardPng, warmUp, WIDTH, type MeasureCard, type PartyCard } from '../worker/og/card.ts';
import { deflateRows } from '../worker/og/png.ts';

const root = new URL('../', import.meta.url);
const programsDir = new URL('src/data/2026/generales/programas/', root);
const atlasBytes = readFileSync(new URL('worker/og/atlas.bin', root));

let cpu = performance.now();
const atlas = loadAtlas(atlasBytes.buffer.slice(atlasBytes.byteOffset, atlasBytes.byteOffset + atlasBytes.byteLength));
const ms = () => {
  const now = performance.now();
  const used = now - cpu;
  cpu = now;
  return used;
};
console.log(`atlas: ${ms().toFixed(2)} ms`);
// What the Worker does in its global scope (startup time, not request time).
if (!process.argv.includes('--cold')) {
  warmUp(atlas);
  console.log(`warm-up (startup): ${ms().toFixed(2)} ms`);
}

// The same cut as `measureExcerpt(measure, 190)` in src/lib/seo.ts, which makes the data of the Worker.
const excerpt = (text: string, max = 190) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > max / 2 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
};

const program = (id: string) => JSON.parse(readFileSync(new URL(`${id}.json`, programsDir), 'utf8'));
const singular = (plural: string) => ({ ejes: 'eje' })[plural] ?? plural.replace(/s$/, '');

const partyCard = (raw: any): PartyCard => ({
  acronym: raw.siglas,
  name: raw.partido,
  program: raw.programa ?? '',
  color: raw.color,
  lightColor: raw.colorClaro || raw.color,
  count: raw.medidas.filter((m: any) => !m.oculta).length,
  unit: singular(raw.unidadMedidas || 'medidas'),
  unitPlural: raw.unidadMedidas || 'medidas',
});

const measureCard = (raw: any, m: any): MeasureCard => ({
  acronym: raw.siglas,
  color: raw.color,
  lightColor: raw.colorClaro || raw.color,
  unit: singular(raw.unidadMedidas || 'medidas'),
  number: m.n,
  title: m.tituloFrase || m.titulo,
  excerpt: m.texto?.trim() ? excerpt(m.texto) : '',
  page: m.pagina,
});

/** CPU time of the drawing and of the compression, in ms. */
function time(draw: () => Uint8Array, width = WIDTH, height = HEIGHT) {
  cpu = performance.now();
  const rows = draw();
  const drawing = ms();
  const size = deflateRows(rows, width + 1, height).length;
  return { drawing, compression: ms(), size };
}

const outIndex = process.argv.indexOf('--out');
const outDir = outIndex > 0 ? process.argv[outIndex + 1] : undefined;
if (outIndex > 0 && !outDir) throw new Error('--out needs a folder');
const args = process.argv.slice(2).filter((arg, i, all) => arg !== '--cold' && arg !== '--out' && all[i - 1] !== '--out');

/** Writes a card outside the timed part: the files are for looking at, not for the benchmark. */
function save(path: string, png: Uint8Array) {
  if (!outDir) return;
  const file = join(outDir, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, png);
}

if (args[0] === '--all') {
  // A clean folder each time, so no card of a removed measure stays there.
  if (outDir) rmSync(outDir, { recursive: true, force: true });
  const results: { card: string; drawing: number; compression: number; size: number }[] = [];
  for (const file of readdirSync(programsDir).filter((name) => name.endsWith('.json'))) {
    const raw = program(file.replace(/\.json$/, ''));
    if (raw.vacio || !raw.medidas?.length) continue;
    results.push({ card: raw.id, ...time(() => drawPartyCard(atlas, partyCard(raw))) });
    save(`${raw.id}.png`, partyCardPng(atlas, partyCard(raw)));
    const party = partyCard(raw);
    results.push({ card: `${raw.id} (square)`, ...time(() => drawSquareCard(atlas, party.acronym, `${party.count} ${party.unitPlural}`, false), SQUARE, SQUARE) });
    save(`whatsapp/${raw.id}.png`, squarePartyCardPng(atlas, party));
    for (const m of raw.medidas.filter((m: any) => !m.oculta)) {
      results.push({ card: `${raw.id}-${m.n}`, ...time(() => drawMeasureCard(atlas, measureCard(raw, m))) });
      save(`${raw.id}/${m.n}.png`, measureCardPng(atlas, measureCard(raw, m)));
      results.push({ card: `${raw.id}-${m.n} (square)`, ...time(() => drawSquareCard(atlas, raw.siglas, `medida ${m.n}`, true), SQUARE, SQUARE) });
      save(`whatsapp/${raw.id}/${m.n}.png`, squareMeasureCardPng(atlas, measureCard(raw, m)));
    }
  }
  const totals = results.map((r) => r.drawing + r.compression).sort((a, b) => a - b);
  const pick = (q: number) => totals[Math.min(totals.length - 1, Math.floor(q * totals.length))].toFixed(2);
  console.log(`${results.length} cards · total CPU ms: median ${pick(0.5)} · p95 ${pick(0.95)} · p99 ${pick(0.99)} · max ${pick(1)}`);
  const sizes = results.map((r) => r.size).sort((a, b) => a - b);
  console.log(`compressed size KB: median ${(sizes[sizes.length >> 1] / 1024).toFixed(1)} · max ${(sizes[sizes.length - 1] / 1024).toFixed(1)}`);
  for (const r of results.sort((a, b) => b.drawing + b.compression - a.drawing - a.compression).slice(0, 5)) {
    console.log(`  ${r.card}: drawing ${r.drawing.toFixed(2)} + compression ${r.compression.toFixed(2)}`);
  }
  if (outDir) console.log(`${results.length} cards in ${resolve(outDir)}`);
} else {
  const [id, second, third] = args;
  const raw = program(id);
  const number = second && /^\d+$/.test(second) ? Number(second) : undefined;
  const out = (number === undefined ? second : third) ?? `${id}${number === undefined ? '' : `-${number}`}.png`;
  const m = number === undefined ? undefined : raw.medidas.find((candidate: any) => candidate.n === number);
  if (number !== undefined && !m) throw new Error(`${id} has no measure ${number}`);
  const draw = () => (m ? drawMeasureCard(atlas, measureCard(raw, m)) : drawPartyCard(atlas, partyCard(raw)));
  console.log('first card (cold fonts):', time(draw));
  console.log('second card:', time(draw));
  const png = (m ? measureCardPng(atlas, measureCard(raw, m)) : partyCardPng(atlas, partyCard(raw)));
  writeFileSync(out, png);
  console.log(`${out}: ${(png.length / 1024).toFixed(1)} KB`);
}
