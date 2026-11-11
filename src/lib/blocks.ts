/** The block palette has 11 colors. Programs with more blocks reuse them in order. */
const PALETTE_SIZE = 11;

/** CSS value of the color that identifies block `blockId`. */
export const blockColor = (blockId: number) => `var(--color-block-${((blockId - 1) % PALETTE_SIZE) + 1})`;
