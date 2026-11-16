/**
 * The Worker of the site. Cloudflare serves the static site (`dist/`) first; this script runs only for the
 * addresses that are not files, and it draws the link previews:
 *   /og/tarjetas/<party>.png        the card of a party
 *   /og/tarjetas/<party>/<n>.png    the card of one measure
 * Any other address goes back to the static files (and their 404 page).
 *
 * The free plan gives 10 ms of CPU per request. A card takes 1 to 3 ms:
 * - the letters come already drawn (`og/atlas.bin`, made by `scripts/og_atlas.py`);
 * - the PNG has a palette and its own compressor for runs of one color (`og/png.ts`);
 * - the data is one line of `/og/datos/<party>.json`, read from the static files (waiting is not CPU time);
 * - the code is compiled when the isolate starts (`warmUp`), which is startup time (limit 1 s), not request time;
 * - each card is kept in the cache of Cloudflare, so most requests draw nothing.
 * `node scripts/og_card_bench.ts --all` measures the time of every card.
 */
import atlasData from './og/atlas.bin';
import { loadAtlas } from './og/atlas.ts';
import { measureCardPng, partyCardPng, warmUp, type PartyCard } from './og/card.ts';

interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}
interface Context {
  waitUntil: (promise: Promise<unknown>) => void;
}

const atlas = loadAtlas(atlasData);
warmUp(atlas);

const CARD = /^(.*)\/og\/tarjetas\/([a-z0-9-]+)(?:\/(\d+))?\.png$/;

const notFound = () => new Response('No existe esa tarjeta.', { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });

async function drawCard(request: Request, env: Env, base: string, party: string, number: string | undefined) {
  const data = await env.ASSETS.fetch(new URL(`${base}/og/datos/${party}.json`, request.url).href);
  if (!data.ok) return notFound();
  const text = await data.text();
  // «[», then one value per line, each but the last followed by a comma: the party first, then the measures.
  const line = (start: number) => text.slice(start, text.indexOf('\n', start)).replace(/,$/, '');
  const card = JSON.parse(line(2)) as PartyCard;
  let png: Uint8Array;
  if (number === undefined) {
    png = partyCardPng(atlas, card);
  } else {
    // Only the line of this measure is parsed.
    const start = text.indexOf(`\n[${number},`);
    if (start < 0) return notFound();
    const [n, title, excerpt, page] = JSON.parse(line(start + 1)) as [number, string, string, number];
    png = measureCardPng(atlas, { ...card, number: n, title, excerpt, page: page || undefined });
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

export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    const url = new URL(request.url);
    const match = CARD.exec(url.pathname);
    if (!match || (request.method !== 'GET' && request.method !== 'HEAD')) return env.ASSETS.fetch(request);
    const [, base, party, number] = match;

    // One cache entry per card and version; any other query is ignored.
    const version = (url.searchParams.get('v') ?? '').replace(/[^a-z0-9]/g, '').slice(0, 16);
    const key = new Request(`${url.origin}${url.pathname}${version ? `?v=${version}` : ''}`);
    const cache = (caches as unknown as { default: Cache }).default;
    const cached = await cache.match(key);
    if (cached) return cached;

    const response = await drawCard(request, env, base, party, number);
    if (response.ok) context.waitUntil(cache.put(key, response.clone()));
    return response;
  },
};
