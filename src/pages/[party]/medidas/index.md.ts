/** The Markdown version of the list of measures of a party, for the AI agents. See `src/lib/markdown/`. */
import type { APIRoute } from 'astro';
import { markdownResponse, measuresMarkdown } from '@/lib/markdown';
import { getProgram, programs } from '@/lib/programs';

export function getStaticPaths() {
  return programs.map((program) => ({ params: { party: program.id } }));
}

export const GET: APIRoute = ({ params, site }) => markdownResponse(measuresMarkdown(getProgram(params.party!), site));
