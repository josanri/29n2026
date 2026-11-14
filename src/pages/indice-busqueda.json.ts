/**
 * Search index of every published measure. The search page loads this file on the first search.
 * The texts are normalized once here, so the browser does not do it for each measure.
 */
import type { APIRoute } from 'astro';
import { announcedMeasures, publishedPrograms } from '@/lib/programs';
import { categoryById } from '@/lib/taxonomy';
import { normalizeForSearch } from '@/lib/format';
import { readableTextColor } from '@/lib/color';

const EXCERPT_LENGTH = 200;

const excerptOf = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= EXCERPT_LENGTH) return flat;
  return `${flat.slice(0, flat.lastIndexOf(' ', EXCERPT_LENGTH))}…`;
};

export const GET: APIRoute = () => {
  // `color` is the party color and `on` is the text color that is readable on it: the pill of each result uses them.
  const parties = publishedPrograms.map((program) => ({
    id: program.id,
    acronym: program.acronym,
    color: program.color,
    on: readableTextColor(program.color),
  }));
  const items = publishedPrograms.flatMap((program, partyIndex) =>
    announcedMeasures(program)
      .map((measure) => ({
        /** Index in `parties`. */
        p: partyIndex,
        /** Measure number. */
        n: measure.number,
        /** Category name. */
        c: categoryById[measure.categoryId]?.name ?? measure.categoryId,
        /** Category id, for the filter of the search page. */
        d: measure.categoryId,
        /** Title, as shown. */
        t: measure.phraseTitle,
        /** Start of the text, as shown. */
        x: excerptOf(measure.text),
        /** Title, normalized. The search gives it more weight. */
        k: normalizeForSearch(`${measure.title} ${measure.phraseTitle}`),
        /** Full text, normalized. */
        s: normalizeForSearch(measure.text),
      })),
  );
  return new Response(JSON.stringify({ parties, items }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
