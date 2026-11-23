import { describe, expect, it } from 'vitest';
import { allOf, isMasculineUnit, programBandSentence } from './format';

describe('isMasculineUnit and allOf', () => {
  it('treats compromiso and eje as masculine and medida and propuesta as feminine', () => {
    expect(isMasculineUnit('compromiso')).toBe(true);
    expect(isMasculineUnit('eje')).toBe(true);
    expect(isMasculineUnit('medida')).toBe(false);
    expect(isMasculineUnit('propuesta')).toBe(false);

    expect(allOf({ measureUnit: 'eje', measureUnitPlural: 'ejes' }, 16)).toBe('los 16 ejes');
    expect(allOf({ measureUnit: 'eje', measureUnitPlural: 'ejes' }, 1)).toBe('el único eje');
    expect(allOf({ measureUnit: 'propuesta', measureUnitPlural: 'propuestas' }, 1)).toBe('la única propuesta');
  });
});

describe('programBandSentence', () => {
  it('avoids "0 tienen" when a program has no figures and no deadlines', () => {
    expect(
      programBandSentence({
        measureUnit: 'medida',
        measureUnitPlural: 'medidas',
        total: 30,
        withFigures: 0,
        withDeadline: 0,
        withRepeals: 0,
        blockCount: 10,
        sectionCount: 10,
        biggestBlock: 3,
        pendingCount: 0,
      }),
    ).toBe('Ninguna de las 30 medidas concreta cifras ni plazos. Se reparten en 10 bloques y 10 secciones. El bloque más largo tiene 3 medidas.');
  });

  it('uses masculine agreement for compromisos and ejes', () => {
    expect(
      programBandSentence({
        measureUnit: 'compromiso',
        measureUnitPlural: 'compromisos',
        total: 17,
        withFigures: 0,
        withDeadline: 0,
        withRepeals: 0,
        blockCount: 5,
        sectionCount: 5,
        biggestBlock: 6,
        pendingCount: 0,
      }),
    ).toBe('Ninguno de los 17 compromisos concreta cifras ni plazos. Se reparten en 5 bloques y 5 secciones. El bloque más largo tiene 6 compromisos.');

    expect(
      programBandSentence({
        measureUnit: 'eje',
        measureUnitPlural: 'ejes',
        total: 16,
        withFigures: 1,
        withDeadline: 0,
        withRepeals: 0,
        blockCount: 16,
        sectionCount: 16,
        biggestBlock: 1,
        pendingCount: 0,
      }),
    ).toBe('De los 16 ejes, 1 tiene una cifra y ninguno tiene un plazo. Se reparten en 16 bloques y 16 secciones.');
  });

  it('uses natural phrasing when only one of figures or deadlines is zero', () => {
    expect(
      programBandSentence({
        measureUnit: 'propuesta',
        measureUnitPlural: 'propuestas',
        total: 30,
        withFigures: 2,
        withDeadline: 0,
        withRepeals: 0,
        blockCount: 5,
        sectionCount: 5,
        biggestBlock: 6,
        pendingCount: 0,
      }),
    ).toBe('De las 30 propuestas, 2 tienen una cifra y ninguna tiene un plazo. Se reparten en 5 bloques y 5 secciones. El bloque más largo tiene 6 propuestas.');

    expect(
      programBandSentence({
        measureUnit: 'compromiso',
        measureUnitPlural: 'compromisos',
        total: 12,
        withFigures: 0,
        withDeadline: 1,
        withRepeals: 0,
        blockCount: 1,
        sectionCount: 1,
        biggestBlock: 12,
        pendingCount: 0,
      }),
    ).toBe('De los 12 compromisos, ninguno tiene una cifra y 1 tiene un plazo. Se agrupan en un único bloque.');
  });

  it('handles single-measure programs without plural verbs or redundant block text', () => {
    expect(
      programBandSentence({
        measureUnit: 'propuesta',
        measureUnitPlural: 'propuestas',
        total: 1,
        withFigures: 0,
        withDeadline: 0,
        withRepeals: 0,
        blockCount: 1,
        sectionCount: 1,
        biggestBlock: 1,
        pendingCount: 0,
      }),
    ).toBe('La única propuesta no concreta cifras ni plazos.');
  });

  it('handles programs with figures, deadlines, repeals, and pending measures', () => {
    expect(
      programBandSentence({
        measureUnit: 'medida',
        measureUnitPlural: 'medidas',
        total: 249,
        withFigures: 37,
        withDeadline: 13,
        withRepeals: 3,
        blockCount: 4,
        sectionCount: 21,
        biggestBlock: 82,
        pendingCount: 8,
      }),
    ).toBe(
      'De las 249 medidas, 37 tienen una cifra, 13 tienen un plazo y 3 derogan una ley. Se reparten en 4 bloques y 21 secciones. El bloque más largo tiene 82 medidas. Quedan 8 por anunciar durante la campaña.',
    );
  });
});
