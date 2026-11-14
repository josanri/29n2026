/**
 * Review of the data of the programs, on top of the files that the scripts write.
 *
 * `src/data/<año>/<tipo>/revisiones.json` keeps, for each program, the measures whose category was corrected and the
 * explicit repeals that the review found. It is a separate file so that running an extraction script again
 * does not undo the corrections. The format is:
 *   { "<program id>": {
 *       "categorias": { "<measure number>": "<category id>" },
 *       "deroga": { "<number>": "<law>" },
 *       "cifras": { "<number>": ["literal phrase with a quantified commitment"] },
 *       "cifrasPrograma": [{ "valor", "unidad", "texto", "contexto", "medida" }]
 *   } }
 * When a program has `cifras`, they replace the figures of ALL its measures (a measure that is not listed has
 * none), and `cifrasPrograma` replaces the figures of the program header. Both hold only quantified commitments,
 * never context data; each phrase and each `contexto` must be a literal piece of the measure's text.
 */
import { z } from 'astro/zod';
import rawReview from '@eleccion/revisiones.json';
import { categoryById } from './taxonomy';
import type { Program } from './program-schema';

const reviewSchema = z.record(
  z.string(),
  z.object({
    categorias: z.record(z.string(), z.string()).default({}),
    deroga: z.record(z.string(), z.string()).default({}),
    cifras: z.record(z.string(), z.array(z.string())).optional(),
    cifrasPrograma: z
      .array(
        z.object({
          valor: z.string(),
          unidad: z.string(),
          texto: z.string(),
          contexto: z.string().optional(),
          medida: z.number(),
        }),
      )
      .optional(),
  }),
);

const review = reviewSchema.parse(rawReview);

// A wrong category id would break the pages later: stop the build now.
for (const [programId, entry] of Object.entries(review)) {
  for (const [number, categoryId] of Object.entries(entry.categorias)) {
    if (!categoryById[categoryId]) throw new Error(`revisiones.json: ${programId} nº ${number} has an unknown category "${categoryId}"`);
  }
}

// Spaces and line breaks do not matter when a quote is compared with the text of its measure.
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The program with the corrected categories, the repeals and the figures of the review. */
export const withReview = (program: Program): Program => {
  const entry = review[program.id];
  if (!entry) return program;
  const byNumber = new Map(program.measures.map((measure) => [String(measure.number), measure]));
  // A figure must quote its own measure: a wrong number or a paraphrase would put a figure on the wrong measure.
  const quoted = (number: string, quote: string, what: string) => {
    const measure = byNumber.get(number);
    if (!measure) throw new Error(`revisiones.json: ${program.id} ${what} names measure ${number}, which does not exist`);
    if (!squash(`${measure.title} ${measure.text}`).includes(squash(quote))) {
      throw new Error(`revisiones.json: ${program.id} nº ${number} ${what} is not in the measure: «${quote}»`);
    }
  };
  for (const [number, phrases] of Object.entries(entry.cifras ?? {})) {
    for (const phrase of phrases) quoted(number, phrase, 'figure');
  }
  for (const figure of entry.cifrasPrograma ?? []) {
    if (figure.contexto) quoted(String(figure.medida), figure.contexto, 'program figure');
    else if (!byNumber.has(String(figure.medida))) throw new Error(`revisiones.json: ${program.id} program figure names measure ${figure.medida}, which does not exist`);
  }
  const measures = program.measures.map((measure) => ({
    ...measure,
    categoryId: entry.categorias[measure.number] ?? measure.categoryId,
    repeals: measure.repeals ?? entry.deroga[measure.number] ?? null,
    figures: entry.cifras ? (entry.cifras[measure.number] ?? []) : measure.figures,
  }));
  const figures = entry.cifrasPrograma
    ? entry.cifrasPrograma.map((figure) => ({
        value: figure.valor,
        unit: figure.unidad,
        text: figure.texto,
        context: figure.contexto,
        measureNumber: figure.medida,
      }))
    : program.figures;
  return { ...program, measures, figures };
};
