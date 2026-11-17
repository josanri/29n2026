/** The Markdown version of «Temas que dividen», with the stances that the page hides until the reader answers. See `src/lib/markdown/`. */
import type { APIRoute } from 'astro';
import { markdownResponse, topicsMarkdown } from '@/lib/markdown';

export const GET: APIRoute = ({ site }) => markdownResponse(topicsMarkdown(site));
