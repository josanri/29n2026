/** Data for the AI agents of the browser (WebMCP): key election dates and deadlines. See `agent-data.ts`. */
import type { APIRoute } from 'astro';
import { calendarData } from '@/lib/agent-data';

export const GET: APIRoute = ({ site }) =>
  new Response(JSON.stringify(calendarData(site)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
