/**
 * Relations between parties that run together: a joint list or a coalition.
 * The data is in `src/data/<año>/<tipo>/relaciones.json`. The build fails if a party id does not exist.
 */
import { z } from 'astro/zod';
import rawRelations from '@eleccion/relaciones.json';
import { unique } from './collections';
import { getProgram, type Program } from './programs';
import { provinceByCode } from './presence';

const relationSchema = z
  .object({
    id: z.string(),
    /** Party that is the joint list itself (for example `eh-bildu-erc`), when it has its own page. */
    lista: z.string().optional(),
    partidos: z.array(z.string()).min(1),
    camaras: z.array(z.enum(['congreso', 'senado'])).min(1),
    provincias: z.array(z.string()).optional(),
    nota: z.string().optional(),
  })
  .transform((raw) => {
    const jointList = raw.lista ? getProgram(raw.lista) : undefined;
    const members = raw.partidos.map(getProgram);
    return {
      id: raw.id,
      jointList,
      /** Every party of the relation, the joint list first. */
      parties: unique([...(jointList ? [jointList] : []), ...members]),
      chambers: raw.camaras.map((chamber) => (chamber === 'congreso' ? ('congress' as const) : ('senate' as const))),
      provinceCodes: raw.provincias ?? [],
      note: raw.nota,
    };
  });

const relations = z.object({ relaciones: z.array(relationSchema) }).parse(rawRelations).relaciones;

export type Relation = (typeof relations)[number] & { partners: Program[] };

/** The relations of one party, each with the other parties of the relation. */
export function relationsOf(program: Program): Relation[] {
  return relations
    .filter((relation) => relation.parties.some((party) => party.id === program.id))
    .map((relation) => ({ ...relation, partners: relation.parties.filter((party) => party.id !== program.id) }));
}

const MAX_PROVINCES_LISTED = 3;

export const chamberLabel = (chambers: Relation['chambers']) =>
  chambers.length === 2 ? 'al Congreso y al Senado' : chambers[0] === 'congress' ? 'al Congreso' : 'al Senado';

export function provincesLabel(codes: string[]): string {
  if (codes.length === 0) return '';
  if (codes.length <= MAX_PROVINCES_LISTED) return codes.map((code) => provinceByCode[code]?.name ?? code).join(', ');
  return `${codes.length} provincias`;
}

/** One line for a card: `Con ERC y EH BILDU · al Senado · 7 provincias`. */
export function relationSummary(relation: Relation): string {
  const partners = relation.partners.map((party) => party.acronym).join(' y ');
  const where = provincesLabel(relation.provinceCodes);
  return `Con ${partners} ${chamberLabel(relation.chambers)}${where ? ` en ${where}` : ''}`;
}
