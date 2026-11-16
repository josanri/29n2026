/**
 * Titles and descriptions of the party pages, for search engines and link previews.
 * A search engine shows the description when it says what the page has; when it is short or generic, it takes a
 * piece of the page instead (the wordmark or the footer). So each description names the party, the election and
 * what the page holds. The party name goes first, so no article is needed («del Partido Popular», «de VOX»).
 */
import { existsSync } from 'node:fs';
import { election } from '@eleccion/eleccion';
import { allOf } from './format';
import { announcedMeasures, type Block, type Measure, type Program } from './programs';
import type { ShareImage } from './site';

/** «Partido Popular (PP)», or just «VOX» when the acronym is the name. */
export const partyLabel = (program: Program) =>
  program.acronym.toLowerCase() === program.partyName.toLowerCase()
    ? program.partyName
    : `${program.partyName} (${program.acronym})`;

/** «elecciones generales del 29 de noviembre de 2026». */
const electionText = `${election.name.toLowerCase()} del ${election.longDate}`;

/** «Partido Popular (PP): Programa electoral 2026»; «Frente Amplio (FA): programa pendiente» without one. */
export const partyPageTitle = (program: Program) =>
  `${partyLabel(program)}: ${program.hasProgram ? program.programName || 'programa electoral' : 'programa pendiente'}`;

export const partyPageDescription = (program: Program) => {
  if (!program.hasProgram) {
    return `${partyLabel(program)} aún no ha publicado su programa para las ${electionText}. Aquí, dónde presenta candidatura al Congreso y al Senado, y el programa en cuanto se publique.`;
  }
  const count = announcedMeasures(program).length;
  return `${partyLabel(program)}, ${electionText}: ${allOf(program, count)} de su programa, por categoría, con sus cifras, sus plazos y el texto original.`;
};

export const measuresPageDescription = (program: Program) => {
  if (!program.hasProgram) return partyPageDescription(program);
  const count = announcedMeasures(program).length;
  return `${partyLabel(program)}: ${allOf(program, count)} de su programa para el ${election.shortName}, con el texto original y filtros por categoría, colectivo y palanca.`;
};

export const blockPageDescription = (program: Program, block: Block) => {
  const count = announcedMeasures(program).filter((measure) => measure.blockId === block.id).length;
  const noun = count === 1 ? program.measureUnit : program.measureUnitPlural;
  return `${partyLabel(program)}, bloque ${block.id} de su programa para el ${election.shortName}: ${block.title}. ${count} ${noun} con su texto original, su categoría y su página en el PDF.`;
};

/** The link preview of a party page: its own card when it has a program (`scripts/og_images.py`), else the site's. */
export const partyShareImage = (program: Program): ShareImage | undefined =>
  program.hasProgram
    ? {
        path: `/og/${program.id}.png`,
        alt: `${partyLabel(program)}: ${program.measures.length} ${program.measureUnitPlural} de su programa para el ${election.shortName}, en Electosfera.`,
      }
    : undefined;

/** The path of the picture of one measure, under the base of the site (`scripts/og_images.py --medida pp:144`). */
const measureImagePath = (program: Program, measure: Measure) => `/og/medidas/${program.id}-${measure.number}.png`;

/**
 * The page of one measure: «Construiremos un millón de viviendas» (PP, medida 144).
 * The picture is a quote of the measure. Only the measures that have one (it is made on demand, because a
 * picture for every measure would weigh tens of megabytes) get it; the others take the card of the party.
 */
export const measurePageTitle = (program: Program, measure: Measure) =>
  `«${measure.phraseTitle}» (${program.acronym}, ${program.measureUnit} ${measure.number})`;

/** The start of the text of the measure, cut at the end of a sentence when it is long. */
export const measureExcerpt = (measure: Measure, max = 200) => {
  const text = measure.text.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentenceEnd = cut.lastIndexOf('. ');
  return sentenceEnd > max / 2 ? cut.slice(0, sentenceEnd + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
};

export const measurePageDescription = (program: Program, measure: Measure) =>
  `${partyLabel(program)}, ${electionText}${measure.page ? `, pág. ${measure.page}` : ''}: ${measureExcerpt(measure)}`;

export const measureShareImage = (program: Program, measure: Measure): ShareImage | undefined =>
  existsSync(`public/${election.id}${measureImagePath(program, measure)}`)
    ? {
        path: measureImagePath(program, measure),
        alt: `«${measure.phraseTitle}»: ${program.measureUnit} ${measure.number} del programa de ${partyLabel(program)}${measure.page ? `, pág. ${measure.page}` : ''}.`,
      }
    : partyShareImage(program);
