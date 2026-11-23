/** The debates of the election: loading and ordering. Server only (it reads the content collection). */
import { getCollection } from 'astro:content';
import type { Debate } from './debate';

const entries = await getCollection('debates');

/**
 * The debates that the site shows, the newest first. A debate with no date goes last.
 * A draft (`published: false`) shows only on the dev server, so it can be checked before it goes live.
 */
export const debates: Debate[] = entries
  .map((entry) => entry.data)
  .filter((debate) => debate.published !== false || import.meta.env.DEV)
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
