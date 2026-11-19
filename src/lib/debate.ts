/**
 * The shape of one debate file (`src/data/<election>/debates/<slug>.json`), written by `scripts/debate_derive.py`.
 * Everything below `interventions` is derived from them: edit the interventions, not the derived fields.
 */
export interface DebateSpeaker {
  id: string;
  name: string;
  role: string;
  partyId: string | null;
  minutes: number;
  words: number;
  turns: number;
  longestSeconds: number;
  /** Interruptions between speakers (kind «interrupcion»): made and received. */
  cutsMade: number;
  cutsReceived: number;
  /** Cuts by the moderator (kind «moderacion»): made (the moderator) and received (a candidate). */
  moderationsMade: number;
  moderationsReceived: number;
}

export type DebateCutKind = 'interrupcion' | 'moderacion';

export interface DebateIntervention {
  speaker: string;
  start: number;
  end: number;
  paragraphs: string[];
  cut: boolean;
  cutOff: boolean;
  kind?: DebateCutKind;
  topics: string[];
}

export interface DebateInterruption {
  start: number;
  kind: DebateCutKind;
  by: string;
  of: string;
  /** The start of what the interrupter says. */
  text: string;
  /** The end of the sentence that was cut. */
  before: string;
  intervention: number;
  topics: string[];
}

export interface DebateTopic {
  id: string;
  label: string;
  mentions: number[];
  total: number;
  interruptions: number;
}

export interface Debate {
  slug: string;
  title: string;
  /** Day of the debate (YYYY-MM-DD), the channel that broadcast it and the page of the full video. */
  date?: string;
  channel?: string;
  url?: string;
  durationSeconds: number;
  binSeconds: number;
  speakers: DebateSpeaker[];
  interventions: DebateIntervention[];
  interruptions: DebateInterruption[];
  /** Interruptions between speakers in each bin. */
  density: number[];
  /** Cuts by the moderator in each bin. */
  moderationDensity: number[];
  topics: DebateTopic[];
  /** Zones of overlapped speech, from the recording (seconds). */
  overlaps?: [number, number][];
}
