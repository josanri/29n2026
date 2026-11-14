/**
 * «Sin siglas»: the reader votes on measures without knowing the party, and then sees the parties.
 *
 * The build uses `quizStatement` and `applicableProvinces` to write one small JSON file per party.
 * The browser uses `allocateMeasures` and `pickMeasures` to choose the measures of one round.
 */
import type { Measure } from './program-schema';
import { normalizeForSearch } from './format';

/** Number of measures in one round, when the reader does not choose another. */
export const ROUND_SIZE = 10;
/** The round sizes that the reader can choose. */
export const ROUND_SIZES = [5, 10, 20, 30] as const;

/** One measure as the game shows it. The keys are short because the files go to the browser. */
export interface QuizMeasure {
  /** Number of the measure in its program. */
  n: number;
  /** Category name. */
  c: string;
  /** Heading. Empty when the text says it already, or when the program only has a cut title. */
  h: string;
  /** Full text. It can be empty when the program only has a title. */
  x: string;
  /** INE codes of the provinces where the measure applies. No value: it applies everywhere. */
  a?: string[];
}

const flat = (text: string) => text.replace(/\s+/g, ' ').trim();
const withoutEnd = (text: string) => text.replace(/[.…:]+$/, '');

/**
 * The heading and the text of a measure for the game, or `null` when the measure has nothing to show.
 * Some programs repeat the start of the text as a title cut with «…»: then only the text shows.
 */
export function quizStatement(measure: Measure): { heading: string; text: string } | null {
  let text = flat(measure.text);
  let heading = flat(measure.phraseTitle);
  if (heading.endsWith('…')) {
    const title = flat(measure.title);
    heading = title && !title.endsWith('…') && title !== title.toUpperCase() ? title : '';
  }
  // Some programs cut a sentence between the title and the text («… más» + «allá del …»): join them.
  if (heading && text && (/^[a-záéíóúñü]/.test(text) || heading.endsWith(','))) {
    text = `${heading} ${text}`;
    heading = '';
  }
  if (heading && text && normalizeForSearch(text).startsWith(normalizeForSearch(withoutEnd(heading)))) heading = '';
  if (heading.length + text.length < 15) return null;
  // A statement that starts in lowercase is a fragment of the extraction (the start of the sentence is in
  // another measure): it is not a fair question, so it does not go in the game.
  if (/^[a-záéíóúàèòçñü]/.test(heading || text)) return null;
  return { heading, text };
}

/**
 * Spanish territories that the programs name, and their provinces (INE codes).
 * Keys are normalized (`normalizeForSearch`). A name that is not here (Spain, the EU, another country)
 * makes no limit.
 */
export function territoryProvinces(
  provinces: { code: string; name: string; region: string }[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const add = (name: string, codes: string[]) => {
    const key = normalizeForSearch(name);
    map[key] = [...new Set([...(map[key] ?? []), ...codes])];
  };
  for (const province of provinces) {
    add(province.region, [province.code]);
    for (const name of province.name.split('/')) add(name, [province.code]);
  }
  // Other names of regions and provinces in the programs.
  const aliases: Record<string, string> = {
    Baleares: 'Illes Balears',
    'C. Valenciana': 'Comunidad Valenciana',
    'País Valencià': 'Comunidad Valenciana',
    Euskadi: 'País Vasco',
    'Principado de Asturias': 'Asturias',
    'Región de Murcia': 'Murcia',
    'Comunidad de Madrid': 'Madrid',
  };
  for (const [alias, name] of Object.entries(aliases)) add(alias, map[normalizeForSearch(name)] ?? []);
  // Islands of the Canary Islands and the Balearic Islands.
  for (const island of ['Gran Canaria', 'Fuerteventura', 'Lanzarote', 'La Graciosa']) add(island, ['35']);
  for (const island of ['Tenerife', 'La Palma', 'La Gomera', 'El Hierro']) add(island, ['38']);
  for (const island of ['Mallorca', 'Menorca', 'Ibiza', 'Eivissa', 'Formentera']) add(island, ['07']);
  return map;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern for each province: its name (or each of its names, "Alicante/Alacant") as a whole word. */
const patternCache = new WeakMap<object, { code: string; pattern: RegExp }[]>();
const provincePatterns = (provinces: { code: string; name: string }[]) => {
  const cached = patternCache.get(provinces);
  if (cached) return cached;
  const patterns = buildPatterns(provinces);
  patternCache.set(provinces, patterns);
  return patterns;
};
const buildPatterns = (provinces: { code: string; name: string }[]) =>
  provinces.map((province) => ({
    code: province.code,
    pattern: new RegExp(
      `(^|[^a-z])(${province.name
        .split('/')
        .map((name) => escapeRegExp(normalizeForSearch(name)))
        .join('|')})([^a-z]|$)`,
    ),
  }));

/**
 * The provinces where a measure applies, or `undefined` when it applies everywhere.
 *
 * A measure that names a region ("Andalucía") applies to all its provinces, unless its text names some
 * of them: "Cercanías que sirvan… los Cercanías de Sevilla van llenos" is a measure for Sevilla, not for Málaga.
 * Then it applies to the provinces that the text names. A measure with no territory applies everywhere,
 * even if its text names a city as an example ("lo que vale en Sevilla vale en Bilbao").
 */
export function applicableProvinces(
  measure: Measure,
  territories: Record<string, string[]>,
  provinces: { code: string; name: string }[] = [],
): string[] | undefined {
  const codes = [...new Set(measure.territories.flatMap((name) => territories[normalizeForSearch(name)] ?? []))];
  if (!codes.length) return undefined;
  const text = normalizeForSearch(`${measure.title} ${measure.text}`);
  const named = provincePatterns(provinces)
    .filter(({ code, pattern }) => codes.includes(code) && pattern.test(text))
    .map(({ code }) => code);
  return (named.length ? named : codes).sort();
}

/**
 * How many measures each party gets in a round of `total`. Every party has the same weight, whatever the
 * size of its program: the places go one by one, in turns, in a random order of the parties. With 7 parties
 * and 10 places, each party gets 1 and 3 parties at random get 2. No party gets more than it has; its turn
 * then goes to the next party.
 */
export function allocateMeasures(available: Record<string, number>, total = ROUND_SIZE): Record<string, number> {
  const order = shuffle(Object.keys(available).filter((id) => available[id] > 0));
  const result: Record<string, number> = Object.fromEntries(order.map((id) => [id, 0]));
  let left = total;
  while (left > 0) {
    let given = 0;
    for (const id of order) {
      if (left === 0) break;
      if (result[id] < available[id]) {
        result[id] += 1;
        left -= 1;
        given += 1;
      }
    }
    if (given === 0) break;
  }
  return result;
}

/** A copy of the list in random order (Fisher–Yates). */
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
