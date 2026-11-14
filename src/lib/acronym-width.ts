/**
 * The width of an acronym in the display font (Big Shoulders Display 900), in em, so the CSS can give each acronym
 * the biggest size that fits. One average width for every letter does not work: «M» is three times as wide as «I»,
 * so «PACMA» and «AUTÓNOMOS» broke into two lines.
 *
 * The advance widths come from the font files (`@fontsource/big-shoulders-display`, 900, latin and latin-ext),
 * read with fontTools: `hmtx` advance / `unitsPerEm`. A character that is not here counts as a wide letter.
 */
const WIDTHS: Record<string, number> = {
  ' ': 0.22, '&': 0.619, "'": 0.203, '+': 0.536, '-': 0.446, '.': 0.25, '/': 0.41,
  '0': 0.507, '1': 0.274, '2': 0.49, '3': 0.504, '4': 0.511, '5': 0.515, '6': 0.498, '7': 0.485, '8': 0.5, '9': 0.499,
  A: 0.478, B: 0.472, C: 0.49, D: 0.495, E: 0.408, F: 0.406, G: 0.493, H: 0.485, I: 0.23, J: 0.453, K: 0.496,
  L: 0.402, M: 0.745, N: 0.543, O: 0.496, P: 0.47, Q: 0.496, R: 0.477, S: 0.474, T: 0.419, U: 0.487, V: 0.494,
  W: 0.8, X: 0.471, Y: 0.465, Z: 0.418,
  a: 0.475, b: 0.496, c: 0.459, d: 0.496, e: 0.459, f: 0.335, g: 0.501, h: 0.503, i: 0.232, j: 0.233, k: 0.457,
  l: 0.232, m: 0.769, n: 0.503, o: 0.48, p: 0.496, q: 0.496, r: 0.351, s: 0.438, t: 0.35, u: 0.499, v: 0.445,
  w: 0.768, x: 0.419, y: 0.447, z: 0.401,
  À: 0.478, Á: 0.478, Ç: 0.49, È: 0.408, É: 0.408, Í: 0.23, Ï: 0.23, Ñ: 0.543, Ò: 0.496, Ó: 0.496, Ú: 0.487, Ü: 0.487,
  à: 0.475, á: 0.475, ç: 0.459, è: 0.459, é: 0.459, í: 0.232, ï: 0.232, ñ: 0.503, ò: 0.48, ó: 0.48, ú: 0.499, ü: 0.499,
};
const UNKNOWN = 0.55;
/** A small margin for rounding and for the browser's text rendering. */
const MARGIN = 1.04;

const widthOf = (text: string) => [...text].reduce((sum, char) => sum + (WIDTHS[char] ?? UNKNOWN), 0) * MARGIN;

/**
 * The width of the whole acronym on one line, and the width of its longest piece when it breaks.
 * It can break only at a space, or after «-», «/» or «+».
 */
export function acronymWidths(acronym: string): { line: number; word: number } {
  const pieces = acronym.split(/(?<=[-/+])|\s+/).filter(Boolean);
  return {
    line: Number(widthOf(acronym).toFixed(3)),
    word: Number(Math.max(...pieces.map(widthOf)).toFixed(3)),
  };
}
