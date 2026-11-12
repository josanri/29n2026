/** Province outlines and map geometry (`src/data/provincias.json`). */
import { z } from 'astro/zod';
import rawGeography from '../data/provincias.json';

/** Island provinces: Illes Balears, Las Palmas and Santa Cruz de Tenerife. */
const ISLAND_PROVINCES = new Set(['07', '35', '38']);

/**
 * Extra width, in map units, around the small shapes that react to the pointer: the circle around each city,
 * and an invisible border around each island. The nearest islands of two provinces are 28 units apart.
 */
export const MAP_HIT_MARGIN = 8;

const geographySchema = z
  .object({
    ancho: z.number(),
    alto: z.number(),
    canarias: z.object({ x: z.number(), y: z.number(), ancho: z.number(), alto: z.number() }),
    ciudades: z.object({ x: z.number(), y: z.number(), ancho: z.number(), alto: z.number() }),
    provincias: z.array(
      z.object({
        codigo: z.string(),
        nombre: z.string(),
        d: z.string(),
        marcador: z
          .object({ x: z.number(), y: z.number(), r: z.number(), rotuloY: z.number() })
          .optional(),
      }),
    ),
  })
  .transform((raw) => ({
    width: raw.ancho,
    height: raw.alto,
    canaryIslands: { x: raw.canarias.x, y: raw.canarias.y, width: raw.canarias.ancho, height: raw.canarias.alto },
    /** The inset frame of Ceuta and Melilla. */
    cityInset: { x: raw.ciudades.x, y: raw.ciudades.y, width: raw.ciudades.ancho, height: raw.ciudades.alto },
    provinces: raw.provincias.map(({ codigo, nombre, d, marcador }) => ({
      code: codigo,
      name: nombre,
      path: d,
      /**
       * Cities (Ceuta, Melilla) sit in an inset. `x`, `y` and `radius` are the circle that holds their outline:
       * the reader can point at that circle. `labelY` is the baseline of the label under the city.
       */
      marker: marcador && { x: marcador.x, y: marcador.y, radius: marcador.r, labelY: marcador.rotuloY },
      /** Islands get an invisible border that reacts to the pointer, because some islands are very small. */
      isIsland: ISLAND_PROVINCES.has(codigo),
    })),
  }));

export const geography = geographySchema.parse(rawGeography);
export type MapProvince = (typeof geography.provinces)[number];
