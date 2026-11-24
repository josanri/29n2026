import { describe, expect, it } from 'vitest';
import { breadcrumbStructuredData, jsonLdText, siteStructuredData } from './structured-data';
import { SITE_ALTERNATE_NAMES, SITE_NAME, SOCIAL_ACCOUNTS } from './site';

describe('structured-data', () => {
  it('builds domain-level WebSite and Organization graph', () => {
    const site = new URL('https://electosfera.es/2026/generales/');
    const data = siteStructuredData(site);
    expect(data['@context']).toBe('https://schema.org');

    const graph = data['@graph'] as Record<string, unknown>[];
    expect(graph).toHaveLength(2);

    const [website, organization] = graph;
    expect(website).toMatchObject({
      '@type': 'WebSite',
      '@id': 'https://electosfera.es/#website',
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAMES,
      url: 'https://electosfera.es/',
      inLanguage: 'es-ES',
      publisher: { '@id': 'https://electosfera.es/#organization' },
    });

    expect(organization).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://electosfera.es/#organization',
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAMES,
      url: 'https://electosfera.es/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://electosfera.es/favicon-192.png',
        width: 192,
        height: 192,
      },
      sameAs: SOCIAL_ACCOUNTS.map((account) => account.url),
    });
  });

  it('builds BreadcrumbList with 1-based positions and absolute URLs', () => {
    const site = new URL('https://electosfera.es');
    const data = breadcrumbStructuredData(site, [
      { name: 'Inicio', path: '/2026/generales/' },
      { name: 'Categorías', path: '/2026/generales/categorias/' },
      { name: 'Vivienda' },
    ]);

    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://electosfera.es/2026/generales/' },
        { '@type': 'ListItem', position: 2, name: 'Categorías', item: 'https://electosfera.es/2026/generales/categorias/' },
        { '@type': 'ListItem', position: 3, name: 'Vivienda' },
      ],
    });
  });

  it('escapes < characters so JSON-LD cannot close a script tag', () => {
    const text = jsonLdText({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
