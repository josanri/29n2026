/**
 * Groups of the Congress simulator.
 *
 * `seatsNow` is the composition of the Congress of the XV legislature when it was dissolved
 * (6 October 2026), from the infobox of es.wikipedia.org/wiki/XV_Legislatura_de_España:
 * PP 137, PSOE 121, Vox 32, Sumar 26, Junts 7, ERC 7, EH Bildu 6, EAJ-PNV 5 and Grupo Mixto 9
 * (Podemos 4, BNG 1, CC 1, UPN 1, Compromís 1 and one more deputy). The page gives no date for the figures.
 * `seats2023` are the results of the general election of 2023 by candidacy
 * (PSOE includes the PSC; Sumar includes its coalition parties). Sumar runs on 29N as Frente Amplio (FA).
 *
 * The order is only visual: it goes from the left to the right of the hemicycle.
 * It is an approximation: no source that was read gives the real seating order.
 * The colors are the usual colors of each party. They are not read from the program files,
 * which use their own color to theme the page of each party.
 */

export const CONGRESS_SEATS = 350;
/** Absolute majority: half of the seats plus one. */
export const ABSOLUTE_MAJORITY = 176;

export interface CongressGroup {
  id: string;
  acronym: string;
  name: string;
  /** Seats when the Congress was dissolved (6 October 2026). */
  seatsNow: number;
  /** Seats of the election of 2023. */
  seats2023: number;
  /** The usual color of the party. */
  color: string;
  /** The id of its program on this site, when it has one. */
  programId?: string;
  /**
   * The name it takes for the new election, when it changes. The presets of the old Congress (now, 2023) use the
   * old name and color; a Congress built from zero uses this one.
   */
  next?: { acronym: string; name: string; color: string; programId?: string };
}

export const congressGroups: CongressGroup[] = [
  // Sumar en el Congreso disuelto y en 2023; el 29N se presenta como Frente Amplio (registrado el 16 de octubre de 2026),
  // con otro color: el bermellón de su logotipo, el mismo de su ficha (programas/fa.json).
  {
    id: 'sumar',
    acronym: 'SUMAR',
    name: 'Sumar',
    seatsNow: 26,
    seats2023: 31,
    color: '#e6007e',
    next: { acronym: 'FA', name: 'Frente Amplio (antes Sumar)', color: '#f03c00', programId: 'fa' },
  },
  { id: 'podemos', acronym: 'PODEMOS', name: 'Podemos', seatsNow: 4, seats2023: 0, color: '#6b2d8f', programId: 'podemos' },
  { id: 'compromis', acronym: 'Compromís', name: 'Més-Compromís', seatsNow: 1, seats2023: 0, color: '#f0861e' },
  { id: 'psoe', acronym: 'PSOE', name: 'Partido Socialista Obrero Español', seatsNow: 121, seats2023: 121, color: '#e30613', programId: 'psoe' },
  { id: 'erc', acronym: 'ERC', name: 'Esquerra Republicana de Catalunya', seatsNow: 7, seats2023: 7, color: '#ffa51f', programId: 'erc' },
  { id: 'bildu', acronym: 'EH Bildu', name: 'Euskal Herria Bildu', seatsNow: 6, seats2023: 6, color: '#00c1a2', programId: 'eh-bildu' },
  { id: 'bng', acronym: 'BNG', name: 'Bloque Nacionalista Galego', seatsNow: 1, seats2023: 1, color: '#5bb5e6', programId: 'bng' },
  { id: 'junts', acronym: 'Junts', name: 'Junts per Catalunya', seatsNow: 7, seats2023: 7, color: '#00a99d', programId: 'jxcat' },
  { id: 'pnv', acronym: 'EAJ-PNV', name: 'Partido Nacionalista Vasco', seatsNow: 5, seats2023: 5, color: '#2e8b57', programId: 'eaj-pnv' },
  { id: 'cc', acronym: 'CC', name: 'Coalición Canaria', seatsNow: 1, seats2023: 1, color: '#f4d03f', programId: 'cc' },
  { id: 'upn', acronym: 'UPN', name: 'Unión del Pueblo Navarro', seatsNow: 1, seats2023: 1, color: '#1b4a8a', programId: 'upn' },
  { id: 'pp', acronym: 'PP', name: 'Partido Popular', seatsNow: 137, seats2023: 137, color: '#1d84ce', programId: 'pp' },
  { id: 'vox', acronym: 'VOX', name: 'Vox', seatsNow: 32, seats2023: 33, color: '#63be21', programId: 'vox' },
  { id: 'otros', acronym: 'Otros', name: 'Resto del Grupo Mixto', seatsNow: 1, seats2023: 0, color: '#8a857a' },
];
