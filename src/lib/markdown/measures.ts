/** The Markdown of the pages under a party: the list of its measures, one block and one measure. */
import { blockPageDescription, measurePageDescription, measurePageTitle, measuresPageDescription } from '../seo';
import { announcedMeasures, type Block, type Measure, type Program } from '../programs';
import { routes } from '../routes';
import { categoryById } from '../taxonomy';
import { splitParagraphs } from '../format';
import { absolute, frontMatter, markdownLink, measureDetails, measureLines, oneLine, sourceNote } from './shared';

/** `/<party>/medidas/`: the title of every measure with its category and its link. The full text is in the page of the party. */
export function measuresMarkdown(program: Program, site: URL | undefined): string {
  const measures = announcedMeasures(program);
  const lines = [
    ...frontMatter(
      `${program.acronym}: ${program.measureUnitPlural}`,
      absolute(routes.measures(program.id), site),
      measuresPageDescription(program),
    ),
    `# ${program.partyName} (${program.acronym}): ${program.measureUnitPlural}`,
    '',
    `El programa completo, con el texto de cada medida: ${markdownLink(routes.party(program.id), site)}`,
    '',
  ];
  for (const block of program.blocks) {
    const inBlock = measures.filter((measure) => measure.blockId === block.id);
    if (!inBlock.length) continue;
    lines.push(`## Bloque ${block.id}. ${oneLine(block.title)}`, '');
    for (const measure of inBlock) {
      const category = categoryById[measure.categoryId]?.name;
      const link = markdownLink(routes.measureShare(program.id, measure.number), site);
      lines.push(`- ${measure.number}. [${oneLine(measure.title)}](${link})${category ? ` (${category})` : ''}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** `/<party>/bloque/<id>/`: the introduction of the block and the full text of its measures. */
export function blockMarkdown(program: Program, block: Block, site: URL | undefined): string {
  const measures = announcedMeasures(program).filter((measure) => measure.blockId === block.id);
  const lines = [
    ...frontMatter(
      `${program.acronym}: bloque ${block.id}, ${block.title}`,
      absolute(routes.block(program.id, block.id), site),
      blockPageDescription(program, block),
    ),
    `# ${program.acronym}, bloque ${block.id}. ${oneLine(block.title)}`,
    '',
    `Programa: ${program.programName}. Todas las medidas: ${markdownLink(routes.party(program.id), site)}`,
    '',
  ];
  if (block.motto) lines.push(`**${oneLine(block.motto)}**`, '');
  if (block.quote) lines.push(`> ${oneLine(block.quote)}`, '');
  if (block.intro) lines.push(...splitParagraphs(block.intro).flatMap((paragraph) => [paragraph.trim(), '']));
  lines.push(sourceNote, '');
  for (const section of program.sections.filter((candidate) => candidate.blockId === block.id)) {
    const inSection = measures.filter((measure) => measure.sectionId === section.id);
    if (!inSection.length) continue;
    lines.push(`## ${oneLine(section.title)}`, '');
    for (const measure of inSection) lines.push(...measureLines(program, measure, site, 3));
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** `/<party>/medidas/<n>/`: one measure, with its full text and its details. */
export function measureMarkdown(program: Program, measure: Measure, site: URL | undefined): string {
  const section = program.sections.find((candidate) => candidate.id === measure.sectionId);
  const block = program.blocks.find((candidate) => candidate.id === measure.blockId);
  const lines = [
    ...frontMatter(
      measurePageTitle(program, measure),
      absolute(routes.measureShare(program.id, measure.number), site),
      measurePageDescription(program, measure),
    ),
    `# ${program.acronym}, ${program.measureUnit} ${measure.number}: ${oneLine(measure.title)}`,
    '',
    measure.text.trim(),
    '',
    `- Programa: [${program.programName}](${markdownLink(routes.party(program.id), site)})`,
    ...(block ? [`- Bloque ${block.id}: [${oneLine(block.title)}](${markdownLink(routes.block(program.id, block.id), site)})`] : []),
    ...(section ? [`- Apartado: ${oneLine(section.title)}`] : []),
    `- ${measureDetails(program, measure, site)}`,
    ...(measure.figures.length ? [`- Cifras: ${measure.figures.join('; ')}`] : []),
    '',
    sourceNote,
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
