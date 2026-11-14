import { PARTY_STEP_COUNT } from './color';

/**
 * The color that identifies block `blockId`: one step of the color scale of the party
 * (`--party-1` to `--party-4`, dark to light; see `partyScaleStyle` in color.ts). With more than four
 * blocks the steps repeat in order, and the ink border between two blocks keeps them apart.
 * `color` is the background and `on` is the text color that is readable on it.
 */
export const blockColor = (blockId: number) => {
  const step = ((blockId - 1) % PARTY_STEP_COUNT) + 1;
  return { color: `var(--party-${step})`, on: `var(--party-on-${step})` };
};
