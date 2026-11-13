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
  title: string;
  description: string;
  source: 'official' | 'derived';
  /** The base of a derived date, for the reader who wants to check it. */
  basis?: string;
  /** Link to the document of the site that supports an official date. */
  documentPath?: string;
}

export const ELECTION_DATE = '2026-11-29';

export const calendarEvents: CalendarEvent[] = [
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
    title: 'Proclamación de candidaturas',
    description: 'Las Juntas Electorales proclaman las candidaturas al Congreso y al Senado.',
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
    description: 'Votación en los colegios electorales, de 9:00 a 20:00. Se elige el Congreso y 208 de los 265 escaños del Senado.',
    source: 'derived',
    basis: 'Fecha de la convocatoria. Horario: LOREG, art. 85.',
  },
  {
    id: 'escrutinio-general',
    date: '2026-12-02',
    title: 'Escrutinio general',
    description: 'Las Juntas Electorales Provinciales hacen el recuento oficial. Hasta entonces, los resultados son provisionales.',
    source: 'derived',
    basis: 'LOREG, art. 103: el tercer día siguiente a la votación.',
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
