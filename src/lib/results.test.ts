import { describe, expect, it } from 'vitest';
import { constituencySeats, resultsParties, senateConstituencies } from '@eleccion/resultados';
import {
  dhondt,
  nationalTotal,
  normalizeFeed,
  normalizeMunicipalFeed,
  normalizeSenateFeed,
  partyIdOf,
  senateTotal,
  senateVotesPerVoter,
  simulateMunicipalities,
  simulateNight,
  simulateSenate,
  withElected,
  withSeats,
  type SenateArea,
} from './results';

describe('dhondt', () => {
  it('shares out the seats of the textbook example', () => {
    // 7 seats, 4 lists: the usual example of the D'Hondt rule.
    const votes = { a: 340_000, b: 280_000, c: 160_000, d: 60_000 };
    expect(dhondt(votes, 7, 840_000)).toEqual({ a: 3, b: 3, c: 1, d: 0 });
  });

  it('leaves out a list under 3 % of the valid votes, blank votes included', () => {
    const votes = { a: 600, b: 371, c: 29 };
    // 29 of 1 000 valid votes is 2.9 %.
    expect(dhondt(votes, 10, 1_000).c).toBe(0);
    // With 30 votes it reaches 3 %.
    expect(dhondt({ a: 600, b: 370, c: 30 }, 40, 1_000).c).toBeGreaterThan(0);
  });

  it('gives a tie of quotients to the list with more votes', () => {
    // 2nd seat: a 200/2 = 100 against b 100/1 = 100. The tie goes to a.
    expect(dhondt({ b: 100, a: 200 }, 2, 300)).toEqual({ a: 2, b: 0 });
  });
});

describe('the constituencies', () => {
  it('add up to the 350 seats of the Congress', () => {
    expect(Object.values(constituencySeats).reduce((sum, seats) => sum + seats, 0)).toBe(350);
    expect(Object.keys(constituencySeats)).toHaveLength(52);
  });
});

describe('partyIdOf', () => {
  it('finds a party by an alias, without accents or case', () => {
    expect(partyIdOf('PSC-PSOE', resultsParties)).toBe('psoe');
    expect(partyIdOf('eh bildu', resultsParties)).toBe('bildu');
    expect(partyIdOf('Adelante Andalucía', resultsParties)).toBe('adelante');
  });
  it('gives an unknown list a stable id', () => {
    expect(partyIdOf('Teruel Existe', resultsParties)).toBe('x-teruel-existe');
  });
});

describe('normalizeFeed', () => {
  it('reads the usual Spanish field names and numbers in Spanish format', () => {
    const feed = normalizeFeed(
      {
        tipo: 'provisional',
        fechaActualizacion: '2026-11-29T21:30:00+01:00',
        ambitos: [
          { codigo: '00', nombre: 'Total', partidos: [] },
          {
            codigoINE: '4200',
            nombre: 'SORIA',
            porcentajeEscrutado: '87,31',
            censo: '72.000',
            votantes: '48.000',
            votosNulos: 500,
            votosBlanco: 400,
            partidos: [
              { siglas: 'PP', votos: '20.000', electos: 1 },
              { siglas: 'PSOE', votos: '15.000', electos: 1 },
              { siglas: 'SORIA ¡YA!', votos: '12.100', electos: 0 },
            ],
          },
        ],
      },
      { catalog: resultsParties, seatsByCode: constituencySeats, names: { '42': 'Soria' } },
    );
    expect(feed.areas).toHaveLength(1);
    const [soria] = feed.areas;
    expect(soria).toMatchObject({ code: '42', name: 'Soria', seats: 2, counted: 87.31, census: 72_000, voters: 48_000, null: 500, blank: 400 });
    expect(soria.parties.map((party) => party.id)).toEqual(['pp', 'psoe', 'x-soria-ya']);
    expect(feed.updatedAt).toBe('2026-11-29T20:30:00.000Z');
  });

  it('computes the counted share from the polling stations, and the seats from the votes', () => {
    const feed = normalizeFeed(
      { areas: [{ code: '51', mesas: 80, mesasEscrutadas: 20, parties: [{ acronym: 'PP', votes: 300 }, { acronym: 'PSOE', votes: 200 }] }] },
      { catalog: resultsParties, seatsByCode: constituencySeats },
    );
    expect(feed.areas[0].counted).toBe(25);
    expect(withSeats(feed.areas[0]).parties.find((party) => party.id === 'pp')?.seats).toBe(1);
  });

  it('fails with a clear message when no province matches', () => {
    expect(() => normalizeFeed({ areas: [{ code: '99' }] }, { catalog: resultsParties, seatsByCode: constituencySeats })).toThrow(/52 provincias/);
  });
});

describe('simulateNight', () => {
  const shares = { pp: 33, psoe: 27, vox: 15, fa: 7, podemos: 3, salf: 2, erc: 1.8, junts: 1.5, bildu: 1.3, pnv: 1.1, bng: 0.7, cc: 0.4, upn: 0.2 };
  const input = { shares, catalog: resultsParties, seatsByCode: constituencySeats, names: {} };

  it('shares out the 350 seats when the count ends', () => {
    const total = nationalTotal(simulateNight({ ...input, progress: 100 }).areas);
    expect(total.parties.reduce((sum, party) => sum + (party.seats ?? 0), 0)).toBe(350);
    expect(total.counted).toBe(100);
    expect(total.parties.find((party) => party.id === 'otros')?.seats).toBe(0);
  });

  it('keeps a regional party in its territory', () => {
    const feed = simulateNight({ ...input, progress: 100 });
    const madrid = feed.areas.find((area) => area.code === '28')!;
    const barcelona = feed.areas.find((area) => area.code === '08')!;
    expect(madrid.parties.some((party) => party.id === 'erc')).toBe(false);
    expect(barcelona.parties.some((party) => party.id === 'erc')).toBe(true);
  });

  it('gives the same night for the same seed and no votes before the count', () => {
    const a = simulateNight({ ...input, progress: 40 });
    const b = simulateNight({ ...input, progress: 40 });
    expect(a.areas).toEqual(b.areas);
    expect(nationalTotal(simulateNight({ ...input, progress: 0 }).areas).voters).toBe(0);
  });
});

describe('normalizeMunicipalFeed', () => {
  const provinces = Object.keys(constituencySeats);
  it('reads the INE code in its usual forms and makes one file for each province', () => {
    const files = normalizeMunicipalFeed(
      {
        municipios: [
          { codigoINE: '29067', nombre: 'Málaga', porcentajeEscrutado: '100', partidos: [{ siglas: 'PP', votos: 100 }] },
          { codProvincia: '29', codMunicipio: '38', nombre: 'Campillos', partidos: [{ siglas: 'PSOE', votos: 50 }] },
          { codigo: '0128079', nombre: 'Madrid', partidos: [] },
          { codigo: '080193', nombre: 'Barcelona', partidos: [] },
          { codigo: '99999', nombre: 'Fuera', partidos: [] },
        ],
      },
      { catalog: resultsParties, provinces },
    );
    expect(Object.keys(files).sort()).toEqual(['08', '28', '29']);
    expect(files['29'].province).toBe('29');
    expect(files['29'].areas.map((area) => [area.code, area.name])).toEqual([['29038', 'Campillos'], ['29067', 'Málaga']]);
    expect(files['28'].areas[0].code).toBe('28079');
    expect(files['08'].areas[0].code).toBe('08019');
  });
});

describe('simulateMunicipalities', () => {
  it('adds up to the votes of the province', () => {
    const input = { shares: { pp: 33, psoe: 28, vox: 16, fa: 7 }, catalog: resultsParties, seatsByCode: constituencySeats, names: {} };
    const province = simulateNight({ ...input, progress: 70 }).areas.find((area) => area.code === '29')!;
    const towns = Array.from({ length: 103 }, (_, index) => ({ code: `29${String(index + 1).padStart(3, '0')}`, name: `Pueblo ${index}` }));
    const feed = simulateMunicipalities(province, [...towns, { code: '53001', name: 'Compartido', shared: true }]);
    expect(feed.areas).toHaveLength(103);
    for (const party of province.parties) {
      expect(feed.areas.reduce((sum, area) => sum + area.parties.find((item) => item.id === party.id)!.votes, 0)).toBe(party.votes);
    }
    expect(feed.areas.reduce((sum, area) => sum + area.census, 0)).toBe(province.census);
  });
});

describe('the Senate', () => {
  const area = (candidates: [string, string, number][], seats = 4): SenateArea => ({
    code: '28',
    name: 'Madrid',
    province: '28',
    seats,
    counted: 50,
    census: 0,
    voters: 0,
    null: 0,
    blank: 0,
    candidates: candidates.map(([name, partyId, votes]) => ({ name, partyId, acronym: partyId.toUpperCase(), votes })),
  });

  it('has 59 constituencies and 208 elected seats', () => {
    expect(senateConstituencies).toHaveLength(59);
    expect(senateConstituencies.reduce((sum, constituency) => sum + constituency.seats, 0)).toBe(208);
    expect(senateConstituencies.some((constituency) => ['07', '35', '38'].includes(constituency.code))).toBe(false);
  });

  it('gives each voter 3, 2 or 1 candidates (LOREG, art. 166.1.a)', () => {
    expect([4, 3, 2, 1].map(senateVotesPerVoter)).toEqual([3, 2, 2, 1]);
  });

  it('elects the candidates with the most votes, whatever their party', () => {
    const result = withElected(area([['a1', 'a', 100], ['a2', 'a', 98], ['a3', 'a', 97], ['b1', 'b', 99], ['b2', 'b', 50]]));
    expect(result.candidates.filter((candidate) => candidate.elected).map((candidate) => candidate.name)).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('keeps the elected marks of the source', () => {
    const marked = area([['a1', 'a', 100], ['b1', 'b', 10]], 1);
    marked.candidates[1].elected = true;
    expect(withElected(marked).candidates.map((candidate) => candidate.elected)).toEqual([undefined, true]);
  });

  it('adds up the senators of each party', () => {
    const total = senateTotal([area([['a1', 'a', 100], ['a2', 'a', 90], ['a3', 'a', 80], ['b1', 'b', 85]])]);
    expect(total.seats).toBe(4);
    expect(total.assigned).toBe(4);
    expect(total.parties.map((party) => [party.id, party.seats, party.votes])).toEqual([['a', 3, 100], ['b', 1, 85]]);
  });

  it('reads the source by the code of a province and by the name of an island', () => {
    const feed = normalizeSenateFeed(
      {
        ambitos: [
          { codigo: '28', nombre: 'Madrid', porcentajeEscrutado: '10,5', candidatos: [{ nombre: 'Ana', siglas: 'PP', votos: '1.000' }] },
          { codigo: '9999', nombre: 'Eivissa-Formentera', candidatos: [{ nombre: 'Juan', siglas: 'PSOE', votos: 10, electo: 'S' }] },
          { codigo: '35', nombre: 'Las Palmas', candidatos: [] },
        ],
      },
      { catalog: resultsParties, constituencies: senateConstituencies },
    );
    expect(feed.areas.map((item) => item.code)).toEqual(['28', 'ibiza-formentera']);
    expect(feed.areas[0].counted).toBe(10.5);
    expect(feed.areas[0].candidates[0]).toEqual({ name: 'Ana', partyId: 'pp', acronym: 'PP', votes: 1000 });
    expect(feed.areas[1].candidates[0].elected).toBe(true);
  });

  it('simulates the 208 senators from a simulated night of the Congress', () => {
    const congress = simulateNight({ shares: { pp: 33, psoe: 28, vox: 16, fa: 7 }, catalog: resultsParties, seatsByCode: constituencySeats, names: {}, progress: 100 });
    const total = senateTotal(simulateSenate(congress, senateConstituencies).areas);
    expect(total.seats).toBe(208);
    expect(total.assigned).toBe(208);
  });
});
