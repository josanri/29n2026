/** Data for the AI agents of the browser (WebMCP): index and statistics of published debates. See `agent-data.ts`. */
import type { APIRoute } from 'astro';
import { debatesIndexData } from '@/lib/agent-data';
import { debates } from '@/lib/debates';

export const GET: APIRoute = ({ site }) =>
  new Response(JSON.stringify(debatesIndexData(debates, site)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
