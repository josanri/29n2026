/**
 * Common classification applied to every program: categories, target groups and levers.
 * The JSON keeps Spanish keys; this module maps them to the English model.
 */
import { z } from 'astro/zod';
import rawTaxonomy from '../data/taxonomia.json';

const taxonomySchema = z
  .object({
    categorias: z.array(
      z.object({ id: z.string(), codigo: z.string(), nombre: z.string(), descripcion: z.string() }),
    ),
    colectivos: z.array(z.object({ id: z.string(), nombre: z.string() })),
    palancas: z.array(z.object({ id: z.string(), nombre: z.string(), descripcion: z.string() })),
  })
  .transform((raw) => ({
    categories: raw.categorias.map(({ id, codigo, nombre, descripcion }) => ({
      id,
      code: codigo,
      name: nombre,
      description: descripcion,
    })),
    targetGroups: raw.colectivos.map(({ id, nombre }) => ({ id, name: nombre })),
    levers: raw.palancas.map(({ id, nombre, descripcion }) => ({ id, name: nombre, description: descripcion })),
  }));

const taxonomy = taxonomySchema.parse(rawTaxonomy);

export type Category = (typeof taxonomy.categories)[number];
export type TargetGroup = (typeof taxonomy.targetGroups)[number];
export type Lever = (typeof taxonomy.levers)[number];

export const { categories, targetGroups, levers } = taxonomy;

const indexById = <T extends { id: string }>(items: T[]) =>
  Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, T>;

export const categoryById = indexById(categories);
export const targetGroupById = indexById(targetGroups);
export const leverById = indexById(levers);
