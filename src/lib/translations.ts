/**
 * Translations into Spanish of programs written in another language (Catalan, Galician, Basque…).
 *
 * The original text is always the one that counts. A translation is a separate layer, marked as such: it lives in
 * `src/data/<año>/<tipo>/traducciones/<partido>.json`, it never replaces the original, and each file says how it was made.
 * Build steps: `scripts/traducir.py preparar` cuts the measures in chunks, one model translates, a second model
 * reviews, `scripts/traducir.py unir` joins the result and checks it (same measures, same figures).
 */
import { z } from 'astro/zod';

const translationSchema = z.object({
  id: z.string(),
  /** Language of the original program, in Spanish: «catalán». */
  idiomaOrigen: z.string(),
  /** `revisada`: translated by one model and reviewed by a second one. `automatica`: not reviewed. Never «oficial». */
  estado: z.enum(['automatica', 'revisada']),
  fecha: z.string(),
  medidas: z.record(z.string(), z.object({ titulo: z.string().min(1), texto: z.string() })),
  /** Titles of blocks and sections, and the short quotes of «Los números del programa», by their original text or id. */
  bloques: z.record(z.string(), z.string()).optional(),
  secciones: z.record(z.string(), z.string()).optional(),
  citas: z.record(z.string(), z.string()).optional(),
  /** The motto of each block («Bloc I. …»), by block id. */
  lemas: z.record(z.string(), z.string()).optional(),
});

export type Translation = z.infer<typeof translationSchema>;

const files = import.meta.glob('@eleccion/traducciones/*.json', { eager: true, import: 'default' });
const translations = new Map<string, Translation>();
for (const raw of Object.values(files)) {
  const translation = translationSchema.parse(raw);
  translations.set(translation.id, translation);
}

export const hasTranslation = (programId: string) => translations.has(programId);

export function translationNotice(translation: Translation): string {
  const unreviewed = translation.estado === 'automatica' ? ' Sin revisar.' : '';
  return `Traducción automática, no oficial.${unreviewed} Si hay diferencias, vale el original en ${translation.idiomaOrigen}.`;
}

/** The translation of one measure, with the notice that goes with it, or `null`. */
export function translationOf(programId: string, measureNumber: number) {
  const translation = translations.get(programId);
  const measure = translation?.medidas[String(measureNumber)];
  if (!translation || !measure) return null;
  return { title: measure.titulo, text: measure.texto, notice: translationNotice(translation), language: translation.idiomaOrigen };
}

/** The language of the original and the notice of the translation of a program, or `null` when it has none. */
export function translationInfo(programId: string) {
  const translation = translations.get(programId);
  return translation ? { language: translation.idiomaOrigen, notice: translationNotice(translation) } : null;
}

/** Same cut as the short title of a measure in the extractors: 125 characters at most, with «…». */
const shortTitle = (title: string) => {
  const text = title.trim().replace(/[ .]+$/, '');
  if (text.length <= 125) return text;
  const head = text.slice(0, 122);
  const space = head.lastIndexOf(' ');
  return `${space > 0 ? head.slice(0, space) : head}…`;
};

export const translatedBlockTitle = (programId: string, blockId: number) => translations.get(programId)?.bloques?.[String(blockId)] ?? null;
export const translatedBlockMotto = (programId: string, blockId: number) => translations.get(programId)?.lemas?.[String(blockId)] ?? null;
export const translatedSectionTitle = (programId: string, sectionId: string) => translations.get(programId)?.secciones?.[sectionId] ?? null;
export const translatedQuote = (programId: string, quote: string) => translations.get(programId)?.citas?.[quote] ?? null;
/** The short title of a measure in Spanish, as the map and the tooltips show it. */
export const translatedPhraseTitle = (programId: string, measureNumber: number) => {
  const title = translations.get(programId)?.medidas[String(measureNumber)]?.titulo;
  return title ? shortTitle(title) : null;
};
