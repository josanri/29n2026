/**
 * iCalendar (.ics) and Google Calendar links for the events of the electoral calendar.
 * The functions are pure: they run at build time and in the browser.
 */
import type { CalendarEvent } from '@eleccion/calendario';
import { SITE_NAME } from '@/lib/site';

const PRODUCT_ID = `-//${SITE_NAME}//Calendario electoral//ES`;

/** Local time of Spain in winter (CET, UTC+1): valid for the dates of the election (November and December). */
const SPAIN_WINTER_OFFSET_HOURS = 1;

/** `2026-11-29` → `20261129`. */
const compactDate = (date: string) => date.replaceAll('-', '');

/** The day after a local date, as a Date at midnight UTC (an all-day event ends the day after its last day). */
const nextDay = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1));
};

const compactUtcDate = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '');

/** `2026-11-29` + `09:00` (Spain, winter) → `20261129T080000Z`. */
const spainToUtc = (date: string, time: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour - SPAIN_WINTER_OFFSET_HOURS, minute));
  return `${utc.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
};

/** Start and end of an event, as the text that iCalendar and Google need. */
const eventRange = (event: CalendarEvent) => {
  if (event.time) {
    return {
      allDay: false,
      start: spainToUtc(event.date, event.time.from),
      end: spainToUtc(event.date, event.time.to),
    };
  }
  return { allDay: true, start: compactDate(event.date), end: compactUtcDate(nextDay(event.endDate ?? event.date)) };
};

const fullDescription = (event: CalendarEvent, siteUrl: string) =>
  [event.description, event.basis ? `Base: ${event.basis}` : '', siteUrl ? `Más información: ${siteUrl}` : '']
    .filter(Boolean)
    .join('\n\n');

const escapeText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** A line of iCalendar has at most 75 bytes. A longer one continues in the next line, after a space. */
const foldLine = (line: string) => {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const character of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + character).length > limit) {
      parts.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join('\r\n');
};

const eventLines = (event: CalendarEvent, stamp: string, siteUrl: string) => {
  const range = eventRange(event);
  return [
    'BEGIN:VEVENT',
    `UID:${event.id}@programas29n`,
    `DTSTAMP:${stamp}`,
    range.allDay ? `DTSTART;VALUE=DATE:${range.start}` : `DTSTART:${range.start}`,
    range.allDay ? `DTEND;VALUE=DATE:${range.end}` : `DTEND:${range.end}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(fullDescription(event, siteUrl))}`,
    'TRANSP:TRANSPARENT',
    // A reminder the day before, at 9:00 (an all-day event starts at 0:00: 15 hours before).
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    range.allDay ? 'TRIGGER:-PT15H' : 'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
  ];
};

/** The text of an `.ics` file with one or more events. */
export const buildIcs = (events: CalendarEvent[], options: { name: string; siteUrl?: string; now?: Date }) => {
  const stamp = `${(options.now ?? new Date()).toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name)}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    ...events.flatMap((event) => eventLines(event, stamp, options.siteUrl ?? '')),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
};

/** Link that opens Google Calendar with the event ready to save. */
export const googleCalendarUrl = (event: CalendarEvent, siteUrl = '') => {
  const range = eventRange(event);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${range.start}/${range.end}`,
    details: fullDescription(event, siteUrl),
    ctz: 'Europe/Madrid',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
