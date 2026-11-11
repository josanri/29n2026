import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { programSchema } from './lib/program-schema';

/** One JSON file per party program. The schema validates it and maps it to the English model. */
const programs = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/programas' }),
  schema: programSchema,
});

export const collections = { programs };
