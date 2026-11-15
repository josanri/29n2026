/** Site-wide constants. The names of the election come from its data folder (`@eleccion/eleccion`). */
import { election } from '@eleccion/eleccion';

/** The brand. It does not carry the election, so the site can host other elections. */
export const SITE_NAME = 'Electosfera';

export const DEFAULT_DESCRIPTION = `Los programas electorales de las ${election.name.toLowerCase()} del ${election.longDate} (${election.shortName}), medida a medida: categorías, cifras, plazos y diagramas.`;

/** Where the reader's theme choice is stored. The key stays the same so saved choices still work. */
export const THEME_STORAGE_KEY = 'tema';

/** The accounts of the site on social networks: the footer links them and link previews on X name the first. */
export const SOCIAL_ACCOUNTS = [
  { network: 'X', handle: '@Electosfera', url: 'https://x.com/Electosfera' },
  { network: 'Instagram', handle: '@Electosfera', url: 'https://www.instagram.com/electosfera/' },
] as const;
export const X_HANDLE = SOCIAL_ACCOUNTS[0].handle;

/** A link preview: a 1200 × 630 PNG (`scripts/og_images.py`), its path under the base of the site and its text. */
export interface ShareImage {
  path: string;
  alt: string;
}
export const DEFAULT_SHARE_IMAGE: ShareImage = {
  path: '/og/portada.png',
  alt: 'Electosfera: los programas electorales del 29N, medida a medida.',
};
