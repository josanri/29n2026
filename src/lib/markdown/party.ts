/** The Markdown of the page of a party (`/<party>/`): its program, block by block, with the full text of each measure. */
import { keyFindingsByParty } from '@eleccion/analysis';
import { partyPageDescription, partyPageTitle } from '../seo';
import { announcedMeasures, type Program } from '../programs';
import { routes } from '../routes';
import { absolute, electionLine, frontMatter, markdownLink, measureLines, oneLine, sourceNote } from './shared';

export function partyMarkdown(program: Program, site: URL | undefined): string {
  const front = frontMatter(partyPageTitle(program), absolute(routes.party(program.id), site), partyPageDescription(program));
  const head = [`# ${program.partyName} (${program.acronym})`, ''];
  if (!program.hasProgram) return [...front, ...head, partyPageDescription(program), ''].join('\n');

  const measures = announcedMeasures(program);
  const lines = [
    ...front,
    ...head,
    `**${program.programName}**. ${program.subtitle}.`,
    '',
    `- Elección: ${electionLine}.`,
    `- Programa en PDF: ${absolute(program.documentUrl, site)}`,
    ...(program.sourceUrl ? [`- Fuente oficial: ${program.sourceUrl}`] : []),
    `- Todas las medidas, con filtros: ${absolute(routes.measures(program.id), site)}`,
    '',
    sourceNote,
    '',
  ];

  if (program.notes.length) lines.push('## Observaciones', '', ...program.notes.map((note) => `- ${oneLine(note)}`), '');

  const findings = keyFindingsByParty[program.id] ?? [];
  if (findings.length) {
    lines.push('## Las claves', '');
    for (const finding of findings) lines.push(`- **${oneLine(finding.title)}**. ${oneLine(finding.text)}`);
    lines.push('');
  }

  if (program.figures.length) {
    lines.push('## Cifras', '');
    for (const figure of program.figures) {
      lines.push(`- **${figure.value}** ${figure.unit}: ${oneLine(figure.text)} (medida ${figure.measureNumber})`);
    }
    lines.push('');
  }

  if (program.deadlines.length) {
    lines.push('## Plazos', '');
    for (const entry of program.deadlines) lines.push(`- ${entry.deadline}: ${oneLine(entry.text)} (medida ${entry.measureNumber})`);
    lines.push('');
  }

  lines.push(`## Las ${measures.length} ${program.measureUnitPlural}`, '');
  for (const block of program.blocks) {
    const inBlock = measures.filter((measure) => measure.blockId === block.id);
    if (!inBlock.length) continue;
    lines.push(`### Bloque ${block.id}. ${oneLine(block.title)}`, '', `Página del bloque: ${markdownLink(routes.block(program.id, block.id), site)}`, '');
    for (const section of program.sections.filter((candidate) => candidate.blockId === block.id)) {
      const inSection = inBlock.filter((measure) => measure.sectionId === section.id);
      if (!inSection.length) continue;
      lines.push(`#### ${oneLine(section.title)}`, '');
      for (const measure of inSection) lines.push(...measureLines(program, measure, site, 5));
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
