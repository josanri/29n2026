/** The Markdown version of the page of one category, for the AI agents. See `src/lib/markdown/`. */
import type { APIRoute } from 'astro';
import { categoryMarkdown, markdownResponse } from '@/lib/markdown';
import { categories, categoryById } from '@/lib/taxonomy';

export function getStaticPaths() {
  return categories.map((category) => ({ params: { id: category.id } }));
}

export const GET: APIRoute = ({ params, site }) => markdownResponse(categoryMarkdown(categoryById[params.id!], site));
