/**
 * Pure functions of the Congress and pacts simulator: the hemicycle, the vote of investiture
 * and the coalitions that reach the absolute majority. They have no DOM, so they are easy to test.
 */
import { ABSOLUTE_MAJORITY, CONGRESS_SEATS } from '@eleccion/congreso';

export type Vote = 'yes' | 'abstain' | 'no';

export interface SeatPosition {
  x: number;
  y: number;
}

export const HEMICYCLE = { width: 400, height: 210, centerX: 200, centerY: 200, innerRadius: 78, outerRadius: 192, rows: 11 };

/**
 * The positions of the seats of a hemicycle, from the left to the right.
 * Each row has seats in proportion to its length, so the seats keep the same distance from each other.
 * All the seats are sorted by their angle: a party takes a slice of the hemicycle, like a pie.
 */
export const hemicyclePositions = (total = CONGRESS_SEATS): { positions: SeatPosition[]; seatRadius: number } => {
  const { centerX, centerY, innerRadius, outerRadius, rows } = HEMICYCLE;
  const step = (outerRadius - innerRadius) / (rows - 1);
  const radii = Array.from({ length: rows }, (_, row) => innerRadius + row * step);
  const radiiSum = radii.reduce((sum, radius) => sum + radius, 0);

  const perRow = radii.map((radius) => Math.round((total * radius) / radiiSum));
  // The rounding can leave a seat too many or too few: the longest row takes the difference.
  perRow[rows - 1] += total - perRow.reduce((sum, count) => sum + count, 0);

  const seats: (SeatPosition & { angle: number; radius: number })[] = [];
  radii.forEach((radius, row) => {
    const count = perRow[row];
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * (1 - (count === 1 ? 0.5 : index / (count - 1)));
      seats.push({
        x: Number((centerX + radius * Math.cos(angle)).toFixed(2)),
        y: Number((centerY - radius * Math.sin(angle)).toFixed(2)),
        angle,
        radius,
      });
    }
  });
  // From the left (angle π) to the right (angle 0). With the same angle, from the inside to the outside.
  seats.sort((a, b) => b.angle - a.angle || a.radius - b.radius);
  return { positions: seats.map(({ x, y }) => ({ x, y })), seatRadius: Number((step * 0.4).toFixed(2)) };
};

export interface InvestitureResult {
  yes: number;
  no: number;
  abstain: number;
  /** First vote: it needs the absolute majority. */
  firstVote: boolean;
  /** Second vote, 48 hours later: more votes in favor than against. */
  secondVote: boolean;
  outcome: 'first' | 'second' | 'failed';
}

/**
 * The vote of investiture (Constitución, art. 99). The group of the candidate votes yes.
 * A group with no vote set votes no.
 */
export const investiture = (
  seats: Record<string, number>,
  candidateId: string,
  votes: Record<string, Vote>,
): InvestitureResult => {
  const totals: Record<Vote, number> = { yes: 0, abstain: 0, no: 0 };
  for (const [id, count] of Object.entries(seats)) {
    const vote: Vote = id === candidateId ? 'yes' : (votes[id] ?? 'no');
    totals[vote] += count;
  }
  const firstVote = totals.yes >= ABSOLUTE_MAJORITY;
  const secondVote = totals.yes > totals.no;
  return {
    ...totals,
    firstVote,
    secondVote,
    outcome: firstVote ? 'first' : secondVote ? 'second' : 'failed',
  };
};

/**
 * The coalitions of the candidate that reach the absolute majority, with no group that can be left out.
 * Each one is a list of group ids without the candidate. The shortest come first; with the same
 * length, the one with fewer seats comes first. With 11 groups there are at most 2048 combinations.
 */
export const minimalCoalitions = (
  seats: Record<string, number>,
  candidateId: string,
  limit = 6,
): { partners: string[]; seats: number }[] => {
  const candidateSeats = seats[candidateId] ?? 0;
  const others = Object.entries(seats).filter(([id, count]) => id !== candidateId && count > 0);
  if (candidateSeats >= ABSOLUTE_MAJORITY) return [{ partners: [], seats: candidateSeats }];

  const found: { partners: string[]; seats: number }[] = [];
  for (let mask = 1; mask < 1 << others.length; mask += 1) {
    const members = others.filter((_, index) => mask & (1 << index));
    const sum = candidateSeats + members.reduce((total, [, count]) => total + count, 0);
    if (sum < ABSOLUTE_MAJORITY) continue;
    // Minimal: without any one member, it does not reach the majority.
    if (members.some(([, count]) => sum - count >= ABSOLUTE_MAJORITY)) continue;
    found.push({ partners: members.map(([id]) => id), seats: sum });
  }
  return found.sort((a, b) => a.partners.length - b.partners.length || a.seats - b.seats).slice(0, limit);
};
