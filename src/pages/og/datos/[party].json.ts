/**
 * The data of the link previews of one party, for the Worker that draws them (`worker/index.ts`).
 * A JSON array with one value per line: first the card of the party, then one line per measure,
 * `[number, title, excerpt, page]`. The Worker parses only the line it needs (it looks for «\n[144,»), not the
 * whole file: the CPU time of a request is 10 ms on the free plan of Cloudflare Workers.
 * (An endpoint that ends in `.txt` breaks the build of Astro 7 next to `robots.txt.ts`, so the file is `.json`.)
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { announcedMeasures, publishedPrograms, type Program } from '@/lib/programs';
import { measureCardData, partyCardData } from '@/lib/seo';

export const getStaticPaths: GetStaticPaths = () =>
  publishedPrograms.map((program) => ({ params: { party: program.id }, props: { program } }));

export const GET: APIRoute = ({ props }) => {
  const { program } = props as { program: Program };
  const lines = [
    JSON.stringify(partyCardData(program)),
    ...announcedMeasures(program).map((measure) => {
      const card = measureCardData(program, measure);
      return JSON.stringify([card.number, card.title, card.excerpt, card.page ?? 0]);
    }),
  ];
  return new Response(`[\n${lines.join(',\n')}\n]\n`, { headers: { 'Content-Type': 'application/json' } });
};
