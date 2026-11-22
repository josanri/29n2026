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
  // 20 nov (tracking tras el debate, que Demócrata llama «noveno»; en la serie de este archivo sería el 8.º): sin el informe original; cifras de Demócrata, que no indica muestra ni trabajo de campo ni publica SALF. PP con UPN-PP incluido. FA en voto suma Frente Amplio (3,8) y las otras coaliciones de izquierda (1,8): 5,6 %. Sin escaños de FA: Demócrata los publica por separado (Frente Amplio 5, horquilla 5–6; otras coaliciones de izquierda 3, horquilla 3–5) y no para la suma del voto, así que no se suman. «Otros partidos»: 29 escaños (29–31), sin desglose territorial porque no está verificado. PP + Vox: 189 escaños.
  { pollster: '40db', date: '2026-11-20', checked: false, url: 'https://www.democrata.es/elecciones-generales-espana/tracking-diario-40db-elecciones-29n/', values: vFa(31.9, 31.2, 17.1, 5.6, 1.1, null), seats: { pp: [127, 137], psoe: [121, 129], vox: [50, 60], podemos: [0, 1] } },
  // 16 y 17 nov: FA suma Frente Amplio (3,7) y las otras coaliciones del bloque (1,7): 5,4 %. Sin el informe original: cifras de Electografica y Demócrata (checked: false).
  // 16 nov: horquilla del PP con UPN-PP (125-136); la muestra (2.500) y el campo (10-15 nov) los da una sola fuente.
  // 17 nov: SALF y muestra (2.000) de Electografica; FA y otras coaliciones sin escaños sumados (se publican por separado: FA 5-6, otras 3-5).
  // 18 nov (6.º tracking, campo 13-17 nov): FA suma Frente Amplio (3,5) y las otras coaliciones (1,7): 5,2 %. Cifras de Electografica (SALF y muestra incluidos); el informe de El País (…/informe_tracking_dia06.pdf) está bloqueado y no se ha leído, por eso el enlace es el de Electografica. Horquillas con UPN-PP incluido: PP 128-139 (la tabla da 126-137 para el PP solo y 2 para UPN-PP); PSOE 118-127 y Vox 51-60 de la tabla (el texto da centrales 131, 122 y 55). Escaños de territoriales de la etiqueta del gráfico (ERC 10, Junts 4, Bildu 7, PNV 3, BNG 2, CC 1, Adelante 3). FA (5; tabla 4-6) y otras coaliciones (3-5) sin sumar.
  // 19 nov (7.º tracking): FA suma Frente Amplio (3,7) y las otras coaliciones (1,7): 5,4 %. Cifras de Demócrata, sin enlace al informe, muestra ni campo; no da SALF. PP incluye los 2 de UPN-PP. FA 5 (5-6) y otras coaliciones (4: Compromís-FV 3, Ara Més 1, UPC 0) sin sumar. Territoriales del desglose de «Otros» (28). Única fuente: Demócrata.
  // 20 nov (campo 16-20 nov, según Demócrata): FA suma Frente Amplio (3,8) y las otras coaliciones (1,8): 5,6 % y 8 escaños (5 + 3). SALF (1,5) de la comparación de Demócrata del 21 nov. Escaños puntuales, sin horquilla; sin muestra ni informe de El País; no consta si el PP incluye UPN-PP. Única fuente: Electomanía.
  // 21 nov (campo 17-21 nov): FA suma Frente Amplio (3,6) y las otras coaliciones (1,7): 5,3 % y 8 escaños (5 + 3). Escaños puntuales, sin horquilla; sin muestra ni informe de El País; no consta si el PP incluye UPN-PP. Única fuente: Demócrata.
  { pollster: '40db', date: '2026-11-21', checked: false, url: 'https://www.democrata.es/encuestas/elecciones-generales/elecciones-generales-tracking-encuesta-29n-hoy-40db-21-noviembre-2026/', values: vFa(31.9, 31.6, 16.9, 5.3, 1.0, 1.4), seats: { pp: 131, psoe: 125, vox: 54, fa: 8, podemos: 0 } },
  { pollster: '40db', date: '2026-11-19', checked: false, url: 'https://www.democrata.es/encuestas/elecciones-generales/tracking-encuesta-29n-hoy-40db-19-noviembre-2026/', values: vFa(32.4, 30.4, 17.2, 5.4, 1.2, null), seats: { pp: [128, 140], psoe: [116, 125], vox: [53, 61], podemos: [0, 1], erc: 9, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  { pollster: '40db', date: '2026-11-18', checked: false, url: 'https://www.electografica.com/2026/11/encuesta-40db-261118.html', values: vFa(32.2, 30.7, 17.0, 5.2, 1.2, 1.7), sample: 2000, seats: { pp: [128, 139], psoe: [118, 127], vox: [51, 60], podemos: [0, 1], erc: 10, junts: 4, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  { pollster: '40db', date: '2026-11-17', checked: false, url: 'https://www.democrata.es/encuestas/elecciones-generales/elecciones-generales-tracking-encuesta-29n-hoy-40db-17-noviembre-2026/', values: vFa(31.8, 30.6, 17.5, 5.4, 1.1, 1.6), sample: 2000, seats: { pp: [126, 137], psoe: [118, 126], vox: [55, 62], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
  { pollster: '40db', date: '2026-11-16', checked: false, url: 'https://www.electografica.com/2026/11/encuesta-40db-261116.html', values: vFa(31.5, 30.3, 18.0, 5.4, 1.1, 1.7), sample: 2500, seats: { pp: [125, 136], psoe: [118, 124], vox: [57, 64], podemos: [0, 1], erc: 10, junts: 3, bildu: 7, pnv: 3, bng: 2, cc: 1, adelante: 3 } },
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
  // 20 nov: sin enlace propio de El Mundo; cifras de Electografica (8.º tracking). Sin muestra ni autonómicos publicados en el extracto consultado.
  { pollster: 'sigmados', date: '2026-11-20', checked: false, url: 'https://www.electografica.com/2026/11/encuesta-sigmados-261120.html', values: vFa(31.2, 27.6, 18.9, 7.1, 0.8, null), seats: { pp: [125, 131], psoe: [111, 117], vox: [57, 62], fa: [11, 14], podemos: 0 } },
  // 19 nov: el enlace es la publicación de El Mundo, pero no se ha podido leer; cifras del agregador Mapa Electoral. Podemos sin dato de voto.
  { pollster: 'sigmados', date: '2026-11-19', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/19/6aff2a9afc6c83886c8b459b.html', values: vFa(31.0, 27.1, 19.4, 8.9, null, null), seats: { pp: [125, 131], psoe: [110, 116], vox: [59, 64], fa: [11, 14], podemos: 0 } },
  // 18 nov: sin enlace propio de El Mundo; cifras de Electografica y Mapa Electoral (muestra 4.511). Adelante Andalucía de Mapa Electoral. Podemos sin escaños publicados.
  { pollster: 'sigmados', date: '2026-11-18', checked: false, url: 'https://www.electografica.com/2026/11/encuesta-sigmados-261118.html', values: vFa(30.7, 26.7, 19.7, 8.7, 0.8, null, { adelante: 1.7 }), sample: 4511, seats: { pp: [123, 129], psoe: [108, 114], vox: [62, 67], fa: [10, 14], adelante: [3, 5] } },
  // 16 nov: sin enlace propio de El Mundo; cifras de Electografica (horquillas, muestra) y Demócrata (FA 6,7 % y 14 escaños). FA 6,7 y 14 escaños (central de Demócrata); la fuente no detalla si incluye Front Valencià y UPCan, se asume por la serie (7,2 el 15 nov, 13-16 escaños). Horquillas de una sola fuente. Sin muestra (el tracking es acumulado y no se ha podido confirmar) ni autonómicos.
  // 17-21 nov (5.º a 9.º tracking): cifras de Electografica (21 nov: también Electomanía para el 20); el enlace es el de El Mundo, que no se ha abierto. PP incluye UPN-PP (0,2). FA suma FA + Compromís:FV + UPC: 6,7 % (17 nov: 4,9 + 1,4 + 0,4), 6,9 % (18 nov), 7,1 % (19, 20 y 21 nov; el 21 nov: 5,1 + 1,5 + 0,5). Muestra y escaños de cada entrega acumulada. Electomanía da el 20 nov con escaños puntuales (PP 129, PSOE 115, Vox 60, FA 12). Sin verificar: FA 9-12 del 21 nov frente a 11-14 del 20 nov con el mismo 7,1 %.
  { pollster: 'sigmados', date: '2026-11-21', checked: false, url: 'https://www.elmundo.es/espana/encuestas/2026/11/21/6b01d96dfc6c83e5298b4592.html', values: vFa(31.5, 28.0, 18.3, 7.1, 0.7, null, { erc: 2.7, junts: 1.5, bildu: 1.6, pnv: 0.9, bng: 1.0, cc: 0.4, adelante: 1.6 }), sample: 4511, seats: { pp: [126, 132], psoe: [112, 118], vox: [57, 62], fa: [9, 12], podemos: 0, erc: [10, 11], junts: [4, 5], bildu: [7, 8], pnv: [4, 5], bng: 2, cc: [0, 1], adelante: [2, 3] } },
  { pollster: 'sigmados', date: '2026-11-17', checked: false, url: 'https://www.elmundo.es/elecciones/elecciones-generales/2026/11/17/6afca438e9cf4a7d7a8b459c.html', values: vFa(30.7, 26.4, 19.8, 6.7, 1.2, null, { erc: 2.4, junts: 1.3, bildu: 1.5, pnv: 0.9, bng: 1.0, cc: 0.3, adelante: 1.8 }), sample: 3759, seats: { pp: [123, 129], psoe: [108, 114], vox: [62, 67], fa: [10, 14], podemos: 0, erc: [8, 9], junts: [4, 5], bildu: [6, 8], pnv: [3, 4], bng: [2, 3], cc: [0, 1], adelante: [3, 5] } },
  { pollster: 'sigmados', date: '2026-11-16', checked: false, url: 'https://www.electografica.com/2026/11/encuesta-sigmados-261116.html', values: vFa(30.8, 26.1, 19.8, 6.7, 1.4, null), seats: { pp: [123, 129], psoe: [107, 113], vox: [63, 68], fa: 14, podemos: 0 } },
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
];
