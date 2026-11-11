// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// URL pública del sitio. Se usa en el sitemap, en robots.txt y en las URL canónicas.
// En producción: SITE_URL=https://tu-dominio.es npm run build
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      // la búsqueda es una herramienta y el sistema de diseño es una página oculta: no se indexan
      filter: (page) => !page.endsWith('/buscar/') && !page.includes('/design-system'),
      changefreq: 'weekly',
      lastmod: new Date(),
      // el análisis de cada programa y la portada pesan más que las páginas de detalle
      serialize(item) {
        const ruta = new URL(item.url).pathname;
        item.priority = ruta === '/' ? 1 : /^\/[^/]+\/$/.test(ruta) && ruta !== '/categorias/' ? 0.9 : 0.6;
        return item;
      },
    }),
  ],
});
