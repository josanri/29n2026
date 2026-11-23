/**
 * Seguimiento de encuestas: estimación de voto (% sobre voto válido) de cinco encuestadoras.
 *
 * Para añadir una encuesta: una línea más en `polls`, con su fecha de publicación (AAAA-MM-DD), la URL de la
 * publicación original y los porcentajes que da. Un partido que la encuesta no publica va como `null`.
 * Para añadir una encuestadora: una entrada en `pollsters` con su página oficial.
 *
 * Origen de las cifras (revisión del 23 de noviembre de 2026):
 * - `checked: true`: la cifra se ha leído en la página original enlazada.
 * - `checked: false`: la cifra no se ha leído en la página original enlazada: viene de la tabla de Mapa Electoral
 *   (agregador) o de otra fuente que la recoge (electografica, Demócrata…). El enlace es la publicación original.
 * Sumar se convierte en Frente Amplio el 16 de octubre de 2026 (registro en la Junta Electoral Central). Una encuesta
 * publicada antes de esa fecha da «Sumar»; una publicada después, «Frente Amplio»: quien añade la línea elige `v()` (antes del 16-X) o `vFa()` (desde esa fecha).
 * La cifra es la suma que publica cada encuestadora para la coalición y sus socios.
 * Escaños y muestra: de la tabla de Mapa Electoral o de la fuente que indica el comentario de cada línea, salvo los leídos en la página original (Sigma Dos 9 nov,
 * SocioMétrica 8 y 15 nov, 40dB. 15 nov y GAD3). En «Frente Amplio» se usa la suma del agregador, igual que en el porcentaje.
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
  // Otras encuestadoras (desde el 23 de noviembre de 2026): la página del medio que publica sus encuestas.
  { id: 'imop', name: 'IMOP', media: 'El Confidencial', url: 'https://www.elconfidencial.com' },
  { id: 'gesop', name: 'GESOP', media: 'El Periódico (Prensa Ibérica)', url: 'https://www.elperiodico.com/es/' },
  { id: 'ipsos', name: 'Ipsos', media: 'La Vanguardia', url: 'https://www.lavanguardia.com' },
  { id: 'ncreport', name: 'NC Report', media: 'La Razón', url: 'https://www.larazon.es' },
  { id: 'targetpoint', name: 'Target Point', media: 'El Debate', url: 'https://www.eldebate.com' },
  { id: 'hamalgama', name: 'Hamalgama Métrica', media: 'Vozpópuli', url: 'https://www.vozpopuli.com' },
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
  // 23 nov (estudio 3587, barómetro de noviembre, campo 10-17 nov, 8.034 entrevistas): leído en el PDF oficial de estimación del CIS (3587_estimacion-pdf). FA suma Frente Amplio (5,7) + Compromís: Front Valencià (1,8) + UPC (0,4) + Aramés-Front Ampli (0,3): 8,2 %. Podemos (0,8) va sola: la fila ERC-Podemos (2,7) se omite en ERC porque no se puede separar. Sin escaños: el barómetro mensual no los estima.
  { pollster: 'cis', date: '2026-11-23', checked: true, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3587-bar%C3%B3metro-de-noviembre-2026-', values: vFa(24.7, 34.4, 15.6, 8.2, 0.8, 1.8, { junts: 1.0, bildu: 1.8, pnv: 0.7, bng: 1.1, cc: 0.3, adelante: 1.7 }), sample: 8034 },
  { pollster: 'cis', date: '2026-11-12', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3584-preelectoral-elecciones-generales-2026-', values: vFa(25.5, 33.3, 18.4, 6.9, 1.1, 1.4, { erc: 3.1, junts: 1.2, bildu: 1.8, pnv: 0.7, bng: 1.0, cc: 0.2, adelante: 1.5 }), sample: 45074, seats: { pp: [98, 106], psoe: [134, 143], vox: [57, 65], fa: [11, 20], podemos: [0, 1], erc: [10, 14], junts: [2, 4], bildu: [7, 10], pnv: [2, 4], bng: [2, 3], cc: 0, adelante: [3, 4] } },
  { pollster: 'cis', date: '2026-10-14', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3582-bar%C3%B3metro-de-octubre-2026-', values: v(22.2, 34.0, 17.1, 6.1, 3.1, 1.8, { erc: 3.0, junts: 1.1, bildu: 1.6, pnv: 0.6, bng: 0.9, cc: 0.2, upn: 0.1 }), sample: 5025 },
  { pollster: 'cis', date: '2026-09-14', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3577-bar%C3%B3metro-de-septiembre-2026-', values: v(25.5, 31.0, 16.6, 5.7, 3.7, 1.8, { erc: 2.5, junts: 0.7, bildu: 1.3, pnv: 0.7, bng: 0.7, cc: 0.2, upn: 0.1 }), sample: 4042 },
  { pollster: 'cis', date: '2026-07-15', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3571-bar%C3%B3metro-de-julio-2026-', values: v(25.1, 33.0, 15.3, 6.1, 2.5, 2.6, { erc: 2.7, junts: 0.7, bildu: 0.8, pnv: 1.0, bng: 0.9, cc: 0.2, upn: 0.2 }), sample: 4020 },
  { pollster: 'cis', date: '2026-06-11', checked: false, url: 'https://www.cis.es/es/w/avance-de-resultados-del-estudio-3567-bar%C3%B3metro-de-junio-2026-', values: v(27.1, 31.3, 15.8, 6.4, 2.8, 1.9, { erc: 1.9, junts: 1.0, bildu: 1.2, pnv: 0.6, bng: 1.0, cc: 0.2, upn: 0.1 }), sample: 4024 },
  // 40dB.
  // 16 a 23 nov (trackings días 4 a 10 y Preelectoral II): leídos directamente en los PDF oficiales de El País (checked: true). En voto, FA suma Frente Amplio y «Otras coaliciones territoriales de izquierda» (Compromís: Front Valencià, Ara Més-Front Ampli y UPC). En escaños, el PP incluye los 2 de UPN-PP que el gráfico coloca en «Otros»; los escaños de FA y de «Otras coaliciones» se publican con horquillas separadas y no se suman.
  // 23 nov (Preelectoral II, campo 10-21 nov, N = 7.500): FA = 3,9 + 1,8 (1,3 Compromís:FV + 0,2 AraMés + 0,3 UPC) = 5,7 %. PP en PDF: 125-134 + 2 UPN-PP = 127-136.
  { pollster: '40db', date: '2026-11-23', checked: true, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/11-preelectoral2/PE2-cbe680f8658575bfec9654dda53767bbd334f392/2026_11_preelectoral2_voto.pdf', values: vFa(31.8, 30.9, 17.3, 5.7, 1.1, 1.3), sample: 7500, seats: { pp: [127, 136], psoe: [116, 127], vox: [51, 61], podemos: [0, 1], erc: 10, junts: 4, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 21 nov (día 10, campo 17-21 nov, N = 2.000): FA = 3,6 + 1,7 = 5,3 %. PP en PDF: 125-136 + 2 UPN-PP = 127-138.
  { pollster: '40db', date: '2026-11-21', checked: true, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/11-tracking-electoral/D10-8f4c9a2b7e61d035a8c4f290b73e6d12/informe_tracking_dia10.pdf', values: vFa(31.9, 31.6, 16.9, 5.3, 1.0, 1.4), sample: 2000, seats: { pp: [127, 138], psoe: [119, 130], vox: [49, 59], podemos: [0, 1], erc: 11, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 20 nov (día 9, campo 16-20 nov, N = 2.000): FA = 3,8 + 1,8 = 5,6 %. PP en PDF: 125-135 + 2 UPN-PP = 127-137.
  { pollster: '40db', date: '2026-11-20', checked: true, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/informe_tracking_dia09.pdf', values: vFa(31.9, 31.2, 17.1, 5.6, 1.1, 1.5), sample: 2000, seats: { pp: [127, 137], psoe: [121, 129], vox: [50, 60], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 19 nov (día 8, campo 15-19 nov, N = 2.000): FA = 3,6 + 1,7 = 5,3 %. PP en PDF: 125-137 + 2 UPN-PP = 127-139.
  { pollster: '40db', date: '2026-11-19', checked: true, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/informe_tracking_dia08.pdf', values: vFa(32.2, 30.2, 17.6, 5.3, 1.1, 1.7), sample: 2000, seats: { pp: [127, 139], psoe: [115, 123], vox: [56, 62], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 19 nov (día 7, campo 14-18 nov, N = 2.000): FA = 3,7 + 1,7 = 5,4 %. PP en PDF: 126-138 + 2 UPN-PP = 128-140.
  { pollster: '40db', date: '2026-11-19', checked: true, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/informe_tracking_dia07.pdf', values: vFa(32.4, 30.4, 17.2, 5.4, 1.2, 1.7), sample: 2000, seats: { pp: [128, 140], psoe: [116, 125], vox: [53, 61], podemos: [0, 1], erc: 9, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 18 nov (día 6, campo 13-17 nov, N = 2.000): FA = 3,5 + 1,7 = 5,2 %. PP en PDF: 126-137 + 2 UPN-PP = 128-139.
  { pollster: '40db', date: '2026-11-18', checked: true, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/informe_tracking_dia06.pdf', values: vFa(32.2, 30.7, 17.0, 5.2, 1.2, 1.7), sample: 2000, seats: { pp: [128, 139], psoe: [118, 127], vox: [51, 60], podemos: [0, 1], erc: 10, junts: 4, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 17 nov (día 5, campo 12-16 nov, N = 2.000): FA = 3,7 + 1,7 = 5,4 %. PP en PDF: 124-135 + 2 UPN-PP = 126-137.
  { pollster: '40db', date: '2026-11-17', checked: true, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/informe_tracking_dia05.pdf', values: vFa(31.8, 30.6, 17.5, 5.4, 1.1, 1.6), sample: 2000, seats: { pp: [126, 137], psoe: [118, 126], vox: [55, 62], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 16 nov (día 4, campo 10-15 nov, N = 2.500): FA = 3,7 + 1,7 = 5,4 %. PP en PDF: 123-134 + 2 UPN-PP = 125-136.
  { pollster: '40db', date: '2026-11-16', checked: true, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/informe_tracking_dia04.pdf', values: vFa(31.5, 30.3, 18.0, 5.4, 1.1, 1.7), sample: 2500, seats: { pp: [125, 136], psoe: [118, 124], vox: [57, 64], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 15 nov: FA suma Frente Amplio (3,7) y las otras coaliciones del bloque (1,7): 5,4 %. El informe no da escaños de FA.
  { pollster: '40db', date: '2026-11-15', checked: true, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/11-tracking-electoral/Informe_tracking_dia03.pdf', values: vFa(31.4, 29.9, 18.3, 5.4, 1.3, 1.8), sample: 2000, seats: { pp: [125, 136], psoe: [117, 123], vox: [59, 65], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1 } },
  { pollster: '40db', date: '2026-11-14', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/11-tracking-electoral/Informe_tracking_dia02.pdf', values: vFa(31.1, 29.8, 18.5, 5.2, 1.3, 1.6), sample: 1500, seats: { pp: [121, 132], psoe: [116, 123], vox: [61, 67], fa: [7, 11], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  { pollster: '40db', date: '2026-11-13', checked: false, url: 'https://elpais.com/infografias/encuestas40db/2026/11-tracking-electoral/Informe_tracking_dia01.pdf', values: vFa(31.5, 29.4, 18.8, 5.1, 1.3, 1.7), sample: 1000, seats: { pp: [124, 137], psoe: [113, 121], vox: [61, 70], fa: [7, 11], podemos: 0, erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1 } },
  { pollster: '40db', date: '2026-11-09', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/11-preelectoral/2026_11_preelectoral_informe.pdf', values: vFa(31.9, 29.9, 18.0, 5.0, 1.2, 2.0), sample: 2000, seats: { pp: [126, 139], psoe: [115, 123], vox: [58, 64], fa: [7, 11], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1 } },
  { pollster: '40db', date: '2026-10-09', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/10-08-barometro-flash/2026_10_informe_voto_barometro_flash.pdf', values: v(31.9, 28.1, 18.9, 5.3, 2.3, 1.8), sample: 800, seats: { pp: [123, 140], psoe: [105, 117], vox: [63, 74], sumar: [5, 7], erc: 8, junts: 7, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  { pollster: '40db', date: '2026-10-05', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/10-barometro/2026_10_informe_voto.pdf', values: v(31.6, 27.4, 18.4, 5.6, 2.7, 2.0), sample: 2000 },
  { pollster: '40db', date: '2026-09-07', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/09-barometro/2026_09_informe_voto.pdf', values: v(32.4, 27.6, 17.8, 5.7, 2.8, 2.2), sample: 2000 },
  { pollster: '40db', date: '2026-07-06', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/07-barometro/2026_07_informe_voto.pdf', values: v(32.0, 28.0, 17.2, 5.8, 3.1, 2.1), sample: 2000 },
  { pollster: '40db', date: '2026-06-08', checked: false, url: 'https://ep00.epimg.net/infografias/encuestas40db/2026/06-barometro-y-Papa/2026_06_barometro_voto.pdf', values: v(32.4, 27.7, 17.4, 6.2, 2.3, 2.1), sample: 2000 },
  // Sigma Dos (no publica SALF)
  // 23 nov (última entrega antes de la veda, enlace oficial de El Mundo del 22 nov noche): voto de PP (31,7), PSOE (28,3), Vox (17,9) y FA (7,2) confirmados en El Mundo; horquillas, Podemos (0,7), Adelante (1,8; 5 escaños) y muestra (4.616) de Mapa Electoral y Europa Press (El Mundo da centrales 132, 117 y 58 en texto). Al completar horquillas y desglose con fuentes secundarias, queda checked: false.
  { pollster: 'sigmados', date: '2026-11-23', checked: false, url: 'https://www.elmundo.es/espana/encuestas/2026/11/22/6b033046fc6c830e508b4594.html', values: vFa(31.7, 28.3, 17.9, 7.2, 0.7, null, { adelante: 1.8 }), sample: 4616, seats: { pp: [124, 130], psoe: [113, 119], vox: [58, 63], fa: [11, 14], podemos: 0, adelante: 5 } },
  // 17-21 nov (5.º a 9.º tracking): cifras de Electografica y Mapa Electoral; enlaces oficiales de El Mundo (no se han leído las tablas completas en El Mundo, checked: false). PP incluye UPN-PP (0,2). FA suma FA + Compromís:FV + UPC.
  { pollster: 'sigmados', date: '2026-11-21', checked: false, url: 'https://www.elmundo.es/espana/encuestas/2026/11/21/6b01d96dfc6c83e5298b4592.html', values: vFa(31.5, 28.0, 18.3, 7.1, 0.7, null, { erc: 2.7, junts: 1.5, bildu: 1.6, pnv: 0.9, bng: 1.0, cc: 0.4, adelante: 1.6 }), sample: 4511, seats: { pp: [126, 132], psoe: [112, 118], vox: [57, 62], fa: [9, 12], podemos: 0, erc: [10, 11], junts: [4, 5], bildu: [7, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [2, 3] } },
  { pollster: 'sigmados', date: '2026-11-20', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/20/6b00981ffdddffc8218b4590.html', values: vFa(31.2, 27.6, 18.9, 7.1, 0.8, null, { adelante: 1.7 }), sample: 4561, seats: { pp: [125, 131], psoe: [111, 117], vox: [57, 62], fa: [11, 14], podemos: 0, adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-19', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/19/6aff2a9afc6c83886c8b459b.html', values: vFa(31.0, 27.1, 19.4, 8.9, 0.8, null, { adelante: 1.7 }), sample: 4491, seats: { pp: [125, 131], psoe: [110, 116], vox: [59, 64], fa: [11, 14], podemos: 0, adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-18', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/18/6afdd75c21efa083408b45b2.html', values: vFa(30.7, 26.7, 19.7, 8.7, 0.8, null, { adelante: 1.7 }), sample: 4511, seats: { pp: [123, 129], psoe: [108, 114], vox: [62, 67], fa: [10, 14], podemos: 0, adelante: [3, 5] } },
  { pollster: 'sigmados', date: '2026-11-17', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/17/6afca438e9cf4a7d7a8b459c.html', values: vFa(30.7, 26.4, 19.8, 6.7, 1.2, null, { erc: 2.4, junts: 1.3, bildu: 1.5, pnv: 0.9, bng: 1.0, cc: 0.3, adelante: 1.8 }), sample: 3759, seats: { pp: [123, 129], psoe: [108, 114], vox: [62, 67], fa: [10, 14], podemos: 0, erc: [8, 9], junts: [4, 5], bildu: [6, 8], pnv: [3, 4], bng: [2, 3], cc: [0, 1], adelante: [3, 5] } },
  { pollster: 'sigmados', date: '2026-11-16', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/16/6afb2ef1fc6c834a4a8b4589.html', values: vFa(30.8, 26.1, 19.8, 6.7, 1.4, null, { adelante: 1.8 }), sample: 3002, seats: { pp: [123, 129], psoe: [107, 113], vox: [63, 68], fa: 14, podemos: 0, adelante: [3, 5] } },
  // 15 nov: FA suma Frente Amplio (5,6), Front Valencià (1,1) y UPCan (0,5): 7,2 % y 13-16 escaños.
  { pollster: 'sigmados', date: '2026-11-15', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/15/6af8afeae9cf4ab47b8b4586.html', values: vFa(31.0, 25.6, 19.7, 7.2, 1.4, null, { erc: 2.7, junts: 1.3, bildu: 1.4, pnv: 0.8, bng: 1.1, cc: 0.4, adelante: 1.9 }), sample: 5370, seats: { pp: [126, 132], psoe: [105, 111], vox: [62, 67], fa: [13, 16], podemos: 0, erc: [9, 10], junts: [4, 5], bildu: [6, 8], pnv: [3, 4], bng: 2, cc: [0, 1], adelante: [3, 5] } },
  { pollster: 'sigmados', date: '2026-11-13', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/13/6af73a35fdddffb36c8b45a0.html', values: vFa(31.0, 25.4, 19.7, 8.8, 1.4, null, { erc: 2.7, junts: 1.4, bildu: 1.4, pnv: 0.8, bng: 1.1, cc: 0.3, adelante: 2.0 }), sample: 4620, seats: { pp: [126, 132], psoe: [104, 109], vox: [62, 69], fa: [13, 15], podemos: 0, erc: [8, 9], junts: [6, 7], bildu: [6, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-12', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/12/6af60b3ee4d4d8845c8b4577.html', values: vFa(30.8, 25.3, 19.6, 7.3, 1.4, null, { erc: 2.7, junts: 1.4, bildu: 1.4, pnv: 0.8, bng: 1.1, cc: 0.3, adelante: 2.0 }), sample: 3120, seats: { pp: [126, 132], psoe: [103, 108], vox: [63, 70], fa: [13, 15], erc: [8, 9], junts: [6, 7], bildu: [6, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-09', checked: true, url: 'https://www.sigmados.com/noticia?id=Zr7XEKTN9GLN00s', values: vFa(31.0, 25.2, 19.4, 8.1, 1.6, null, { erc: 2.9, junts: 1.2, bildu: 1.3, pnv: 0.9, bng: 1.0, cc: 0.4, adelante: 1.6 }), sample: 4172, seats: { pp: [131, 137], psoe: [101, 106], vox: [62, 70], fa: [13, 16], podemos: 0, erc: [8, 9], junts: [5, 6], bildu: [6, 8], pnv: [4, 6], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-11-02', checked: false, url: 'https://www.sigmados.com/noticia?id=sa0OT7jgxEjay6E', values: vFa(31.1, 24.6, 19.3, 8.4, 1.9, null, { erc: 3.0, junts: 1.1, bildu: 1.3, pnv: 0.9, bng: 1.0, cc: 0.4, adelante: 1.4 }), sample: 2505, seats: { pp: [133, 139], psoe: [97, 103], vox: [63, 69], fa: [11, 15], podemos: [0, 1], erc: [9, 11], junts: 6, bildu: [7, 8], pnv: [5, 6], bng: 2, cc: [0, 1], adelante: [3, 4] } },
  { pollster: 'sigmados', date: '2026-10-26', checked: false, url: 'https://www.sigmados.com/noticia?id=OUze2FxEIVfARtu3', values: vFa(30.6, 26.1, 19.9, 8.2, 2.8, null, { erc: 2.5, junts: 1.2, bildu: 1.2, pnv: 0.9, bng: 0.9, cc: 0.4, adelante: 1.0 }), sample: 3122, seats: { pp: [125, 131], psoe: [103, 109], vox: [66, 69], fa: [12, 15], erc: [8, 9], junts: [6, 7], bildu: [7, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [2, 3] } },
  { pollster: 'sigmados', date: '2026-10-19', checked: false, url: 'https://www.sigmados.com/noticia?id=EIJOKGN2GFZmhHt', values: vFa(31.5, 25.3, 19.5, 8.1, 2.8, null, { erc: 2.5, junts: 1.2, bildu: 1.2, pnv: 0.9, bng: 0.8, cc: 0.5, adelante: 0.8 }), sample: 3007, seats: { pp: [132, 137], psoe: [101, 106], vox: [65, 68], fa: [12, 14], erc: 9, junts: [6, 7], bildu: [6, 7], pnv: [5, 6], bng: 2, cc: 1, adelante: [1, 2] } },
  { pollster: 'sigmados', date: '2026-10-11', checked: false, url: 'https://www.sigmados.com/noticia?id=wp_news_13139', values: v(31.9, 25.3, 19.1, 7.6, 3.1, null, { erc: 2.6, junts: 1.2, bildu: 1.1, pnv: 0.9, bng: 0.9, cc: 0.5, upn: 0.2, adelante: 0.8 }), sample: 2017, seats: { pp: 135, psoe: 103, vox: 68, sumar: 9, erc: 9, junts: 7, bildu: 6, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 2 } },
  // SocioMétrica
  // 22 nov (publicada en la noche del 22, campo acumulado 1 sept–22 nov, 7.266 entrevistas): PP sin UPN 31,7 % (132 escaños; con UPN-PP, 32,1 % y 134). FA = 5,98 %, la suma que da Mapa Electoral (la publicación da FA 4,5 % y FV 1,0 % por separado, sin desglose de Ara Més ni UPCan); 8 escaños, también de Mapa Electoral (Electografica desglosa FA 4, Compromís-Front Valencià 3 y Chunta 1). Podemos 1,0 % en solitario, sin escaños. ERC, Junts, Bildu, PNV, BNG, CCa y Adelante, de Mapa Electoral y de la publicación: sin escaños por partido, porque no se han cruzado en una fuente que los dé por separado. Sin leer la página original de El Español: checked: false.
  { pollster: 'sociometrica', date: '2026-11-22', checked: false, url: 'https://www.elespanol.com/espana/politica/20261122/penultimo-sondeo-pp-aventaja-psoe-puntos-escanos-oposicion-semana/1003744468035_0.html', values: vFa(31.7, 28.7, 18.4, 5.98, 1.0, 2.2, { erc: 2.5, junts: 1.4, bildu: 1.5, pnv: 0.8, bng: 1.0, cc: 0.4, adelante: 1.7 }), sample: 7266, seats: { pp: 134, psoe: 114, vox: 63, fa: 8, podemos: 0 } },
  // 21 nov: PP sin UPN (31,8 %; con UPN-PP, 32,5 % y 134 escaños); FA es la suma FA (4,5) + Front Valencià (1,0) + Ara Més (0,2) + UPCan (0,2): 5,9 %, 7 escaños (5 + 2). Podemos (1,0) queda aparte. Cifras de Electografica; el enlace es el suyo porque el «Fuente» que da apunta al artículo de El Español del 15 nov. Muestra y campo (1-IX a 21-XI) acumulados.
  { pollster: 'sociometrica', date: '2026-11-21', checked: false, url: 'https://www.electografica.com/2026/11/encuesta-sociometrica-261121.html', values: vFa(31.8, 28.5, 18.8, 5.9, 1.0, 2.2, { erc: 2.5, junts: 1.3, bildu: 1.5, pnv: 0.8, bng: 1.0, cc: 0.4, adelante: 1.6 }), sample: 6842, seats: { pp: 134, psoe: 113, vox: 65, fa: 7, podemos: 0, erc: 9, junts: 5, bildu: 8, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  // 15 nov: PP sin UPN (31,6 %; con UPN-PP, 32,1 % y 132 escaños); FA es la suma FA + Front Valencià + UPCan (6,0 %, 9 escaños).
  { pollster: 'sociometrica', date: '2026-11-15', checked: true, url: 'https://www.elespanol.com/espana/politica/20261115/sondeo-semanas-psoe-recorta-medio-punto-pp-derecha-mantiene-escanos-frente-sanchez-socios/1003744459132_0.html', values: vFa(31.6, 27.8, 19.1, 6.0, 1.2, 2.2, { erc: 2.5, bildu: 1.5, adelante: 1.6 }), sample: 5923, seats: { pp: 132, psoe: 110, vox: 67, fa: 9, podemos: 0, salf: 0, erc: 9, junts: 5, bildu: 8, adelante: 3 } },
  { pollster: 'sociometrica', date: '2026-11-08', checked: true, url: 'https://www.elespanol.com/espana/politica/20261108/pp-vox-suman-escanos-sanchez-recupera-perdio-urda-dimision-puente-sondeo-noche/1003744450645_0.html', values: vFa(32.0, 27.7, 18.9, 5.9, 1.2, 2.2, { erc: 2.4, junts: 1.4, bildu: 1.6, pnv: 0.8, bng: 1.0, cc: 0.5, adelante: 1.7 }), sample: 5460, seats: { pp: 136, psoe: 108, vox: 66, fa: 8, salf: 0, erc: 9, junts: 6, bildu: 8, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  { pollster: 'sociometrica', date: '2026-11-01', checked: true, url: 'https://www.elespanol.com/espana/politica/20261101/primer-sondeo-tragedia-pp-vox-amplian-ventaja-sanchez-sigue-cayendo-pese-vaciar-frente-amplio/1003744442810_0.html', values: vFa(32.2, 26.6, 19.1, 6.1, 1.7, 2.5, { erc: 2.5, junts: 1.4, bildu: 1.4, pnv: 0.8, bng: 0.9, cc: 0.5, adelante: 1.4 }), sample: 4893, seats: { pp: 139, psoe: 106, vox: 64, fa: 10, erc: 9, junts: 6, bildu: 7, pnv: 4, bng: 2, cc: 1, adelante: 2 } },
  { pollster: 'sociometrica', date: '2026-10-26', checked: false, url: 'https://www.elespanol.com/espana/politica/20261025/izquierda-no-remonta-sanchez-gana-escanos-costa-frente-podemos-sondeo-noche/1003744434105_0.html', values: vFa(32.4, 27.0, 18.6, 6.1, 1.8, 2.4, { erc: 2.6, junts: 1.7, bildu: 1.3, pnv: 0.8, bng: 0.9, cc: 0.4, adelante: 1.2 }), sample: 3223, seats: { pp: 137, psoe: 108, vox: 63, fa: 10, erc: 9, junts: 7, bildu: 7, pnv: 4, bng: 2, cc: 1, adelante: 2 } },
  { pollster: 'sociometrica', date: '2026-10-12', checked: false, url: 'https://www.elespanol.com/espana/politica/20261011/sanchez-no-funciona-apropiarse-maricarmen-huelga-oposicion-cae-sondeo-noche/1003744416762_0.html', values: v(32.6, 26.2, 18.8, 5.8, 2.8, 2.1, { erc: 2.0, junts: 1.5, bildu: 1.3, pnv: 0.8, bng: 0.9, cc: 0.5, upn: 0.2, adelante: 0.9 }), sample: 1000, seats: { pp: 141, psoe: 104, vox: 64, sumar: 8, erc: 8, junts: 6, bildu: 7, pnv: 4, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  { pollster: 'sociometrica', date: '2026-10-04', checked: false, url: 'https://www.elespanol.com/espana/politica/20261004/sondeo-expres-sanchez-disuelve-congreso-pp-hoy-diputados-psoe-vox-sumar/1003744408026_0.html', values: v(33.4, 26.5, 18.1, 5.3, 3.1, 2.2, { erc: 2.2, junts: 1.2, bildu: 1.3, pnv: 1.0, bng: 0.9, cc: 0.6, upn: 0.2 }), sample: 1000, seats: { pp: 143, psoe: 106, vox: 62, sumar: 6, erc: 8, junts: 5, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  { pollster: 'sociometrica', date: '2026-09-27', checked: false, url: 'https://www.elespanol.com/espana/politica/20260927/sanchez-devora-socios-pide-ayuda-decreto-maricarmen-sumar-junts-pnv-bajarian-escanos/1003744398872_0.html', values: v(33.9, 25.7, 18.0, 5.7, 3.3, 2.0, { erc: 2.0, junts: 1.2, bildu: 1.4, pnv: 0.9, bng: 1.0, cc: 0.6, upn: 0.2, adelante: 1.0 }), sample: 1200, seats: { pp: 145, psoe: 107, vox: 62, sumar: 5, erc: 8, junts: 4, bildu: 7, pnv: 4, bng: 2, cc: 1, upn: 1, adelante: 2 } },
  { pollster: 'sociometrica', date: '2026-08-10', checked: false, url: 'https://www.elespanol.com/espana/politica/20260809/ceuta-hunde-sanchez-pp-sube-suma-escanos-gobierno-baja-sondeo-espanol-invasion/1003744347988_0.html', values: v(33.8, 26.0, 17.0, 5.9, 2.7, 2.3, { erc: 2.1, junts: 1.5, bildu: 1.5, pnv: 1.1, bng: 0.9, cc: 0.5, upn: 0.2, adelante: 1.0 }), sample: 1690, seats: { pp: 149, psoe: 103, vox: 57, sumar: 7, erc: 8, junts: 6, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  // GAD3
  // 22 nov (campo 16-19 nov, barómetro II): FA suma FA (5,8) + Compromís (1,5) + CHA (0,3) + Ara Més (0,2): 7,8 % y 14 escaños (7 + 5 + 1 + 1). PP en coalición con UPN-PP (una sola cifra). No publica Podemos ni SALF. Sin enlace de ABC: el de la ficha de GAD3. Muestra: 1.501 (el margen de error cita 1.502).
  { pollster: 'gad3', date: '2026-11-22', checked: false, url: 'https://www.gad3.com/barometro-abc-i-estimacion-de-voto-nacional-noviembre-2026-ii/', values: vFa(31.1, 28.4, 18.1, 7.8, null, null, { erc: 2.6, junts: 1.1, bildu: 1.6, pnv: 1.0, bng: 0.9, cc: 0.3, adelante: 1.9 }), sample: 1501, seats: { pp: 131, psoe: 110, vox: 63, fa: 14, erc: 11, junts: 4, bildu: 7, pnv: 4, bng: 2, cc: 1, adelante: 3 } },
  { pollster: 'gad3', date: '2026-11-09', checked: false, url: 'https://www.gad3.com/barometro-abc-i-estimacion-de-voto-nacional-noviembre-2026/', values: vFa(31.9, 25.9, 18.6, 7.5, 1.4, 1.3, { erc: 2.7, junts: 1.4, bildu: 1.5, pnv: 0.9, bng: 0.9, cc: 0.4, adelante: 1.6 }), sample: 1502, seats: { pp: 136, psoe: 103, vox: 63, fa: 12, erc: 12, junts: 5, bildu: 8, pnv: 4, bng: 2, cc: 1, adelante: 3 } },
  { pollster: 'gad3', date: '2026-10-12', checked: false, url: 'https://www.gad3.com/barometro-abc-estimacion-de-voto-nacional-octubre-2026/', values: v(31.4, 26.4, 18.2, 7.4, 2.3, 1.8, { erc: 2.6, junts: 1.5, bildu: 1.5, pnv: 1.0, bng: 0.9, cc: 0.4, upn: 0.1, adelante: 1.0 }), sample: 1077, seats: { pp: 133, psoe: 107, vox: 65, sumar: 10, erc: 10, junts: 5, bildu: 8, pnv: 6, bng: 2, cc: 1, upn: 0, adelante: 1 } },
  { pollster: 'gad3', date: '2026-09-07', checked: false, url: 'https://www.gad3.com/barometro-abc-estimacion-de-voto-nacional-septiembre-2026/', values: v(31.1, 26.1, 19.2, 7.0, 3.1, 1.5, { erc: 2.3, junts: 1.2, bildu: 1.5, pnv: 0.9, bng: 0.9, cc: 0.3, upn: 0.2, adelante: 1.0 }), sample: 1010, seats: { pp: 133, psoe: 105, vox: 69, sumar: 9, erc: 10, junts: 4, bildu: 7, pnv: 6, bng: 2, cc: 1, upn: 1, adelante: 1 } },
  // IMOP
  // 23 nov (5.ª oleada para El Confidencial): PP (31,7 %, 131), PSOE (27,4 %, 110) y Vox (18,3 %, 64) confirmados en El Confidencial; FA (7,4 %, 11), Podemos (0,7 %, 0), SALF (1,9 %, 0), Adelante (2,0 %, 3) y muestra (1.200) de Mapa Electoral (checked: false).
  { pollster: 'imop', date: '2026-11-23', checked: false, url: 'https://www.elconfidencial.com/espana/2026-11-23/pp-vox-recta-final-margen-19-escanos-investidura-2023_4470100/', values: vFa(31.7, 27.4, 18.3, 7.4, 0.7, 1.9, { adelante: 2.0 }), sample: 1200, seats: { pp: 131, psoe: 110, vox: 64, fa: 11, podemos: 0, salf: 0, erc: 12, junts: 4, bildu: 7, pnv: 4, bng: 3, cc: 1, adelante: 3 } },
  // 16 nov (4.ª oleada) y 8 nov (3.ª oleada): cifras de Mapa Electoral, con enlace oficial de El Confidencial (checked: false).
  { pollster: 'imop', date: '2026-11-16', checked: false, url: 'https://www.elconfidencial.com/espana/2026-11-16/encuesta-imop-cuarta-oleada-derecha-ventaja-izquierdas-territoriales-frente-amplio-podemos-cbtr_4464610/', values: vFa(31.5, 26.9, 19.0, 6.9, 0.9, 1.6, { adelante: 2.2 }), sample: 1000, seats: { pp: 128, psoe: 109, vox: 66, fa: 11, podemos: 0, salf: 0, adelante: 4 } },
  { pollster: 'imop', date: '2026-11-08', checked: false, url: 'https://www.elconfidencial.com/espana/2026-11-08/derecha-recupera-seis-escanos-izquierda-castigo-psoe-urda-cbtr_4460900/', values: vFa(29.8, 25.9, 19.9, 8.1, 1.2, 1.7, { adelante: 1.8 }), sample: 1000, seats: { pp: 126, psoe: 106, vox: 70, fa: 13, podemos: 1, salf: 0, adelante: 4 } },
  // GESOP
  // 23 nov (para Prensa Ibérica, campo 18-21 nov, telefónica, 905 entrevistas): PP (32,9 %, 131-136), PSOE (29,0 %, 110-116) y Vox (17,5 %) confirmados en El Periódico; resto de Mapa Electoral y Electografica (Podemos 0,7 %, 0 escaños; ERC 2,5 %; FA 6,7 %, 7-10 escaños; SALF 1,3 %, 0). Al completar la tabla con agregadores, queda checked: false.
  { pollster: 'gesop', date: '2026-11-23', checked: false, url: 'https://www.elperiodico.com/es/politica/20261123/encuesta-elecciones-generales-espana-2026-sondeo-29n-136693938', values: vFa(32.9, 29.0, 17.5, 6.7, 0.7, 1.3, { erc: 2.5, junts: 1.1 }), sample: 905, seats: { pp: [131, 136], psoe: [110, 116], vox: [56, 63], fa: [7, 10], podemos: 0, salf: 0, junts: [3, 5], bildu: 6, pnv: 5, bng: 1, cc: 1 } },
  // Ipsos
  // 22 nov (para La Vanguardia): enlace oficial de La Vanguardia; cifras de Mapa Electoral (muestra 1.999, FA 5,8 %, Podemos 1,1 %, SALF 1,9 %, Adelante 2,1 %) y Demócrata para el desglose de escaños territoriales (checked: false). PP con UPN (30,3 %, 127 escaños).
  { pollster: 'ipsos', date: '2026-11-22', checked: false, url: 'https://www.lavanguardia.com/politica/20261122/11689982/derecha-suma-mayoria-absoluta-psoe-acerca-pp.html', values: vFa(30.3, 29.8, 17.9, 5.8, 1.1, 1.9, { adelante: 2.1 }), sample: 1999, seats: { pp: 127, psoe: 119, vox: 63, fa: 9, podemos: 0, salf: 0, erc: 11, junts: 5, bildu: 7, pnv: 3, bng: 1, cc: 1, adelante: 4 } },
  // NC Report
  // 23 nov: leído en el artículo original de La Razón (checked: true). PP sin UPN (31,9 %, 130-133; Mapa Electoral suma UPN hasta 132-135) y FA sin socios (5,6 %, 8-9; Mapa Electoral suma socios hasta 7,3 %, 12-13). Sin Podemos, SALF ni muestra en el cuerpo del artículo.
  { pollster: 'ncreport', date: '2026-11-23', checked: true, url: 'https://www.larazon.es/espana/sanchez-remonta-alterar-mayoria-ppvox_202611236b032823c0d5c85b96c4a76e.html', values: vFa(31.9, 27.2, 19.0, 5.6, null, null), seats: { pp: [130, 133], psoe: [108, 111], vox: [64, 66], fa: [8, 9] } },
  // 16 nov: PP (32,1 %, 135-137 sin UPN), PSOE (26,1 %, 102-104), Vox (19,0 %, 66-68) y FA (7,6 %, 11-12) confirmados en el texto de La Razón del 23 nov; Podemos (1,5 %, 0-1), Adelante (1,8 %, 3) y muestra (1.000) de Mapa Electoral (checked: false).
  { pollster: 'ncreport', date: '2026-11-16', checked: false, url: 'https://www.larazon.es/espana/mayoria-vox-resiste-arranque-campana-205-diputados_202611166afa6889ea8d89799786d4d1.html', values: vFa(32.1, 26.1, 19.0, 7.6, 1.5, null, { adelante: 1.8 }), sample: 1000, seats: { pp: [135, 137], psoe: [102, 104], vox: [66, 68], fa: [11, 12], podemos: [0, 1], adelante: 3 } },
  // 9 nov (campo 2-5 nov): sin abrir La Razón; cifras de Demócrata (única fuente). PP sin UPN: NC Report publica UPN aparte (0,4 %, 2 escaños). Sin SALF ni muestra.
  { pollster: 'ncreport', date: '2026-11-09', checked: false, url: 'https://www.larazon.es/espana/gana-7-puntos-psoe-que-cae-100-escanos_202611096af1319903bbf30bb045239e.html', values: vFa(32.6, 25.6, 19.3, 6.9, 2.4, null, { erc: 2.0, junts: 1.8, bildu: 1.4, pnv: 0.9, bng: 0.8, cc: 0.4, upn: 0.4, adelante: 1.2 }), sample: 1000, seats: { pp: [136, 138], psoe: [99, 101], vox: [67, 69], fa: [9, 10], podemos: [0, 1], erc: [7, 8], junts: [8, 9], bildu: [6, 7], pnv: [4, 5], bng: 2, cc: 1, upn: 2, adelante: [2, 3] } },
  // Target Point
  // 23 nov (campo 20-21 nov, 1.206 entrevistas): leído en el artículo original de El Debate (checked: true). El texto da PP (31,5 %, 127-131), PSOE (28,8 %, 114-118), Vox (17,4 %, 59-63), FA (7,3 %), Podemos (1,0 %) y ERC (10-12); no da en texto SALF ni escaños de FA (Mapa Electoral recoge FA 11-12, SALF 1,8 % y Adelante 1,6 %).
  { pollster: 'targetpoint', date: '2026-11-23', checked: true, url: 'https://www.eldebate.com/espana/20261123/feijoo-sanchez-crecen-pelean-primer-puesto-mayoria-absoluta-derecha-sigue-solida_483831.html', values: vFa(31.5, 28.8, 17.4, 7.3, 1.0, null), sample: 1206, seats: { pp: [127, 131], psoe: [114, 118], vox: [59, 63], erc: [10, 12] } },
  // 16 nov (campo 12 nov, 1.013 entrevistas CAWI): sin abrir El Debate; cifras de Demócrata (versión inglesa, única fuente). No consta si FA incluye socios ni si el PP incluye UPN. Sin SALF. Escaños de Vox y FA puntuales («66», «unos 11»).
  { pollster: 'targetpoint', date: '2026-11-16', checked: false, url: 'https://www.eldebate.com/espana/20261116/psoe-activa-medio-millon-votantes-recorta-no-pone-riesgo-mayoria-absoluta-pp-vox_480764.html', values: vFa(30.6, 27.0, 18.7, 7.3, 1.6, null), sample: 1013, seats: { pp: [125, 129], psoe: [110, 114], vox: 66, fa: 11, podemos: [0, 1], erc: [13, 14], junts: [3, 4], pnv: 3, bng: [1, 2], adelante: [3, 4] } },
  // Hamalgama Métrica
  // 22 nov (campo 10-18 nov, 1.000 entrevistas CATI): leído en Vozpópuli (checked: true). PP sin UPN (130 escaños; UPN aparte, 2). Solo publica en texto el voto de PP, PSOE, Vox y FA (6,5 %): Podemos y SALF van null en porcentaje (0 escaños ambos). Escaños del texto (suman 350).
  { pollster: 'hamalgama', date: '2026-11-22', checked: true, url: 'https://www.vozpopuli.com/espana/politica/pp-y-vox-se-disparan-a-210-escanos-y-frenan-en-seco-el-espiritu-de-remontada-del-psoe.html', values: vFa(31.8, 25.4, 20.6, 6.5, null, null), sample: 1000, seats: { pp: 130, psoe: 98, vox: 80, fa: 9, podemos: 0, salf: 0, erc: 9, junts: 6, bildu: 7, pnv: 4, bng: 2, upn: 2, adelante: 3 } },
  // 2 nov (campo 22-28 oct, 1.000 entrevistas CATI): leído en Vozpópuli. PP sin UPN (UPN aparte, 2 escaños). Solo publica en texto el voto de PP, PSOE, Vox y FA (5,4 %; no consta si incluye socios): Podemos y SALF van null. Escaños del texto (suman 350).
  { pollster: 'hamalgama', date: '2026-11-02', checked: true, url: 'https://www.vozpopuli.com/espana/politica/pp-y-vox-suman-ya-un-techo-historico-de-127-millones-de-votos-y-lograrian-205-escanos.html', values: vFa(32.0, 26.4, 19.9, 5.4, null, null), sample: 1000, seats: { pp: 135, psoe: 106, vox: 70, fa: 7, podemos: 1, salf: 0, erc: 7, junts: 7, bildu: 7, pnv: 4, bng: 2, upn: 2, adelante: 2 } },
];
