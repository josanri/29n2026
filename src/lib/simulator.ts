/**
 * Pure functions of the Congress and Senate simulator: the hemicycle, the chamber vote
 * and the coalitions that reach the absolute majority. They have no DOM, so they are easy to test.
 */
import { ABSOLUTE_MAJORITY, CONGRESS_SEATS } from '@eleccion/congreso';

export type Vote = 'yes' | 'abstain' | 'no';

export interface SeatPosition {
  x: number;
  y: number;
}

export const HEMICYCLE = { width: 400, height: 210, centerX: 200, centerY: 200, innerRadius: 78, outerRadius: 192, rows: 11 };
/** Row count for the 266 seats of the Senate: keeps the same balance between radial and angular gaps. */
export const SENATE_HEMICYCLE_ROWS = 9;

/**
 * The positions of the seats of a hemicycle, from the left to the right.
 * Each row has seats in proportion to its length, so the seats keep the same distance from each other.
 * All the seats are sorted by their angle: a party takes a slice of the hemicycle, like a pie.
 */
export const hemicyclePositions = (
  total = CONGRESS_SEATS,
  rows = HEMICYCLE.rows,
): { positions: SeatPosition[]; seatRadius: number } => {
  const { centerX, centerY, innerRadius, outerRadius } = HEMICYCLE;
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
  /** First vote / absolute majority: yes >= majority. */
  firstVote: boolean;
  /** Second vote / simple majority: more votes in favor than against. */
  secondVote: boolean;
  outcome: 'first' | 'second' | 'failed';
}

/**
 * Evaluates a chamber vote (investiture in Congress, art. 99 CE, or a majority vote in the Senate).
 * The group of the candidate / sponsor votes yes. A group with no vote set votes no.
 */
export const investiture = (
  seats: Record<string, number>,
  candidateId: string,
  votes: Record<string, Vote>,
  majority = ABSOLUTE_MAJORITY,
): InvestitureResult => {
  const totals: Record<Vote, number> = { yes: 0, abstain: 0, no: 0 };
  for (const [id, count] of Object.entries(seats)) {
    const vote: Vote = id === candidateId ? 'yes' : (votes[id] ?? 'no');
    totals[vote] += count;
  }
  const firstVote = totals.yes >= majority;
  const secondVote = totals.yes > totals.no;
  return {
    ...totals,
    firstVote,
    secondVote,
    outcome: firstVote ? 'first' : secondVote ? 'second' : 'failed',
  };
};

/**
 * The coalitions of the candidate / sponsor that reach the absolute majority, with no group that can be left out.
 * Each one is a list of group ids without the candidate. The shortest come first; with the same
 * length, the one with fewer seats comes first.
 *
 * Uses iterative deepening by coalition size with branch-and-bound pruning on a list sorted descending by seats,
 * so it stays fast even with 20+ groups (e.g. Senate groups plus custom parties).
 */
export const minimalCoalitions = (
  seats: Record<string, number>,
  candidateId: string,
  limit = 6,
  majority = ABSOLUTE_MAJORITY,
): { partners: string[]; seats: number }[] => {
  const candidateSeats = seats[candidateId] ?? 0;
  if (candidateSeats >= majority) return [{ partners: [], seats: candidateSeats }];

  const others = Object.entries(seats)
    .filter(([id, count]) => id !== candidateId && count > 0)
    .sort((a, b) => b[1] - a[1]);
  const n = others.length;
  if (n === 0) return [];

  const prefix = new Array<number>(n + 1).fill(0);
  for (let index = 0; index < n; index += 1) prefix[index + 1] = prefix[index] + others[index][1];
  if (candidateSeats + prefix[n] < majority) return [];

  const results: { partners: string[]; seats: number }[] = [];
  const MAX_VISITS = 200_000;
  let visits = 0;

  for (let targetSize = 1; targetSize <= n && results.length < limit; targetSize += 1) {
    const remainingSlots = limit - results.length;
    const foundAtSize: { partners: string[]; seats: number }[] = [];
    const chosen: string[] = [];

    const search = (start: number, currentSum: number) => {
      if (visits >= MAX_VISITS) return;
      visits += 1;

      const left = targetSize - chosen.length;
      if (start + left > n) return;
      // Maximum possible sum if we take the largest remaining groups from `start`.
      const maxAdd = prefix[start + left] - prefix[start];
      if (currentSum + maxAdd < majority) return;

      if (left === 1) {
        // Because `others` is descending and `currentSum < majority`, every pick `i` that reaches `majority`
        // has `others[i][1]` as the smallest member of the coalition, so removing any member drops below `majority`.
        for (let index = start; index < n; index += 1) {
          const sum = currentSum + others[index][1];
          if (sum < majority) break;
          foundAtSize.push({ partners: [...chosen, others[index][0]], seats: sum });
        }
        return;
      }

      for (let index = start; index <= n - left; index += 1) {
        const nextSum = currentSum + others[index][1];
        // A coalition that already reaches the majority before the last pick is not minimal.
        if (nextSum >= majority) continue;
        // If even taking the largest remaining `left - 1` groups cannot reach the majority, smaller picks cannot either.
        if (nextSum + prefix[index + left] - prefix[index + 1] < majority) break;
        chosen.push(others[index][0]);
        search(index + 1, nextSum);
        chosen.pop();
      }
    };

    search(0, candidateSeats);
    foundAtSize.sort((a, b) => a.seats - b.seats);
    results.push(...foundAtSize.slice(0, remainingSlots));
  }

  return results.slice(0, limit);
};
