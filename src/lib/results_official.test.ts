import { describe, expect, it } from 'vitest';
import { constituencySeats, resultsParties, senateConstituencies } from '@eleccion/resultados';
import {
  buildCongressFeed,
  buildMunicipalFeedFromScope,
  buildPartyMap,
  buildSenateFeed,
  extractCongressProvinces,
  extractSenateTargets,
  officialPartyId,
  type OfficialNomenclator,
  type OfficialPartidosCatalog,
  type OfficialPartyEntry,
  type OfficialScopeDataResponse,
} from './results_official';

const sampleCatalog: OfficialPartidosCatalog = {
  version: 12,
  elecciones: [
    {
      eleccion: 2,
      convocatoria: {
        '07-23': { partidos: { '5': { nombre: 'PARTIDO POPULAR OLD', siglas: 'PP' } } },
        '11-26': {
          partidos: {
            '2': { nombre: 'PARTIDO SOCIALISTA OBRERO ESPAÑOL', siglas: 'PSOE' },
            '5': { nombre: 'PARTIDO POPULAR', siglas: 'PP' },
            '6': { nombre: 'VOX', siglas: 'VOX' },
            '99': { nombre: 'TERUEL EXISTE', siglas: 'EXISTE' },
          },
        },
      },
    },
    {
      eleccion: 3,
      convocatoria: {
        '11-26': {
          partidos: {
            '2': { nombre: 'PARTIDO SOCIALISTA OBRERO ESPAÑOL', siglas: 'PSOE' },
            '5': { nombre: 'PARTIDO POPULAR', siglas: 'PP' },
          },
        },
      },
    },
  ],
};

const sampleNomenclator: OfficialNomenclator = {
  ver: 14,
  amb: [
    {
      elec: 2,
      ord: 1,
      ambitos: [
        { i: 0, c: '000b', co: '1', n: 'España', l: 1, ic: 2 },
        { i: 1, c: '0b0e', co: '28', n: 'Madrid', l: 30, ic: 1 },
        { i: 2, c: '00e6', co: '02', n: 'Albacete', l: 30, ic: 1 },
      ],
    },
    {
      elec: 3,
      ord: 2,
      ambitos: [
        { i: 1, c: '0b0e', co: '28', n: 'Madrid', l: 30, ic: 1 },
        { i: 2, c: '02da', co: '07', n: 'Illes Balears', l: 30, ic: 2 },
        { i: 3, c: '1cca', co: '073', n: 'Eivissa', l: 70, ic: 1 },
        { i: 4, c: '1d2e', co: '074', n: 'Formentera', l: 70, ic: 1 },
      ],
    },
  ],
};

describe('results_official adapter', () => {
  it('selects the 11-26 party catalog and extracts Congress and Senate scopes', () => {
    const congressParties = buildPartyMap(sampleCatalog, 2);
    expect(congressParties['5'].nombre).toBe('PARTIDO POPULAR');

    const provinces = extractCongressProvinces(sampleNomenclator);
    expect(provinces.map((p) => p.co)).toEqual(['02', '28']);

    const senateTargets = extractSenateTargets(sampleNomenclator);
    expect(senateTargets.map((t) => [t.constituencyCode, t.scope.co])).toEqual([
      ['28', '28'],
      ['formentera', '074'],
      ['ibiza', '073'],
    ]);
  });

  it('converts Congress province scope and municipal mapa into normalized feeds', () => {
    const partyMap = buildPartyMap(sampleCatalog, 2);
    const madridResponse: OfficialScopeDataResponse = {
      scope: {
        codigo: '28',
        nombre: 'Madrid',
        escrutinio: {
          fecha: { pro: '2026-11-29T21:15:00.000+01:00', def: '' },
          censoNocheEscrutado: { pro: 500_000, def: 0 },
          porcMesasEscrutadas: { pro: 82.5, def: 0 },
          votosTotales: { pro: 350_000, def: 0 },
          votosNulos: { pro: 3_000, def: 0 },
          votosBlancos: { pro: 2_000, def: 0 },
          partidos: [
            { codigo: '5', votos: { pro: 160_000, def: 0 }, cargos: { pro: 18, def: 0 } },
            { codigo: '2', votos: { pro: 110_000, def: 0 }, cargos: { pro: 12, def: 0 } },
            { codigo: '6', votos: { pro: 75_000, def: 0 }, cargos: { pro: 8, def: 0 } },
            // A 2023 list with no 2026 list: only for the comparison, never a party of the feed.
            { codigo: '00', votos: { pro: 0, def: 0 }, cargos: { pro: 0, def: 0 } },
          ],
        },
      },
      mapa: [
        {
          codigo: '28079',
          nombre: 'Madrid',
          escrutinio: {
            censoNocheEscrutado: { pro: 250_000, def: 0 },
            porcMesasEscrutadas: { pro: 90, def: 0 },
            votosTotales: { pro: 180_000, def: 0 },
            votosNulos: { pro: 1_000, def: 0 },
            votosBlancos: { pro: 1_000, def: 0 },
            partidos: [{ codigo: '5', votos: { pro: 90_000, def: 0 }, cargos: { pro: 0, def: 0 } }],
          },
        },
      ],
    };

    const feed = buildCongressFeed([{ provinceCode: '28', response: madridResponse }], {
      partyMap,
      catalog: resultsParties,
      seatsByCode: constituencySeats,
      names: { '28': 'Madrid' },
      source: 'pro',
    });

    expect(feed.kind).toBe('provisional');
    expect(feed.updatedAt).toBe('2026-11-29T20:15:00.000Z');
    expect(feed.areas).toHaveLength(1);
    expect(feed.areas[0]).toMatchObject({
      code: '28',
      name: 'Madrid',
      seats: 38,
      counted: 82.5,
      census: 500_000,
      voters: 350_000,
      null: 3_000,
      blank: 2_000,
    });
    expect(feed.areas[0].parties.map((p) => [p.id, p.seats, p.votes])).toEqual([
      ['pp', 18, 160_000],
      ['psoe', 12, 110_000],
      ['vox', 8, 75_000],
    ]);

    const municipal = buildMunicipalFeedFromScope('28', madridResponse, {
      partyMap,
      catalog: resultsParties,
      source: 'pro',
    });
    expect(municipal?.province).toBe('28');
    expect(municipal?.areas).toHaveLength(1);
    expect(municipal?.areas[0]).toMatchObject({ code: '28079', name: 'Madrid', seats: 0, counted: 90 });
    expect(municipal?.areas[0].parties[0]).toMatchObject({ id: 'pp', votes: 90_000 });
  });

  it('keeps Eivissa and Formentera as two Senate constituencies with one senator each', () => {
    const partyMap = buildPartyMap(sampleCatalog, 3);
    const eivissa: OfficialScopeDataResponse = {
      scope: {
        escrutinio: {
          censoNocheEscrutado: { pro: 80_000, def: 0 },
          porcMesasEscrutadas: { pro: 100, def: 0 },
          votosTotales: { pro: 50_000, def: 0 },
          votosNulos: { pro: 500, def: 0 },
          votosBlancos: { pro: 400, def: 0 },
          candidaturas: [
            { codigo: 'C1', nombre: 'MARIA', apellido1: 'SERRA', apellido2: 'TUR', votos: { pro: 20_000, def: 0 }, partido: { codigo: '5' }, cargo: true },
            { codigo: 'C2', nombre: 'JOAN', apellido1: 'MARI', apellido2: 'ROIG', votos: { pro: 18_000, def: 0 }, partido: { codigo: '2' }, cargo: false },
          ],
        },
      },
    };
    const formentera: OfficialScopeDataResponse = {
      scope: {
        escrutinio: {
          censoNocheEscrutado: { pro: 10_000, def: 0 },
          porcMesasEscrutadas: { pro: 50, def: 0 },
          votosTotales: { pro: 4_000, def: 0 },
          votosNulos: { pro: 50, def: 0 },
          votosBlancos: { pro: 40, def: 0 },
          candidaturas: [
            { codigo: 'C1', nombre: 'MARIA', apellido1: 'SERRA', apellido2: 'TUR', votos: { pro: 1_500, def: 0 }, partido: { codigo: '5' }, cargo: true },
            { codigo: 'C2', nombre: 'JOAN', apellido1: 'MARI', apellido2: 'ROIG', votos: { pro: 2_000, def: 0 }, partido: { codigo: '2' }, cargo: false },
          ],
        },
      },
    };

    const senate = buildSenateFeed(
      [
        { constituencyCode: 'ibiza', response: eivissa },
        { constituencyCode: 'formentera', response: formentera },
      ],
      {
        partyMap,
        catalog: resultsParties,
        constituencies: senateConstituencies,
        names: {},
        source: 'pro',
      },
    );

    expect(senate.areas.map((item) => [item.code, item.seats, item.census, item.voters])).toEqual([
      ['formentera', 1, 10_000, 4_000],
      ['ibiza', 1, 80_000, 50_000],
    ]);
    const [formenteraArea, ibizaArea] = senate.areas;
    expect(ibizaArea.candidates[0]).toMatchObject({ name: 'MARIA SERRA TUR', partyId: 'pp', votes: 20_000, elected: true });
    expect(formenteraArea.candidates[0]).toMatchObject({ name: 'MARIA SERRA TUR', partyId: 'pp', votes: 1_500, elected: true });
    expect(formenteraArea.candidates[1]).toMatchObject({ name: 'JOAN MARI ROIG', partyId: 'psoe', votes: 2_000, elected: false });
  });

  it('maps the official 2026 acronyms, groups and coalitions to the catalog', () => {
    // Entries copied from getPartidosColorAgrup (convocatoria 11-26).
    const congress: Record<string, OfficialPartyEntry> = {
      '1': { siglas: 'PSOE', nombre: 'PARTIDO SOCIALISTA OBRERO ESPAÑOL', agrupacion: '1' },
      '12': { siglas: 'PODEMOS', nombre: 'PODEMOS', agrupacion: '12' },
      '13': { siglas: 'FA', nombre: 'FRENTE AMPLIO', agrupacion: '13' },
      '24': { siglas: 'PSIB-PSOE', nombre: 'PARTIDO SOCIALISTA DE LAS ISLAS BALEARES', agrupacion: '1' },
      '25': { siglas: 'ARAMÉS-EU-MS', nombre: 'ARAMÉS-FRONT AMPLI', agrupacion: '13' },
      '30': { siglas: 'NC-BC, PODEMOS, IU, SUMAR', nombre: 'UNIDAD DEL PUEBLO CANARIO UPC', agrupacion: '30' },
      '45': { siglas: 'COMUNS-FRONT AMPLI', nombre: 'COMUNS-FRONT AMPLI', agrupacion: '13' },
      '56': { siglas: 'B.N.G.', nombre: 'BLOQUE NACIONALISTA GALEGO', agrupacion: '109' },
      '67': { siglas: 'UPN-PP', nombre: 'UNIÓN DEL PUEBLO NAVARRO EN COALICIÓN CON EL PARTIDO POPULAR', agrupacion: '67' },
      '77': { siglas: 'COMPROMIS-EUPV-PODEM-ERPV', nombre: 'COMPROMÍS: FRONT VALENCIÀ', agrupacion: '77' },
      '130': { siglas: 'CHA-IU-MS-FRENTE AMPLIO', nombre: 'CHUNTA ARAGONESISTA-FRENTE AMPLIO ARAGÓN', agrupacion: '13' },
      '137': { siglas: '1.ºCAN-CCa', nombre: 'MUNICIPALISTAS PRIMERO CANARIAS-COALICIÓN CANARIA', agrupacion: '28' },
      '152': { siglas: 'PAZ,CASA Y TRABAJO', nombre: 'PODEMOS', agrupacion: '12' },
      '154': { siglas: 'FRENTE AMPLIO - FRONTE AMPLA', nombre: 'FRENTE AMPLIO - FRONTE AMPLA', agrupacion: '13' },
    };
    const ids = Object.fromEntries(Object.keys(congress).map((code) => [code, officialPartyId(code, congress, resultsParties).id]));
    expect(ids).toEqual({
      '1': 'psoe',
      '12': 'podemos',
      '13': 'fa',
      '24': 'psoe',
      '25': 'fa',
      '30': 'x-nc-bc-podemos-iu-sumar',
      '45': 'fa',
      '56': 'bng',
      '67': 'upn',
      '77': 'x-compromis-eupv-podem-erpv',
      '130': 'fa',
      '137': 'cc',
      '152': 'podemos',
      '154': 'fa',
    });
    // The acronym stays the official one: the table shows the catalog acronym, the feed keeps the source.
    expect(officialPartyId('25', congress, resultsParties).acronym).toBe('ARAMÉS-EU-MS');

    // Two lists of one party outside the catalog share the id and the acronym of their group.
    const small: Record<string, OfficialPartyEntry> = {
      '20': { siglas: 'F.I.A.', nombre: 'FEDERACIÓN DE LOS INDEPENDIENTES DE ARAGÓN', agrupacion: '111' },
      '111': { siglas: 'FIA', nombre: 'FEDERACIÓN DE LOS INDEPENDIENTES DE ARAGÓN', agrupacion: '111' },
    };
    expect(officialPartyId('20', small, resultsParties)).toEqual({ id: 'x-fia', acronym: 'FIA' });
    expect(officialPartyId('111', small, resultsParties)).toEqual({ id: 'x-fia', acronym: 'FIA' });

    // The official color of the group goes with a party outside the catalog; a catalog party keeps the site color.
    const colored: Record<string, OfficialPartyEntry> = {
      '39': { siglas: 'SY', nombre: 'SORIA ¡YA!', agrupacion: '39', color: '#B09481' },
      '7': { siglas: 'PP', nombre: 'PARTIDO POPULAR', agrupacion: '7', color: '#0556a1' },
    };
    expect(officialPartyId('39', colored, resultsParties)).toEqual({ id: 'x-sy', acronym: 'SY', color: '#b09481' });
    expect(officialPartyId('7', colored, resultsParties)).toEqual({ id: 'pp', acronym: 'PP' });

    const senate: Record<string, OfficialPartyEntry> = {
      '62': { siglas: 'ERC-EH BILDU', nombre: 'ESQUERRA REPUBLICANA DE CATALUNYA-EUSKAL HERRIA BILDU', agrupacion: '62' },
      '63': { siglas: 'EH BILDU-ERC', nombre: 'EUSKAL HERRIA BILDU-ESQUERRA REPUBLICANA DE CATALUNYA', agrupacion: '62' },
      '84': { siglas: 'SDP (PSOE, IU, MS, MM, COMPROMIS, CHA, BATZARRE)', nombre: 'SENADO DE PROGRESO', agrupacion: '84' },
      '86': { siglas: 'SDP (PSOE-CHA-IU-MS)', nombre: 'SENADO DE PROGRESO DE ARAGÓN', agrupacion: '84' },
      '90': { siglas: 'PSOE-GxF-M.SUMAR', nombre: 'FORMENTERA AL SENAT', agrupacion: '90' },
      '95': { siglas: 'A.H.I.', nombre: 'AGRUPACION HERREÑA INDEPENDIENTE', agrupacion: '95' },
      '96': { siglas: 'ASAMBLEA HERREÑA', nombre: 'ASAMBLEA HERREÑA', agrupacion: '96' },
      '97': { siglas: 'C-DEM', nombre: 'COMUNS-FRONT AMPLI PER LA DEMOCRÀCIA', agrupacion: '97' },
    };
    const senateIds = Object.fromEntries(Object.keys(senate).map((code) => [code, officialPartyId(code, senate, resultsParties).id]));
    expect(senateIds).toEqual({
      '62': 'erc',
      '63': 'bildu',
      '84': 'psoe',
      '86': 'psoe',
      '90': 'psoe',
      '95': 'ahi',
      '96': 'x-asamblea-herrena',
      '97': 'fa',
    });
  });
});
