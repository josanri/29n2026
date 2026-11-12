/**
 * Review of the data of the programs, on top of the files that the scripts write.
 *
 * `src/data/revisiones.json` keeps, for each program, the measures whose category was corrected and the
 * explicit repeals that the review found. It is a separate file so that running an extraction script again
 * does not undo the corrections. The format is:
 *   { "<program id>": { "categorias": { "<measure number>": "<category id>" }, "deroga": { "<number>": "<law>" } } }
 */
import { z } from 'astro/zod';
import rawReview from '../data/revisiones.json';
import { categoryById } from './taxonomy';
import type { Program } from './program-schema';

const reviewSchema = z.record(
  z.string(),
  z.object({
    categorias: z.record(z.string(), z.string()).default({}),
    deroga: z.record(z.string(), z.string()).default({}),
  }),
);

const review = reviewSchema.parse(rawReview);

// A wrong category id would break the pages later: stop the build now.
for (const [programId, entry] of Object.entries(review)) {
  for (const [number, categoryId] of Object.entries(entry.categorias)) {
    if (!categoryById[categoryId]) throw new Error(`revisiones.json: ${programId} nº ${number} has an unknown category "${categoryId}"`);
  }
}

/** The program with the corrected categories and the repeals of the review. */
export const withReview = (program: Program): Program => {
  const entry = review[program.id];
  const measures = entry
    ? program.measures.map((measure) => ({
        ...measure,
        categoryId: entry.categorias[measure.number] ?? measure.categoryId,
        repeals: measure.repeals ?? entry.deroga[measure.number] ?? null,
      }))
    : program.measures;
  return { ...program, measures };
};
