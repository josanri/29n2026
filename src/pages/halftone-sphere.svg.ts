import type { APIRoute } from 'astro';
import { sphereDots } from '@/lib/sphere';

const round = (value: number) => Number(value.toFixed(2));

/**
 * The halftone sphere of the site as a standalone SVG asset: a yellow disc (#ffd23f) with one black dot per measure.
 * Grouping dots by rounded diameter keeps the SVG compact and out of the home page DOM.
 */
export const GET: APIRoute = () => {
  const groups = new Map<string, string[]>();
  for (const dot of sphereDots) {
    const width = String(round(dot.r * 2));
    let list = groups.get(width);
    if (!list) {
      list = [];
      groups.set(width, list);
    }
    list.push(`M${round(dot.x)} ${round(dot.y)}h0`);
  }

  const paths = [...groups.entries()]
    .map(([width, cmds]) => `<path stroke-width="${width}" d="${cmds.join('')}"/>`)
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<circle fill="#ffd23f" cx="50" cy="50" r="50"/>` +
    `<g fill="none" stroke="#000" stroke-linecap="round">${paths}</g>` +
    `</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
