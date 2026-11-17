/** The Markdown of the pages that cover every party: the home page, the categories, one category and the topics. */
import { election } from '@eleccion/eleccion';
import { partiesData } from '../agent-data';
import { DEFAULT_DESCRIPTION } from '../site';
import { announcedMeasures, programs, publishedFirst, publishedPrograms, totalMeasures, type Program } from '../programs';
import { nationalPrograms, presenceOf } from '../presence';
import { routes } from '../routes';
import { categories, type Category } from '../taxonomy';
import { compareText, formatNumber } from '../format';
import { tools } from '../tools';
import { absolute, frontMatter, markdownLink, oneLine, sourceNote } from './shared';

/** «PP (Partido Popular): 442 medidas, link». One line of the list of parties. */
const partyLine = (program: Program, site: URL | undefined) => {
  const link = markdownLink(routes.party(program.id), site);
  if (!program.hasProgram) return `- [${program.acronym}](${link}): ${program.partyName}. Programa pendiente.`;
  const count = announcedMeasures(program).length;
  return `- [${program.acronym}](${link}): ${program.partyName}, «${program.programName}». ${formatNumber(count)} ${count === 1 ? program.measureUnit : program.measureUnitPlural}.`;
};

/** `/`: what the site is, the parties with their programs, the categories and the tools. */
export function homeMarkdown(site: URL | undefined): string {
  const national = new Set(nationalPrograms.map((program) => program.id));
  const regionalOf = (program: Program) => presenceOf(program).regions.join(', ');
  const lines = [
    ...frontMatter('Los programas, medida a medida', absolute(routes.home(), site), DEFAULT_DESCRIPTION),
    '# Electosfera: los programas, medida a medida',
    '',
    DEFAULT_DESCRIPTION,
    '',
    `- Elección: ${election.name} (${election.date}).`,
    `- ${formatNumber(publishedPrograms.length)} programas publicados de ${formatNumber(programs.length)} partidos.`,
    `- ${formatNumber(totalMeasures)} medidas en total.`,
    '',
    sourceNote,
    '',
    '## Partidos de ámbito estatal',
    '',
    ...publishedFirst(programs.filter((program) => national.has(program.id))).map((program) => partyLine(program, site)),
    '',
    '## Partidos de ámbito autonómico y provincial',
    '',
    ...publishedFirst(programs.filter((program) => !national.has(program.id))).map((program) => {
      const regions = regionalOf(program);
      return `${partyLine(program, site)}${regions ? ` Se presenta en: ${regions}.` : ''}`;
    }),
    '',
    '## Categorías',
    '',
    ...categories.map((category) => `- [${category.name}](${markdownLink(routes.category(category.id), site)}): ${oneLine(category.description)}`),
    '',
    '## Otras formas de mirar la elección',
    '',
    ...tools.map((tool) => `- [${tool.name}](${markdownLink(tool.href, site)}): ${tool.text}`),
    '',
    '## Datos para agentes',
    '',
    `- Lista de partidos, categorías y temas que dividen, en JSON: ${absolute(routes.agentParties(), site)}`,
    `- Un programa completo, en JSON: ${absolute(routes.agentProgram('<partido>'), site)}`,
    '',
  ];
  return lines.join('\n');
}

/** `/categorias/`: for each category, its description, its total and the parties that have the most measures in it. */
export function categoriesMarkdown(site: URL | undefined): string {
  const comparable = publishedPrograms.filter((program) => announcedMeasures(program).length > 0);
  const description = 'Las medidas de todos los programas agrupadas por categoría temática.';
  const lines = [
    ...frontMatter('Categorías', absolute(routes.categories(), site), description),
    '# Categorías',
    '',
    `${description} ${comparable.length} programas con medidas.`,
    '',
  ];
  for (const category of categories) {
    const counts = comparable
      .map((program) => ({
        program,
        count: announcedMeasures(program).filter((measure) => measure.categoryId === category.id).length,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || compareText(a.program.acronym, b.program.acronym));
    const total = counts.reduce((sum, entry) => sum + entry.count, 0);
    lines.push(
      `## [${category.name}](${markdownLink(routes.category(category.id), site)})`,
      '',
      oneLine(category.description),
      '',
      `${formatNumber(total)} medidas. Por partido: ${counts.map((entry) => `${entry.program.acronym} ${entry.count}`).join(', ')}.`,
      '',
    );
  }
  return lines.join('\n');
}

/** `/categorias/<id>/`: the measures of one category, by party, with the link of each one. */
export function categoryMarkdown(category: Category, site: URL | undefined): string {
  const groups = programs
    .map((program) => ({ program, measures: announcedMeasures(program).filter((measure) => measure.categoryId === category.id) }))
    .filter((group) => group.measures.length > 0)
    .sort((a, b) => b.measures.length - a.measures.length || compareText(a.program.acronym, b.program.acronym));
  const total = groups.reduce((sum, group) => sum + group.measures.length, 0);
  const description = `Medidas sobre ${category.name.toLowerCase()} en los programas electorales del ${election.shortName}.`;
  const lines = [
    ...frontMatter(category.name, absolute(routes.category(category.id), site), description),
    `# ${category.name}`,
    '',
    oneLine(category.description),
    '',
    `${formatNumber(total)} medidas en ${groups.length} programas. Todas las categorías: ${markdownLink(routes.categories(), site)}`,
    '',
  ];
  for (const { program, measures } of groups) {
    lines.push(`## ${program.partyName} (${program.acronym}): ${measures.length}`, '');
    for (const measure of measures) {
      lines.push(`- ${measure.number}. [${oneLine(measure.title)}](${markdownLink(routes.measureShare(program.id, measure.number), site)})`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** `/tests/temas/`: the stance of each party on every topic that divides. The page hides them until the reader answers. */
export function topicsMarkdown(site: URL | undefined): string {
  const { temas } = partiesData(site);
  const description = `${temas.length} debates con dos posturas opuestas y lo que dice cada programa.`;
  const lines = [
    ...frontMatter('Temas que dividen', absolute(routes.topicQuiz(), site), description),
    '# Temas que dividen',
    '',
    description,
    '',
    'La postura de cada partido la deciden los textos de las posturas A y B. «Con matices»: el programa trata el tema sin tomar del todo una de las dos. La nota resume la postura; las medidas son la prueba.',
    '',
  ];
  for (const topic of temas) {
    lines.push(
      `## ${oneLine(topic.titulo)}`,
      '',
      `**${oneLine(topic.pregunta)}**`,
      '',
      `- A, ${oneLine(topic.a.etiqueta)}: ${oneLine(topic.a.texto)}`,
      `- B, ${oneLine(topic.b.etiqueta)}: ${oneLine(topic.b.texto)}`,
      '',
      '### Qué dice cada programa',
      '',
    );
    for (const stance of topic.posturas) {
      const proof = stance.medidas.map((measure) => `[${measure.n}](${markdownLink(routes.measureShare(stance.partido, measure.n), site)})`);
      lines.push(`- ${stance.siglas}, ${oneLine(stance.postura)}: ${oneLine(stance.nota)}${proof.length ? ` Medidas: ${proof.join(', ')}.` : ''}`);
    }
    if (topic.sinPostura.length) lines.push('', `Sin postura en su programa: ${topic.sinPostura.join(', ')}.`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
