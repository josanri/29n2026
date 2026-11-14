/**
 * «El programa en verbos»: the verbs that a program repeats most. One function for every program, computed at build
 * time, so a new program needs no code of its own.
 *
 * - A program whose extractor already wrote its list (`verbos` in the JSON) keeps it.
 * - Otherwise the list counts the infinitives (-ar, -er, -ir) of the proposal text of each announced measure.
 *   The explanation that some programs add after the proposal («Porque…» in Adelante Andalucía, «Para qué:» in the
 *   PNV) is not counted: its verbs explain the measure, they do not propose anything.
 * - The list shows only when it says something: at least 30 measures, and at least half of them with an infinitive.
 *   A program written in nouns («Creación de…»), in the passive or in the third person gets no list.
 *
 * The stop list comes from an audit of the programs (14 November 2026): words that end like an infinitive but are
 * not verbs, in Spanish and in Galician, and the light verbs that say nothing about a program.
 */
import { announcedMeasures, type Program } from './programs';

export type VerbForm = 'futuro' | 'infinitivo';

export interface ProgramVerbs {
  verbs: { verb: string; count: number }[];
  /** The verbal form of the list, for the lead of the panel. `null` when there is no list. */
  form: VerbForm | null;
}

const MIN_MEASURES = 30;
const MIN_SHARE_WITH_INFINITIVE = 0.5;
const TOP = 15;

const NOT_VERBS = new Set([
  // Spanish words that end in -ar, -er or -ir and are not verbs.
  'alquiler', 'cualquier', 'carácter', 'lugar', 'escolar', 'militar', 'familiar', 'primer', 'tercer', 'mujer',
  'nuclear', 'hogar', 'cáncer', 'bienestar', 'malestar', 'irregular', 'popular', 'particular',
  'multidisciplinar', 'cardiopulmonar', 'alzheimer', 'estándar', 'queer', 'solar', 'máster', 'taller', 'azar',
  'pesar', 'mayor', 'menor', 'sector', 'valor', 'exterior', 'interior', 'superior', 'anterior', 'posterior',
  'similar', 'singular', 'titular', 'auxiliar', 'pilar', 'mar', 'polar', 'circular', 'celular', 'vascular',
  'ejemplar', 'nivel', 'sónar', 'mater',
  // Names of places and acronyms.
  'gibraltar', 'guadalquivir', 'trafalgar', 'feder', 'feader', 'edar', 'villar', 'olivar', 'vejer', 'sanlúcar',
  'níjar', 'almodóvar', 'aguilar', 'andújar', 'abejar',
  // Galician words that are not verbs.
  'fogar', 'muller', 'aluguer', 'limiar', 'lecer', 'dicir',
  // Light verbs: they are verbs, but they say nothing about what a program proposes.
  'poder', 'tener', 'estar', 'haber', 'hacer', 'saber', 'deber', 'poner', 'facer', 'ser', 'ter', 'ir', 'ver', 'dar',
]);

const INFINITIVE = /(?<![\p{L}])[a-záéíóúüñç]{2,}(?:ar|er|ir)(?![\p{L}])/gu;
/** The explanation after the proposal: «Porque…», «Para qué:». */
const EXPLANATION = /\s(?:Porque\b|Para qué:)/u;

const proposalText = (title: string, text: string) => {
  const full = `${title} ${text}`;
  const cut = full.search(EXPLANATION);
  return (cut === -1 ? full : full.slice(0, cut)).toLowerCase();
};

const infinitivesOf = (text: string) => (text.match(INFINITIVE) ?? []).filter((word) => word.length >= 4 && !NOT_VERBS.has(word));

function computeVerbs(program: Program): ProgramVerbs {
  const measures = announcedMeasures(program);
  if (measures.length < MIN_MEASURES) return { verbs: [], form: null };
  const perMeasure = measures.map((measure) => infinitivesOf(proposalText(measure.title, measure.text)));
  const withInfinitive = perMeasure.filter((words) => words.length > 0).length;
  if (withInfinitive / measures.length < MIN_SHARE_WITH_INFINITIVE) return { verbs: [], form: null };
  const counts = new Map<string, number>();
  for (const word of perMeasure.flat()) counts.set(word, (counts.get(word) ?? 0) + 1);
  const verbs = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, TOP)
    .map(([verb, count]) => ({ verb, count }));
  return { verbs, form: verbs.length ? 'infinitivo' : null };
}

/** The verbs of a program: the list of its extractor, or the computed one. */
export function programVerbs(program: Program): ProgramVerbs {
  if (program.verbs.length) {
    const future = program.verbs.filter(({ verb }) => /remos$/.test(verb)).length;
    return { verbs: program.verbs, form: future > program.verbs.length / 2 ? 'futuro' : 'infinitivo' };
  }
  return computeVerbs(program);
}
