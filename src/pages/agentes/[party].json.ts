/** Data for the AI agents of the browser (WebMCP): one program, with the full text of each measure. */
import type { APIRoute } from 'astro';
import { programData } from '@/lib/agent-data';
import { getProgram, publishedPrograms } from '@/lib/programs';

export function getStaticPaths() {
  return publishedPrograms.map((program) => ({ params: { party: program.id } }));
}

export const GET: APIRoute = ({ params, site }) =>
  new Response(JSON.stringify(programData(getProgram(params.party!), site)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
