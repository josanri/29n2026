import type { APIRoute, GetStaticPaths } from 'astro';
import { calendarEvents } from '@eleccion/calendario';
import { buildIcs } from '@/lib/ics';
import { routes } from '@/lib/routes';

export const getStaticPaths = (() => calendarEvents.map((event) => ({ params: { id: event.id }, props: { event } }))) satisfies GetStaticPaths;

/** One event of the calendar, in its own `.ics` file. */
export const GET: APIRoute = ({ props, site }) => {
  const event = props.event as (typeof calendarEvents)[number];
  const siteUrl = site ? new URL(routes.calendar(), site).href : '';
  return new Response(buildIcs([event], { name: event.title, siteUrl }), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
};
