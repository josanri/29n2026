import { describe, expect, it } from 'vitest';
import { measureMarkdown } from '@/lib/markdown';
import { announcedMeasures, getProgram } from '@/lib/programs';
import { measurePageDescription, measurePageTitle, measureShareImage } from '@/lib/seo';
import { categoryById, leverById, targetGroupById } from '@/lib/taxonomy';
import { translationInfo, translationOf } from '@/lib/translations';
import {
  parseMeasureData,
  renderMeasureHtml,
  renderMeasureMarkdown,
  type MeasurePartyHeader,
  type MeasureRow,
} from '../../worker/measure.ts';

function buildPartyPayload(partyId: string) {
  const program = getProgram(partyId);
  const header: MeasurePartyHeader = {
    id: program.id,
    acronym: program.acronym,
    partyName: program.partyName,
    programName: program.programName,
    measureUnit: program.measureUnit,
    measureUnitPlural: program.measureUnitPlural,
    documentUrl: program.documentUrl,
    documentType: program.documentType,
    blocks: Object.fromEntries(program.blocks.map((block) => [String(block.id), block.title])),
    sections: Object.fromEntries(program.sections.map((section) => [section.id, section.title])),
    translation: translationInfo(program.id),
  };
  const rows: MeasureRow[] = announcedMeasures(program).map((measure) => {
    const shareImage = measureShareImage(program, measure);
    const translation = translationOf(program.id, measure.number);
    return [
      measure.number,
      measure.title,
      measure.phraseTitle,
      measure.text,
      measure.blockId,
      measure.sectionId,
      measure.categoryId,
      categoryById[measure.categoryId]?.name ?? measure.categoryId,
      measure.deadline ?? '',
      measure.repeals ?? '',
      measure.page ?? 0,
      measure.sourceUrl ?? '',
      measure.targetGroupIds.map((id) => targetGroupById[id]?.name ?? id),
      measure.leverIds.map((id) => leverById[id]?.name ?? id),
      measure.territories,
      measure.figures,
      translation ? [translation.title, translation.text] : null,
      measurePageTitle(program, measure),
      measurePageDescription(program, measure),
      shareImage.path,
      shareImage.alt,
    ];
  });
  return {
    program,
    text: `[\n${[JSON.stringify(header), ...rows.map((row) => JSON.stringify(row))].join(',\n')}\n]\n`,
  };
}

describe('worker measure rendering', () => {
  it('parses only the requested measure row and returns null for unknown numbers', () => {
    const { text } = buildPartyPayload('pp');
    const parsed = parseMeasureData(text, '1');
    expect(parsed).not.toBeNull();
    expect(parsed!.header.id).toBe('pp');
    expect(parsed!.row[0]).toBe(1);
    expect(parseMeasureData(text, '999999')).toBeNull();
  });

  it('matches measureMarkdown byte-for-byte', () => {
    const site = new URL('https://electosfera.es');
    const { program, text } = buildPartyPayload('pp');
    for (const measure of announcedMeasures(program).slice(0, 5)) {
      const parsed = parseMeasureData(text, String(measure.number));
      expect(parsed).not.toBeNull();
      const actual = renderMeasureMarkdown(parsed!.header, parsed!.row, site.origin, '');
      const expected = measureMarkdown(program, measure, site);
      expect(actual).toBe(expected);
    }
  });

  it('renders measure HTML into the Astro party shell with scoped cids and metadata', () => {
    const { text } = buildPartyPayload('pp');
    const parsed = parseMeasureData(text, '1')!;
    const template =
      '<!DOCTYPE html><html lang="es"><head>' +
      '<title>__MEASURE_TITLE__ | Electosfera</title>' +
      '<meta name="description" content="__MEASURE_DESCRIPTION__">' +
      '<link rel="canonical" href="https://electosfera.es/2026/generales/datos/medidas/pp/">' +
      '<meta property="og:title" content="__MEASURE_TITLE__ | Electosfera">' +
      '<meta property="og:url" content="https://electosfera.es/2026/generales/datos/medidas/pp/">' +
      '<meta property="og:image" content="https://electosfera.es/2026/generales/__MEASURE_IMAGE_PATH__">' +
      '<meta property="og:image:alt" content="__MEASURE_IMAGE_ALT__">' +
      '<style>.button[data-astro-cid-btn1]{}.tag[data-astro-cid-tag1]{}</style>' +
      '</head><body><main id="content">' +
      '<section class="measure-page" data-astro-cid-page1><article class="measure-card" data-astro-cid-card1>' +
      '<span class="block-chip" data-astro-cid-chip1></span></article></section>' +
      '</main></body></html>';

    const html = renderMeasureHtml(template, parsed.header, parsed.row, 'https://electosfera.es', '/2026/generales');
    expect(html).not.toContain('__MEASURE_TITLE__');
    expect(html).not.toContain('__MEASURE_DESCRIPTION__');
    expect(html).not.toContain('__MEASURE_IMAGE_PATH__');
    expect(html).not.toContain('__MEASURE_IMAGE_ALT__');
    expect(html).toContain('<link rel="canonical" href="https://electosfera.es/2026/generales/pp/medidas/1/">');
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/2026/generales/pp/medidas/1/index.md">');
    expect(html).toContain('https://electosfera.es/2026/generales/og/tarjetas/pp/1.png?v=');
    expect(html).toContain('data-astro-cid-page1');
    expect(html).toContain('data-astro-cid-card1');
    expect(html).toContain('data-astro-cid-chip1');
    expect(html).toContain('data-astro-cid-tag1="true"');
    expect(html).toContain('data-astro-cid-btn1="true"');
  });
});
