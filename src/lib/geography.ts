/** Province outlines and map geometry (`src/data/provincias.json`). */
import { z } from 'astro/zod';
import rawGeography from '../data/provincias.json';

const geographySchema = z
  .object({
    ancho: z.number(),
    alto: z.number(),
    canarias: z.object({ x: z.number(), y: z.number(), ancho: z.number(), alto: z.number() }),
    provincias: z.array(
      z.object({
        codigo: z.string(),
        nombre: z.string(),
        d: z.string(),
        marcador: z
          .object({ x: z.number(), y: z.number(), r: z.number(), rotulo: z.enum(['izquierda', 'derecha']) })
          .optional(),
      }),
    ),
  })
  .transform((raw) => ({
    width: raw.ancho,
    height: raw.alto,
    canaryIslands: { x: raw.canarias.x, y: raw.canarias.y, width: raw.canarias.ancho, height: raw.canarias.alto },
    provinces: raw.provincias.map(({ codigo, nombre, d, marcador }) => ({
      code: codigo,
      name: nombre,
      path: d,
      /** Small provinces (Ceuta, Melilla) get a circle marker and an external label. */
      marker: marcador && {
        x: marcador.x,
        y: marcador.y,
        radius: marcador.r,
        labelSide: marcador.rotulo === 'izquierda' ? ('left' as const) : ('right' as const),
      },
    })),
  }));

export const geography = geographySchema.parse(rawGeography);
export type MapProvince = (typeof geography.provinces)[number];
