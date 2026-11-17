/** The Markdown version of the page of one measure, for the AI agents. See `src/lib/markdown/`. */
import type { APIRoute } from 'astro';
import { markdownResponse, measureMarkdown } from '@/lib/markdown';
import { announcedMeasures, getProgram, programs } from '@/lib/programs';

export function getStaticPaths() {
  return programs.flatMap((program) =>
    announcedMeasures(program).map((measure) => ({ params: { party: program.id, n: String(measure.number) } })),
  );
}

export const GET: APIRoute = ({ params, site }) => {
  const program = getProgram(params.party!);
  const measure = program.measures.find((candidate) => String(candidate.number) === params.n)!;
  return markdownResponse(measureMarkdown(program, measure, site));
};
