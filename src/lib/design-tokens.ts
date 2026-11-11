/**
 * Reads the color tokens from `src/styles/tokens.css`, so the design-system page documents
 * the real values and computes their contrast. The CSS file stays the only source of truth.
 */
import tokensCss from '../styles/tokens.css?raw';
import { contrastRatio, parseHex } from './color';

export interface ColorToken {
  name: string;
  light: string;
  dark: string;
}

const LIGHT_DARK = /^light-dark\(\s*(#[0-9a-f]{3,8})\s*,\s*(#[0-9a-f]{3,8})\s*\)$/i;
const HEX = /^#[0-9a-f]{3,8}$/i;
const REFERENCE = /^var\(\s*(--[\w-]+)\s*\)$/;

const declarations = new Map<string, string>(
  [...tokensCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
);

/** Resolve a token to a hex color for the theme (0 = light, 1 = dark). Follows `var()` references. */
function resolve(name: string, theme: 0 | 1): string | undefined {
  const value = declarations.get(name);
  if (!value) return undefined;
  const pair = value.match(LIGHT_DARK);
  if (pair) return pair[theme + 1];
  if (HEX.test(value)) return value;
  const reference = value.match(REFERENCE);
  return reference ? resolve(reference[1], theme) : undefined;
}

export function colorToken(shortName: string): ColorToken {
  const name = `--color-${shortName}`;
  return { name, light: resolve(name, 0) ?? '#000000', dark: resolve(name, 1) ?? '#000000' };
}

export interface ContrastResult {
  light: number;
  dark: number;
}

export const contrastBetween = (foreground: string, background: string): ContrastResult => {
  const fg = colorToken(foreground);
  const bg = colorToken(background);
  return {
    light: contrastRatio(parseHex(fg.light), parseHex(bg.light)),
    dark: contrastRatio(parseHex(fg.dark), parseHex(bg.dark)),
  };
};
