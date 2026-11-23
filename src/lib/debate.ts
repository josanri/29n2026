/**
 * The shape of one debate file (`src/data/<election>/debates/<slug>.json`), written by `scripts/debate_derive.py`.
 * Everything below `interventions` is derived from them: edit the interventions, not the derived fields.
 * The content collection `debates` (`src/content.config.ts`) validates each file with this schema at build time.
 */
import { z } from 'astro/zod';

const cutKindSchema = z.enum(['interrupcion', 'moderacion']);

const speakerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  partyId: z.string().nullable(),
  minutes: z.number(),
  words: z.number(),
  turns: z.number(),
  longestSeconds: z.number(),
  /** Interruptions between speakers (kind «interrupcion»): made and received. */
  cutsMade: z.number(),
  cutsReceived: z.number(),
  /** Cuts by the moderator (kind «moderacion»): made (the moderator) and received (a candidate). */
  moderationsMade: z.number(),
  moderationsReceived: z.number(),
});

const interventionSchema = z.object({
  speaker: z.string(),
  start: z.number(),
  end: z.number(),
  paragraphs: z.array(z.string()),
  cut: z.boolean(),
  cutOff: z.boolean(),
  kind: cutKindSchema.optional(),
  topics: z.array(z.string()),
});

const interruptionSchema = z.object({
  start: z.number(),
  kind: cutKindSchema,
  by: z.string(),
  of: z.string(),
  /** The start of what the interrupter says. */
  text: z.string(),
  /** The end of the sentence that was cut. */
  before: z.string(),
  intervention: z.number(),
  topics: z.array(z.string()),
});

const topicSchema = z.object({
  id: z.string(),
  label: z.string(),
  mentions: z.array(z.number()),
  total: z.number(),
  interruptions: z.number(),
});

/** A span of time in seconds: `[start, end]`. */
const spanSchema = z.tuple([z.number(), z.number()]);

export const debateSchema = z.object({
  slug: z.string(),
  title: z.string(),
  /** Day of the debate (YYYY-MM-DD), the channel that broadcast it and the page of the full video. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  channel: z.string().optional(),
  url: z.url().optional(),
  /** The text of the link to `url`, when it is a source and not the full video (default: «Ver el debate íntegro…»). */
  urlLabel: z.string().optional(),
  /** false: a draft. It shows only on the dev server (`npm run dev`), never in the built site. */
  published: z.boolean().optional(),
  durationSeconds: z.number(),
  binSeconds: z.number(),
  speakers: z.array(speakerSchema),
  interventions: z.array(interventionSchema),
  interruptions: z.array(interruptionSchema),
  /** Interruptions between speakers in each bin. */
  density: z.array(z.number()),
  /** Cuts by the moderator in each bin. */
  moderationDensity: z.array(z.number()),
  topics: z.array(topicSchema),
  /** The closing minute of each candidate («minuto de oro»), in order of speech. */
  golden: z.array(z.object({ speaker: z.string(), start: z.number(), end: z.number() })).optional(),
  /** Advertising breaks left out of the transcript (seconds). */
  breaks: z.array(spanSchema).optional(),
  /** Zones of overlapped speech, from the recording (seconds). */
  overlaps: z.array(spanSchema).optional(),
});

export type DebateCutKind = z.infer<typeof cutKindSchema>;
export type DebateSpeaker = z.infer<typeof speakerSchema>;
export type DebateIntervention = z.infer<typeof interventionSchema>;
export type DebateInterruption = z.infer<typeof interruptionSchema>;
export type DebateTopic = z.infer<typeof topicSchema>;
export type Debate = z.infer<typeof debateSchema>;
