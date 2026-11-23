import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { programSchema } from './lib/program-schema';
import { debateSchema } from './lib/debate';
import { ELECTION_DATA_DIR } from '../election.config.mjs';

/** One JSON file per party program. The schema validates it and maps it to the English model.
 *  Astro caches parsed entries and only clears them when this file changes: after editing
 *  `program-schema.ts`, touch this line too (schema v2: «documents»). */
const programs = defineCollection({
  loader: glob({ pattern: '*.json', base: `./${ELECTION_DATA_DIR}/programas` }),
  schema: programSchema,
});

/** One JSON file per debate, written by `scripts/`. Read it with `debates` from `@/lib/debates`.
 *  The same cache rule applies: after editing the schema in `debate.ts`, touch this line too (schema v1). */
const debates = defineCollection({
  loader: glob({ pattern: '*.json', base: `./${ELECTION_DATA_DIR}/debates` }),
  schema: debateSchema,
});

export const collections = { programs, debates };
