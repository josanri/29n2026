/** Data for the AI agents of the browser (WebMCP): poll averages and individual polls. See `agent-data.ts`. */
import type { APIRoute } from 'astro';
import { pollsData } from '@/lib/agent-data';

export const GET: APIRoute = ({ site }) =>
  new Response(JSON.stringify(pollsData(site)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
