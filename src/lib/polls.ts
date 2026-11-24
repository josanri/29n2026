/**
 * Shared calculations for the polls page (`src/pages/encuestas/index.astro`) and the AI agent endpoint
 * (`/agentes/encuestas.json`): 21-day rolling averages, 95 % margins of error and Sumar -> Frente Amplio handling.
 */
import { DEFAULT_SAMPLE, FRENTE_AMPLIO_FROM, pollParties, polls, type Poll, type PollPartyId } from '@eleccion/encuestas';

export const DAY_MS = 86_400_000;
export const POLL_WINDOW_DAYS = 21;
export const POLL_WINDOW_MS = POLL_WINDOW_DAYS * DAY_MS;
export const POLL_ELECTION_DATE = '2026-11-29';
/** Five days before election day (LOREG, art. 69.8): publishing polls is banned from 00:00 on this day. */
export const POLL_BAN_DATE = '2026-11-24';

export type PollMetric = 'pct' | 'seats';
export type PollEstimate = { mid: number; lo: number; hi: number };
export type PollAverage = PollEstimate & { count: number };

export const pollTime = (date: string) => new Date(`${date}T12:00:00Z`).getTime();

export const sortedPolls = [...polls].sort((a, b) => pollTime(a.date) - pollTime(b.date));
export const pollDates = [...new Set(sortedPolls.map((poll) => poll.date))];

export const marginOfError = (share: number, sample: number) =>
  196 * Math.sqrt(((share / 100) * (1 - share / 100)) / sample);

export function estimateOf(poll: Poll, party: PollPartyId, metric: PollMetric): PollEstimate | null {
  if (metric === 'pct') {
    const value = poll.values[party] ?? null;
    if (value === null) return null;
    const margin = marginOfError(value, poll.sample ?? DEFAULT_SAMPLE);
    return { mid: value, lo: Math.max(0, value - margin), hi: value + margin };
  }
  const seats = poll.seats?.[party];
  if (seats == null) return null;
  const [lo, hi] = Array.isArray(seats) ? seats : [seats, seats];
  return { mid: (lo + hi) / 2, lo, hi };
}

/**
 * Rolling average on a given date: the latest poll of each pollster in the 21 days before (inclusive).
 * Respects the Sumar -> Frente Amplio split (`FRENTE_AMPLIO_FROM`) so the two are never mixed.
 */
export function averageOn(date: string, party: PollPartyId, metric: PollMetric, list: readonly Poll[] = sortedPolls): PollAverage | null {
  if (party === 'sumar' && date >= FRENTE_AMPLIO_FROM) return null;
  if (party === 'fa' && date < FRENTE_AMPLIO_FROM) return null;
  const target = pollTime(date);
  const latest = new Map<string, PollEstimate>();
  for (const poll of list) {
    const age = target - pollTime(poll.date);
    const estimate = estimateOf(poll, party, metric);
    if (age < 0 || age > POLL_WINDOW_MS || !estimate) continue;
    latest.set(poll.pollster, estimate);
  }
  const values = [...latest.values()];
  if (!values.length) return null;
  const mean = (key: keyof PollEstimate) => values.reduce((sum, item) => sum + item[key], 0) / values.length;
  return { mid: mean('mid'), lo: mean('lo'), hi: mean('hi'), count: values.length };
}

export const round1 = (value: number) => Math.round(value * 10) / 10;

export function latestPollAverages(list: readonly Poll[] = sortedPolls) {
  const latestDate = list.at(-1)?.date ?? POLL_ELECTION_DATE;
  const parties = pollParties
    .map((party) => {
      const vote = averageOn(latestDate, party.id, 'pct', list);
      const seats = averageOn(latestDate, party.id, 'seats', list);
      if (!vote && !seats) return null;
      return {
        id: party.id,
        siglas: party.acronym,
        voto: vote
          ? { media: round1(vote.mid), min: round1(vote.lo), max: round1(vote.hi), encuestadoras: vote.count }
          : null,
        escanos: seats
          ? { media: round1(seats.mid), min: round1(seats.lo), max: round1(seats.hi), encuestadoras: seats.count }
          : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return { fecha: latestDate, ventanaDias: POLL_WINDOW_DAYS, partidos: parties };
}
