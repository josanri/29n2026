/** The Markdown version of the home page, for the AI agents. See `src/lib/markdown/`. */
import type { APIRoute } from 'astro';
import { homeMarkdown, markdownResponse } from '@/lib/markdown';

export const GET: APIRoute = ({ site }) => markdownResponse(homeMarkdown(site));
