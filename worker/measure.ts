/**
 * On-demand renderer for `/<party>/medidas/<n>/` (HTML) and `/<party>/medidas/<n>/index.md` (Markdown).
 *
 * Reads only two lines from `/datos/medidas/<party>.json` (the party header and the line for measure `<n>`),
 * and fills the Astro-built party shell `/datos/medidas/<party>/`. This removes ~18,500 static files from
 * `dist/` while keeping identical HTML, metadata, link previews, and Markdown output.
 */

export interface MeasurePartyHeader {
  id: string;
  acronym: string;
  partyName: string;
  programName: string;
  measureUnit: string;
  measureUnitPlural: string;
  documentUrl: string;
  documentType: 'pdf' | 'web';
  blocks: Record<string, string>;
  sections: Record<string, string>;
  translation: { language: string; notice: string } | null;
}

export type MeasureRow = [
  number: number,
  title: string,
  phraseTitle: string,
  text: string,
  blockId: number,
  sectionId: string,
  categoryId: string,
  categoryName: string,
  deadline: string,
  repeals: string,
  page: number,
  sourceUrl: string,
  targetGroups: string[],
  levers: string[],
  territories: string[],
  figures: string[],
  translation: [title: string, text: string] | null,
  pageTitle: string,
  pageDescription: string,
  shareImagePath: string,
  shareImageAlt: string,
];

const SOURCE_NOTE =
  'El texto de cada medida es el del programa oficial. Las categorías, los plazos y las claves son una clasificación editorial de Electosfera.';

const PARTY_STEP_COUNT = 4;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const splitParagraphs = (text: string) => text.split(/\n\n+/).filter(Boolean);

const measureQuote = (phraseTitle: string) => (phraseTitle.startsWith('«') ? phraseTitle : `«${phraseTitle}»`);

const withBase = (base: string, path: string) => {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return `${base}${path}`;
};

const lineAt = (text: string, start: number) => {
  const end = text.indexOf('\n', start);
  const raw = end < 0 ? text.slice(start) : text.slice(start, end);
  return raw.replace(/,$/, '');
};

/** Parse only the party header and the single measure row from a line-indexed `/datos/medidas/<party>.json` file. */
export function parseMeasureData(text: string, number: string): { header: MeasurePartyHeader; row: MeasureRow } | null {
  const start = text.indexOf(`\n[${number},`);
  if (start < 0) return null;
  const header = JSON.parse(lineAt(text, 2)) as MeasurePartyHeader;
  const row = JSON.parse(lineAt(text, start + 1)) as MeasureRow;
  return { header, row };
}

interface AstroCids {
  page: string;
  card: string;
  chip: string;
  tag: string;
  button: string;
}

function extractCids(templateHtml: string): AstroCids {
  const pick = (pattern: RegExp) => templateHtml.match(pattern)?.[1] ?? '';
  return {
    page: pick(/<section class="measure-page"[^>]*\s(data-astro-cid-[a-z0-9]+)/),
    card: pick(/<article class="measure-card"[^>]*\s(data-astro-cid-[a-z0-9]+)/),
    chip: pick(/<span class="block-chip"[^>]*\s(data-astro-cid-[a-z0-9]+)/),
    tag:
      pick(/\.tag\[(data-astro-cid-[a-z0-9]+)\]/) ||
      pick(/class="[^"]*\btag\b[^"]*"[^>]*\s(data-astro-cid-[a-z0-9]+)/) ||
      pick(/(data-astro-cid-[a-z0-9]+)="true"\s+class="[^"]*\btag\b/),
    button:
      pick(/\.button\[(data-astro-cid-[a-z0-9]+)\]/) ||
      pick(/class="[^"]*\bbutton\b[^"]*"[^>]*\s(data-astro-cid-[a-z0-9]+)/) ||
      pick(/(data-astro-cid-[a-z0-9]+)="true"\s+class="[^"]*\bbutton\b/),
  };
}

const attr = (cid: string) => (cid ? ` ${cid}` : '');

function renderTag(text: string, variant: 'default' | 'ink' | 'bold', cids: AstroCids, href?: string): string {
  const classes = ['tag', variant === 'ink' && 'tag--ink', variant === 'bold' && 'tag--bold', 'tag--sm']
    .filter(Boolean)
    .join(' ');
  const scoped = `${cids.card ? ` ${cids.card}="true"` : ''}${cids.tag ? ` ${cids.tag}="true"` : ''}`;
  if (href) return `<a href="${escapeHtml(href)}"${scoped} class="${classes}">${escapeHtml(text)}</a>`;
  return `<span${scoped} class="${classes}">${escapeHtml(text)}</span>`;
}

/** Render `/<party>/medidas/<n>/` HTML from the Astro-built party shell and one measure row. */
export function renderMeasureHtml(
  templateHtml: string,
  header: MeasurePartyHeader,
  row: MeasureRow,
  origin: string,
  base: string,
): string {
  const [
    number,
    title,
    phraseTitle,
    text,
    blockId,
    sectionId,
    categoryId,
    categoryName,
    deadline,
    repeals,
    page,
    sourceUrl,
    targetGroups,
    levers,
    territories,
    ,
    translationTuple,
    pageTitle,
    pageDescription,
    shareImagePath,
    shareImageAlt,
  ] = row;

  const cids = extractCids(templateHtml);
  const pCid = attr(cids.page);
  const cCid = attr(cids.card);
  const chCid = attr(cids.chip);
  const bCid = cids.page && cids.button ? ` ${cids.page}="true" ${cids.button}="true"` : attr(cids.button);

  const canonicalPath = `${base}/${header.id}/medidas/${number}/`;
  const canonicalUrl = `${origin}${canonicalPath}`;
  const markdownPath = `${base}/${header.id}/medidas/${number}/index.md`;

  const step = ((blockId - 1) % PARTY_STEP_COUNT) + 1;
  const blockColor = `var(--party-${step})`;
  const blockTitle = header.blocks[String(blockId)] ?? '';

  const quote = measureQuote(phraseTitle);
  const h1Class = ['headline', phraseTitle.length > 60 && 'is-long', phraseTitle.length > 110 && 'is-longer']
    .filter(Boolean)
    .join(' ');

  const titleIsCut = phraseTitle.endsWith('…') && title.startsWith(phraseTitle.slice(0, -1).trimEnd());
  const translation = header.translation && translationTuple
    ? {
        language: header.translation.language,
        notice: header.translation.notice,
        title: translationTuple[0],
        text: translationTuple[1],
      }
    : null;

  const documentLink = page ? `${header.documentUrl}#page=${page}` : header.documentUrl;
  const documentLabel = page
    ? `${header.documentType === 'web' ? 'Web oficial' : 'PDF'}, pág. ${page}`
    : header.documentType === 'web'
      ? 'Web oficial'
      : 'PDF';

  const metaHtml = [
    `<span class="block-chip" title="${escapeHtml(`Bloque ${blockId}: ${blockTitle}`)}"${chCid}><i style="background: ${blockColor}"${chCid}></i>${escapeHtml(sectionId)}</span>`,
    renderTag(categoryName, 'ink', cids, withBase(base, `/categorias/${categoryId}/`)),
    deadline ? renderTag(`Plazo: ${deadline}`, 'bold', cids) : '',
    repeals ? renderTag(`Deroga: ${repeals}`, 'bold', cids) : '',
  ]
    .filter(Boolean)
    .join('');

  const paragraphsHtml = splitParagraphs(text)
    .map((paragraph) => `<p${cCid}>${escapeHtml(paragraph)}</p>`)
    .join('');

  const translationHtml = translation
    ? `<details class="measure-card__translation"${cCid}><summary${cCid}>Ver la traducción al castellano <span class="measure-card__translation-tag"${cCid}>automática</span></summary><p class="measure-card__translation-notice"${cCid}>${escapeHtml(translation.notice)}</p><p lang="es"${cCid}><strong${cCid}>${escapeHtml(translation.title)}</strong></p>${splitParagraphs(translation.text)
        .map((paragraph) => `<p lang="es"${cCid}>${escapeHtml(paragraph)}</p>`)
        .join('')}</details>`
    : '';

  const factsRows: string[] = [];
  if (targetGroups.length > 0) {
    factsRows.push(
      `<div${cCid}><dt${cCid}>Colectivos</dt><dd class="measure-card__tags"${cCid}>${targetGroups.map((name) => renderTag(name, 'default', cids)).join('')}</dd></div>`,
    );
  }
  if (levers.length > 0) {
    factsRows.push(
      `<div${cCid}><dt${cCid}>Palancas</dt><dd class="measure-card__tags"${cCid}>${levers.map((name) => renderTag(name, 'default', cids)).join('')}</dd></div>`,
    );
  }
  if (territories.length > 0) {
    factsRows.push(
      `<div${cCid}><dt${cCid}>Territorios</dt><dd class="measure-card__tags"${cCid}>${territories.map((name) => renderTag(name, 'default', cids)).join('')}</dd></div>`,
    );
  }
  const sourceHtml = sourceUrl
    ? `<a href="${escapeHtml(withBase(base, sourceUrl))}" target="_blank" rel="noopener"${cCid}>Ficha oficial</a>`
    : `<a href="${escapeHtml(documentLink)}" target="_blank" rel="noopener"${cCid}>${escapeHtml(documentLabel)}</a>`;
  factsRows.push(`<div${cCid}><dt${cCid}>Fuente</dt><dd${cCid}>${sourceHtml}</dd></div>`);

  const sectionHtml =
    `<section class="measure-page"${pCid}><div class="container"${pCid}>` +
    `<p class="breadcrumb"${pCid}><a href="${escapeHtml(withBase(base, `/${header.id}/`))}"${pCid}>${escapeHtml(header.acronym)}: ${escapeHtml(header.programName)}</a> /` +
    `<a href="${escapeHtml(withBase(base, `/${header.id}/medidas/`))}"${pCid}>${escapeHtml(header.measureUnitPlural)}</a> / ${number}</p>` +
    `<h1 class="${h1Class}"${pCid}>${escapeHtml(quote)}</h1>` +
    `<div class="measure-page__card"${pCid}>` +
    `<article class="measure-card" id="m-${number}" style="--stripe-color: ${blockColor}"${cCid}>` +
    `<details open${cCid}><summary${cCid}>` +
    `<span class="measure-card__number" aria-label="${escapeHtml(`${header.measureUnit} número ${number}`)}"${cCid}>${number}</span>` +
    `<span class="measure-card__body"${cCid}><span class="measure-card__meta"${cCid}>${metaHtml}</span>` +
    `<span class="measure-card__title"${cCid}>${escapeHtml(phraseTitle)}</span></span>` +
    `<span class="measure-card__toggle" aria-hidden="true"${cCid}></span></summary>` +
    `<div class="measure-card__text"${cCid}>` +
    (translation ? `<p class="measure-card__lang"${cCid}>Original en ${escapeHtml(translation.language)}</p>` : '') +
    (titleIsCut ? `<p class="measure-card__full-title"${cCid}>${escapeHtml(title)}</p>` : '') +
    paragraphsHtml +
    translationHtml +
    `<dl class="measure-card__facts"${cCid}>${factsRows.join('')}</dl>` +
    `</div></details></article></div>` +
    `<p class="measure-page__more"${pCid}><a class="button" href="${escapeHtml(withBase(base, `/${header.id}/medidas/#m-${number}`))}"${bCid}>${escapeHtml(`Ver entre las ${header.measureUnitPlural} de ${header.acronym}`)}</a></p>` +
    `</div></section>`;

  const escapedCanonical = escapeHtml(canonicalUrl);
  const escapedMarkdown = escapeHtml(markdownPath);

  let html = templateHtml
    .replaceAll('__MEASURE_TITLE__', escapeHtml(pageTitle))
    .replaceAll('__MEASURE_DESCRIPTION__', escapeHtml(pageDescription))
    .replaceAll('/__MEASURE_IMAGE_PATH__', escapeHtml(shareImagePath))
    .replaceAll('__MEASURE_IMAGE_ALT__', escapeHtml(shareImageAlt))
    .replace(
      /<link rel="canonical" href="[^"]*">/,
      `<link rel="canonical" href="${escapedCanonical}"><link rel="alternate" type="text/markdown" href="${escapedMarkdown}">`,
    )
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapedCanonical}">`);

  html = html.replace(/(<main id="content"[^>]*>)[\s\S]*?(<\/main>)/, (_, open, close) => `${open}${sectionHtml}${close}`);
  return html;
}

/** Render `/<party>/medidas/<n>/index.md`, matching `measureMarkdown` in `src/lib/markdown/measures.ts`. */
export function renderMeasureMarkdown(
  header: MeasurePartyHeader,
  row: MeasureRow,
  origin: string,
  base: string,
): string {
  const [
    number,
    title,
    ,
    text,
    blockId,
    sectionId,
    ,
    categoryName,
    deadline,
    repeals,
    page,
    ,
    ,
    ,
    ,
    figures,
    ,
    pageTitle,
    pageDescription,
  ] = row;

  const canonicalUrl = `${origin}${base}/${header.id}/medidas/${number}/`;
  const partyMdUrl = `${origin}${base}/${header.id}/index.md`;
  const blockMdUrl = `${origin}${base}/${header.id}/bloque/${blockId}/index.md`;
  const blockTitle = header.blocks[String(blockId)];
  const sectionTitle = header.sections[sectionId];

  const details = [
    categoryName,
    deadline && `plazo: ${deadline}`,
    repeals && `deroga: ${repeals}`,
    page && `página ${page} del programa`,
    `[enlace](${canonicalUrl})`,
  ]
    .filter(Boolean)
    .join(' · ');

  const lines = [
    '---',
    `title: ${JSON.stringify(pageTitle)}`,
    `url: ${canonicalUrl}`,
    `description: ${JSON.stringify(pageDescription)}`,
    '---',
    '',
    `# ${header.acronym}, ${header.measureUnit} ${number}: ${oneLine(title)}`,
    '',
    text.trim(),
    '',
    `- Programa: [${header.programName}](${partyMdUrl})`,
    ...(blockTitle ? [`- Bloque ${blockId}: [${oneLine(blockTitle)}](${blockMdUrl})`] : []),
    ...(sectionTitle ? [`- Apartado: ${oneLine(sectionTitle)}`] : []),
    `- ${details}`,
    ...(figures.length ? [`- Cifras: ${figures.join('; ')}`] : []),
    '',
    SOURCE_NOTE,
  ];

  return `${lines.join('\n').trimEnd()}\n`;
}
