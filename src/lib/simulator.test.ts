import { describe, expect, it } from 'vitest';
import { ABSOLUTE_MAJORITY, CONGRESS_SEATS, congressGroups } from '@eleccion/congreso';
import {
  SENATE_ABSOLUTE_MAJORITY,
  SENATE_AUTONOMOUS_SEATS,
  SENATE_ELECTED_SEATS,
  SENATE_SEATS,
  senateGroups,
} from '@eleccion/senado';
import { SENATE_HEMICYCLE_ROWS, hemicyclePositions, investiture, minimalCoalitions } from './simulator';

describe('hemicyclePositions', () => {
  it('places one seat for each deputy or senator', () => {
    expect(hemicyclePositions().positions).toHaveLength(CONGRESS_SEATS);
    expect(hemicyclePositions(SENATE_SEATS, SENATE_HEMICYCLE_ROWS).positions).toHaveLength(SENATE_SEATS);
    expect(hemicyclePositions(20).positions).toHaveLength(20);
  });

  it('goes from the left to the right', () => {
    const { positions } = hemicyclePositions();
    expect(positions[0].x).toBeLessThan(positions[positions.length - 1].x);
    const senate = hemicyclePositions(SENATE_SEATS, SENATE_HEMICYCLE_ROWS);
    expect(senate.positions[0].x).toBeLessThan(senate.positions[senate.positions.length - 1].x);
  });
});

describe('chamber data totals', () => {
  it('sums to 350 seats in Congress', () => {
    expect(congressGroups.reduce((sum, group) => sum + group.seatsNow, 0)).toBe(CONGRESS_SEATS);
    expect(congressGroups.reduce((sum, group) => sum + group.seats2023, 0)).toBe(CONGRESS_SEATS);
  });

  it('sums to 266 total, 208 elected and 58 autonomous seats in the Senate', () => {
    expect(senateGroups.reduce((sum, group) => sum + group.seatsNow, 0)).toBe(SENATE_SEATS);
    expect(senateGroups.reduce((sum, group) => sum + group.seats2023, 0)).toBe(SENATE_ELECTED_SEATS);
    expect(senateGroups.reduce((sum, group) => sum + group.seatsAutonomous, 0)).toBe(SENATE_AUTONOMOUS_SEATS);
    for (const group of senateGroups) {
      expect(group.seatsNow).toBe(group.seats2023 + group.seatsAutonomous);
    }
  });
});

describe('investiture', () => {
  const seats = { a: 150, b: 30, c: 100, d: 70 };

  it('passes in the first vote with the absolute majority', () => {
    const result = investiture(seats, 'a', { b: 'yes' });
    expect(result.yes).toBe(180);
    expect(result.outcome).toBe('first');
  });

  it('passes in the second vote with more yes than no', () => {
    const result = investiture(seats, 'a', { b: 'abstain', d: 'abstain' });
    expect(result).toMatchObject({ yes: 150, abstain: 100, no: 100, outcome: 'second' });
  });

  it('counts a group with no vote as no', () => {
    expect(investiture(seats, 'a', {}).outcome).toBe('failed');
  });

  it('always counts the group of the candidate as yes', () => {
    expect(investiture(seats, 'a', { a: 'no' }).yes).toBe(150);
  });

  it('evaluates Senate votes with the Senate absolute majority', () => {
    const senateSeats = { pp: 120, psoe: 100, vox: 14, others: 32 };
    expect(investiture(senateSeats, 'pp', { vox: 'yes' }, SENATE_ABSOLUTE_MAJORITY)).toMatchObject({
      yes: 134,
      firstVote: true,
      outcome: 'first',
    });
    expect(investiture(senateSeats, 'pp', { others: 'abstain', vox: 'abstain' }, SENATE_ABSOLUTE_MAJORITY)).toMatchObject({
      yes: 120,
      no: 100,
      abstain: 46,
      firstVote: false,
      secondVote: true,
      outcome: 'second',
    });
  });
});

describe('minimalCoalitions', () => {
  it('needs no partner when the candidate has the majority alone', () => {
    expect(minimalCoalitions({ a: ABSOLUTE_MAJORITY, b: 10 }, 'a')).toEqual([{ partners: [], seats: ABSOLUTE_MAJORITY }]);
  });

  it('gives only coalitions where every partner is necessary, the shortest first', () => {
    const groups: Record<string, number> = { a: 150, b: 30, c: 20, d: 10 };
    const coalitions = minimalCoalitions(groups, 'a');
    expect(coalitions[0]).toEqual({ partners: ['b'], seats: 180 });
    for (const { partners, seats } of coalitions) {
      expect(seats).toBeGreaterThanOrEqual(ABSOLUTE_MAJORITY);
      for (const id of partners) expect(seats - groups[id]).toBeLessThan(ABSOLUTE_MAJORITY);
    }
    // b alone is enough, so no coalition has b with another partner.
    expect(coalitions.some(({ partners }) => partners.includes('b') && partners.length > 1)).toBe(false);
  });

  it('gives no coalition when the majority is not possible', () => {
    expect(minimalCoalitions({ a: 100, b: 20 }, 'a')).toEqual([]);
  });

  it('finds minimal Senate coalitions quickly even with many groups', () => {
    const senateSeats: Record<string, number> = {
      psoe: 110,
      erc: 12,
      bildu: 12,
      pnv: 10,
      junts: 8,
      sumar: 6,
      bng: 4,
      cc: 3,
      upn: 2,
      asg: 1,
      ahi: 1,
      geroa: 1,
      compromis: 1,
      podemos: 1,
      x1: 1,
      x2: 1,
      x3: 1,
      x4: 1,
      x5: 1,
      pp: 89,
    };
    const coalitions = minimalCoalitions(senateSeats, 'psoe', 6, SENATE_ABSOLUTE_MAJORITY);
    expect(coalitions.length).toBeGreaterThan(0);
    expect(coalitions[0]).toEqual({ partners: ['pp'], seats: 199 });
    for (const { partners, seats } of coalitions) {
      expect(seats).toBeGreaterThanOrEqual(SENATE_ABSOLUTE_MAJORITY);
      for (const id of partners) expect(seats - senateSeats[id]).toBeLessThan(SENATE_ABSOLUTE_MAJORITY);
    }
  });
});
