import type { APIRoute } from 'astro';
import { calendarEvents } from '@eleccion/calendario';
import { election } from '@eleccion/eleccion';
import { buildIcs } from '@/lib/ics';
import { routes } from '@/lib/routes';

/** The whole electoral calendar, for a reader who adds it in one step or follows the link. */
export const GET: APIRoute = ({ site }) => {
  const siteUrl = site ? new URL(routes.calendar(), site).href : '';
  return new Response(buildIcs(calendarEvents, { name: `${election.name} ${election.shortName} ${election.year}`, siteUrl }), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
};
