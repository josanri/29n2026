/**
 * The items of the RSS feed (`src/pages/novedades.xml.ts`): one per program, poll and debate, the newest first.
 * Only content with a real date goes in the feed: a program goes in on the day it came on the site
 * (`@eleccion/publicaciones`). Pure functions: the endpoint gives them the data and the URL of the site.
 */
import type { RSSFeedItem } from '@astrojs/rss';
import type { Debate } from './debate';
import { formatLongDate } from './format';
import { routes } from './routes';

/** The part of a poll that the feed reads (the type of `@eleccion/encuestas`, without the election-specific ids). */
export interface FeedPoll {
  pollster: string;
  date: string;
  url: string;
  checked: boolean;
  values: Partial<Record<string, number | null>>;
  seats?: Partial<Record<string, number | [number, number] | null>>;
}

export interface FeedPollster {
  id: string;
  name: string;
  media: string;
}

export interface FeedParty {
  id: string;
  acronym: string;
}

/** Noon UTC: a date with no time stays on the same day in Spain and in America. */
const dayToDate = (date: string) => new Date(`${date}T12:00:00Z`);
const percent = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const seatsText = (seats: number | [number, number]) =>
  Array.isArray(seats) ? (seats[0] === seats[1] ? String(seats[0]) : `${seats[0]}–${seats[1]}`) : String(seats);
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The parties that the poll publishes, from the highest vote to the lowest. */
const rankedParties = (poll: FeedPoll, parties: FeedParty[]) =>
  parties
    .flatMap((party) => {
      const value = poll.values[party.id];
      return value == null ? [] : [{ party, value, seats: poll.seats?.[party.id] ?? null }];
    })
    .sort((a, b) => b.value - a.value);

export const pollItem = (poll: FeedPoll, pollster: FeedPollster, parties: FeedParty[], site: URL): RSSFeedItem => {
  const ranked = rankedParties(poll, parties);
  const top = ranked
    .slice(0, 3)
    .map(({ party, value }) => `${party.acronym} ${percent(value)} %`)
    .join(', ');
  const day = formatLongDate(poll.date);
  const source = poll.checked
    ? 'Las cifras se han leído en la publicación original.'
    : 'Las cifras vienen de una fuente que recoge la encuesta: no se han leído en la publicación original.';
  const rows = ranked
    .map(({ party, value, seats }) => `<li>${escapeHtml(party.acronym)}: ${percent(value)} %${seats == null ? '' : ` (${seatsText(seats)} escaños)`}</li>`)
    .join('');
  return {
    title: `Encuesta ${pollster.name}: ${top}`,
    link: new URL(routes.poll(poll.pollster, poll.date), site).href,
    pubDate: dayToDate(poll.date),
    categories: ['Encuestas'],
    description: `Estimación de voto de ${pollster.name} (${pollster.media}), publicada el ${day}: ${top}. ${source}`,
    content:
      `<p>Estimación de voto de ${escapeHtml(pollster.name)} (${escapeHtml(pollster.media)}), publicada el ${day}.</p>` +
      `<ul>${rows}</ul>` +
      `<p>${source} <a href="${escapeHtml(poll.url)}">Ver la publicación</a>.</p>`,
  };
};

/** The part of a program that the feed reads. */
export interface FeedProgram {
  id: string;
  partyName: string;
  acronym: string;
  programName: string;
  subtitle?: string;
  /** «500 compromisos», in the words of the program. */
  measureLabel: string;
  /** The day it came on the site (YYYY-MM-DD). */
  publishedOn: string;
}

export const programItem = (program: FeedProgram, site: URL): RSSFeedItem => {
  const description =
    `${program.subtitle ? `${program.subtitle}. ` : ''}El análisis del programa: ${program.measureLabel}, ` +
    'por categoría, con sus cifras y sus plazos, y el enlace al documento oficial.';
  return {
    title: `${program.partyName} (${program.acronym}): «${program.programName}»`,
    link: new URL(routes.party(program.id), site).href,
    pubDate: dayToDate(program.publishedOn),
    categories: ['Programas'],
    description,
    content: `<p>${escapeHtml(description)}</p>`,
  };
};

/** The candidates of a debate: the speakers of a party who say something. */
const candidatesOf = (debate: Debate) => debate.speakers.filter((speaker) => speaker.partyId && speaker.words > 0);

/** «A, B y C». */
const listText = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items.join(''));

export const debateItem = (debate: Debate, site: URL): RSSFeedItem => {
  const who = listText(candidatesOf(debate).map((speaker) => `${speaker.name} (${speaker.role})`));
  const when = [debate.channel, debate.date && formatLongDate(debate.date)].filter(Boolean).join(', ');
  const description = `${when ? `${when}. ` : ''}Con ${who}. La transcripción completa, el tiempo de palabra de cada candidato y cada interrupción.`;
  return {
    title: debate.title,
    link: new URL(routes.debate(debate.slug), site).href,
    pubDate: debate.date ? dayToDate(debate.date) : undefined,
    categories: ['Debates'],
    description,
    content: `<p>${escapeHtml(description)}</p>`,
  };
};

/** All the items, the newest first. On the same day: the programs, then the debates, then the polls. */
export const feedItems = (
  data: { programs: FeedProgram[]; polls: FeedPoll[]; pollsters: FeedPollster[]; parties: FeedParty[]; debates: Debate[] },
  site: URL,
): RSSFeedItem[] => {
  const pollsterById = new Map(data.pollsters.map((pollster) => [pollster.id, pollster]));
  const programs = data.programs.map((program) => ({ date: program.publishedOn, order: 0, item: programItem(program, site) }));
  const debates = data.debates.filter((debate) => debate.date).map((debate) => ({ date: debate.date!, order: 1, item: debateItem(debate, site) }));
  const polls = data.polls.map((poll) => {
    const pollster = pollsterById.get(poll.pollster);
    if (!pollster) throw new Error(`Unknown pollster in a poll: ${poll.pollster}`);
    return { date: poll.date, order: 2, item: pollItem(poll, pollster, data.parties, site) };
  });
  return [...programs, ...debates, ...polls]
    .sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order)
    .map(({ item }) => item);
};
