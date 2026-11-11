/**
 * Settings of the fuzzy search in the browser (Fuse.js). Every search box of the site uses them.
 * Always search normalized text: see `normalizeForSearch` in `format.ts`.
 */
import type { IFuseOptions } from 'fuse.js';

/** A query shorter than this is a plain substring search. One letter would match nearly every text. */
export const MIN_FUZZY_LENGTH = 2;

export const fuzzyOptions = {
  // About one error for each three letters of the query.
  threshold: 0.3,
  // A word can be anywhere in a long text.
  ignoreLocation: true,
  minMatchCharLength: MIN_FUZZY_LENGTH,
} satisfies IFuseOptions<unknown>;
