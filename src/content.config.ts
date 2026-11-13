import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { programSchema } from './lib/program-schema';
import { ELECTION_DATA_DIR } from '../election.config.mjs';

/** One JSON file per party program. The schema validates it and maps it to the English model. */
const programs = defineCollection({
  loader: glob({ pattern: '*.json', base: `./${ELECTION_DATA_DIR}/programas` }),
  schema: programSchema,
});

export const collections = { programs };
