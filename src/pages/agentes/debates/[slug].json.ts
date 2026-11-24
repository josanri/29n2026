/** Data for the AI agents of the browser (WebMCP): interventions and interruptions of one debate. See `agent-data.ts`. */
import type { APIRoute, GetStaticPaths } from 'astro';
import { debateDetailData } from '@/lib/agent-data';
import type { Debate } from '@/lib/debate';
import { debates } from '@/lib/debates';

export const getStaticPaths: GetStaticPaths = () =>
  debates.map((debate) => ({
    params: { slug: debate.slug },
    props: { debate },
  }));

export const GET: APIRoute = ({ props, site }) =>
  new Response(JSON.stringify(debateDetailData(props.debate as Debate, site)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
