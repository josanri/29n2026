/** Data for the AI agents of the browser (WebMCP): every party, the categories and the topics. See `agent-data.ts`. */
import type { APIRoute } from 'astro';
import { partiesData } from '@/lib/agent-data';

export const GET: APIRoute = ({ site }) =>
  new Response(JSON.stringify(partiesData(site)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
