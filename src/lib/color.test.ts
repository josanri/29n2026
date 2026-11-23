import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, contrastRatio, parseHex, readableTextColor, shiftForContrast, withLuminance, relativeLuminance } from './color';

describe('contrastRatio', () => {
  it('gives 21:1 for black on white and 1:1 for a color on itself', () => {
    expect(contrastRatio(parseHex(BLACK), parseHex(WHITE))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseHex('#e30613'), parseHex('#e30613'))).toBe(1);
  });
});

describe('readableTextColor', () => {
  it('puts white text on a dark color and black text on a light color', () => {
    expect(readableTextColor('#0a2a66')).toBe(WHITE);
    expect(readableTextColor('#ffd400')).toBe(BLACK);
  });
});

describe('shiftForContrast', () => {
  it('returns a color with the minimum contrast on the background', () => {
    const shifted = shiftForContrast('#ffd400', WHITE, 0, 3);
    const rgb = shifted.match(/\d+/g)!.map(Number) as [number, number, number];
    expect(contrastRatio(rgb, parseHex(WHITE))).toBeGreaterThanOrEqual(3);
  });
});

describe('withLuminance', () => {
  it('reaches the target luminance', () => {
    expect(relativeLuminance(parseHex(withLuminance('#e30613', 0.5)))).toBeCloseTo(0.5, 1);
    expect(relativeLuminance(parseHex(withLuminance('#e30613', 0.05)))).toBeCloseTo(0.05, 1);
  });
});
