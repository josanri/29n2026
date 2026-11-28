/**
 * Electoral calendar of the general election of 29 November 2026.
 *
 * `source: 'official'` = the date comes from a document of the site (the official proclamation).
 * `source: 'derived'` = the date follows from the election day and the deadlines of the LOREG
 * (Ley Orgánica 5/1985). The decree of the Government can fix a different day: check it in the BOE.
 */

export interface CalendarEvent {
  id: string;
  /** Local date (Spain) in the form YYYY-MM-DD. */
  date: string;
  /** Local last day (included) of an event of several days. */
  endDate?: string;
  /** Local times (Spain, winter time) for an event with hours. Without it, the event lasts the whole day. */
  time?: { from: string; to: string };
  /** The hours of the events inside the day (for example, the night of the election), in order. */
  schedule?: ScheduleItem[];
  title: string;
  description: string;
  source: 'official' | 'derived';
  /** The base of a derived date, for the reader who wants to check it. */
  basis?: string;
  /** Link to the document of the site that supports an official date. */
  documentPath?: string;
  /** Link to the page of the official site (Ministry of the Interior) that explains the event. */
  officialUrl?: string;
}

export interface ScheduleItem {
  /** Local time (Spain, winter time), `HH:MM`. */
  time: string;
  label: string;
  /** Page where the reader can follow this step. */
  url?: string;
}

/** Official site of the Ministry of the Interior for this election. */
export const OFFICIAL_SITE = 'https://29neleccionesgenerales.es';
/** Official site of the provisional results (Ministry of the Interior). It opens on the day of the election. */
export const OFFICIAL_RESULTS_SITE = 'https://resultados.29neleccionesgenerales.es/';

/** The day of the election, as the official results site publishes it (Spain, peninsular time). */
export const ELECTION_DAY_SCHEDULE: ScheduleItem[] = [
  { time: '08:00', label: 'Constitución de las Mesas' },
  { time: '14:00', label: 'Primer avance de participación' },
  { time: '18:00', label: 'Segundo avance de participación' },
  { time: '20:00', label: 'Cierre de los colegios e inicio del escrutinio' },
  { time: '21:00', label: 'Resultados provisionales', url: OFFICIAL_RESULTS_SITE },
];
export const OFFICIAL_EMAIL = 'infoelectoral@interior.es';

export const ELECTION_DATE = '2026-11-29';

const events: CalendarEvent[] = [
  {
    id: 'convocatoria',
    date: '2026-10-06',
    title: 'Convocatoria de las elecciones',
    description: 'El BOE publica el real decreto de disolución de las Cortes y de convocatoria de las elecciones. Empieza el calendario electoral.',
    source: 'derived',
    basis: 'LOREG, art. 42: las elecciones se celebran el día quincuagésimo cuarto posterior a la convocatoria.',
  },
  {
    id: 'fin-presentacion-candidaturas',
    date: '2026-10-26',
    title: 'Fin del plazo para presentar candidaturas',
    description: 'Último día para que los partidos, federaciones, coaliciones y agrupaciones de electores presenten sus listas ante las Juntas Electorales.',
    source: 'derived',
    basis: 'LOREG, art. 45: las candidaturas se presentan entre el decimoquinto y el vigésimo día posteriores a la convocatoria.',
  },
  {
    id: 'proclamacion-candidaturas',
    date: '2026-11-03',
    title: 'Candidaturas proclamadas',
    description: 'Las Juntas Electorales proclamaron el 2 de noviembre las candidaturas al Congreso y al Senado. El BOE las publica el 3 de noviembre.',
    source: 'official',
    documentPath: '/datos-electorales/candidaturas-proclamadas-2026.pdf',
  },
  {
    id: 'correccion-proclamacion',
    date: '2026-11-07',
    title: 'Corrección de la proclamación',
    description: 'Publicación de la corrección oficial de las candidaturas proclamadas.',
    source: 'official',
    documentPath: '/datos-electorales/candidaturas-proclamadas-2026-correccion.pdf',
  },
  {
    id: 'consulta-censo',
    date: '2026-10-12',
    endDate: '2026-10-19',
    title: 'Consulta del censo y reclamaciones',
    description:
      'Puedes comprobar tus datos del censo electoral en tu ayuntamiento, en el consulado o en la Delegación Provincial de la Oficina del Censo Electoral, y reclamar si hay un error.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'inicio-campana',
    date: '2026-11-13',
    endDate: '2026-11-27',
    title: 'Campaña electoral',
    description:
      'Quince días de campaña: desde el viernes 13 hasta el viernes 27 de noviembre. Los partidos piden el voto con mítines y propaganda.',
    source: 'derived',
    basis: 'LOREG, art. 51: la campaña dura quince días y termina a las 0 horas del día anterior a la jornada de reflexión.',
  },
  {
    id: 'fin-solicitud-voto-correo',
    date: '2026-11-19',
    title: 'Fin de la solicitud del voto por correo',
    description:
      'Último día para pedir el voto por correo desde España. Puedes hacerlo en cualquier oficina de Correos o por vía electrónica, con un certificado digital o el DNI electrónico y la aplicación AutoFirma.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/como-votar/voto-por-correo-desde-espana/`,
  },
  {
    id: 'envio-documentacion-voto-correo',
    date: '2026-11-09',
    endDate: '2026-11-22',
    title: 'Voto por correo: envío de la documentación',
    description:
      'La Oficina del Censo Electoral envía a quien lo ha pedido la documentación para votar por correo (LOREG, art. 73.2).',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'devolucion-voto-correo',
    date: '2026-11-09',
    endDate: '2026-11-26',
    title: 'Voto por correo: entrega del voto',
    description:
      'Las personas que votan por correo entregan su voto en una oficina de Correos (LOREG, art. 73.3). El plazo termina el jueves 26 de noviembre a las 14:00, según amplió la Junta Electoral Central. Quien está temporalmente fuera (ERTA) tiene hasta el 25 de noviembre para que su papeleta llegue a la Mesa; el envío empieza el 3 de noviembre (art. 74).',
    source: 'official',
    basis: 'Acuerdo de la Junta Electoral Central, que amplió el plazo de depósito (nota de prensa de Correos del 20 de noviembre de 2026). Antes terminaba el 25 de noviembre.',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/como-votar/voto-por-correo-desde-espana/`,
  },
  {
    id: 'jornada-reflexion',
    date: '2026-11-28',
    title: 'Jornada de reflexión',
    description: 'No se permite pedir el voto ni hacer propaganda. En los cinco días previos a la votación tampoco se publican encuestas.',
    source: 'derived',
    basis: 'LOREG, art. 53 (reflexión) y art. 69 (encuestas): es el día anterior a la votación.',
  },
  {
    id: 'votacion',
    date: '2026-11-29',
    time: { from: '09:00', to: '20:00' },
    title: 'Día de las elecciones',
    description: 'Votación en los colegios electorales, de 9:00 a 20:00. Se eligen los 350 diputados del Congreso y 209 senadores. Para identificarte vale el DNI, la app MiDNI, el pasaporte o el permiso de conducir.',
    source: 'derived',
    basis: 'Fecha de la convocatoria. Horario: LOREG, art. 85.',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/como-votar/voto-presencial`,
    schedule: ELECTION_DAY_SCHEDULE,
  },
  {
    id: 'escrutinio-general',
    date: '2026-12-04',
    endDate: '2026-12-07',
    title: 'Escrutinio general',
    description: 'Las Juntas Electorales Provinciales hacen el recuento oficial. Hasta entonces, los resultados son provisionales.',
    source: 'official',
    basis: 'LOREG, art. 103 y siguientes: es el quinto día tras la votación y debe terminar antes del octavo, el 7 de diciembre. Otros calendarios muestran el 2 de diciembre, que es el tercer día.',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'reclamaciones-escrutinio',
    date: '2026-12-04',
    endDate: '2026-12-12',
    title: 'Reclamaciones y resolución del escrutinio',
    description:
      'Los representantes y apoderados pueden reclamar contra el escrutinio del 4 al 8 de diciembre. La Junta Provincial resuelve y envía el expediente a la Junta Electoral Central hasta el 12 de diciembre.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'solicitud-voto-erta',
    date: '2026-10-06',
    endDate: '2026-10-31',
    title: 'Solicitud del voto de residentes temporales en el extranjero (ERTA)',
    description:
      'Las personas que están temporalmente en el extranjero piden votar con el impreso de solicitud ERTA.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'designacion-mesas',
    date: '2026-10-31',
    endDate: '2026-11-07',
    title: 'Designación de los miembros de las Mesas',
    description:
      'Se notifica a las personas elegidas por sorteo como presidente o vocal de Mesa y se les entrega el manual de instrucciones.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-mesas/informacion-general/informacion-general-sobre-las-mesas-electorales`,
  },
  {
    id: 'alegaciones-mesas',
    date: '2026-11-01',
    endDate: '2026-11-14',
    title: 'Alegar una causa para no formar parte de una Mesa',
    description:
      'Quien ha sido designado para una Mesa puede alegar ante la Junta Electoral de Zona una causa que se lo impide.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-mesas/informacion-general/informacion-general-sobre-las-mesas-electorales`,
  },
  {
    id: 'cera-papeletas-descargables',
    date: '2026-11-02',
    endDate: '2026-11-07',
    title: 'Voto en el extranjero (CERA): papeletas descargables',
    description:
      'Los residentes permanentes en el extranjero (CERA) pueden descargar sus papeletas.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'cera-voto-correo-consulado',
    date: '2026-11-03',
    endDate: '2026-11-24',
    title: 'Voto en el extranjero (CERA): envío al consulado',
    description:
      'Los electores CERA que votan por correo envían su voto al consulado.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'secciones-locales-mesas-definitivos',
    date: '2026-11-19',
    endDate: '2026-11-28',
    title: 'Secciones, locales y Mesas definitivos',
    description:
      'Se publican y se exponen, en los ayuntamientos y en línea, las secciones, los locales y las Mesas definitivos.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'cera-voto-urna',
    date: '2026-11-21',
    endDate: '2026-11-26',
    title: 'Voto en el extranjero (CERA): voto en urna',
    description:
      'Los residentes en el extranjero votan en la urna del consulado o de los centros habilitados.',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'proclamacion-electos',
    date: '2026-12-08',
    endDate: '2026-12-16',
    title: 'Proclamación de los electos',
    description:
      'Las Juntas Electorales Provinciales proclaman a los candidatos electos. Antes, la Junta Electoral Central resuelve los recursos (del 7 al 15 de diciembre).',
    source: 'official',
    officialUrl: `${OFFICIAL_SITE}/informacion-general/calendarios/calendarios`,
  },
  {
    id: 'constitucion-cortes',
    date: '2026-12-24',
    title: 'Constitución de las Cortes (fecha límite)',
    description:
      'Es el último día para reunir las nuevas Cortes. El decreto de convocatoria fija el día exacto. Se elige la Mesa del Congreso y, después, el Rey abre las consultas para proponer un candidato a la investidura.',
    source: 'derived',
    basis: 'CE, art. 68.6: el Congreso electo se convoca dentro de los veinticinco días siguientes a las elecciones.',
  },
];

/** The events in order of date: the page and the files `.ics` rely on this order. */
export const calendarEvents: CalendarEvent[] = [...events].sort(
  (a, b) => a.date.localeCompare(b.date) || (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date),
);
