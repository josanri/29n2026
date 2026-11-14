/** Party programs: loading, lookup and ordering. */
import { getCollection } from 'astro:content';
import { compareText } from './format';
import type { Measure, Program } from './program-schema';
import { withReview } from './review';

export type { Program, Measure, Block, Section, KeyFigure, DeadlineEntry } from './program-schema';

const entries = await getCollection('programs');

// Each program goes through the review: corrected categories and repeals.
export const programs: Program[] = entries.map((entry) => withReview(entry.data)).sort((a, b) => compareText(a.acronym, b.acronym));

export function getProgram(id: string): Program {
  const program = programs.find((candidate) => candidate.id === id);
  if (!program) throw new Error(`Unknown program: ${id}`);
  return program;
}

/** Parties with a published program first, then the others. Each group is sorted by acronym. */
export const publishedFirst = (list: Program[]) =>
  [...list].sort(
    (a, b) => Number(!a.hasProgram) - Number(!b.hasProgram) || compareText(a.acronym, b.acronym),
  );

export const publishedPrograms = programs.filter((program) => program.hasProgram);

/*
 * The one source of truth for counting measures. A number that a program reserves for a measure it has not
 * announced yet (`isPending`, 8 in the PP program) is not a measure. Every count across programs (the home
 * page, the sphere, the search, the categories, the cards, «Sin siglas») takes its measures from here, so all
 * the pages give the same total. The page of one program keeps the program's own numbering and shows the
 * reserved numbers as «pendiente de anunciar».
 */
/** `true` when the program has announced the measure. */
export const isAnnounced = (measure: Measure) => !measure.isPending;
/** The announced measures of one program. */
export const announcedMeasures = (program: Program): Measure[] => program.measures.filter(isAnnounced);
/** The announced measures of all the programs. */
export const allMeasures: Measure[] = programs.flatMap(announcedMeasures);
/** The number of announced measures of all the programs. */
export const totalMeasures = allMeasures.length;
