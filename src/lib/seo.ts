/**
 * Titles and descriptions of the party pages, for search engines and link previews.
 * A search engine shows the description when it says what the page has; when it is short or generic, it takes a
 * piece of the page instead (the wordmark or the footer). So each description names the party, the election and
 * what the page holds. The party name goes first, so no article is needed («del Partido Popular», «de VOX»).
 */
import { election } from '@eleccion/eleccion';
import { allOf } from './format';
import { announcedMeasures, type Block, type Program } from './programs';
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
