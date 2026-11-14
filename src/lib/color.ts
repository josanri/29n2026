/** WCAG color helpers. Used to keep party colors readable in both themes. */

export type Rgb = [number, number, number];

export const BLACK = '#000000';
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

const toHex = (rgb: Rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

/**
 * `color` mixed with black or with white until its relative luminance is `target` (0 to 1).
 * The hue stays the same, so the result is still the color of the party.
 */
export const withLuminance = (color: string, target: number) => {
  const base = parseHex(color);
  const toward = relativeLuminance(base) > target ? 0 : 255;
  const mix = (amount: number) => base.map((channel) => Math.round(channel + (toward - channel) * amount)) as Rgb;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 20; step++) {
    const middle = (low + high) / 2;
    const tooDark = relativeLuminance(mix(middle)) < target;
    // Toward black, more mix is darker. Toward white, more mix is lighter.
    if (tooDark === (toward === 0)) high = middle;
    else low = middle;
  }
  return toHex(mix((low + high) / 2));
};

/**
 * The four steps of the color scale of a party, from dark to light, as relative luminances.
 * White text passes 4.5:1 on the first two steps and black text on the last two.
 * Step 2 has 4.5:1 against white paper and step 3 has 8.6:1 against black paper: they are the bar colors.
 */
const PARTY_STEP_LUMINANCES = [0.06, 0.18, 0.38, 0.62] as const;
export const PARTY_STEP_COUNT = PARTY_STEP_LUMINANCES.length;

/** A neutral scale, for a page that belongs to no party. */
const NEUTRAL = '#808080';

/**
 * CSS custom properties with the scale of one party: `--party-1` to `--party-4` (dark to light),
 * the readable text color of each step (`--party-on-N`), and `--color-bar` for bars with no border,
 * which has at least 3:1 against the paper of each theme.
 * A party has two colors: the two dark steps come from its main color and the two light steps from
 * its light color, so the scale shows both (Adelante Andalucía: dark teal and green).
 */
export const partyScaleStyle = (color: string = NEUTRAL, lightColor: string = color) => {
  const steps = PARTY_STEP_LUMINANCES.map((luminance, index) => withLuminance(index < 2 ? color : lightColor, luminance));
  return [
    ...steps.map((step, index) => `--party-${index + 1}:${step}`),
    ...steps.map((step, index) => `--party-on-${index + 1}:${readableTextColor(step)}`),
    `--color-bar:light-dark(${steps[1]},${steps[2]})`,
  ].join(';');
};

/**
 * The hover color of a party page: the lightest step of the scale, with black text (13:1).
 * It replaces the yellow highlight, so a hover on a party page has the color of the party.
 */
export const partyHighlightStyle = (lightColor: string) =>
  `--color-highlight:${withLuminance(lightColor, PARTY_STEP_LUMINANCES[3])};--color-on-highlight:${BLACK}`;

/**
 * The two colors of the sphere of a party, as CSS custom properties: the disc has the main color of the
 * party (the same as the favicon) and the dots have its light color.
 * If the two colors are too near (less than 2:1), the dots are black or white, whichever shows on the disc.
 */
export const sphereStyle = (color: string, lightColor: string) => {
  const distinct = contrastRatio(parseHex(color), parseHex(lightColor)) >= 2;
  return `--sphere-disc:${color};--sphere-dots:${distinct ? lightColor : readableTextColor(color)}`;
};

/** The paper of each theme. Keep in sync with `--color-paper` in tokens.css. */
export const PAPER = { light: '#ffffff', dark: '#000000' } as const;
