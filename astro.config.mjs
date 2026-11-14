// @ts-check
import { cpSync, createReadStream, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { ELECTION_DATA_DIR, ELECTION_PUBLIC_DIR, SHARED_PUBLIC_DIR } from './election.config.mjs';

// URL pública del sitio. Se usa en el sitemap, en robots.txt y en las URL canónicas.
// En producción: SITE_URL=https://electosfera.es npm run build (ver «Dominio propio» en el README)
// Se usa `||` y no `??`: una variable vacía (como una variable de GitHub sin definir) no es una URL válida.
const SITE_URL = process.env.SITE_URL || 'http://localhost:4321';
// Ruta base del sitio. En GitHub Pages de un repositorio es «/nombre-del-repositorio». En un dominio propio es «/».
// Si cada elección vive en su ruta, por ejemplo «/2026/generales», BASE_PATH es esa ruta.
const BASE_PATH = process.env.BASE_PATH || '/';
// Ruta base sin la barra final («/2026/generales»; «» en la raíz).
const BASE_PREFIX = BASE_PATH.replace(/\/$/, '');

// Con NESTED_OUTPUT=1, la web se compila en «dist/<ruta base>/» y no en «dist/».
// Cloudflare sirve «dist/» desde la raíz del dominio: la petición «/2026/generales/pp/» busca
// «dist/2026/generales/pp/index.html». En GitHub Pages, la ruta del repositorio ya es el prefijo: allí no se usa.
const NESTED_OUTPUT = process.env.NESTED_OUTPUT === '1' && BASE_PREFIX !== '';
const ROOT_DIR = new URL('./dist/', import.meta.url);

/** Archivos comunes a todas las elecciones (por ejemplo «_headers»). */
const SHARED_DIR = fileURLToPath(new URL(`./${SHARED_PUBLIC_DIR}/`, import.meta.url));
/** @type {Record<string, string>} */
const CONTENT_TYPES = { '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

/**
 * Astro solo tiene una carpeta pública: la de la elección («public/<año>/<tipo>/»).
 * Esta integración añade la carpeta común: la sirve en desarrollo y la copia en la compilación.
 * Un archivo de la elección con el mismo nombre tiene prioridad.
 * @type {import('astro').AstroIntegration}
 */
const sharedPublic = {
  name: 'shared-public',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
        const relative = path.startsWith(`${BASE_PREFIX}/`) ? path.slice(BASE_PREFIX.length + 1) : null;
        const file = relative && !relative.includes('..') ? `${SHARED_DIR}${relative}` : null;
        if (!file || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    'astro:build:done': ({ dir }) => {
      cpSync(SHARED_DIR, fileURLToPath(dir), { recursive: true, force: false });
    },
  },
};

/**
 * Archivos que Cloudflare solo lee en la raíz de «dist/». Con NESTED_OUTPUT, esta integración:
 * - mueve «_headers» a la raíz y pone la ruta base delante de cada ruta (menos «/*»);
 * - crea «_redirects»: la raíz del dominio y los niveles intermedios van a la elección (302, temporal);
 * - copia «robots.txt» a la raíz, donde lo buscan los buscadores.
 * @type {import('astro').AstroIntegration}
 */
const nestedOutput = {
  name: 'nested-output',
  hooks: {
    // Astro solo vacía «dist/<ruta base>/»: una compilación anterior en la raíz de «dist/» se quedaría allí.
    'astro:build:start': () => rmSync(ROOT_DIR, { recursive: true, force: true }),
    'astro:build:done': ({ dir }) => {
      const headers = new URL('_headers', dir);
      if (existsSync(headers)) {
        const prefixed = readFileSync(headers, 'utf8').replace(/^\/(?!\*$)(\S*)$/gm, `${BASE_PREFIX}/$1`);
        writeFileSync(new URL('_headers', ROOT_DIR), prefixed);
        rmSync(headers);
      }

      // «/2026/generales» → «/», «/2026», «/2026/»: cada nivel por encima de la elección lleva a ella.
      const levels = BASE_PREFIX.split('/').slice(1, -1);
      const parents = ['/', ...levels.map((_, i) => `/${levels.slice(0, i + 1).join('/')}`)];
      const redirects = parents
        .flatMap((path) => (path === '/' ? [path] : [path, `${path}/`]))
        .map((path) => `${path} ${BASE_PREFIX}/ 302`);
      writeFileSync(new URL('_redirects', ROOT_DIR), `${redirects.join('\n')}\n`);

      const robots = new URL('robots.txt', dir);
      if (existsSync(robots)) writeFileSync(new URL('robots.txt', ROOT_DIR), readFileSync(robots));
    },
  },
};

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  outDir: NESTED_OUTPUT ? `./dist${BASE_PREFIX}` : './dist',
  publicDir: `./${ELECTION_PUBLIC_DIR}`,
  trailingSlash: 'ignore',
  vite: {
    // «@eleccion/…» apunta a la carpeta de datos de la elección que se compila.
    // tsconfig.json repite el alias con la elección por defecto, para los tipos del editor.
    resolve: { alias: { '@eleccion': fileURLToPath(new URL(`./${ELECTION_DATA_DIR}`, import.meta.url)) } },
  },
  integrations: [
    // Primero la carpeta común: nested-output mueve después su «_headers» a la raíz.
    sharedPublic,
    ...(NESTED_OUTPUT ? [nestedOutput] : []),
    sitemap({
      // la búsqueda es una herramienta y el sistema de diseño es una página oculta: no se indexan
      // «/sin-siglas/» es la dirección antigua del test: solo redirige a «/tests/sin-siglas/»
      filter: (page) =>
        !page.endsWith('/buscar/') &&
        !page.includes('/design-system') &&
        !(page.endsWith('/sin-siglas/') && !page.endsWith('/tests/sin-siglas/')),
      // (la ruta base se añade sola a las URL del sitemap)
      changefreq: 'weekly',
      lastmod: new Date(),
      // el análisis de cada programa y la portada pesan más que las páginas de detalle
      serialize(item) {
        // la ruta sin la ruta base, para que «/» siga siendo la portada en GitHub Pages
        const base = BASE_PATH.replace(/\/$/, '');
        const ruta = new URL(item.url).pathname.slice(base.length) || '/';
        item.priority = ruta === '/' ? 1 : /^\/[^/]+\/$/.test(ruta) && ruta !== '/categorias/' ? 0.9 : 0.6;
        return item;
      },
    }),
  ],
});
