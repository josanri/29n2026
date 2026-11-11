/** Text and number helpers shared by pages and components. */
import type { Program } from './program-schema';

export const LOCALE = 'es';

export const formatNumber = (value: number) => value.toLocaleString('es-ES');

/** Share of `total` as a rounded integer percentage. */
export const percentOf = (value: number, total: number) => Math.round((value / total) * 100);

export const compareText = (a: string, b: string) => a.localeCompare(b, LOCALE);

/** "measure" or "measures", in the words the program itself uses. */
export const measureNoun = (program: Program, count: number) =>
  count === 1 ? program.measureUnit : program.measureUnitPlural;

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Split a text into paragraphs (separated by a blank line). */
export const splitParagraphs = (text: string) => text.split(/\n\n+/).filter(Boolean);

/** Lower case and remove accents, so a search matches "ibi" with "IBÍ". */
export const normalizeForSearch = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const padNumber = (value: number) => String(value).padStart(2, '0');
