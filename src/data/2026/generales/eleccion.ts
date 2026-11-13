/** The election of this folder. The interface and the texts of the site take its names from here. */
export const election = {
  /** Folder of the election, `<year>/<type>`. The same value as ELECTION in election.config.mjs. */
  id: '2026/generales',
  year: 2026,
  /** Short name: the mark of the logo and the favicon. */
  shortName: '29N',
  /** Name of the election, without the date. */
  name: 'Elecciones generales',
  /** Day of the vote, ISO format. */
  date: '2026-11-29',
  /** Day of the vote, as text. */
  longDate: '29 de noviembre de 2026',
} as const;

/** «Elecciones generales · 29 de noviembre de 2026». */
export const electionLabel = `${election.name} · ${election.longDate}`;
