/** Text and number helpers shared by pages and components. */
import type { Program } from './program-schema';

export const LOCALE = 'es';

/** «2.773»: Spanish groups thousands of four digits too (the default of the locale does not). */
export const formatNumber = (value: number) => value.toLocaleString('es-ES', { useGrouping: 'always' });

/** Share of `total` as a rounded integer percentage. */
export const percentOf = (value: number, total: number) => Math.round((value / total) * 100);

export const compareText = (a: string, b: string) => a.localeCompare(b, LOCALE);

/** `true` for masculine measure nouns («compromiso», «eje»). */
export const isMasculineUnit = (unit: string) => unit.endsWith('o') || unit === 'eje';

/** "measure" or "measures", in the words the program itself uses. */
export const measureNoun = (program: Pick<Program, 'measureUnit' | 'measureUnitPlural'>, count: number) =>
  count === 1 ? program.measureUnit : program.measureUnitPlural;

/**
 * "las 12 propuestas" or, when there is one, "la única propuesta".
 * Masculine units ("compromiso", "eje") take "los" / "el único".
 */
export const allOf = (program: Pick<Program, 'measureUnit' | 'measureUnitPlural'>, count: number) => {
  const masculine = isMasculineUnit(program.measureUnit);
  if (count === 1) return `${masculine ? 'el único' : 'la única'} ${program.measureUnit}`;
  return `${masculine ? 'los' : 'las'} ${count} ${program.measureUnitPlural}`;
};

export interface BandSummaryInput {
  measureUnit: string;
  measureUnitPlural: string;
  total: number;
  withFigures: number;
  withDeadline: number;
  withRepeals: number;
  blockCount: number;
  sectionCount: number;
  biggestBlock: number;
  pendingCount: number;
}

/** One-paragraph summary of a program for the party band, avoiding robotic «0 tienen» counts. */
export function programBandSentence(input: BandSummaryInput): string {
  const {
    measureUnit: singular,
    measureUnitPlural: plural,
    total,
    withFigures,
    withDeadline,
    withRepeals,
    blockCount,
    sectionCount,
    biggestBlock,
    pendingCount,
  } = input;
  const masculine = isMasculineUnit(singular);
  const none = masculine ? 'ninguno' : 'ninguna';
  const unitRef = { measureUnit: singular, measureUnitPlural: plural };

  let countsSentence: string;
  if (total === 1) {
    if (withFigures === 0 && withDeadline === 0 && withRepeals === 0) {
      countsSentence = `${capitalize(allOf(unitRef, 1))} no concreta cifras ni plazos.`;
    } else {
      const parts = [
        withFigures > 0 ? 'tiene una cifra' : 'no tiene cifras',
        withDeadline > 0 ? 'fija un plazo' : 'no fija un plazo',
        withRepeals > 0 ? 'deroga una ley' : null,
      ].filter(Boolean) as string[];
      countsSentence = `${capitalize(allOf(unitRef, 1))} ${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}.`;
    }
  } else if (withFigures === 0 && withDeadline === 0) {
    countsSentence =
      withRepeals > 0
        ? `De ${allOf(unitRef, total)}, ${none} concreta cifras ni plazos y ${withRepeals} ${withRepeals === 1 ? 'deroga' : 'derogan'} una ley.`
        : `${capitalize(none)} de ${allOf(unitRef, total)} concreta cifras ni plazos.`;
  } else {
    const parts = [
      withFigures > 0 ? `${withFigures} ${withFigures === 1 ? 'tiene' : 'tienen'} una cifra` : `${none} tiene una cifra`,
      withDeadline > 0 ? `${withDeadline} ${withDeadline === 1 ? 'tiene' : 'tienen'} un plazo` : `${none} tiene un plazo`,
      withRepeals > 0 ? `${withRepeals} ${withRepeals === 1 ? 'deroga' : 'derogan'} una ley` : null,
    ].filter(Boolean) as string[];
    countsSentence = `De ${allOf(unitRef, total)}, ${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}.`;
  }

  let structureSentence: string | null = null;
  let longestBlockSentence: string | null = null;
  if (total > 1) {
    if (blockCount === 1) {
      structureSentence = sectionCount > 1 ? `Se reparten en ${sectionCount} secciones.` : 'Se agrupan en un único bloque.';
    } else {
      structureSentence = `Se reparten en ${blockCount} bloques y ${sectionCount} ${sectionCount === 1 ? 'sección' : 'secciones'}.`;
      if (biggestBlock > 1) {
        longestBlockSentence = `El bloque más largo tiene ${biggestBlock} ${biggestBlock === 1 ? singular : plural}.`;
      }
    }
  }

  return [
    countsSentence,
    structureSentence,
    longestBlockSentence,
    pendingCount > 0 ? `Quedan ${pendingCount} por anunciar durante la campaña.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Split a text into paragraphs (separated by a blank line). */
export const splitParagraphs = (text: string) => text.split(/\n\n+/).filter(Boolean);

/** Lower case and remove accents, so a search matches "ibi" with "IBÍ". */
export const normalizeForSearch = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const padNumber = (value: number) => String(value).padStart(2, '0');

/** «9 de noviembre de 2026», from an ISO date (`2026-11-09`). */
export const formatLongDate = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
