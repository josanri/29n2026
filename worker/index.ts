/**
 * The Worker of the site. Cloudflare serves the static site (`dist/`) first; this script runs only for the
 * addresses that are not static files:
 *   /og/tarjetas/<party>.png            the link-preview card of a party
 *   /og/tarjetas/<party>/<n>.png        the link-preview card of one measure
 *   /<party>/medidas/<n>/               the share page of one measure (HTML)
 *   /<party>/medidas/<n>/index.md       the Markdown version of one measure, for AI agents
 * Any other address goes back to the static files (and their 404 page).
 *
 * WhatsApp shows a small square cut from the middle of a wide image, which cuts the text. Its app downloads the image
 * with its own User-Agent («WhatsApp/2.24…»), so for WhatsApp the same address gives a square card (`drawSquareCard`).
 * `?formato=cuadrada` gives the square card to any browser, to look at it.
 *
 * The free plan gives 10 ms of CPU per request. A card takes 1 to 3 ms and a measure page takes under 1 ms:
 * - the letters come already drawn (`og/atlas.bin`, made by `scripts/og_atlas.py`);
 * - the PNG has a palette and its own compressor for runs of one color (`og/png.ts`);
 * - the data is one line of `/og/datos/<party>.json` or `/datos/medidas/<party>.json`, read from the static files
 *   (waiting is not CPU time);
 * - the code is compiled when the isolate starts (`warmUp`), which is startup time (limit 1 s), not request time;
 * - each response is kept in the cache of Cloudflare, so most requests compute nothing.
 * `node scripts/og_card_bench.ts --all` measures the time of every card.
 */
import atlasData from './og/atlas.bin';
import { loadAtlas } from './og/atlas.ts';
import { measureCardPng, partyCardPng, squareMeasureCardPng, squarePartyCardPng, warmUp, type PartyCard } from './og/card.ts';
import { parseMeasureData, renderMeasureHtml, renderMeasureMarkdown } from './measure.ts';

interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}
interface Context {
  waitUntil: (promise: Promise<unknown>) => void;
}

const atlas = loadAtlas(atlasData);
warmUp(atlas);

const CARD = /^(.*)\/og\/tarjetas\/([a-z0-9-]+)(?:\/(\d+))?\.png$/;
const MEASURE_MD = /^(.*)\/([a-z0-9-]+)\/medidas\/(\d+)\/index\.md$/;
const MEASURE_PAGE = /^(.*)\/([a-z0-9-]+)\/medidas\/(\d+)(\/?)$/;

const notFound = () => new Response('No existe esa tarjeta.', { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });

async function drawCard(request: Request, env: Env, base: string, party: string, number: string | undefined, square: boolean) {
  const data = await env.ASSETS.fetch(new URL(`${base}/og/datos/${party}.json`, request.url).href);
  if (!data.ok) return notFound();
  const text = await data.text();
  // «[», then one value per line, each but the last followed by a comma: the party first, then the measures.
  const line = (start: number) => text.slice(start, text.indexOf('\n', start)).replace(/,$/, '');
  const card = JSON.parse(line(2)) as PartyCard;
  let png: Uint8Array;
  if (number === undefined) {
    png = (square ? squarePartyCardPng : partyCardPng)(atlas, card);
  } else {
    // Only the line of this measure is parsed.
    const start = text.indexOf(`\n[${number},`);
    if (start < 0) return notFound();
    const [n, title, excerpt, page] = JSON.parse(line(start + 1)) as [number, string, string, number];
    png = (square ? squareMeasureCardPng : measureCardPng)(atlas, { ...card, number: n, title, excerpt, page: page || undefined });
  }
  return new Response(png as Uint8Array<ArrayBuffer>, {
    headers: {
      'Content-Type': 'image/png',
      // The address carries the version of the data (`?v=`): a new card always has a new address.
      'Cache-Control': new URL(request.url).searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function serveMeasureMarkdown(request: Request, env: Env, base: string, party: string, number: string): Promise<Response> {
  const dataRes = await env.ASSETS.fetch(new URL(`${base}/datos/medidas/${party}.json`, request.url).href);
  if (!dataRes.ok) return env.ASSETS.fetch(request);
  const parsed = parseMeasureData(await dataRes.text(), number);
  if (!parsed) return env.ASSETS.fetch(request);
  const markdown = renderMeasureMarkdown(parsed.header, parsed.row, new URL(request.url).origin, base);
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

async function serveMeasureHtml(request: Request, env: Env, base: string, party: string, number: string): Promise<Response> {
  const [dataRes, templateRes] = await Promise.all([
    env.ASSETS.fetch(new URL(`${base}/datos/medidas/${party}.json`, request.url).href),
    env.ASSETS.fetch(new URL(`${base}/datos/medidas/${party}/`, request.url).href),
  ]);
  if (!dataRes.ok || !templateRes.ok) return env.ASSETS.fetch(request);
  const parsed = parseMeasureData(await dataRes.text(), number);
  if (!parsed) return env.ASSETS.fetch(request);
  const html = renderMeasureHtml(await templateRes.text(), parsed.header, parsed.row, new URL(request.url).origin, base);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

async function cachedResponse(
  cacheKey: Request,
  context: Context,
  produce: () => Promise<Response>,
): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  let response = await cache.match(cacheKey);
  if (!response) {
    response = await produce();
    if (response.ok) context.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
    const url = new URL(request.url);

    const cardMatch = CARD.exec(url.pathname);
    if (cardMatch) {
      const [, base, party, number] = cardMatch;
      const square = url.searchParams.get('formato') === 'cuadrada' || /WhatsApp/i.test(request.headers.get('User-Agent') ?? '');

      // One cache entry per card, version and shape; any other query is ignored.
      const version = (url.searchParams.get('v') ?? '').replace(/[^a-z0-9]/g, '').slice(0, 16);
      const query = [version && `v=${version}`, square && 'formato=cuadrada'].filter(Boolean).join('&');
      const key = new Request(`${url.origin}${url.pathname}${query ? `?${query}` : ''}`);
      const cached = await cachedResponse(key, context, () => drawCard(request, env, base, party, number, square));
      // The same address gives another image to WhatsApp: a cache between the two must keep them apart.
      const response = new Response(cached.body, cached);
      response.headers.set('Vary', 'User-Agent');
      return response;
    }

    const mdMatch = MEASURE_MD.exec(url.pathname);
    if (mdMatch) {
      const [, base, party, number] = mdMatch;
      const key = new Request(`${url.origin}${url.pathname}`);
      return cachedResponse(key, context, () => serveMeasureMarkdown(request, env, base, party, number));
    }

    const pageMatch = MEASURE_PAGE.exec(url.pathname);
    if (pageMatch) {
      const [, base, party, number, slash] = pageMatch;
      if (!slash) {
        return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
      }
      const key = new Request(`${url.origin}${url.pathname}`);
      return cachedResponse(key, context, () => serveMeasureHtml(request, env, base, party, number));
    }

    return env.ASSETS.fetch(request);
  },
};
