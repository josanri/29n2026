/** The Markdown version of the page of one block, for the AI agents. See `src/lib/markdown/`. */
import type { APIRoute } from 'astro';
import { blockMarkdown, markdownResponse } from '@/lib/markdown';
import { getProgram, programs } from '@/lib/programs';

export function getStaticPaths() {
  return programs.flatMap((program) => program.blocks.map((block) => ({ params: { party: program.id, id: String(block.id) } })));
}

export const GET: APIRoute = ({ params, site }) => {
  const program = getProgram(params.party!);
  const block = program.blocks.find((candidate) => candidate.id === Number(params.id))!;
  return markdownResponse(blockMarkdown(program, block, site));
};
