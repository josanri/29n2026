import { describe, expect, it } from 'vitest';
import { feedItems, pollItem, programItem, type FeedParty, type FeedPoll, type FeedProgram } from './feed';
import type { Debate } from './debate';

const site = new URL('https://example.org/');
const parties: FeedParty[] = [
  { id: 'pp', acronym: 'PP' },
  { id: 'psoe', acronym: 'PSOE' },
  { id: 'vox', acronym: 'VOX' },
  { id: 'fa', acronym: 'Frente Amplio' },
];
const program: FeedProgram = {
  id: 'psoe',
  partyName: 'Partido Socialista Obrero Español',
  acronym: 'PSOE',
  programName: 'La fuerza de seguir avanzando',
  subtitle: '500 compromisos en 8 capítulos',
  measureLabel: '500 compromisos',
  publishedOn: '2026-11-13',
};
const pollsters = [{ id: 'gad3', name: 'GAD3', media: 'ABC' }];
const poll = (date: string, checked = true): FeedPoll => ({
  pollster: 'gad3',
  date,
  url: 'https://example.com/poll?a=1&b=2',
  checked,
  values: { pp: 31.1, psoe: 28.4, vox: 18.1, fa: null },
  seats: { pp: [127, 136], psoe: 110 },
});
const debate = (slug: string, date?: string): Debate => ({
  slug,
  title: `Debate ${slug}`,
  date,
  channel: 'RTVE',
  durationSeconds: 60,
  binSeconds: 60,
  speakers: [
    { id: 'm', name: 'Moderadora', role: 'Moderadora', partyId: null, minutes: 1, words: 10, turns: 1, longestSeconds: 1, cutsMade: 0, cutsReceived: 0, moderationsMade: 0, moderationsReceived: 0 },
    { id: 'a', name: 'Ana', role: 'PP', partyId: 'pp', minutes: 1, words: 10, turns: 1, longestSeconds: 1, cutsMade: 0, cutsReceived: 0, moderationsMade: 0, moderationsReceived: 0 },
    { id: 'b', name: 'Berta', role: 'PSOE', partyId: 'psoe', minutes: 1, words: 10, turns: 1, longestSeconds: 1, cutsMade: 0, cutsReceived: 0, moderationsMade: 0, moderationsReceived: 0 },
  ],
  interventions: [],
  interruptions: [],
  density: [],
  moderationDensity: [],
  topics: [],
});

describe('pollItem', () => {
  const item = pollItem(poll('2026-11-22'), pollsters[0], parties, site);

  it('puts the three first parties in the title, in Spanish number format', () => {
    expect(item.title).toBe('Encuesta GAD3: PP 31,1 %, PSOE 28,4 %, VOX 18,1 %');
  });

  it('links to the row of the poll, with an absolute URL', () => {
    expect(item.link).toBe('https://example.org/encuestas/#encuesta-gad3-2026-11-22');
  });

  it('lists the seats and leaves out a party with no figure', () => {
    expect(item.content).toContain('<li>PP: 31,1 % (127–136 escaños)</li>');
    expect(item.content).toContain('<li>PSOE: 28,4 % (110 escaños)</li>');
    expect(item.content).not.toContain('Frente Amplio');
  });

  it('escapes the URL of the source', () => {
    expect(item.content).toContain('href="https://example.com/poll?a=1&amp;b=2"');
  });

  it('says when the figures were not read in the original publication', () => {
    expect(pollItem(poll('2026-11-22', false), pollsters[0], parties, site).description).toContain('no se han leído');
  });
});

describe('programItem', () => {
  const item = programItem(program, site);

  it('names the party and the program, and links to the page of the party', () => {
    expect(item.title).toBe('Partido Socialista Obrero Español (PSOE): «La fuerza de seguir avanzando»');
    expect(item.link).toBe('https://example.org/psoe/');
  });

  it('gives the count in the words of the program, on the day it came on the site', () => {
    expect(item.description).toContain('500 compromisos');
    expect(item.pubDate).toEqual(new Date('2026-11-13T12:00:00Z'));
  });
});

describe('feedItems', () => {
  const items = feedItems(
    {
      programs: [program],
      polls: [poll('2026-11-13'), poll('2026-11-20')],
      pollsters,
      parties,
      debates: [debate('a', '2026-11-13'), debate('sin-fecha')],
    },
    site,
  );

  it('sorts the items from the newest: on the same day, the program, the debate and then the polls', () => {
    expect(items.map((item) => item.link)).toEqual([
      'https://example.org/encuestas/#encuesta-gad3-2026-11-20',
      'https://example.org/psoe/',
      'https://example.org/debates/a/',
      'https://example.org/encuestas/#encuesta-gad3-2026-11-13',
    ]);
  });

  it('names the candidates of a debate and not the moderator', () => {
    expect(items[2].description).toContain('Con Ana (PP) y Berta (PSOE).');
    expect(items[2].description).not.toContain('Moderadora');
  });

  it('stops on a poll of an unknown pollster', () => {
    expect(() => feedItems({ programs: [], polls: [{ ...poll('2026-11-01'), pollster: 'x' }], pollsters, parties, debates: [] }, site)).toThrow(/x/);
  });
});
