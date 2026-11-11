// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// URL pública del sitio. Se usa en el sitemap, en robots.txt y en las URL canónicas.
// En producción: SITE_URL=https://tu-dominio.es npm run build
// Se usa `||` y no `??`: una variable vacía (como una variable de GitHub sin definir) no es una URL válida.
const SITE_URL = process.env.SITE_URL || 'http://localhost:4321';
// Ruta base del sitio. En GitHub Pages de un repositorio es «/nombre-del-repositorio». En un dominio propio es «/».
const BASE_PATH = process.env.BASE_PATH || '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      // la búsqueda es una herramienta y el sistema de diseño es una página oculta: no se indexan
      filter: (page) => !page.endsWith('/buscar/') && !page.includes('/design-system'),
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
