/**
 * Checks of the programs at build time, so that a section of a party page never goes missing or shows broken text
 * because a program lacks a piece of data. The page of each party calls `checkPrograms()` once.
 *
 * - Errors stop the build: the page would show something broken or wrong.
 * - Warnings are printed in the build output: the page has a designed replacement, but the data is worth adding.
 *
 * A section of the party page never depends on code that each extractor must repeat. Data that can be computed
 * from the measures is computed for every program in `src/lib/` (the verbs in `verbs.ts`, the totals in
 * `programs.ts`). What an extractor or an editor must write is checked here.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { keyFindingsByParty } from '@eleccion/analysis';
import { downloadFileNames } from '@eleccion/download-names';
import { ELECTION_PUBLIC_DIR } from '../../election.config.mjs';
import { announcedMeasures, publishedPrograms } from './programs';

// The build runs from the project folder; `import.meta.url` points into the build bundle, not into `src/lib`.
const ROOT = process.cwd();
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

let checked = false;

export function checkPrograms(): void {
  if (checked) return;
  checked = true;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const program of publishedPrograms) {
    const measures = announcedMeasures(program);
    if (measures.length === 0) continue;
    const id = program.id;

    // Every announced measure has something to show.
    const empty = measures.filter((measure) => !measure.title.trim() && !measure.text.trim()).map((measure) => measure.number);
    if (empty.length) errors.push(`${id}: medidas sin título ni texto: ${empty.slice(0, 10).join(', ')}`);

    // A PDF program: its official source, the PDF file of this site, the download name and a valid date.
    if (program.documentType === 'pdf') {
      if (!program.sourceUrl) errors.push(`${id}: falta «fuentePdf», la URL oficial del partido.`);
      const isLocal = program.documentUrl.startsWith(`${BASE}/`) && !/^https?:/.test(program.documentUrl);
      if (isLocal) {
        const file = join(ROOT, ELECTION_PUBLIC_DIR, program.documentUrl.slice(BASE.length));
        if (!existsSync(file)) errors.push(`${id}: no existe el PDF ${file}.`);
        if (!downloadFileNames[id]) errors.push(`${id}: falta su nombre de descarga en download-names.ts.`);
      }
      if (!program.documentDate) warnings.push(`${id}: el PDF no tiene fecha («fechaPdf»); la ficha la omite.`);
    }
    for (const [field, value] of [['fechaPdf', program.documentDate], ['fechaFuente', program.sourceDate]] as const) {
      if (value && !ISO_DATE.test(value)) errors.push(`${id}: «${field}» no es una fecha AAAA-MM-DD: ${value}`);
    }

    // «Las claves»: without the editorial reading, the page builds them from the categories.
    if (!keyFindingsByParty[id]?.length) warnings.push(`${id}: sin «Las claves» en analysis.ts; la ficha usa la versión automática.`);
  }

  if (warnings.length) console.warn(`\n[programas] ${warnings.length} avisos:\n- ${warnings.join('\n- ')}\n`);
  if (errors.length) throw new Error(`[programas] ${errors.length} errores en los datos:\n- ${errors.join('\n- ')}`);
}
