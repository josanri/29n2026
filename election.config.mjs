// @ts-check
// Elección que se compila. Cada elección tiene su carpeta de datos y su carpeta pública:
//   src/data/<año>/<tipo>/   datos (programas, calendario, Congreso, mapa…) y `eleccion.ts`
//   public/<año>/<tipo>/     archivos públicos (PDF, candidaturas, favicon)
// Los archivos comunes a todas las elecciones están en `src/data/` (taxonomía) y en `public/comun/`.
// Otra elección: ELECTION=2027/municipales npm run build
// Las URL públicas no incluyen la elección: la ruta la pone BASE_PATH (astro.config.mjs).

const DEFAULT_ELECTION = '2026/generales';

/** «<año>/<tipo>», por ejemplo «2026/generales» o «2019/generales-10n». */
export const ELECTION = process.env.ELECTION || DEFAULT_ELECTION;

if (!/^\d{4}\/[a-z0-9-]+$/.test(ELECTION)) {
  throw new Error(`ELECTION debe tener la forma «<año>/<tipo>» (por ejemplo «2026/generales»), no «${ELECTION}».`);
}

/** Carpeta de datos de la elección, relativa a la raíz del proyecto. */
export const ELECTION_DATA_DIR = `src/data/${ELECTION}`;
/** Carpeta pública de la elección, relativa a la raíz del proyecto. */
export const ELECTION_PUBLIC_DIR = `public/${ELECTION}`;
/** Archivos públicos comunes a todas las elecciones. */
export const SHARED_PUBLIC_DIR = 'public/comun';
