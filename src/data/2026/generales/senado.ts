/**
 * Groups of the Senate simulator.
 *
 * The Senate of the XV legislature has 266 seats: 208 elected directly in the general election of
 * 23 July 2023 (`seats2023`) and 58 designated by the parliaments of the Autonomous Communities
 * (`seatsAutonomous`, art. 69.5 of the Constitution). The 58 regional-parliament seats do not renew
 * on 29N; only the 208 direct seats are elected in the general election.
 *
 * `seatsNow` is the sum by party of origin (`seats2023 + seatsAutonomous`): PP 143 (120 + 23),
 * PSOE 91 (72 + 19, including PSC), Vox 5 (0 + 5), EH Bildu 5 (4 + 1), EAJ-PNV 5 (4 + 1),
 * ERC 4 (3 + 1), Junts 4 (1 + 3), BNG 1 (0 + 1), CC 1 (0 + 1), Compromís 1 (0 + 1),
 * Sumar / Más Madrid 1 (0 + 1), Geroa Bai 1 (0 + 1), UPN 1 (1 + 0), ASG 1 (1 + 0), AHI 1 (1 + 0)
 * and Eivissa i Formentera al Senat 1 (1 + 0). Inside the chamber, parliamentary groups borrow
 * senators to reach the minimum required by the rules, so group counts differ slightly from party counts.
 *
 * The order is only visual: it goes from the left to the right of the hemicycle.
 */

export const SENATE_SEATS = 266;
/** Senators elected directly in provincial and insular constituencies. */
export const SENATE_ELECTED_SEATS = 208;
/** Senators designated by the parliaments of the Autonomous Communities (art. 69.5 CE). */
export const SENATE_AUTONOMOUS_SEATS = 58;
/** Absolute majority: half of the seats plus one (art. 90.2 veto, art. 155 CE). */
export const SENATE_ABSOLUTE_MAJORITY = 134;
/** Three-fifths majority (art. 167 CE, constitutional reform and judicial bodies). */
export const SENATE_THREE_FIFTHS = 160;
/** Two-thirds majority (art. 168 CE, aggravated constitutional reform). */
export const SENATE_TWO_THIRDS = 178;

export interface SenateGroup {
  id: string;
  acronym: string;
  name: string;
  /** Total seats in the Senate of the XV legislature (elected + autonomous). */
  seatsNow: number;
  /** Seats elected directly in the general election of 2023 (out of 208). */
  seats2023: number;
  /** Seats designated by regional parliaments (out of 58). */
  seatsAutonomous: number;
  /** The usual color of the party. */
  color: string;
  /** The id of its program on this site, when it has one. */
  programId?: string;
  /**
   * The name it takes for the new election, when it changes. The presets of the old Senate keep the
   * old name and color; starting a new Senate for 29N uses this one.
   */
  next?: { acronym: string; name: string; color: string; programId?: string };
}

export const senateGroups: SenateGroup[] = [
  {
    id: 'sumar',
    acronym: 'SUMAR',
    name: 'Sumar (Más Madrid)',
    seatsNow: 1,
    seats2023: 0,
    seatsAutonomous: 1,
    color: '#e6007e',
    next: { acronym: 'FA', name: 'Frente Amplio (antes Sumar)', color: '#f03c00', programId: 'fa' },
  },
  {
    id: 'podemos',
    acronym: 'PODEMOS',
    name: 'Podemos',
    seatsNow: 0,
    seats2023: 0,
    seatsAutonomous: 0,
    color: '#6b2d8f',
    programId: 'podemos',
  },
  {
    id: 'compromis',
    acronym: 'Compromís',
    name: 'Compromís',
    seatsNow: 1,
    seats2023: 0,
    seatsAutonomous: 1,
    color: '#f0861e',
    programId: 'compromis-front-valencia',
  },
  {
    id: 'psoe',
    acronym: 'PSOE',
    name: 'Partido Socialista Obrero Español',
    seatsNow: 91,
    seats2023: 72,
    seatsAutonomous: 19,
    color: '#e30613',
    programId: 'psoe',
  },
  {
    id: 'erc',
    acronym: 'ERC',
    name: 'Esquerra Republicana de Catalunya',
    seatsNow: 4,
    seats2023: 3,
    seatsAutonomous: 1,
    color: '#ffa51f',
    programId: 'erc',
  },
  {
    id: 'bildu',
    acronym: 'EH Bildu',
    name: 'Euskal Herria Bildu',
    seatsNow: 5,
    seats2023: 4,
    seatsAutonomous: 1,
    color: '#00c1a2',
    programId: 'eh-bildu',
  },
  {
    id: 'bng',
    acronym: 'BNG',
    name: 'Bloque Nacionalista Galego',
    seatsNow: 1,
    seats2023: 0,
    seatsAutonomous: 1,
    color: '#5bb5e6',
    programId: 'bng',
  },
  {
    id: 'geroa',
    acronym: 'Geroa Bai',
    name: 'Geroa Bai',
    seatsNow: 1,
    seats2023: 0,
    seatsAutonomous: 1,
    color: '#3a5a98',
    programId: 'geroa-bai',
  },
  {
    id: 'asg',
    acronym: 'ASG',
    name: 'Agrupación Socialista Gomera',
    seatsNow: 1,
    seats2023: 1,
    seatsAutonomous: 0,
    color: '#d21a1a',
    programId: 'asg',
  },
  {
    id: 'junts',
    acronym: 'Junts',
    name: 'Junts per Catalunya',
    seatsNow: 4,
    seats2023: 1,
    seatsAutonomous: 3,
    color: '#00a99d',
    programId: 'jxcat',
  },
  {
    id: 'pnv',
    acronym: 'EAJ-PNV',
    name: 'Partido Nacionalista Vasco',
    seatsNow: 5,
    seats2023: 4,
    seatsAutonomous: 1,
    color: '#2e8b57',
    programId: 'eaj-pnv',
  },
  {
    id: 'cc',
    acronym: 'CC',
    name: 'Coalición Canaria',
    seatsNow: 1,
    seats2023: 0,
    seatsAutonomous: 1,
    color: '#f4d03f',
    programId: 'cc',
  },
  {
    id: 'ahi',
    acronym: 'AHI',
    name: 'Agrupación Herreña Independiente',
    seatsNow: 1,
    seats2023: 1,
    seatsAutonomous: 0,
    color: '#009c4c',
    programId: 'ahi',
  },
  {
    id: 'upn',
    acronym: 'UPN',
    name: 'Unión del Pueblo Navarro',
    seatsNow: 1,
    seats2023: 1,
    seatsAutonomous: 0,
    color: '#1b4a8a',
    programId: 'upn',
  },
  {
    id: 'pp',
    acronym: 'PP',
    name: 'Partido Popular',
    seatsNow: 143,
    seats2023: 120,
    seatsAutonomous: 23,
    color: '#1d84ce',
    programId: 'pp',
  },
  {
    id: 'vox',
    acronym: 'VOX',
    name: 'Vox',
    seatsNow: 5,
    seats2023: 0,
    seatsAutonomous: 5,
    color: '#63be21',
    programId: 'vox',
  },
  {
    id: 'otros',
    acronym: 'Otros',
    name: 'Eivissa i Formentera al Senat',
    seatsNow: 1,
    seats2023: 1,
    seatsAutonomous: 0,
    color: '#8a857a',
  },
];
