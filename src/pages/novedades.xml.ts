import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { election } from '@eleccion/eleccion';
import { pollParties, polls, pollsters } from '@eleccion/encuestas';
import { programPublishedOn } from '@eleccion/publicaciones';
import { debates } from '@/lib/debates';
import { feedItems, type FeedProgram } from '@/lib/feed';
import { measureNoun } from '@/lib/format';
import { announcedMeasures, publishedPrograms } from '@/lib/programs';
import { routes } from '@/lib/routes';
import { FEED_TITLE } from '@/lib/site';

// The RSS feed of the site: each program, poll and debate, the newest first (see `src/lib/feed.ts`).
export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('The RSS feed needs `site` in astro.config.mjs.');
  // A published program with no date stops the build in `program-checks.ts`; here it is only left out.
  const programs: FeedProgram[] = publishedPrograms.flatMap((program) => {
    const publishedOn = programPublishedOn[program.id];
    if (!publishedOn) return [];
    const count = announcedMeasures(program).length;
    return [
      {
        id: program.id,
        partyName: program.partyName,
        acronym: program.acronym,
        programName: program.programName,
        subtitle: program.subtitle,
        measureLabel: `${count} ${measureNoun(program, count)}`,
        publishedOn,
      },
    ];
  });
  return rss({
    title: FEED_TITLE,
    description: `Los programas, las encuestas y los debates de las ${election.name.toLowerCase()} del ${election.longDate}, a medida que se publican.`,
    // The home page of the election, with the base path (`site` alone is the root of the domain).
    site: new URL(routes.home(), site).href,
    items: feedItems({ programs, polls, pollsters, parties: pollParties, debates }, site),
    // `atom:link rel="self"`: the address of the feed itself, which the validators of RSS ask for.
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>es-ES</language><atom:link href="${new URL(routes.feed(), site).href}" rel="self" type="application/rss+xml"/>`,
  });
};
