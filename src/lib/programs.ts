/** Party programs: loading, lookup and ordering. */
import { getCollection } from 'astro:content';
import { compareText } from './format';
import type { Program } from './program-schema';

export type { Program, Measure, Block, Section, KeyFigure, DeadlineEntry } from './program-schema';

const entries = await getCollection('programs');

export const programs: Program[] = entries.map((entry) => entry.data).sort((a, b) => compareText(a.acronym, b.acronym));

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
