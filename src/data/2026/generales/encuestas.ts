/**
 * Seguimiento de encuestas: estimación de voto (% sobre voto válido) de cinco encuestadoras.
 *
 * Para añadir una encuesta: una línea más en `polls`, con su fecha de publicación (AAAA-MM-DD), la URL de la
 * publicación original y los porcentajes que da. Un partido que la encuesta no publica va como `null`.
 * Para añadir una encuestadora: una entrada en `pollsters` con su página oficial.
 *
 * Origen de las cifras (revisión del 14 de noviembre de 2026):
 * - `checked: true`: la cifra se ha leído en la página original enlazada.
 * - `checked: false`: la cifra viene de la tabla de Mapa Electoral (agregador). El enlace es la publicación original.
 * Sumar se convierte en Frente Amplio el 16 de octubre de 2026 (registro en la Junta Electoral Central). Una encuesta
 * publicada antes de esa fecha da «Sumar»; una publicada después, «Frente Amplio»: `v()` lo decide por la fecha.
 * La cifra es la suma que publica cada encuestadora para la coalición y sus socios.
 * Escaños y muestra: de la tabla de Mapa Electoral, salvo los leídos en la página original (Sigma Dos 9 nov,
 * SocioMétrica 8 nov y GAD3). En «Frente Amplio» se usa la suma del agregador, igual que en el porcentaje.
 */

export type PollPartyId =
  | 'pp' | 'psoe' | 'vox' | 'sumar' | 'fa' | 'podemos' | 'salf'
  | 'erc' | 'junts' | 'bildu' | 'pnv' | 'bng' | 'cc' | 'upn' | 'adelante';

export interface PollParty {
  id: PollPartyId;
  acronym: string;
  /** Nombre corto para la etiqueta al final de la línea, si las siglas son largas. */
  short?: string;
  /** `false`: la gráfica lo oculta al abrir la página; la leyenda lo muestra. */
  shown?: boolean;
  /** El color habitual del partido (los mismos de `congreso.ts`). */
  color: string;
}

export interface Pollster {
  id: string;
  name: string;
  /** Medio que publica sus encuestas. */
  media: string;
  /** Página oficial de la encuestadora o del medio donde publica. */
  url: string;
}

export interface Poll {
  pollster: string;
  /** Fecha de publicación, AAAA-MM-DD. */
  date: string;
  url: string;
  checked: boolean;
  /** Porcentaje de voto estimado. `null`: la encuesta no lo publica. */
  values: Partial<Record<PollPartyId, number | null>>;
  /** Entrevistas de la muestra, si la publicación lo dice. Sin el dato, la gráfica usa `DEFAULT_SAMPLE`. */
  sample?: number;
  /** Escaños estimados: un número o la horquilla [mínimo, máximo] que publica la encuestadora. */
  seats?: Partial<Record<PollPartyId, number | [number, number] | null>>;
}

/** El día en que Sumar pasa a llamarse Frente Amplio. */
export const FRENTE_AMPLIO_FROM = '2026-10-16';

/** Muestra que se supone cuando la publicación no la da: el margen de error que resulta es orientativo. */
export const DEFAULT_SAMPLE = 1000;

export const pollParties: PollParty[] = [
  { id: 'pp', acronym: 'PP', color: '#1d84ce' },
  { id: 'psoe', acronym: 'PSOE', color: '#e30613' },
  { id: 'vox', acronym: 'VOX', color: '#63be21' },
  // Sumar hasta que se registra Frente Amplio (16 de octubre de 2026); después, Frente Amplio, con su color.
  { id: 'sumar', acronym: 'Sumar', color: '#e6007e' },
  { id: 'fa', acronym: 'Frente Amplio', short: 'FA', color: '#f03c00' },
  { id: 'podemos', acronym: 'Podemos', color: '#6b2d8f' },
  // SALF no tiene un color de marca claro: un gris, con su nombre en la línea.
  { id: 'salf', acronym: 'SALF', color: '#7d7468' },
  // Los partidos de ámbito autonómico: ocultos al abrir la gráfica, se muestran desde la leyenda.
  { id: 'erc', acronym: 'ERC', color: '#ffa51f', shown: false },
  { id: 'junts', acronym: 'Junts', color: '#00a99d', shown: false },
  { id: 'bildu', acronym: 'EH Bildu', short: 'Bildu', color: '#00c1a2', shown: false },
  { id: 'pnv', acronym: 'EAJ-PNV', short: 'PNV', color: '#2e8b57', shown: false },
  { id: 'bng', acronym: 'BNG', color: '#5bb5e6', shown: false },
  { id: 'cc', acronym: 'CC', color: '#f4d03f', shown: false },
  { id: 'upn', acronym: 'UPN', color: '#1b4a8a', shown: false },
  { id: 'adelante', acronym: 'Adelante Andalucía', short: 'AA', color: '#00a35a', shown: false },
];

export const pollsters: Pollster[] = [
  { id: 'cis', name: 'CIS', media: 'Centro de Investigaciones Sociológicas', url: 'https://www.cis.es/es/avance-de-resultados' },
  { id: '40db', name: '40dB.', media: 'El País y Cadena SER', url: 'https://40db.es' },
  { id: 'sigmados', name: 'Sigma Dos', media: 'El Mundo', url: 'https://www.sigmados.com' },
  { id: 'sociometrica', name: 'SocioMétrica', media: 'El Español', url: 'https://www.elespanol.com/elecciones/generales/' },
  { id: 'gad3', name: 'GAD3', media: 'ABC', url: 'https://www.gad3.com' },
];

/** El agregador del que salen las cifras sin revisar en la fuente. */
export const pollAggregator = { name: 'Mapa Electoral', url: 'https://mapaelectoral.es/encuestas/' };

const v = (
  pp: number,
  psoe: number,
  vox: number,
  sumar: number | null,
  podemos: number | null,
  salf: number | null,
  others: Partial<Record<PollPartyId, number>> = {},
) => ({ pp, psoe, vox, sumar, podemos, salf, ...others });
/** The same, for a poll published once Sumar is Frente Amplio: the fourth value is Frente Amplio. */
const vFa = (...args: Parameters<typeof v>) => {
  const { sumar, ...rest } = v(...args);
  return { ...rest, sumar: null, fa: sumar };
};

export const polls: Poll[] = [
  // CIS
  { pollster: 'cis', date: '2026-11-12', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3584-preelectoral-elecciones-generales-2026-', values: vFa(25.5, 33.3, 18.4, 6.9, 1.1, 1.4, { erc: 3.1, junts: 1.2, bildu: 1.8, pnv: 0.7, bng: 1.0, cc: 0.2, adelante: 1.5 }), sample: 45074, seats: { pp: [98, 106], psoe: [134, 143], vox: [57, 65], fa: [11, 20], podemos: [0, 1], erc: [10, 14], junts: [2, 4], bildu: [7, 10], pnv: [2, 4], bng: [2, 3], cc: 0, adelante: [3, 4] } },
  { pollster: 'cis', date: '2026-10-14', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3582-bar%C3%B3metro-de-octubre-2026-', values: v(22.2, 34.0, 17.1, 6.1, 3.1, 1.8, { erc: 3.0, junts: 1.1, bildu: 1.6, pnv: 0.6, bng: 0.9, cc: 0.2, upn: 0.1 }), sample: 5025 },
  { pollster: 'cis', date: '2026-09-14', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3577-bar%C3%B3metro-de-septiembre-2026-', values: v(25.5, 31.0, 16.6, 5.7, 3.7, 1.8, { erc: 2.5, junts: 0.7, bildu: 1.3, pnv: 0.7, bng: 0.7, cc: 0.2, upn: 0.1 }), sample: 4042 },
  { pollster: 'cis', date: '2026-07-15', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3571-bar%C3%B3metro-de-julio-2026-', values: v(25.1, 33.0, 15.3, 6.1, 2.5, 2.6, { erc: 2.7, junts: 0.7, bildu: 0.8, pnv: 1.0, bng: 0.9, cc: 0.2, upn: 0.2 }), sample: 4020 },
  { pollster: 'cis', date: '2026-06-11', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3567-bar%C3%B3metro-de-junio-2026-', values: v(27.1, 31.3, 15.8, 6.4, 2.8, 1.9, { erc: 1.9, junts: 1.0, bildu: 1.2, pnv: 0.6, bng: 1.0, cc: 0.2, upn: 0.1 }), sample: 4024 },
  // 40dB.
  { pollster: '40db', date: '2026-11-13', checked: false, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/Informe_tracking_dia01.pdf', values: vFa(31.5, 29.4, 18.8, 5.1, 1.3, 1.7), sample: 1000, seats: { pp: [124, 137], psoe: [113, 121], vox: [61, 70], fa: [7, 11], podemos: 0, erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1 } },
  { pollster: '40db', date: '2026-11-09', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/11-preelectoral/2026_11_preelectoral_informe.pdf', values: vFa(31.9, 29.9, 18.0, 5.0, 1.2, 2.0), sample: 2000, seats: { pp: [126, 139], psoe: [115, 123], vox: [58, 64], fa: [7, 11], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1 } },
  { pollster: '40db', date: '2026-10-09', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/10-08-barometro-flash/2026_10_informe_voto_barometro_flash.pdf', values: v(31.9, 28.1, 18.9, 5.3, 2.3, 1.8), sample: 800, seats: { pp: [123, 140], psoe: [105, 117], vox: [63, 74], sumar: [5, 7], erc: 8, junts: 7, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  { pollster: '40db', date: '2026-10-05', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/10-barometro/2026_10_informe_voto.pdf', values: v(31.6, 27.4, 18.4, 5.6, 2.7, 2.0), sample: 2000 },
  { pollster: '40db', date: '2026-09-07', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/09-barometro/2026_09_informe_voto.pdf', values: v(32.4, 27.6, 17.8, 5.7, 2.8, 2.2), sample: 2000 },
  { pollster: '40db', date: '2026-07-06', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/07-barometro/2026_07_informe_voto.pdf', values: v(32.0, 28.0, 17.2, 5.8, 3.1, 2.1), sample: 2000 },
  { pollster: '40db', date: '2026-06-08', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/06-barometro-y-Papa/2026_06_barometro_voto.pdf', values: v(32.4, 27.7, 17.4, 6.2, 2.3, 2.1), sample: 2000 },
  // Sigma Dos (no publica SALF)
  { pollster: 'sigmados', date: '2026-11-13', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/13/6af73a35fdddffb36c8b45a0.html', values: vFa(31.0, 25.4, 19.7, 8.8, 1.4, null, { erc: 2.7, junts: 1.4, bildu: 1.4, pnv: 0.8, bng: 1.1, cc: 0.3, adelante: 2.0 }), sample: 4620, seats: { pp: [126, 132], psoe: [104, 109], vox: [62, 69], fa: [13, 15], podemos: 0, erc: [8, 9], junts: [6, 7], bildu: [6, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-12', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/12/6af60b3ee4d4d8845c8b4577.html', values: vFa(30.8, 25.3, 19.6, 7.3, 1.4, null, { erc: 2.7, junts: 1.4, bildu: 1.4, pnv: 0.8, bng: 1.1, cc: 0.3, adelante: 2.0 }), sample: 3120, seats: { pp: [126, 132], psoe: [103, 108], vox: [63, 70], fa: [13, 15], erc: [8, 9], junts: [6, 7], bildu: [6, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-09', checked: true, url: 'https://www.sigmados.com/noticia?id=Zr7XEKTN9GLN00s', values: vFa(31.0, 25.2, 19.4, 8.1, 1.6, null, { erc: 2.9, junts: 1.2, bildu: 1.3, pnv: 0.9, bng: 1.0, cc: 0.4, adelante: 1.6 }), sample: 4172, seats: { pp: [131, 137], psoe: [101, 106], vox: [62, 70], fa: [13, 16], podemos: 0, erc: [8, 9], junts: [5, 6], bildu: [6, 8], pnv: [4, 6], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-02', checked: false, url: 'https://www.sigmados.com/noticia?id=sa0OT7jgxEjay6E', values: vFa(31.1, 24.6, 19.3, 8.4, 1.9, null, { erc: 3.0, junts: 1.1, bildu: 1.3, pnv: 0.9, bng: 1.0, cc: 0.4, adelante: 1.4 }), sample: 2505, seats: { pp: [133, 139], psoe: [97, 103], vox: [63, 69], fa: [11, 15], podemos: [0, 1], erc: [9, 11], junts: 6, bildu: [7, 8], pnv: [5, 6], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-10-26', checked: false, url: 'https://www.sigmados.com/noticia?id=OUze2FxEIVfARtu3', values: vFa(30.6, 26.1, 19.9, 8.2, 2.8, null, { erc: 2.5, junts: 1.2, bildu: 1.2, pnv: 0.9, bng: 0.9, cc: 0.4, adelante: 1.0 }), sample: 3122, seats: { pp: [125, 131], psoe: [103, 109], vox: [66, 69], fa: [12, 15], erc: [8, 9], junts: [6, 7], bildu: [7, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [2, 3] } },
  { pollster: 'sigmados', date: '2026-10-19', checked: false, url: 'https://www.sigmados.com/noticia?id=EIJOKGN2GFZmhHt', values: vFa(31.5, 25.3, 19.5, 8.1, 2.8, null, { erc: 2.5, junts: 1.2, bildu: 1.2, pnv: 0.9, bng: 0.8, cc: 0.5, adelante: 0.8 }), sample: 3007, seats: { pp: [132, 137], psoe: [101, 106], vox: [65, 68], fa: [12, 14], erc: 9, junts: [6, 7], bildu: [6, 7], pnv: [5, 6], bng: 2, cc: 1, adelante: [1, 2] } },
  { pollster: 'sigmados', date: '2026-10-11', checked: false, url: 'https://www.sigmados.com/sondeo-de-arranque-de-campana-estimacion-de-voto-para-las-elecciones-generales-29-n/', values: v(31.9, 25.3, 19.1, 7.6, 3.1, null, { erc: 2.6, junts: 1.2, bildu: 1.1, pnv: 0.9, bng: 0.9, cc: 0.5, upn: 0.2, adelante: 0.8 }), sample: 2017, seats: { pp: 135, psoe: 103, vox: 68, sumar: 9, erc: 9, junts: 7, bildu: 6, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 2 } },
  // SocioMétrica
  { pollster: 'sociometrica', date: '2026-11-08', checked: true, url: 'https://www.elespanol.com/espana/politica/20261108/pp-vox-suman-escanos-sanchez-recupera-perdio-urda-dimision-puente-sondeo-noche/1003744450645_0.html', values: vFa(32.0, 27.7, 18.9, 5.9, 1.2, 2.2, { erc: 2.4, junts: 1.4, bildu: 1.6, pnv: 0.8, bng: 1.0, cc: 0.5, adelante: 1.7 }), sample: 5460, seats: { pp: 136, psoe: 108, vox: 66, fa: 8, salf: 0, erc: 9, junts: 6, bildu: 8, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  { pollster: 'sociometrica', date: '2026-11-01', checked: true, url: 'https://www.elespanol.com/espana/politica/20261101/primer-sondeo-tragedia-pp-vox-amplian-ventaja-sanchez-sigue-cayendo-pese-vaciar-frente-amplio/1003744442810_0.html', values: vFa(32.2, 26.6, 19.1, 6.1, 1.7, 2.5, { erc: 2.5, junts: 1.4, bildu: 1.4, pnv: 0.8, bng: 0.9, cc: 0.5, adelante: 1.4 }), sample: 4893, seats: { pp: 139, psoe: 106, vox: 64, fa: 10, erc: 9, junts: 6, bildu: 7, pnv: 4, bng: 2, cc: 1, adelante: 2 } },
  { pollster: 'sociometrica', date: '2026-10-26', checked: false, url: 'https://www.elespanol.com/espana/politica/20261025/izquierda-no-remonta-sanchez-gana-escanos-costa-frente-podemos-sondeo-noche/1003744434105_0.html', values: vFa(32.4, 27.0, 18.6, 6.1, 1.8, 2.4, { erc: 2.6, junts: 1.7, bildu: 1.3, pnv: 0.8, bng: 0.9, cc: 0.4, adelante: 1.2 }), sample: 3223, seats: { pp: 137, psoe: 108, vox: 63, fa: 10, erc: 9, junts: 7, bildu: 7, pnv: 4, bng: 2, cc: 1, adelante: 2 } },
  { pollster: 'sociometrica', date: '2026-10-12', checked: false, url: 'https://www.elespanol.com/espana/politica/20261011/sanchez-no-funciona-apropiarse-maricarmen-huelga-oposicion-cae-sondeo-noche/1003744416762_0.html', values: v(32.6, 26.2, 18.8, 5.8, 2.8, 2.1, { erc: 2.0, junts: 1.5, bildu: 1.3, pnv: 0.8, bng: 0.9, cc: 0.5, upn: 0.2, adelante: 0.9 }), sample: 1000, seats: { pp: 141, psoe: 104, vox: 64, sumar: 8, erc: 8, junts: 6, bildu: 7, pnv: 4, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  { pollster: 'sociometrica', date: '2026-10-04', checked: false, url: 'https://www.elespanol.com/espana/politica/20261004/sondeo-expres-sanchez-disuelve-congreso-pp-hoy-diputados-psoe-vox-sumar/1003744408026_0.html', values: v(33.4, 26.5, 18.1, 5.3, 3.1, 2.2, { erc: 2.2, junts: 1.2, bildu: 1.3, pnv: 1.0, bng: 0.9, cc: 0.6, upn: 0.2 }), sample: 1000, seats: { pp: 143, psoe: 106, vox: 62, sumar: 6, erc: 8, junts: 5, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  { pollster: 'sociometrica', date: '2026-09-27', checked: false, url: 'https://www.elespanol.com/espana/politica/20260927/sanchez-devora-socios-pide-ayuda-decreto-maricarmen-sumar-junts-pnv-bajarian-escanos/1003744398872_0.html', values: v(33.9, 25.7, 18.0, 5.7, 3.3, 2.0, { erc: 2.0, junts: 1.2, bildu: 1.4, pnv: 0.9, bng: 1.0, cc: 0.6, upn: 0.2, adelante: 1.0 }), sample: 1200, seats: { pp: 145, psoe: 107, vox: 62, sumar: 5, erc: 8, junts: 4, bildu: 7, pnv: 4, bng: 2, cc: 1, upn: 1, adelante: 2 } },
  { pollster: 'sociometrica', date: '2026-08-10', checked: false, url: 'https://www.elespanol.com/espana/politica/20260809/ceuta-hunde-sanchez-pp-sube-suma-escanos-gobierno-baja-sondeo-espanol-invasion/1003744347988_0.html', values: v(33.8, 26.0, 17.0, 5.9, 2.7, 2.3, { erc: 2.1, junts: 1.5, bildu: 1.5, pnv: 1.1, bng: 0.9, cc: 0.5, upn: 0.2, adelante: 1.0 }), sample: 1690, seats: { pp: 149, psoe: 103, vox: 57, sumar: 7, erc: 8, junts: 6, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  // GAD3
  { pollster: 'gad3', date: '2026-11-09', checked: false, url: 'https://www.gad3.com/barometro-abc-i-estimacion-de-voto-nacional-noviembre-2026/', values: vFa(31.9, 25.9, 18.6, 7.5, 1.4, 1.3, { erc: 2.7, junts: 1.4, bildu: 1.5, pnv: 0.9, bng: 0.9, cc: 0.4, adelante: 1.6 }), sample: 1502, seats: { pp: 136, psoe: 103, vox: 63, fa: 12, erc: 12, junts: 5, bildu: 8, pnv: 4, bng: 2, cc: 1, adelante: 3 } },
  { pollster: 'gad3', date: '2026-10-12', checked: false, url: 'https://www.gad3.com/barometro-abc-estimacion-de-voto-nacional-octubre-2026/', values: v(31.4, 26.4, 18.2, 7.4, 2.3, 1.8, { erc: 2.6, junts: 1.5, bildu: 1.5, pnv: 1.0, bng: 0.9, cc: 0.4, upn: 0.1, adelante: 1.0 }), sample: 1077, seats: { pp: 133, psoe: 107, vox: 65, sumar: 10, erc: 10, junts: 5, bildu: 8, pnv: 6, bng: 2, cc: 1, upn: 0, adelante: 1 } },
  { pollster: 'gad3', date: '2026-09-07', checked: false, url: 'https://www.gad3.com/barometro-abc-estimacion-de-voto-nacional-septiembre-2026/', values: v(31.1, 26.1, 19.2, 7.0, 3.1, 1.5, { erc: 2.3, junts: 1.2, bildu: 1.5, pnv: 0.9, bng: 0.9, cc: 0.3, upn: 0.2, adelante: 1.0 }), sample: 1010, seats: { pp: 133, psoe: 105, vox: 69, sumar: 9, erc: 10, junts: 4, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
];
