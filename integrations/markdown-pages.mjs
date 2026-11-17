// @ts-check
/**
 * Markdown for the AI agents (see `src/lib/markdown/shared.ts`).
 * The pages made from data (party, measures, blocks, categories, home) write their own `index.md` with an endpoint.
 * This integration writes the `index.md` of every other page, converting the `<main>` of its built HTML:
 * the information pages, the calendar, the polls, the tests and the tools.
 *
 * A page gets a Markdown file when its HTML has `<link rel="alternate" type="text/markdown">` (`BaseLayout.astro`
 * adds it, unless the page sets `markdown={false}`). So a new page is covered with no other change, and a page that
 * says it has a Markdown version always has the file: the build stops if it does not.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const ALTERNATE = /<link rel="alternate" type="text\/markdown"/;

/**
 * The pages of a folder: every `index.html`, at any depth.
 * @param {string} folder
 * @returns {Generator<string>}
 */
function* pagesIn(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* pagesIn(path);
    else if (entry.name === 'index.html') yield path;
  }
}

/** @type {Record<string, string>} */
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
/** @param {string} text */
const decode = (text) => text.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => ENTITIES[entity]);

/**
 * The `content` of a `<meta>` or the `href` of a `<link>` of the head.
 * @param {string} html
 * @param {RegExp} pattern
 */
const headValue = (html, pattern) => {
  const match = html.match(pattern);
  return match ? decode(match[1]) : '';
};

/**
 * A value in the front matter, quoted: a colon or a quote in the text does not break the YAML.
 * @param {string} value
 */
const yaml = (value) => JSON.stringify(value);

/** @param {URL} site */
function makeConverter(site) {
  const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });
  converter.use(gfm);
  // What an agent cannot read or use: pictures, scripts, controls, dialogs and what the page hides.
  converter.remove(/** @type {any} */ (['script', 'style', 'svg', 'canvas', 'iframe', 'noscript', 'template', 'dialog', 'button', 'input', 'select', 'textarea', 'img']));
  converter.remove((node) => node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true');
  // A list item with no text: the dots of a chart, the marks of a legend.
  converter.remove((node) => node.nodeName === 'LI' && !node.textContent?.trim());
  // Links are absolute: an agent reads the file out of the site. A link to the page itself keeps only its text.
  converter.addRule('absolute-links', {
    filter: 'a',
    replacement: (content, node) => {
      const href = /** @type {HTMLElement} */ (node).getAttribute('href') ?? '';
      const text = content.replace(/\s+/g, ' ').trim();
      if (!text) return '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return text;
      return `[${text}](${new URL(href, site).href})`;
    },
  });
  return converter;
}

/** @returns {import('astro').AstroIntegration} */
export default function markdownPages() {
  /** @type {URL} */
  let site = new URL('http://localhost:4321');
  return {
    name: 'markdown-pages',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (config.site) site = new URL(config.site);
      },
      'astro:build:done': ({ dir }) => {
        const converter = makeConverter(site);
        const folder = fileURLToPath(dir);
        const written = [];
        const failed = [];
        for (const page of pagesIn(folder)) {
          const html = readFileSync(page, 'utf8');
          if (!ALTERNATE.test(html)) continue;
          const target = join(page, '..', 'index.md');
          if (existsSync(target)) continue;
          const main = html.match(/<main[^>]*>([\s\S]*)<\/main>/);
          if (!main) {
            failed.push(page);
            continue;
          }
          const title = headValue(html, /<title>([^<]*)<\/title>/);
          const description = headValue(html, /<meta name="description" content="([^"]*)"/);
          const url = headValue(html, /<link rel="canonical" href="([^"]*)"/);
          // The CSS puts a block between two tags that touch (`<a>CIS</a><span>El País</span>`); in text they need a space.
          const spaced = main[1].replace(/(<\/(?:a|span|small|strong|em|b|abbr)>)(<(?:a|span|small|strong|em|b|abbr)[\s>])/g, '$1 $2');
          const body = converter.turndown(spaced).replace(/\n{3,}/g, '\n\n').trim();
          const front = ['---', `title: ${yaml(title)}`, `url: ${url}`, `description: ${yaml(description)}`, '---', ''];
          // UTF-8 without BOM: the host adds the charset in its headers (`public/comun/_headers`).
          writeFileSync(target, `${front.join('\n')}\n${body}\n`, 'utf8');
          written.push(page);
        }
        if (failed.length) {
          throw new Error(`markdown-pages: estas páginas anuncian Markdown pero no tienen <main>:\n${failed.join('\n')}`);
        }
        console.log(`[markdown-pages] ${written.length} páginas convertidas desde el HTML.`);
      },
    },
  };
}
