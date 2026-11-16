/**
 * The version of the drawing of the cards. The address of a card carries a hash of its data and of this number
 * (`?v=…`, `src/lib/seo.ts`): X, WhatsApp or LinkedIn keep a link preview by its address, so a new address makes
 * them draw it again. Add one when the look of the cards changes (`card.ts`, `atlas.bin`).
 */
export const CARD_VERSION = 1;
