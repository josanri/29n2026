/**
 * Search index of every published measure. The search page loads this file on the first search.
 * The texts are normalized once here, so the browser does not do it for each measure.
 */
import type { APIRoute } from 'astro';
import { publishedPrograms } from '@/lib/programs';
import { categoryById } from '@/lib/taxonomy';
import { normalizeForSearch } from '@/lib/format';

const EXCERPT_LENGTH = 200;

const excerptOf = (text: string) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= EXCERPT_LENGTH) return flat;
  return `${flat.slice(0, flat.lastIndexOf(' ', EXCERPT_LENGTH))}…`;
};

export const GET: APIRoute = () => {
  const parties = publishedPrograms.map((program) => ({ id: program.id, acronym: program.acronym }));
  const items = publishedPrograms.flatMap((program, partyIndex) =>
    program.measures
      .filter((measure) => !measure.isPending)
      .map((measure) => ({
        /** Index in `parties`. */
        p: partyIndex,
        /** Measure number. */
        n: measure.number,
        /** Category name. */
        c: categoryById[measure.categoryId]?.name ?? measure.categoryId,
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
