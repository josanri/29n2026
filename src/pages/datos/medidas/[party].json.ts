/**
 * Compact per-party data for the Worker (`worker/measure.ts`) that renders `/<party>/medidas/<n>/` and
 * `/<party>/medidas/<n>/index.md` on request instead of writing ~18,500 static files into `dist/`.
 *
 * A JSON array with one value per line: first the party metadata object, then one line per announced measure
 * (`[number, ...]`). The Worker locates `\n[<n>,` and parses only two lines, staying well under the 10 ms CPU
 * limit of Cloudflare Workers Free.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { announcedMeasures, publishedPrograms, type Program } from '@/lib/programs';
import { measurePageDescription, measurePageTitle, measureShareImage } from '@/lib/seo';
import { categoryById, leverById, targetGroupById } from '@/lib/taxonomy';
import { translationInfo, translationOf } from '@/lib/translations';

export interface MeasurePartyHeader {
  id: string;
  acronym: string;
  partyName: string;
  programName: string;
  measureUnit: string;
  measureUnitPlural: string;
  documentUrl: string;
  documentType: Program['documentType'];
  blocks: Record<string, string>;
  sections: Record<string, string>;
  translation: { language: string; notice: string } | null;
}

export type MeasureRow = [
  number: number,
  title: string,
  phraseTitle: string,
  text: string,
  blockId: number,
  sectionId: string,
  categoryId: string,
  categoryName: string,
  deadline: string,
  repeals: string,
  page: number,
  sourceUrl: string,
  targetGroups: string[],
  levers: string[],
  territories: string[],
  figures: string[],
  translation: [title: string, text: string] | null,
  pageTitle: string,
  pageDescription: string,
  shareImagePath: string,
  shareImageAlt: string,
];

export const getStaticPaths: GetStaticPaths = () =>
  publishedPrograms
    .filter((program) => announcedMeasures(program).length > 0)
    .map((program) => ({ params: { party: program.id }, props: { program } }));

export const GET: APIRoute = ({ props }) => {
  const { program } = props as { program: Program };
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

  const rows = announcedMeasures(program).map((measure): MeasureRow => {
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

  const lines = [JSON.stringify(header), ...rows.map((row) => JSON.stringify(row))];
  return new Response(`[\n${lines.join(',\n')}\n]\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
