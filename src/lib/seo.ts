/**
 * Titles and descriptions of the party pages, for search engines and link previews.
 * A search engine shows the description when it says what the page has; when it is short or generic, it takes a
 * piece of the page instead (the wordmark or the footer). So each description names the party, the election and
 * what the page holds. The party name goes first, so no article is needed («del Partido Popular», «de VOX»).
 */
import { createHash } from 'node:crypto';
import { election } from '@eleccion/eleccion';
import type { MeasureCard, PartyCard } from '../../worker/og/card.ts';
import { CARD_VERSION } from '../../worker/og/version.ts';
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

/**
 * The link previews are drawn on request by the Worker (`worker/index.ts`), from `/og/datos/<party>.json`.
 * The address ends with a hash of the data of the card: when a title or a color changes, the address changes, and
 * the cache of Cloudflare and of the social networks draw it again.
 */
const cardVersion = (data: unknown) =>
  createHash('sha1').update(JSON.stringify([CARD_VERSION, data])).digest('hex').slice(0, 10);

/** What the card of a party shows. */
export const partyCardData = (program: Program): PartyCard => ({
  acronym: program.acronym,
  name: program.partyName,
  program: program.programName,
  color: program.color,
  lightColor: program.lightColor || program.color,
  count: announcedMeasures(program).length,
  unit: program.measureUnit,
  unitPlural: program.measureUnitPlural,
});

/** What the card of a measure shows: the title as a quote and the start of the text (none when it has no text). */
export const measureCardData = (program: Program, measure: Measure): MeasureCard => ({
  acronym: program.acronym,
  color: program.color,
  lightColor: program.lightColor || program.color,
  unit: program.measureUnit,
  number: measure.number,
  title: measure.phraseTitle || measure.title,
  excerpt: measure.text?.trim() ? measureExcerpt(measure, 190) : '',
  page: measure.page,
});

/** The link preview of a party page: its own card when it has a program, else the site's card. */
export const partyShareImage = (program: Program): ShareImage | undefined =>
  program.hasProgram
    ? {
        path: `/og/tarjetas/${program.id}.png?v=${cardVersion(partyCardData(program))}`,
        alt: `${partyLabel(program)}: ${announcedMeasures(program).length} ${program.measureUnitPlural} de su programa para el ${election.shortName}, en Electosfera.`,
      }
    : undefined;

/** The page of one measure: «Construiremos un millón de viviendas» (PP, medida 144). Its picture is a quote of it. */
export const measurePageTitle = (program: Program, measure: Measure) =>
  `${measureQuote(measure)} (${program.acronym}, ${program.measureUnit} ${measure.number})`;

/** The title of the measure between «», unless it already comes quoted. */
export const measureQuote = (measure: Measure) =>
  measure.phraseTitle.startsWith('«') ? measure.phraseTitle : `«${measure.phraseTitle}»`;

/** The start of the text of the measure, cut at the end of a sentence when it is long. */
export const measureExcerpt = (measure: Measure, max = 200) => {
  // Some programs list a measure with a title and no text: the title is then all there is to quote.
  const text = (measure.text || measure.phraseTitle).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentenceEnd = cut.lastIndexOf('. ');
  return sentenceEnd > max / 2 ? cut.slice(0, sentenceEnd + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
};

export const measurePageDescription = (program: Program, measure: Measure) =>
  `${partyLabel(program)}, ${electionText}${measure.page ? `, pág. ${measure.page}` : ''}: ${measureExcerpt(measure)}`;

export const measureShareImage = (program: Program, measure: Measure): ShareImage => ({
  path: `/og/tarjetas/${program.id}/${measure.number}.png?v=${cardVersion(measureCardData(program, measure))}`,
  alt: `${measureQuote(measure)}: ${program.measureUnit} ${measure.number} del programa de ${partyLabel(program)}${measure.page ? `, pág. ${measure.page}` : ''}.`,
});
