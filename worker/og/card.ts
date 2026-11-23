/**
 * The link previews of a party and of one measure, drawn without a browser, in a few milliseconds: 1200 × 675
 * (16:9, native for Google Discover and large social cards), and 600 × 600 for WhatsApp (`drawSquareCard`).
 *
 * «Edición Tinta»: pure black ink canvas, top and bottom brand edge bars (so the card keeps a crisp edge on
 * dark-mode feeds as well as light-mode feeds), and the signature Electosfera halftone sphere in the party's
 * true brand color with black halftone dots.
 *
 * The letters come from the pre-rasterized atlas (`atlas.ts`). The image has a 96-color indexed palette
 * (6 ramps of 16 anti-aliasing steps) and the sphere's normalized dot positions are precomputed once at
 * isolate startup. Everything is synchronous and takes ~1 to 3 ms (well under Cloudflare Workers' 10 ms limit).
 */
import type { Atlas, Font, Glyph } from './atlas.ts';
import { encodePng } from './png.ts';

export interface PartyCard {
  acronym: string;
  /** Full name of the party; the card leaves it out when it is the acronym. */
  name: string;
  /** Name of the program, without «». */
  program: string;
  color: string;
  lightColor: string;
  count: number;
  /** «medida» */
  unit: string;
  /** «medidas» */
  unitPlural: string;
}

export interface MeasureCard {
  acronym: string;
  color: string;
  lightColor: string;
  unit: string;
  number: number;
  title: string;
  /** The start of the text, already cut (`/og/datos/<party>.json`); empty when the measure has no text. */
  excerpt: string;
  page?: number;
}

export const WIDTH = 1200;
export const HEIGHT = 675;
/** The square card for WhatsApp, which shows a small square cut from the middle of a wide image. */
export const SQUARE = 600;

// ── Indexed Palette (6 ramps × 16 coverage steps = 96 colors) ───────────────────────────────────────────────────
const WHITE = 0; // black → white (step 0 is pure black canvas, step 15 is pure white ink)
const MUTED = 16; // black → #c8c8c8 (dark-theme muted ink from tokens.css)
const ACCENT = 32; // black → brand color (bars, rules, display accents, quote mark, outer sphere edge)
const SPHERE_DOT = 48; // brand color → black (solid brand disc + black halftone dots)
const ON_ACCENT = 64; // brand color → readable white/black text on brand badges
const WORDMARK_DOT = 80; // brand color → white (inner edge of the white ring around the wordmark dot)

const BLACK = WHITE; // step 0 of WHITE ramp is #000000
const WHITE_SOLID = WHITE + 15;
const ACCENT_SOLID = ACCENT + 15;
const ON_ACCENT_BG = ON_ACCENT; // step 0 is solid brand color

const PAD_X = 64;
const WORDMARK_HEIGHT = 52;
const BADGE_HEIGHT = 40;

type Rgb = [number, number, number];

interface Canvas {
  rows: Uint8Array;
  atlas: Atlas;
  width: number;
  height: number;
  /** Bytes per row: the filter byte and one byte per pixel. */
  stride: number;
}

const hex = (color: string): Rgb => {
  const digits = color.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits.slice(0, 6);
  const value = Number.parseInt(full, 16);
  return Number.isNaN(value) ? [0, 0, 0] : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const luminance = ([r, g, b]: Rgb) => {
  const ch = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

const contrastWithBlack = (rgb: Rgb) => (luminance(rgb) + 0.05) / 0.05;

/** Moves `rgb` toward white along the same hue until it reaches `targetLuminance`, preserving hue fidelity. */
function liftLuminance(base: Rgb, targetLuminance: number): Rgb {
  if (luminance(base) >= targetLuminance) return base;
  let low = 0;
  let high = 1;
  const mix = (t: number): Rgb => [
    Math.round(base[0] + (255 - base[0]) * t),
    Math.round(base[1] + (255 - base[1]) * t),
    Math.round(base[2] + (255 - base[2]) * t),
  ];
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    if (luminance(mix(mid)) < targetLuminance) low = mid;
    else high = mid;
  }
  return mix((low + high) / 2);
}

/**
 * Picks the party's true brand color for a pure-black canvas:
 * - Keeps the party's real `color` whenever it stands out from black (PSOE stays pure red #e30613, VOX stays
 *   green #7cbd2a, FA stays orange-red #F03C00 — never pastel pink/mint).
 * - For medium-dark blues/burgundies (contrast 2.6–3.8:1, e.g. PP #135898), lifts luminance gently along the
 *   exact same hue to ~4.2:1 so the color stays unmistakably royal blue while passing large-text contrast.
 * - Only for black/near-black/deep-navy brands (< 2.6:1, e.g. SALF #111, D21, Drago, Adelante) falls back to
 *   their official `lightColor`.
 */
function resolveBrandOnBlack(color: string, lightColor: string): Rgb {
  const main = hex(color);
  const mainCr = contrastWithBlack(main);
  if (mainCr >= 3.8) return main;
  if (mainCr >= 2.6) return liftLuminance(main, 0.16);
  const alt = hex(lightColor || color);
  return contrastWithBlack(alt) >= 3.0 ? alt : liftLuminance(alt, 0.25);
}

function palette(color: string, lightColor: string): Uint8Array {
  const out = new Uint8Array(96 * 3);
  const ramp = (start: number, from: Rgb, to: Rgb) => {
    for (let step = 0; step < 16; step++) {
      for (let c = 0; c < 3; c++) out[(start + step) * 3 + c] = Math.round(from[c] + ((to[c] - from[c]) * step) / 15);
    }
  };
  const black: Rgb = [0, 0, 0];
  const white: Rgb = [255, 255, 255];
  const brand = resolveBrandOnBlack(color, lightColor);
  const onBrand: Rgb = luminance(brand) > 0.179 ? black : white;

  ramp(WHITE, black, white);
  ramp(MUTED, black, [0xc8, 0xc8, 0xc8]);
  ramp(ACCENT, black, brand);
  ramp(SPHERE_DOT, brand, black);
  ramp(ON_ACCENT, brand, onBrand);
  ramp(WORDMARK_DOT, brand, white);
  return out;
}

// ── Pre-rasterized Halftone Sphere Stamps (computed once at startup, copied in <0.2 ms per card) ────────────────

interface SphereStamp {
  x0: number;
  y0: number;
  width: number;
  height: number;
  pixels: Uint8Array;
}

function buildSphereStamp(
  canvasWidth: number,
  canvasHeight: number,
  cx: number,
  cy: number,
  radius: number,
  dotCount: number,
): SphereStamp {
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const x1 = Math.min(canvasWidth, Math.ceil(cx + radius + 1));
  const y1 = Math.min(canvasHeight, Math.ceil(cy + radius + 1));
  const width = x1 - x0;
  const height = y1 - y0;
  const pixels = new Uint8Array(width * height); // 0 = pure black canvas

  const paintCircle = (ccx: number, ccy: number, r: number, rampBase: number) => {
    const minY = Math.max(y0, Math.floor(ccy - r - 1));
    const maxY = Math.min(y1 - 1, Math.ceil(ccy + r + 1));
    const minX = Math.max(x0, Math.floor(ccx - r - 1));
    const maxX = Math.min(x1 - 1, Math.ceil(ccx + r + 1));
    for (let y = minY; y <= maxY; y++) {
      const dy = y + 0.5 - ccy;
      const rowOff = (y - y0) * width - x0;
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x + 0.5 - ccx, dy);
        const cov = r - dist + 0.5;
        if (cov <= 0) continue;
        const step = cov >= 1 ? 15 : Math.round(cov * 15);
        const cur = pixels[rowOff + x];
        const curStep = cur >= rampBase && cur < rampBase + 16 ? cur - rampBase : 0;
        pixels[rowOff + x] = rampBase + (step > curStep ? step : curStep);
      }
    }
  };

  // Brand disc anti-aliased onto pure black canvas.
  paintCircle(cx, cy, radius, ACCENT);

  // Hexagonal halftone grid shaded by top-left light (exact same math as `src/lib/sphere.ts`).
  const grid: { x: number; y: number; dist: number }[] = [];
  const half = Math.ceil(Math.sqrt(dotCount / 2.7)) + 4;
  for (let j = -half; j <= half; j++) {
    for (let i = -half; i <= half; i++) {
      const gx = i + (j % 2 !== 0 ? 0.5 : 0);
      const gy = j * 0.866;
      grid.push({ x: gx, y: gy, dist: Math.hypot(gx, gy) });
    }
  }
  grid.sort((a, b) => a.dist - b.dist);
  const points = grid.slice(0, dotCount);
  const maxDist = points[points.length - 1].dist + 0.5;
  const invMax = 1 / maxDist;
  const innerRadius = radius - 1.5;
  const unit = innerRadius * invMax;
  const [lx, ly, lz] = [-0.5, -0.6, 0.62];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const nx = pt.x * invMax;
    const ny = pt.y * invMax;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const light = Math.max(0, nx * lx + ny * ly + nz * lz);
    const shade = Math.min(0.95, 0.14 + 0.88 * (1 - light));
    const px = cx + nx * innerRadius;
    const py = cy + ny * innerRadius;
    const pr = (shade * unit) / 2;
    if (px + pr < x0 || px - pr >= x1 || py + pr < y0 || py - pr >= y1) continue;
    paintCircle(px, py, pr, SPHERE_DOT);
  }
  return { x0, y0, width, height, pixels };
}

const STAMP_PARTY = buildSphereStamp(WIDTH, HEIGHT, 1030, 340, 275, 950);
const STAMP_MEASURE = buildSphereStamp(WIDTH, HEIGHT, 1105, 585, 275, 850);
const STAMP_SQUARE = buildSphereStamp(SQUARE, SQUARE, 535, 555, 230, 520);

// ── Raster Primitives ───────────────────────────────────────────────────────────────────────────────────────────

function fillRect(canvas: Canvas, x: number, y: number, width: number, height: number, index: number) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(canvas.width, Math.round(x + width));
  const y1 = Math.min(canvas.height, Math.round(y + height));
  if (x1 <= x0 || y1 <= y0) return;
  for (let row = y0; row < y1; row++) {
    const start = row * canvas.stride + 1;
    canvas.rows.fill(index, start + x0, start + x1);
  }
}

function blitStamp(canvas: Canvas, stamp: SphereStamp) {
  const { x0, y0, width, height, pixels } = stamp;
  for (let r = 0; r < height; r++) {
    const src = r * width;
    const dst = (y0 + r) * canvas.stride + 1 + x0;
    canvas.rows.set(pixels.subarray(src, src + width), dst);
  }
}

// ── Text ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The glyph of a code point, or of its letter without accent, or «?»: a card never fails on a rare letter. */
function glyphOf(font: Font, codePoint: number): Glyph | undefined {
  const glyph = font.glyph(codePoint);
  if (glyph) return glyph;
  const base = String.fromCodePoint(codePoint).normalize('NFD').codePointAt(0)!;
  return font.glyph(base) ?? font.glyph(63);
}

const codePoints = (text: string) => Array.from(text.replace(/[\s\u00a0]+/g, ' '), (c) => c.codePointAt(0)!);

/** Width of a text with CSS `letter-spacing` (added after each letter). */
function measure(font: Font, text: string, spacing = 0): number {
  const points = codePoints(text);
  let width = 0;
  for (let i = 0; i < points.length; i++) {
    width += (glyphOf(font, points[i])?.advance ?? 0) + spacing;
    if (i > 0) width += font.kern(points[i - 1], points[i]);
  }
  return width;
}

/**
 * The lines of a paragraph: it breaks between words, like the browser, and with `maxLines` it ends the last line
 * with «…» like `-webkit-line-clamp`. A word wider than the line is cut between letters.
 */
function wrap(font: Font, text: string, maxWidth: number, maxLines: number, spacing = 0): string[] {
  const space = (font.glyph(32)?.advance ?? 0) + spacing;
  const lines: string[] = [];
  let line = '';
  let lineWidth = 0;
  for (let word of text.replace(/[\s\u00a0]+/g, ' ').trim().split(' ')) {
    let wordWidth = measure(font, word, spacing);
    while (wordWidth > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && measure(font, word.slice(0, cut), spacing) > maxWidth) cut--;
      if (line) lines.push(line);
      lines.push(word.slice(0, cut));
      line = '';
      lineWidth = 0;
      word = word.slice(cut);
      wordWidth = measure(font, word, spacing);
    }
    if (!line) {
      line = word;
      lineWidth = wordWidth;
    } else if (lineWidth + space + wordWidth <= maxWidth) {
      line += ` ${word}`;
      lineWidth += space + wordWidth;
    } else {
      lines.push(line);
      line = word;
      lineWidth = wordWidth;
    }
    if (lines.length > maxLines) break;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(font, `${last}…`, spacing) > maxWidth) {
    last = last.includes(' ') ? last.slice(0, last.lastIndexOf(' ')) : last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last.replace(/[\s,;:.·–—-]+$/, '')}…`;
  return kept;
}

/** The baseline of a line of `lineHeight` that starts at `top`, as CSS places it (the font box centered). */
const baseline = (font: Font, top: number, lineHeight: number) =>
  Math.round(top + (lineHeight - (font.ascent + font.descent)) / 2 + font.ascent);

/** Draws a line of text from `x` (or ending at `x` with `alignRight`), on the baseline `y`. Returns its width. */
function drawText(
  canvas: Canvas,
  font: Font,
  text: string,
  x: number,
  y: number,
  rampBase: number,
  spacing = 0,
  alignRight = false,
): number {
  const width = measure(font, text, spacing);
  let pen = alignRight ? x - width : x;
  const points = codePoints(text);
  const { rows } = canvas;
  const pixels = canvas.atlas.pixels;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) pen += font.kern(points[i - 1], points[i]);
    const glyph = glyphOf(font, points[i]);
    if (!glyph) continue;
    const gx = Math.round(pen + glyph.left);
    const gy = y + glyph.top;
    for (let r = 0; r < glyph.height; r++) {
      const row = gy + r;
      if (row < 0 || row >= canvas.height) continue;
      const source = glyph.offset + r * glyph.width;
      const target = row * canvas.stride + 1 + gx;
      const from = Math.max(0, -gx);
      const to = Math.min(glyph.width, canvas.width - gx);
      for (let c = from; c < to; c++) {
        const level = pixels[source + c];
        if (level === 0) continue;
        const current = rows[target + c];
        const step = current >= rampBase && current < rampBase + 16 ? current - rampBase : 0;
        rows[target + c] = rampBase + (level > step ? level : step);
      }
    }
    pen += glyph.advance + spacing;
  }
  return width;
}

/** Draws white text on a solid black pill, or readable text on a solid brand pill. */
function drawBrandPill(canvas: Canvas, font: Font, text: string, x: number, top: number, padX = 16): number {
  const textWidth = Math.round(measure(font, text));
  const pillWidth = textWidth + padX * 2;
  fillRect(canvas, x, top, pillWidth, BADGE_HEIGHT, ON_ACCENT_BG);
  const y = Math.round(top + BADGE_HEIGHT / 2 + (font.ascent - font.descent) / 2);
  drawText(canvas, font, text, x + padX, y, ON_ACCENT);
  return pillWidth;
}

function drawWhitePill(canvas: Canvas, font: Font, text: string, x: number, top: number, padX = 16): number {
  const textWidth = Math.round(measure(font, text));
  const pillWidth = textWidth + padX * 2;
  fillRect(canvas, x, top, pillWidth, BADGE_HEIGHT, WHITE_SOLID);
  const y = Math.round(top + BADGE_HEIGHT / 2 + (font.ascent - font.descent) / 2);
  // Black text on white: invert the WHITE ramp (step 15 - level).
  let pen = x + padX;
  const points = codePoints(text);
  const { rows } = canvas;
  const pixels = canvas.atlas.pixels;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) pen += font.kern(points[i - 1], points[i]);
    const glyph = glyphOf(font, points[i]);
    if (!glyph) continue;
    const gx = Math.round(pen + glyph.left);
    const gy = y + glyph.top;
    for (let r = 0; r < glyph.height; r++) {
      const row = gy + r;
      if (row < 0 || row >= canvas.height) continue;
      const source = glyph.offset + r * glyph.width;
      const target = row * canvas.stride + 1 + gx;
      const from = Math.max(0, -gx);
      const to = Math.min(glyph.width, canvas.width - gx);
      for (let c = from; c < to; c++) {
        const level = pixels[source + c];
        if (level === 0) continue;
        const step = 15 - level;
        const cur = rows[target + c];
        rows[target + c] = cur < step ? cur : step;
      }
    }
    pen += glyph.advance;
  }
  return pillWidth;
}

// ── Common Parts ────────────────────────────────────────────────────────────────────────────────────────────────

/** Pure black canvas with a crisp top (12 px) and bottom (6 px) brand edge bar for dark-mode and light-mode feeds. */
function drawInkFrame(canvas: Canvas, topBar = 12, bottomBar = 6) {
  canvas.rows.fill(BLACK);
  for (let row = 0; row < canvas.height; row++) canvas.rows[row * canvas.stride] = 0;
  fillRect(canvas, 0, 0, canvas.width, topBar, ACCENT_SOLID);
  fillRect(canvas, 0, canvas.height - bottomBar, canvas.width, bottomBar, ACCENT_SOLID);
}

/** «ELECT●SFERA» in crisp white with the party-colored dot and white ring, in a 52 px line from (`x`, `top`). */
function drawWordmark(canvas: Canvas, x: number, top: number): number {
  const center = top + WORDMARK_HEIGHT / 2;
  const wordmark = canvas.atlas.font('bsd-900-52');
  const spacing = 0.52;
  const y = baseline(wordmark, top, WORDMARK_HEIGHT);
  let pen = x + drawText(canvas, wordmark, 'ELECT', x, y, WHITE, spacing);
  const radius = (52 * 0.675) / 2;
  const ring = 52 * 0.07;
  pen += 52 * 0.075;
  drawWordmarkDot(canvas, pen + radius, center, radius, radius - ring);
  pen += 2 * radius + 52 * 0.075;
  pen += drawText(canvas, wordmark, 'SFERA', pen, y, WHITE, spacing);
  return pen - x;
}

function drawWordmarkDot(canvas: Canvas, cx: number, cy: number, outer: number, inner: number) {
  for (let y = Math.floor(cy - outer - 1); y <= Math.ceil(cy + outer + 1); y++) {
    for (let x = Math.floor(cx - outer - 1); x <= Math.ceil(cx + outer + 1); x++) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const outside = Math.min(1, Math.max(0, outer - distance + 0.5));
      const fill = Math.min(1, Math.max(0, inner - distance + 0.5));
      const at = y * canvas.stride + 1 + x;
      if (fill > 0) canvas.rows[at] = WORDMARK_DOT + Math.round((1 - fill) * 15);
      else if (outside > 0) canvas.rows[at] = WHITE + Math.round(outside * 15);
    }
  }
}

// One buffer for every card: the drawing and the encoding are synchronous, so two requests never share it.
const ROWS = new Uint8Array((WIDTH + 1) * HEIGHT);
const newCanvas = (atlas: Atlas, width = WIDTH, height = HEIGHT): Canvas => ({
  rows: ROWS.subarray(0, (width + 1) * height),
  atlas,
  width,
  height,
  stride: width + 1,
});

// ── The Cards ───────────────────────────────────────────────────────────────────────────────────────────────────

const ACRONYM_SIZES = [150, 120, 100, 84];

/** The card of a party (1200 × 675): Edición Tinta with dense 950-dot megaball on the right. */
export function drawPartyCard(atlas: Atlas, data: PartyCard): Uint8Array {
  const canvas = newCanvas(atlas);
  drawInkFrame(canvas);

  // Dense megaball anchored cleanly on the right (left edge at x = 755).
  blitStamp(canvas, STAMP_PARTY);

  const colW = 656; // ends at 720 -> crisp 35 px gutter before the megaball
  const labelFont = atlas.font('archivo-800-26');

  // Header row
  drawWordmark(canvas, PAD_X, 46);
  drawText(canvas, labelFont, 'PROGRAMA · 29N', PAD_X + colW, baseline(labelFont, 54, 34), ACCENT, 0, true);
  fillRect(canvas, PAD_X, 116, colW, 3, ACCENT_SOLID);

  // Acronym (largest size that fits in one line, else wraps at 84 px for long names like «FE DE LAS JONS»)
  const acronym = data.acronym.toUpperCase();
  const oneLineFont = ACRONYM_SIZES.map((s) => atlas.font(`bsd-900-${s}`)).find((f) => measure(f, acronym) <= colW);
  const acronymFont = oneLineFont ?? atlas.font('bsd-900-84');
  const acronymLines = oneLineFont ? [acronym] : wrap(acronymFont, acronym, colW, 2);
  const acronymStep = Math.round(acronymFont.size * 0.88);
  let y = 146;
  for (const line of acronymLines) {
    drawText(canvas, acronymFont, line, PAD_X, baseline(acronymFont, y, acronymStep), WHITE);
    y += acronymStep;
  }

  // Count in party brand color right beneath the acronym
  const countText = `${data.count} ${(data.count === 1 ? data.unit : data.unitPlural).toUpperCase()}`;
  const countFont = measure(atlas.font('bsd-900-84'), countText, 1) <= colW ? atlas.font('bsd-900-84') : atlas.font('archivo-800-46');
  const countStep = countFont.size === 84 ? 78 : 54;
  y += 14;
  drawText(canvas, countFont, countText, PAD_X, baseline(countFont, y, countStep), ACCENT, countFont.size === 84 ? 1 : 0);
  y += countStep + 22;

  // Party full name + program title
  const nameFont = atlas.font('archivo-700-36');
  const nameLines = data.name.toLowerCase() === data.acronym.toLowerCase() ? [] : wrap(nameFont, data.name, colW, 2);
  for (const line of nameLines) {
    drawText(canvas, nameFont, line, PAD_X, baseline(nameFont, y, 44), WHITE);
    y += 44;
  }
  const programFont = atlas.font('archivo-600-28');
  const programLines = data.program ? wrap(programFont, `«${data.program}»`, colW, nameLines.length > 1 ? 1 : 2) : [];
  if (nameLines.length && programLines.length) y += 8;
  for (const line of programLines) {
    drawText(canvas, programFont, line, PAD_X, baseline(programFont, y, 36), MUTED);
    y += 36;
  }

  // Anchored footer bar
  const footRuleY = HEIGHT - 96;
  fillRect(canvas, PAD_X, footRuleY, colW, 4, ACCENT_SOLID);
  drawBrandPill(canvas, labelFont, 'electosfera.es', PAD_X, footRuleY + 20);
  const pluralLabel = `${data.unitPlural.charAt(0).toUpperCase()}${data.unitPlural.slice(1)} por categoría`;
  drawText(canvas, labelFont, pluralLabel, PAD_X + colW, baseline(labelFont, footRuleY + 23, 34), MUTED, 0, true);

  return canvas.rows;
}

/** The card of one measure (1200 × 675): bold white quote, brand quote mark, and dense 850-dot corner megaball. */
export function drawMeasureCard(atlas: Atlas, data: MeasureCard): Uint8Array {
  const canvas = newCanvas(atlas);
  drawInkFrame(canvas);

  // Dense megaball rising cleanly from bottom-right corner (never touches the quote or bottom-left pill).
  blitStamp(canvas, STAMP_MEASURE);
  // Restore the bottom 6 px accent bar across the sphere's lower edge.
  fillRect(canvas, 0, HEIGHT - 6, WIDTH, 6, ACCENT_SOLID);

  // Header: wordmark left, party + measure + page pill right
  const wmWidth = drawWordmark(canvas, PAD_X, 46);
  const labelFont = atlas.font('archivo-800-26');
  const fullTag = `${data.acronym} · ${data.unit.toUpperCase()} ${data.number}${data.page ? ` · PÁG. ${data.page}` : ''}`;
  const shortTag = `${data.acronym} · ${data.unit.toUpperCase()} ${data.number}`;
  const maxTagW = WIDTH - PAD_X * 2 - wmWidth - 36;
  const tagText = measure(labelFont, fullTag) + 32 <= maxTagW ? fullTag : wrap(labelFont, shortTag, maxTagW - 32, 1)[0] ?? shortTag;
  const tagW = Math.round(measure(labelFont, tagText) + 32);
  drawBrandPill(canvas, labelFont, tagText, WIDTH - PAD_X - tagW, 52);

  fillRect(canvas, PAD_X, 116, WIDTH - PAD_X * 2, 3, ACCENT_SOLID);

  // Quote area
  const quoteFont = atlas.font('bsd-900-190');
  const quoteWidth = glyphOf(quoteFont, 0x201c)?.advance ?? 60;
  const colX = Math.round(PAD_X + quoteWidth + 24);
  const titleWidth = WIDTH - PAD_X - colX - 16;

  const size = data.title.length <= 38 ? 72 : data.title.length <= 64 ? 58 : 46;
  const titleFont = atlas.font(`archivo-800-${size}`);
  const titleSpacing = -0.01 * size;
  const titleLineHeight = size * 1.06;
  const titleLines = wrap(titleFont, data.title, titleWidth, 3, titleSpacing);

  // Keep the excerpt strictly left of the rising corner sphere (x <= 810).
  const excerptWidth = Math.min(titleWidth, 810 - colX);
  const bodyFont = atlas.font('archivo-500-26');
  const bodyLineHeight = 36;
  const bodyLines = data.excerpt ? wrap(bodyFont, data.excerpt, excerptWidth, 3) : [];

  drawText(canvas, quoteFont, '“', PAD_X, baseline(quoteFont, 158, 152), ACCENT);
  let y = 154;
  for (const line of titleLines) {
    drawText(canvas, titleFont, line, colX, baseline(titleFont, y, titleLineHeight), WHITE, titleSpacing);
    y += titleLineHeight;
  }
  if (bodyLines.length) {
    y += 22;
    for (const line of bodyLines) {
      drawText(canvas, bodyFont, line, colX, baseline(bodyFont, y, bodyLineHeight), MUTED);
      y += bodyLineHeight;
    }
  }

  // Footer pill + election label on bottom-left (well clear of the rising sphere)
  const pillW = drawWhitePill(canvas, labelFont, 'electosfera.es', PAD_X, HEIGHT - 76);
  drawText(canvas, labelFont, 'Programa electoral · 29N', PAD_X + pillW + 22, baseline(labelFont, HEIGHT - 73, 34), MUTED);

  return canvas.rows;
}

// ── The Square Card for WhatsApp (600 × 600) ────────────────────────────────────────────────────────────────────

const SQUARE_PAD = 42;

/**
 * The square card (600 × 600) for WhatsApp: pure black ink, top/bottom brand bar, dense corner megaball,
 * monumental acronym, one-line count/measure number in brand color, and `electosfera.es` badge.
 */
export function drawSquareCard(atlas: Atlas, acronym: string, line: string, quote: boolean): Uint8Array {
  const canvas = newCanvas(atlas, SQUARE, SQUARE);
  drawInkFrame(canvas, 10, 6);

  // Dense halftone megaball anchored in the lower-right corner (never collides with acronym, line, or URL pill).
  blitStamp(canvas, STAMP_SQUARE);
  fillRect(canvas, 0, SQUARE - 6, SQUARE, 6, ACCENT_SOLID);

  drawWordmark(canvas, SQUARE_PAD, 40);
  if (quote) {
    const qFont = atlas.font('bsd-900-190');
    const glyph = glyphOf(qFont, 0x201c);
    if (glyph) drawText(canvas, qFont, '“', SQUARE - SQUARE_PAD, 40 - glyph.top, ACCENT, 0, true);
  }

  const maxW = SQUARE - SQUARE_PAD * 2;
  const text = acronym.toUpperCase();
  const oneLine = ACRONYM_SIZES.map((s) => atlas.font(`bsd-900-${s}`)).find((f) => measure(f, text) <= maxW);
  const font = oneLine ?? atlas.font('bsd-900-84');
  const lines = oneLine ? [text] : wrap(font, text, maxW, 2);
  const lineStep = Math.round(font.size * 0.88);
  let y = lines.length === 1 ? 148 : 134;
  for (const part of lines) {
    drawText(canvas, font, part, SQUARE_PAD, baseline(font, y, lineStep), WHITE);
    y += lineStep;
  }

  const lineMaxW = 395;
  const lineFont =
    (['archivo-800-46', 'archivo-700-36', 'archivo-800-30'] as const)
      .map((name) => atlas.font(name))
      .find((f) => measure(f, line) <= lineMaxW) ?? atlas.font('archivo-800-30');
  const [fitted = ''] = wrap(lineFont, line, lineMaxW, 1);
  drawText(canvas, lineFont, fitted, SQUARE_PAD, baseline(lineFont, y + 18, Math.round(lineFont.size * 1.13)), ACCENT);

  drawBrandPill(canvas, atlas.font('archivo-800-26'), 'electosfera.es', SQUARE_PAD, SQUARE - 86);
  return canvas.rows;
}

const measureLine = (data: MeasureCard) => `${data.unit} ${data.number}`;
const partyLine = (data: PartyCard) => `${data.count} ${data.count === 1 ? data.unit : data.unitPlural}`;

export const squareMeasureCardPng = (atlas: Atlas, data: MeasureCard) =>
  encodePng(SQUARE, SQUARE, drawSquareCard(atlas, data.acronym, measureLine(data), true), palette(data.color, data.lightColor));

export const squarePartyCardPng = (atlas: Atlas, data: PartyCard) =>
  encodePng(SQUARE, SQUARE, drawSquareCard(atlas, data.acronym, partyLine(data), false), palette(data.color, data.lightColor));

export const measureCardPng = (atlas: Atlas, data: MeasureCard) =>
  encodePng(WIDTH, HEIGHT, drawMeasureCard(atlas, data), palette(data.color, data.lightColor));

export const partyCardPng = (atlas: Atlas, data: PartyCard) =>
  encodePng(WIDTH, HEIGHT, drawPartyCard(atlas, data), palette(data.color, data.lightColor));

/**
 * Draws a few cards that nobody asked for. The Worker calls it in its global scope, when an isolate starts: that time
 * is startup time (limit 1 s), not CPU time of a request (limit 10 ms).
 */
export function warmUp(atlas: Atlas, rounds = 4) {
  const sample = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore';
  for (let i = 0; i < rounds; i++) {
    measureCardPng(atlas, {
      acronym: 'ABC',
      color: '#e30613',
      lightColor: '#f2a4a9',
      unit: 'medida',
      number: 100 + i,
      title: sample.slice(0, 30 + i * 20),
      excerpt: `${sample}. ${sample}. ${sample}.`,
      page: 10,
    });
    squareMeasureCardPng(atlas, {
      acronym: 'ABC',
      color: '#e30613',
      lightColor: '#f2a4a9',
      unit: 'medida',
      number: 100 + i,
      title: '',
      excerpt: '',
    });
    partyCardPng(atlas, {
      acronym: 'ABC',
      name: 'Lorem Ipsum',
      program: 'Dolor sit amet',
      color: '#135898',
      lightColor: '#4dc1df',
      count: 123,
      unit: 'medida',
      unitPlural: 'medidas',
    });
  }
}
