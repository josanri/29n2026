/**
 * Resultados del 29N: el estado de la página /resultados/, la fuente de los datos y las candidaturas.
 *
 * Estados (`resultsConfig.status`):
 * - `proximamente`: antes de `opensAt`, la cuenta atrás y el enlace a la web oficial. Desde `opensAt`, la página lee `feedUrl` cada
 *   `refreshSeconds` segundos y muestra los datos en cuanto existen. No hace falta cambiar nada ni compilar la noche.
 * - `provisional`: lee `feedUrl` cada `refreshSeconds` segundos, sin esperar a `opensAt`.
 * - `definitivo`: el escrutinio general ha terminado. La página lee `feedUrl` una vez.
 *
 * Los archivos tienen el formato normalizado de Electosfera (`electosfera-resultados/1`, ver `src/lib/results.ts`):
 * `espana.json` (las 52 circunscripciones) y `municipios-<provincia>.json` (los municipios de una provincia).
 * `npm run resultados:importar` convierte los datos del Ministerio del Interior a ese formato y los escribe en
 * `public/<elección>/resultados/datos/`: son archivos estáticos, que se publican con una compilación. Ver el README.
 */
// With the extension: `scripts/results_import.ts` loads this file with plain Node.
import { OFFICIAL_RESULTS_SITE } from './calendario.ts';

export type ResultsStatus = 'proximamente' | 'provisional' | 'definitivo';

export const resultsConfig = {
  status: 'proximamente' as ResultsStatus,
  /** Hora de cierre de los colegios (20:00 en la península; en Canarias, a las 20:00 hora canaria). */
  opensAt: '2026-11-29T20:00:00+01:00',
  /** Resultados por circunscripción, en la ruta de la elección. */
  feedUrl: '/resultados/datos/espana.json',
  /** Resultados del Senado: los candidatos de las 60 circunscripciones (`senateConstituencies`). */
  senateFeedUrl: '/resultados/datos/senado.json',
  /** Resultados por municipio de una provincia: `{provincia}` es su código INE de dos cifras. */
  municipalFeedUrl: '/resultados/datos/municipios-{provincia}.json',
  /** Evolución del recuento (instantáneas tomadas durante la noche electoral). */
  evolutionFeedUrl: '/resultados/datos/evolucion.json',
  /** Mapa de los municipios de una provincia (`scripts/municipal_maps.py`). */
  municipalMapUrl: '/mapas/municipios/{provincia}.json',
  /** Cada cuántos segundos la página vuelve a leer los datos en la noche electoral. */
  refreshSeconds: 60,
  source: { name: 'Ministerio del Interior', url: OFFICIAL_RESULTS_SITE },
} as const;

/**
 * Escaños de cada circunscripción en el Congreso (código INE de la provincia). Es el número de candidatos titulares
 * de cada lista proclamada (`public/2026/generales/datos-electorales/candidaturas.json`). La suma es 350.
 */
export const constituencySeats: Record<string, number> = {
  '01': 4, '02': 4, '03': 12, '04': 6, '05': 3, '06': 5, '07': 8, '08': 32, '09': 4, '10': 4,
  '11': 8, '12': 5, '13': 5, '14': 6, '15': 8, '16': 3, '17': 6, '18': 7, '19': 3, '20': 6,
  '21': 5, '22': 3, '23': 5, '24': 4, '25': 4, '26': 4, '27': 4, '28': 38, '29': 11, '30': 10,
  '31': 5, '32': 4, '33': 7, '34': 3, '35': 8, '36': 7, '37': 4, '38': 7, '39': 5, '40': 3,
  '41': 12, '42': 2, '43': 6, '44': 3, '45': 6, '46': 16, '47': 5, '48': 8, '49': 3, '50': 7,
  '51': 1, '52': 1,
};

/**
 * Circunscripciones del Senado (LOREG, art. 165): 209 senadores elegidos. Cada provincia peninsular elige 4; Ceuta y
 * Melilla, 2; en Baleares y Canarias cada isla o agrupación de islas es una circunscripción. Desde el 29N, Eivissa y
 * Formentera eligen un senador cada una (en 2023, uno entre las dos): así lo publica la API oficial de difusión. `share` es la parte del
 * censo de su provincia que vota en la isla (aproximada, solo para el ensayo del script de importación).
 */
export interface SenateConstituency {
  /** El código INE de la provincia, o un nombre corto para una isla. */
  code: string;
  name: string;
  /** El código INE de la provincia a la que pertenece. */
  province: string;
  seats: number;
  share?: number;
  /** Otros nombres con que la fuente puede publicar la circunscripción. */
  aliases?: string[];
}

const ISLANDS: SenateConstituency[] = [
  { code: 'mallorca', name: 'Mallorca', province: '07', seats: 3, share: 0.77 },
  { code: 'menorca', name: 'Menorca', province: '07', seats: 1, share: 0.085 },
  { code: 'ibiza', name: 'Ibiza', province: '07', seats: 1, share: 0.135, aliases: ['Eivissa'] },
  { code: 'formentera', name: 'Formentera', province: '07', seats: 1, share: 0.01 },
  { code: 'gran-canaria', name: 'Gran Canaria', province: '35', seats: 3, share: 0.76 },
  { code: 'lanzarote', name: 'Lanzarote', province: '35', seats: 1, share: 0.14, aliases: ['Lanzarote-La Graciosa'] },
  { code: 'fuerteventura', name: 'Fuerteventura', province: '35', seats: 1, share: 0.1 },
  { code: 'tenerife', name: 'Tenerife', province: '38', seats: 3, share: 0.89 },
  { code: 'la-palma', name: 'La Palma', province: '38', seats: 1, share: 0.08 },
  { code: 'la-gomera', name: 'La Gomera', province: '38', seats: 1, share: 0.02 },
  { code: 'el-hierro', name: 'El Hierro', province: '38', seats: 1, share: 0.01 },
];
const ISLAND_PROVINCES = new Set(ISLANDS.map((island) => island.province));

/**
 * Las 60 circunscripciones del Senado: las 47 provincias con 4 senadores, Ceuta y Melilla con 2 y las 11 islas o
 * agrupaciones de islas. La suma es 209 (`senateElectedSeats`). El nombre de una provincia sale de `provincias.json` en la página.
 */
export const senateConstituencies: SenateConstituency[] = [
  ...Object.keys(constituencySeats)
    .filter((code) => !ISLAND_PROVINCES.has(code))
    .map((code) => ({ code, name: code, province: code, seats: code === '51' || code === '52' ? 2 : 4 })),
  ...ISLANDS,
];

/** Los senadores que se eligen el 29N: 209. */
export const senateElectedSeats = senateConstituencies.reduce((sum, constituency) => sum + constituency.seats, 0);

export interface ResultsParty {
  id: string;
  acronym: string;
  name: string;
  /** El color habitual del partido: el mismo de `congreso.ts` y `encuestas.ts`. */
  color: string;
  /** Escaños de 2023 de la candidatura (Frente Amplio: los de Sumar). */
  seats2023: number;
  /** Senadores elegidos en 2023 (de 208; `senado.ts` tiene los designados por los parlamentos autonómicos). El 29N se eligen 209. */
  senateSeats2023?: number;
  /** Siglas con que el Ministerio puede publicar la candidatura (con federaciones y coaliciones). */
  aliases: string[];
  /** Provincias donde se presenta, solo para los partidos de ámbito autonómico. La simulación lo usa. */
  territory?: string[];
  programId?: string;
}

const CATALONIA = ['08', '17', '25', '43'];
const BASQUE = ['01', '20', '48'];
const GALICIA = ['15', '27', '32', '36'];
const ANDALUSIA = ['04', '11', '14', '18', '21', '23', '29', '41'];

/** Las candidaturas con grupo o representación probable. El orden es el del hemiciclo, de izquierda a derecha. */
export const resultsParties: ResultsParty[] = [
  { id: 'fa', acronym: 'FA', name: 'Frente Amplio', color: '#f03c00', seats2023: 31, aliases: ['FA', 'FRENTE AMPLIO', 'SUMAR', 'COMUNS-FRONT AMPLI', 'C-DEM', 'FRENTE AMPLIO-FRONTE AMPLA', 'FRENTE AMPLIO - FRONTE AMPLA', 'FRENTE AMPLIO-FRONTE ZABALA', 'CHA-IU-MS-FRENTE AMPLIO', 'ARAMÉS-EU-MS'], programId: 'fa' },
  { id: 'podemos', acronym: 'Podemos', name: 'Podemos', color: '#6b2d8f', seats2023: 0, aliases: ['PODEMOS', 'PAZ,CASA Y TRABAJO'], programId: 'podemos' },
  { id: 'adelante', acronym: 'AA', name: 'Adelante Andalucía', color: '#00a35a', seats2023: 0, aliases: ['ADELANTE', 'ADELANTE ANDALUCIA'], territory: ANDALUSIA, programId: 'adelante' },
  { id: 'psoe', acronym: 'PSOE', name: 'Partido Socialista Obrero Español', color: '#e30613', seats2023: 121, senateSeats2023: 72, aliases: ['PSOE', 'PSC-PSOE', 'PSC', 'PSDEG-PSOE', 'PSE-EE (PSOE)', 'PSE-EE', 'PSN-PSOE', 'PSIB-PSOE', 'SENADO DE PROGRESO', 'SDP (PSOE, IU, MS, MM, COMPROMIS, CHA, BATZARRE)', 'PSIB-PSOE-MÉS PER MALLORCA-SUMAR-EUIB', 'PSOE-MÉS PER MENORCA-EM-EU-PODEMOS', 'PSOE-SUMAR-EUIB-ARA EIVISSA-PODEM', 'PSOE-GXF-M.SUMAR'], programId: 'psoe' },
  { id: 'erc', acronym: 'ERC', name: 'Esquerra Republicana de Catalunya', color: '#ffa51f', seats2023: 7, senateSeats2023: 3, aliases: ['ERC', 'ERC-EH BILDU'], territory: CATALONIA, programId: 'erc' },
  { id: 'bildu', acronym: 'EH Bildu', name: 'Euskal Herria Bildu', color: '#00c1a2', seats2023: 6, senateSeats2023: 4, aliases: ['EH BILDU', 'BILDU', 'EH BILDU-ERC'], territory: [...BASQUE, '31'], programId: 'eh-bildu' },
  { id: 'bng', acronym: 'BNG', name: 'Bloque Nacionalista Galego', color: '#5bb5e6', seats2023: 1, aliases: ['BNG', 'B.N.G.'], territory: GALICIA, programId: 'bng' },
  { id: 'junts', acronym: 'Junts', name: 'Junts per Catalunya', color: '#00a99d', seats2023: 7, senateSeats2023: 1, aliases: ['JUNTS', 'JXCAT', 'JUNTS-JXCAT'], territory: CATALONIA, programId: 'jxcat' },
  { id: 'pnv', acronym: 'EAJ-PNV', name: 'Partido Nacionalista Vasco', color: '#2e8b57', seats2023: 5, senateSeats2023: 4, aliases: ['EAJ-PNV', 'PNV'], territory: BASQUE, programId: 'eaj-pnv' },
  { id: 'cc', acronym: 'CC', name: 'Coalición Canaria', color: '#f4d03f', seats2023: 1, aliases: ['CC', 'CCA', 'CC-NC', 'CCA-1ºCAN', '1ºCAN-CCA', '1.ºCAN-CCA'], territory: ['35', '38'], programId: 'cc' },
  { id: 'upn', acronym: 'UPN', name: 'Unión del Pueblo Navarro', color: '#1b4a8a', seats2023: 1, senateSeats2023: 1, aliases: ['UPN', 'UPN-PP', 'PP-UPN'], territory: ['31'], programId: 'upn' },
  { id: 'asg', acronym: 'ASG', name: 'Agrupación Socialista Gomera', color: '#d21a1a', seats2023: 0, senateSeats2023: 1, aliases: ['ASG'], territory: ['38'] },
  { id: 'ahi', acronym: 'AHI', name: 'Agrupación Herreña Independiente', color: '#009c4c', seats2023: 0, senateSeats2023: 1, aliases: ['AHI', 'A.H.I.'], territory: ['38'] },
  { id: 'pp', acronym: 'PP', name: 'Partido Popular', color: '#1d84ce', seats2023: 137, senateSeats2023: 120, aliases: ['PP'], programId: 'pp' },
  { id: 'vox', acronym: 'VOX', name: 'Vox', color: '#63be21', seats2023: 33, aliases: ['VOX'], programId: 'vox' },
  { id: 'salf', acronym: 'SALF', name: 'Se Acabó La Fiesta', color: '#7d7468', seats2023: 0, aliases: ['SALF', 'SE ACABO LA FIESTA'], programId: 'salf' },
];

/** El color de una candidatura que no está en la lista. */
export const OTHER_PARTY_COLOR = '#8a857a';
