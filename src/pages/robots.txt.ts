import type { APIRoute } from 'astro';
import { routes } from '@/lib/routes';

// robots.txt is generated at build time: it points to the sitemap using the `site` URL and the base path.
export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL(routes.asset('/sitemap-index.xml'), site).href;
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
