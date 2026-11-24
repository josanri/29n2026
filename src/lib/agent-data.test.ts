import { describe, expect, it } from 'vitest';
import { calendarData, debateDetailData, debatesIndexData, partiesData, pollsData } from './agent-data';
import type { Debate } from './debate';
import { averageOn, latestPollAverages } from './polls';
import { assertIsoDate, findProvince } from './webmcp/tools';

const SITE = new URL('https://electosfera.es');

describe('agent-data builders', () => {
  it('partiesData includes all 52 provinces and chamber presence per party', () => {
    const data = partiesData(SITE);
    expect(data.provincias).toHaveLength(52);
    expect(data.provincias.some((province) => province.codigo === '28' && province.nombre === 'Madrid')).toBe(true);

    const teruel = data.partidos.find((party) => party.id === 'teruel-existe');
    expect(teruel).toBeDefined();
    expect(teruel!.congreso).toEqual(['44']);

    const vox = data.partidos.find((party) => party.id === 'vox');
    expect(vox?.congreso).toBe('todas');
    expect(Array.isArray(vox?.senado)).toBe(true);

    const pp = data.partidos.find((party) => party.id === 'pp');
    expect(Array.isArray(pp?.congreso)).toBe(true);
    expect((pp?.congreso as string[]).includes('28')).toBe(true);
  });

  it('pollsData keeps Sumar and Frente Amplio separated and preserves provenance', () => {
    const data = pollsData(SITE);
    expect(data.mediaActual.ventanaDias).toBe(21);
    // Latest date is after FRENTE_AMPLIO_FROM (2026-10-16), so Sumar must not appear in current average.
    expect(data.mediaActual.partidos.some((party) => party.id === 'sumar')).toBe(false);
    expect(data.mediaActual.partidos.some((party) => party.id === 'fa')).toBe(true);
    expect(averageOn('2026-11-23', 'sumar', 'pct')).toBeNull();
    expect(averageOn('2026-10-10', 'fa', 'pct')).toBeNull();

    // Distinct ids even when the same pollster publishes twice on the same date.
    const ids = data.encuestas.map((poll) => poll.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Newest first.
    expect(data.encuestas[0].fecha >= data.encuestas[data.encuestas.length - 1].fecha).toBe(true);
    expect(latestPollAverages().partidos.length).toBeGreaterThan(0);
  });

  it('debatesIndexData and debateDetailData filter empty speakers and split moderation cuts', () => {
    const fixture: Debate = {
      slug: 'prueba-debate',
      title: 'Debate de prueba',
      date: '2026-11-23',
      channel: 'RTVE',
      durationSeconds: 3600,
      binSeconds: 60,
      speakers: [
        {
          id: 'mod',
          name: 'Moderador',
          role: 'Moderador',
          partyId: null,
          minutes: 5,
          words: 600,
          turns: 10,
          longestSeconds: 30,
          cutsMade: 0,
          cutsReceived: 0,
          moderationsMade: 2,
          moderationsReceived: 0,
        },
        {
          id: 'cand1',
          name: 'Candidata Uno',
          role: 'Candidata',
          partyId: 'pp',
          minutes: 15,
          words: 2000,
          turns: 20,
          longestSeconds: 90,
          cutsMade: 1,
          cutsReceived: 0,
          moderationsMade: 0,
          moderationsReceived: 2,
        },
        {
          id: 'sin-asignar',
          name: 'Sin asignar',
          role: 'Desconocido',
          partyId: null,
          minutes: 0,
          words: 0,
          turns: 0,
          longestSeconds: 0,
          cutsMade: 0,
          cutsReceived: 0,
          moderationsMade: 0,
          moderationsReceived: 0,
        },
      ],
      interventions: [
        {
          speaker: 'cand1',
          start: 10,
          end: 40,
          paragraphs: ['Hablamos de vivienda.'],
          cut: true,
          cutOff: false,
          kind: 'interrupcion',
          topics: ['vivienda'],
        },
        {
          speaker: 'mod',
          start: 40,
          end: 45,
          paragraphs: ['Tiempo agotado.'],
          cut: true,
          cutOff: false,
          kind: 'moderacion',
          topics: [],
        },
        {
          speaker: 'cand1',
          start: 3500,
          end: 3560,
          paragraphs: ['Minuto de oro.'],
          cut: false,
          cutOff: false,
          topics: [],
        },
      ],
      interruptions: [
        { start: 10, kind: 'interrupcion', by: 'cand1', of: 'cand2', text: 'No es cierto', before: '...', intervention: 0, topics: ['vivienda'] },
        { start: 40, kind: 'moderacion', by: 'mod', of: 'cand1', text: 'Tiempo', before: '...', intervention: 1, topics: [] },
      ],
      density: [1],
      moderationDensity: [1],
      topics: [{ id: 'vivienda', label: 'Vivienda', mentions: [1], total: 1, interruptions: 1 }],
      golden: [{ speaker: 'cand1', start: 3500, end: 3560 }],
    };

    const index = debatesIndexData([fixture], SITE);
    expect(index.total).toBe(1);
    expect(index.debates[0].ponentes.map((speaker) => speaker.id)).toEqual(['mod', 'cand1']);
    expect(index.debates[0].ponentes[0].esModeracion).toBe(true);
    expect(index.debates[0].ponentes[1].esModeracion).toBe(false);
    expect(index.debates[0].interrupcionesCandidatos).toBe(1);
    expect(index.debates[0].cortesModeracion).toBe(1);

    const detail = debateDetailData(fixture, SITE);
    expect(detail.intervenciones[0].esInterrupcion).toBe(true);
    expect(detail.intervenciones[1].esInterrupcion).toBe(false);
    expect(detail.intervenciones[1].esCorteModeracion).toBe(true);
    expect(detail.intervenciones[2].esMinutoDeOro).toBe(true);
  });

  it('calendarData returns ordered events with official and derived origins', () => {
    const data = calendarData(SITE);
    expect(data.fechaVotacion).toBe('2026-11-29');
    expect(data.total).toBe(data.eventos.length);
    expect(data.eventos.length).toBeGreaterThan(10);
    const mailVote = data.eventos.find((event) => event.id === 'devolucion-voto-correo');
    expect(mailVote?.fechaFin).toBe('2026-11-26');
    expect(mailVote?.origen).toBe('oficial');
  });
});

describe('WebMCP pure helpers', () => {
  const { provincias } = partiesData(SITE);

  it('findProvince matches INE codes, co-official halves and Spanish aliases', () => {
    expect(findProvince(provincias, '28').nombre).toBe('Madrid');
    expect(findProvince(provincias, '1').codigo).toBe('01');
    expect(findProvince(provincias, 'Álava').codigo).toBe('01');
    expect(findProvince(provincias, 'Araba').codigo).toBe('01');
    expect(findProvince(provincias, 'Baleares').codigo).toBe('07');
    expect(findProvince(provincias, 'La Coruña').codigo).toBe('15');
    expect(findProvince(provincias, 'Teruel').codigo).toBe('44');
    expect(() => findProvince(provincias, 'Atlántida')).toThrow(/No hay ninguna provincia/);
  });

  it('assertIsoDate validates YYYY-MM-DD dates', () => {
    expect(assertIsoDate('2026-11-24', 'desde')).toBe('2026-11-24');
    expect(() => assertIsoDate('24/11/2026', 'desde')).toThrow(/AAAA-MM-DD/);
  });
});
