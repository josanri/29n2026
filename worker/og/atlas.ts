/**
 * Reads the glyph atlas that `scripts/og_atlas.py` makes: every letter of every size of the cards, already drawn.
 * Nothing is parsed or copied: the glyph and kerning tables are sorted, and a lookup is a binary search in the
 * bytes of the atlas. So the first card of a new isolate costs the same as the next ones.
 */

export interface Glyph {
  advance: number;
  /** From the pen position to the left edge of the bitmap. */
  left: number;
  /** From the baseline to the top edge of the bitmap (negative: above the baseline). */
  top: number;
  width: number;
  height: number;
  /** Start of the bitmap in `Atlas.pixels`: one byte per pixel, coverage from 0 to 15. */
  offset: number;
}

export interface Font {
  size: number;
  ascent: number;
  descent: number;
  glyph: (codePoint: number) => Glyph | undefined;
  /** The kerning between two letters, in pixels (0 for most pairs). */
  kern: (first: number, second: number) => number;
}

export interface Atlas {
  font: (key: string) => Font;
  pixels: Uint8Array;
}

/** Binary search in a table of `count` rows of `rowSize` bytes, sorted by the u32 at the start of each row. */
function find(view: DataView, table: number, count: number, rowSize: number, key: number): number {
  let low = 0;
  let high = count - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const value = view.getUint32(table + middle * rowSize, true);
    if (value === key) return table + middle * rowSize;
    if (value < key) low = middle + 1;
    else high = middle - 1;
  }
  return -1;
}

export function loadAtlas(buffer: ArrayBuffer): Atlas {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'OGA1') throw new Error('atlas.bin: unknown format');
  const fonts = new Map<string, Font>();
  let at = 8;
  let pixelStart = 0;
  for (let i = view.getUint32(4, true); i > 0; i--) {
    const keyLength = bytes[at];
    const key = String.fromCharCode(...bytes.subarray(at + 1, at + 1 + keyLength));
    at += 1 + keyLength;
    const glyphCount = view.getUint32(at + 10, true);
    const glyphTable = view.getUint32(at + 14, true);
    const kernCount = view.getUint32(at + 18, true);
    const kernTable = view.getUint32(at + 22, true);
    // A glyph is read once per font and kept: a card asks for the same letters many times.
    const glyphs = new Map<number, Glyph | undefined>();
    fonts.set(key, {
      size: view.getUint16(at, true),
      ascent: view.getFloat32(at + 2, true),
      descent: view.getFloat32(at + 6, true),
      glyph: (codePoint) => {
        if (glyphs.has(codePoint)) return glyphs.get(codePoint);
        const row = find(view, glyphTable, glyphCount, 20, codePoint);
        const glyph =
          row < 0
            ? undefined
            : {
                advance: view.getFloat32(row + 4, true),
                left: view.getInt16(row + 8, true),
                top: view.getInt16(row + 10, true),
                width: view.getUint16(row + 12, true),
                height: view.getUint16(row + 14, true),
                offset: view.getUint32(row + 16, true),
              };
        glyphs.set(codePoint, glyph);
        return glyph;
      },
      kern: (first, second) => {
        if (kernCount === 0) return 0;
        const row = find(view, kernTable, kernCount, 8, first * 65536 + second);
        return row < 0 ? 0 : view.getFloat32(row + 4, true);
      },
    });
    at += 26;
    // The tables follow one another and the bitmaps come after the last one.
    pixelStart = Math.max(pixelStart, kernTable + kernCount * 8, glyphTable + glyphCount * 20);
  }

  const font = (key: string): Font => {
    const found = fonts.get(key);
    if (!found) throw new Error(`atlas.bin has no font «${key}»: run scripts/og_atlas.py`);
    return found;
  };
  return { font, pixels: bytes.subarray(pixelStart) };
}
