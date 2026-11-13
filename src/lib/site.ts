/** Site-wide constants. The names of the election come from its data folder (`@eleccion/eleccion`). */
import { election } from '@eleccion/eleccion';

export const SITE_NAME = `Programas ${election.shortName}`;

export const DEFAULT_DESCRIPTION = `Los programas electorales del ${election.shortName}, medida a medida: categorías, cifras, plazos y diagramas.`;

/** Where the reader's theme choice is stored. The key stays the same so saved choices still work. */
export const THEME_STORAGE_KEY = 'tema';
