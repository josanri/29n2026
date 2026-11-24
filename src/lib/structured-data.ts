/**
 * Structured data (JSON-LD) of the site, for search engines.
 *
 * Google reads `WebSite.name` to choose the site name in the results, and `Organization` to know that
 * «Electosfera» is a brand and not a typo of «electrosfera». `sameAs` joins the site to its accounts on social
 * networks, which are also sources of the AI Overviews.
 *
 * Both `WebSite.url` and `Organization.url` use the root of the domain (`https://electosfera.es/`), even when an
 * election lives under a base path (`/2026/generales/`): Google Search only supports site names at the domain level,
 * and the organization represents the brand across all elections.
 * See https://developers.google.com/search/docs/appearance/site-names and
 * https://developers.google.com/search/docs/appearance/structured-data/organization
 */
import { DEFAULT_DESCRIPTION, SITE_ALTERNATE_NAMES, SITE_NAME, SOCIAL_ACCOUNTS } from '@/lib/site';
import { routes } from '@/lib/routes';

export interface BreadcrumbItem {
  name: string;
  path?: string;
}

/** The graph of the home page: the site and the organization that publishes it. */
export function siteStructuredData(site: URL): Record<string, unknown> {
  const rootUrl = new URL('/', site).href;
  const organizationId = `${rootUrl}#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${rootUrl}#website`,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: rootUrl,
        description: DEFAULT_DESCRIPTION,
        inLanguage: 'es-ES',
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: rootUrl,
        // A square picture of at least 112 × 112 px that Google can index (not an SVG).
        logo: {
          '@type': 'ImageObject',
          url: new URL(routes.asset('/favicon-192.png'), site).href,
          width: 192,
          height: 192,
        },
        sameAs: SOCIAL_ACCOUNTS.map((account) => account.url),
      },
    ],
  };
}

/** Breadcrumb trail (`BreadcrumbList`) for interior pages. The last item can omit `path` (the current page). */
export function breadcrumbStructuredData(site: URL, items: readonly BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: new URL(item.path, site).href } : {}),
    })),
  };
}

/** The JSON for a `<script type="application/ld+json">`. `<` is escaped so the text cannot close the script. */
export function jsonLdText(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
