/** WCAG color helpers. Used to keep party colors readable in both themes. */

export type Rgb = [number, number, number];

export const BLACK = '#0e0e0e';
export const WHITE = '#ffffff';

/** Parse `#rrggbb` (the `#` is optional). */
export const parseHex = (hex: string): Rgb => {
  const digits = hex.replace('#', '');
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16)) as Rgb;
};

export const relativeLuminance = ([red, green, blue]: Rgb) => {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a: Rgb, b: Rgb) => {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Black or white, whichever is easier to read on `background`. */
export const readableTextColor = (background: string) =>
  relativeLuminance(parseHex(background)) > 0.179 ? BLACK : WHITE;

/**
 * Move `color` toward black (`target` 0) or white (`target` 255) until it has at
 * least `minimumRatio` of contrast with `background`.
 */
export const shiftForContrast = (color: string, background: string, target: 0 | 255, minimumRatio = 3) => {
  const base = parseHex(color);
  const reference = parseHex(background);
  const steps = 20;
  for (let step = 0; step <= steps; step++) {
    const rgb = base.map((channel) => Math.round(channel + (target - channel) * (step / steps))) as Rgb;
    if (contrastRatio(rgb, reference) >= minimumRatio) return `rgb(${rgb.join(' ')})`;
  }
  return target ? WHITE : '#000000';
};

/** Surface colors the party colors must stand out from. Keep in sync with `--color-paper-alt` in tokens.css. */
export const PAPER_ALT = { light: '#e8e2d2', dark: '#222120' } as const;
