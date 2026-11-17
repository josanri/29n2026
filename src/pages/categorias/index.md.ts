/** The Markdown version of the page of the categories, for the AI agents. See `src/lib/markdown/`. */
import type { APIRoute } from 'astro';
import { categoriesMarkdown, markdownResponse } from '@/lib/markdown';

export const GET: APIRoute = ({ site }) => markdownResponse(categoriesMarkdown(site));
