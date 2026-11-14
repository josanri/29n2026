/** Site-wide constants. The names of the election come from its data folder (`@eleccion/eleccion`). */
import { election } from '@eleccion/eleccion';

/** The brand. It does not carry the election, so the site can host other elections. */
export const SITE_NAME = 'Electosfera';

export const DEFAULT_DESCRIPTION = `Los programas electorales de las ${election.name.toLowerCase()} del ${election.longDate} (${election.shortName}), medida a medida: categorías, cifras, plazos y diagramas.`;

/** Where the reader's theme choice is stored. The key stays the same so saved choices still work. */
export const THEME_STORAGE_KEY = 'tema';
