/**
 * The Markdown version of the pages, for the AI agents that ask for `Accept: text/markdown`.
 * The build writes one `index.md` file next to each page (`src/pages/[party]/index.md.ts`).
 * A rewrite rule of the host sends the request to that file when the header asks for Markdown.
 * The text is the one of the program, without menus, scripts or styles. Every link is absolute.
 */
import { keyFindingsByParty } from '@eleccion/analysis';
import { election } from '@eleccion/eleccion';
import { partyPageDescription, partyPageTitle } from './seo';
import { announcedMeasures, type Measure, type Program } from './programs';
import { routes } from './routes';
import { categoryById } from './taxonomy';

const absolute = (path: string, site: URL | undefined) => (site ? new URL(path, site).href : path);

/** The address of the Markdown file of a page: the page address and `index.md`. */
export const markdownPath = (pagePath: string) => `${pagePath.replace(/\/$/, '')}/index.md`;

/** A value in the front matter: quoted, so a colon or a quote in the text does not break the YAML. */
const yaml = (value: string) => JSON.stringify(value);

/** A heading line must not break onto two lines. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const measureLines = (program: Program, measure: Measure, site: URL | undefined) => {
  const details = [
    categoryById[measure.categoryId]?.name,
    measure.deadline && `plazo: ${measure.deadline}`,
    measure.repeals && `deroga: ${measure.repeals}`,
    measure.page && `página ${measure.page} del programa`,
  ].filter(Boolean);
  return [
    `#### ${measure.number}. ${oneLine(measure.title)}`,
    '',
    measure.text.trim(),
    '',
    `${details.join(' · ')} · [enlace](${absolute(routes.measureShare(program.id, measure.number), site)})`,
    '',
  ];
};

/** The page of a party: its program, block by block, with the full text of each measure. */
export function partyMarkdown(program: Program, site: URL | undefined): string {
  const url = absolute(routes.party(program.id), site);
  const front = [
    '---',
    `title: ${yaml(partyPageTitle(program))}`,
    `url: ${url}`,
    `description: ${yaml(partyPageDescription(program))}`,
    '---',
    '',
  ];
  const head = [`# ${program.partyName} (${program.acronym})`, ''];
  if (!program.hasProgram) {
    return [...front, ...head, partyPageDescription(program), ''].join('\n');
  }

  const measures = announcedMeasures(program);
  const lines = [
    ...front,
    ...head,
    `**${program.programName}**. ${program.subtitle}.`,
    '',
    `- Elección: ${election.name} (${election.date}).`,
    `- Programa en PDF: ${absolute(program.documentUrl, site)}`,
    ...(program.sourceUrl ? [`- Fuente oficial: ${program.sourceUrl}`] : []),
    `- Todas las medidas, con filtros: ${absolute(routes.measures(program.id), site)}`,
    '',
    'El texto de cada medida es el del programa oficial. Las categorías, los plazos y las claves son una clasificación editorial de Electosfera.',
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
    lines.push(`### Bloque ${block.id}. ${oneLine(block.title)}`, '');
    for (const section of program.sections.filter((candidate) => candidate.blockId === block.id)) {
      const inSection = inBlock.filter((measure) => measure.sectionId === section.id);
      if (!inSection.length) continue;
      lines.push(`#### ${oneLine(section.title)}`, '');
      for (const measure of inSection) {
        // Each measure is one level below its section.
        lines.push(...measureLines(program, measure, site).map((line) => (line.startsWith('#### ') ? `#${line}` : line)));
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
