/**
 * The text that a party search looks in: the acronym, the names, the regions where the party runs
 * and the names of the parties that run with it. A search for ERC also finds EH Bildu.
 * The home page and the search page share it.
 */
import type { Program } from './programs';
import { presenceOf } from './presence';
import { relationsOf } from './relations';
import { normalizeForSearch } from './format';

export const partySearchText = (program: Program) =>
  normalizeForSearch(
    [
      program.acronym,
      program.partyName,
      program.programName,
      ...presenceOf(program).regions,
      ...relationsOf(program).flatMap((relation) => relation.partners.flatMap((party) => [party.acronym, party.partyName])),
    ].join(' '),
  );
