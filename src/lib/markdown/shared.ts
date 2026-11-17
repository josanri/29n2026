/**
 * Helpers of the Markdown pages (`src/lib/markdown/`). The pages are for the AI agents that ask for
 * `Accept: text/markdown`. The build writes one `index.md` file next to each page. The host sends the request to that
 * file when the header asks for Markdown. Two sources:
 * - the pages made from data (party, measures, blocks, categories, home) have their own builder here, and an endpoint
 *   `index.md.ts` in `src/pages/`;
 * - every other page is converted from its built HTML by `integrations/markdown-pages.mjs`.
 * The text is the one of the program, without menus, scripts or styles. Every link is absolute.
 */
import { election } from '@eleccion/eleccion';
import type { Measure, Program } from '../programs';
import { routes } from '../routes';
import { categoryById } from '../taxonomy';

/** An absolute URL, so the agent can give it to the reader as it is. */
export const absolute = (path: string, site: URL | undefined) => (site ? new URL(path, site).href : path);

/** The address of the Markdown file of a page: the page address and `index.md`. */
export const markdownPath = (pagePath: string) => `${pagePath.replace(/\/$/, '')}/index.md`;

/** A value in the front matter: quoted, so a colon or a quote in the text does not break the YAML. */
const yaml = (value: string) => JSON.stringify(value);

/** A line of text must not break onto two lines. */
export const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The front matter of a page: the title, the address and the description. */
export const frontMatter = (title: string, url: string, description: string) => [
  '---',
  `title: ${yaml(title)}`,
  `url: ${url}`,
  `description: ${yaml(description)}`,
  '---',
  '',
];

/** The Markdown version of a page of the site, as an absolute link. */
export const markdownLink = (pagePath: string, site: URL | undefined) => absolute(markdownPath(pagePath), site);

/** The line under a measure: category, deadline, repeal, page and the link to its own page. */
export const measureDetails = (program: Program, measure: Measure, site: URL | undefined) =>
  [
    categoryById[measure.categoryId]?.name,
    measure.deadline && `plazo: ${measure.deadline}`,
    measure.repeals && `deroga: ${measure.repeals}`,
    measure.page && `página ${measure.page} del programa`,
    `[enlace](${absolute(routes.measureShare(program.id, measure.number), site)})`,
  ]
    .filter(Boolean)
    .join(' · ');

/** The lines of one measure: heading, full text and details. `level` is the number of «#» of the heading. */
export const measureLines = (program: Program, measure: Measure, site: URL | undefined, level: number) => [
  `${'#'.repeat(level)} ${measure.number}. ${oneLine(measure.title)}`,
  '',
  measure.text.trim(),
  '',
  measureDetails(program, measure, site),
  '',
];

export const electionLine = `${election.name} (${election.date})`;

/** The text under each page, so the reader knows where the words and the labels come from. */
export const sourceNote =
  'El texto de cada medida es el del programa oficial. Las categorías, los plazos y las claves son una clasificación editorial de Electosfera.';

/** The response of an endpoint of Markdown. The charset is in the header: a browser that guesses reads UTF-8 as Latin-1. */
export const markdownResponse = (text: string) =>
  new Response(text, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
