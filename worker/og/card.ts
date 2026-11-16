/**
 * The link previews (1200 × 630) of a party and of one measure, drawn without a browser, in a few milliseconds.
 *
 * The design is the one of `scripts/og_images.py` (the static cards), with the same fonts, sizes and boxes; the
 * coordinates below are those of its CSS. The letters come from the atlas (`atlas.ts`), already drawn, so drawing
 * text is copying small bitmaps. The image has a palette of 65 colors: each color of the card (black, the gray of
 * the text, the party color, its light color) has 16 steps from its background, one for each coverage level of
 * the atlas. With one byte per pixel and long runs of one color, `png.ts` compresses it in about 1 ms.
 * Everything is synchronous: the result is ready when the function returns.
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
export const HEIGHT = 630;
const STRIDE = WIDTH + 1;

// Palette: four ramps of 16 steps (step 0 is the background, step 15 the ink), then the frame.
const INK = 0; // white → black (step 0 is the white of the card)
const GRAY = 16; // white → #3a3a3a
const ACCENT = 32; // white → party color
const DOT = 48; // light color → black (the inner edge of the ring of the wordmark dot)
const FRAME = 64;
const WHITE = INK;
const BLACK = INK + 15;

// The boxes of the CSS of `scripts/og_images.py`: body padding 34, border 6, card padding 44 / 54 / 36.
const X0 = 94;
const X1 = 1106;
const Y0 = 84;
const Y1 = 554;
const HEADER_HEIGHT = 52;
const FOOTER_ROW = 40; // the url pill: a line of 26 px Archivo plus 6 + 6 of padding
const FOOTER_TOP = Y1 - FOOTER_ROW - 20 - 5; // padding-top 20, border-top 5

type Ink = { base: number } | { inverse: true };
const ink = (base: number): Ink => ({ base });
const ON_BLACK: Ink = { inverse: true };

interface Canvas {
  rows: Uint8Array;
  atlas: Atlas;
}

const hex = (color: string) => {
  const digits = color.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits.slice(0, 6);
  const value = Number.parseInt(full, 16);
  return Number.isNaN(value) ? [0, 0, 0] : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

function palette(color: string, lightColor: string): Uint8Array {
  const out = new Uint8Array(65 * 3);
  const ramp = (start: number, from: number[], to: number[]) => {
    for (let step = 0; step < 16; step++) {
      for (let c = 0; c < 3; c++) out[(start + step) * 3 + c] = Math.round(from[c] + ((to[c] - from[c]) * step) / 15);
    }
  };
  const white = [255, 255, 255];
  ramp(INK, white, [0, 0, 0]);
  ramp(GRAY, white, [0x3a, 0x3a, 0x3a]);
  ramp(ACCENT, white, hex(color));
  ramp(DOT, hex(lightColor), [0, 0, 0]);
  out.set(hex(color), FRAME * 3);
  return out;
}

function fillRect(canvas: Canvas, x: number, y: number, width: number, height: number, index: number) {
  for (let row = Math.max(0, y); row < Math.min(HEIGHT, y + height); row++) {
    const start = row * STRIDE + 1;
    canvas.rows.fill(index, start + Math.max(0, x), start + Math.min(WIDTH, x + width));
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

const codePoints = (text: string) => Array.from(text.replace(/[\s ]+/g, ' '), (c) => c.codePointAt(0)!);

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
 * Each word is measured once; a line is the sum of its words and spaces.
 */
function wrap(font: Font, text: string, maxWidth: number, maxLines: number, spacing = 0): string[] {
  const space = (font.glyph(32)?.advance ?? 0) + spacing;
  const lines: string[] = [];
  let line = '';
  let lineWidth = 0;
  for (let word of text.replace(/[\s ]+/g, ' ').trim().split(' ')) {
    let wordWidth = measure(font, word, spacing);
    while (wordWidth > maxWidth && word.length > 1) {
      // A word that does not fit in one line: as many letters as fit.
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
function drawText(canvas: Canvas, font: Font, text: string, x: number, y: number, color: Ink, spacing = 0, alignRight = false): number {
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
      if (row < 0 || row >= HEIGHT) continue;
      const source = glyph.offset + r * glyph.width;
      const target = row * STRIDE + 1 + gx;
      const from = Math.max(0, -gx);
      const to = Math.min(glyph.width, WIDTH - gx);
      for (let c = from; c < to; c++) {
        const level = pixels[source + c];
        if (level === 0) continue;
        const current = rows[target + c];
        if ('base' in color) {
          // Letters of the same color can touch (kerning): keep the darker step of the two.
          const step = current >= color.base && current < color.base + 16 ? current - color.base : 0;
          rows[target + c] = color.base + (level > step ? level : step);
        } else {
          // White letters on black: the step goes down from black.
          const step = 15 - level;
          rows[target + c] = current < step ? current : step;
        }
      }
    }
    pen += glyph.advance + spacing;
  }
  return width;
}

// ── Common parts ────────────────────────────────────────────────────────────────────────────────────────────────

/** The frame in the party color, the black border and the white card. */
function drawFrame(canvas: Canvas) {
  canvas.rows.fill(FRAME);
  for (let row = 0; row < HEIGHT; row++) canvas.rows[row * STRIDE] = 0; // filter byte of each row: «none»
  fillRect(canvas, 34, 34, 1132, 562, BLACK);
  fillRect(canvas, 40, 40, 1120, 550, WHITE);
}

/** «ELECT●SFERA» and «Programa electoral · 29N». */
function drawHeader(canvas: Canvas) {
  const center = Y0 + HEADER_HEIGHT / 2;
  const wordmark = canvas.atlas.font('bsd-900-52');
  const spacing = 0.52; // letter-spacing .01em
  const y = baseline(wordmark, Y0, HEADER_HEIGHT);
  let pen = X0 + drawText(canvas, wordmark, 'ELECT', X0, y, ink(INK), spacing);
  // The dot: .675em wide, .075em of margin on each side, a black ring of .07em around the light color.
  const radius = (52 * 0.675) / 2;
  const ring = 52 * 0.07;
  pen += 52 * 0.075;
  drawDot(canvas, pen + radius, center, radius, radius - ring);
  pen += 2 * radius + 52 * 0.075;
  drawText(canvas, wordmark, 'SFERA', pen, y, ink(INK), spacing);

  const label = canvas.atlas.font('archivo-800-26');
  drawText(canvas, label, 'Programa electoral · 29N', X1, Math.round(center + (label.ascent - label.descent) / 2), ink(INK), 0, true);
}

function drawDot(canvas: Canvas, cx: number, cy: number, outer: number, inner: number) {
  for (let y = Math.floor(cy - outer - 1); y <= Math.ceil(cy + outer + 1); y++) {
    for (let x = Math.floor(cx - outer - 1); x <= Math.ceil(cx + outer + 1); x++) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const outside = Math.min(1, Math.max(0, outer - distance + 0.5)); // coverage of the whole dot
      const fill = Math.min(1, Math.max(0, inner - distance + 0.5)); // coverage of the light inside
      const at = y * STRIDE + 1 + x;
      // The ring is thicker than a pixel, so a pixel is on one edge only: black over white, or the light over black.
      if (fill > 0) canvas.rows[at] = DOT + Math.round((1 - fill) * 15);
      else if (outside > 0) canvas.rows[at] = INK + Math.round(outside * 15);
    }
  }
}

/** The line on top, the text on the left and «electosfera.es» in white on black. */
function drawFooter(canvas: Canvas, text: string) {
  const font = canvas.atlas.font('archivo-800-26');
  fillRect(canvas, X0, FOOTER_TOP, X1 - X0, 5, BLACK);
  const top = Y1 - FOOTER_ROW;
  const y = Math.round(top + FOOTER_ROW / 2 + (font.ascent - font.descent) / 2);
  const url = 'electosfera.es';
  const pillWidth = Math.round(measure(font, url) + 32);
  fillRect(canvas, X1 - pillWidth, top, pillWidth, FOOTER_ROW, BLACK);
  drawText(canvas, font, url, X1 - pillWidth + 16, y, ON_BLACK);
  const [line] = wrap(font, text, X1 - pillWidth - 24 - X0, 1);
  drawText(canvas, font, line ?? '', X0, y, ink(INK));
}

// One buffer for every card: the drawing and the encoding are synchronous, so two requests never share it.
const ROWS = new Uint8Array(STRIDE * HEIGHT);
const newCanvas = (atlas: Atlas): Canvas => ({ rows: ROWS, atlas });

// ── The cards ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The card of one measure: its title as a quote, the start of the text and where it is in the program. */
export function drawMeasureCard(atlas: Atlas, data: MeasureCard): Uint8Array {
  const canvas = newCanvas(atlas);
  drawFrame(canvas);
  drawHeader(canvas);
  drawFooter(canvas, `${data.acronym} · ${data.unit} ${data.number}${data.page ? ` · pág. ${data.page}` : ''}`);

  const quote = atlas.font('bsd-900-190');
  const quoteWidth = glyphOf(quote, 0x201c)?.advance ?? 0;
  const column = Math.round(X0 + quoteWidth + 26);
  const columnWidth = X1 - column;

  // A long title gets smaller, to fit in three lines.
  const size = data.title.length <= 38 ? 72 : data.title.length <= 64 ? 58 : 46;
  const titleFont = atlas.font(`archivo-800-${size}`);
  const titleSpacing = -0.01 * size;
  const titleLineHeight = size * 1.04;
  const titleLines = wrap(titleFont, data.title, columnWidth, 3, titleSpacing);
  const textFont = atlas.font('archivo-500-26');
  const textLineHeight = 26 * 1.35;
  const textLines = data.excerpt ? wrap(textFont, data.excerpt, columnWidth, 3) : [];
  const columnHeight = titleLines.length * titleLineHeight + (textLines.length ? 22 + textLines.length * textLineHeight : 0);

  // The quote box is 152 high (190 × .8) plus 6 of margin. Three auto margins (above and below this box, above
  // the footer) share the free space, so the box sits at a third of it.
  const height = Math.max(6 + 152, columnHeight);
  const free = FOOTER_TOP - (Y0 + HEADER_HEIGHT) - height;
  const top = Y0 + HEADER_HEIGHT + Math.max(0, free / 3);

  drawText(canvas, quote, '“', X0, baseline(quote, top + 6, 152), ink(ACCENT));
  let lineTop = top;
  for (const line of titleLines) {
    drawText(canvas, titleFont, line, column, baseline(titleFont, lineTop, titleLineHeight), ink(INK), titleSpacing);
    lineTop += titleLineHeight;
  }
  lineTop += 22;
  for (const line of textLines) {
    drawText(canvas, textFont, line, column, baseline(textFont, lineTop, textLineHeight), ink(GRAY));
    lineTop += textLineHeight;
  }
  return canvas.rows;
}

const ACRONYM_SIZES = [150, 120, 100, 84];

/** The card of a party: its acronym, its name, the name of the program and how many measures it has. */
export function drawPartyCard(atlas: Atlas, data: PartyCard): Uint8Array {
  const canvas = newCanvas(atlas);
  drawFrame(canvas);
  drawHeader(canvas);
  drawFooter(canvas, `Todas sus ${data.unitPlural}, por categoría`);

  // Right: the number and the unit, aligned right.
  const figureFont = atlas.font('bsd-900-120n');
  const unitFont = atlas.font('archivo-800-30');
  const figure = String(data.count);
  const unit = data.count === 1 ? data.unit : data.unitPlural;
  const unitLineHeight = unitFont.ascent + unitFont.descent;
  const rightWidth = Math.max(measure(figureFont, figure), measure(unitFont, unit));
  const bottom = FOOTER_TOP - 30;
  drawText(canvas, unitFont, unit, X1, baseline(unitFont, bottom - unitLineHeight, unitLineHeight), ink(INK), 0, true);
  drawText(canvas, figureFont, figure, X1, baseline(figureFont, bottom - unitLineHeight - 96, 96), ink(INK), 0, true);

  // Left: the acronym as large as fits (150 px for up to 8 letters, like the static card), the name and the program.
  const leftWidth = X1 - X0 - rightWidth - 40;
  const acronym = data.acronym.toUpperCase();
  const wanted = acronym.length <= 8 ? 150 : Math.max(84, (150 * 8) / acronym.length);
  const acronymFont =
    ACRONYM_SIZES.map((size) => atlas.font(`bsd-900-${size}`)).find(
      (font) => font.size <= wanted && measure(font, acronym) <= leftWidth,
    ) ?? atlas.font('bsd-900-84');

  const nameFont = atlas.font('archivo-700-36');
  const nameLines = data.name.toLowerCase() === data.acronym.toLowerCase() ? [] : wrap(nameFont, data.name, leftWidth, 2);
  const programFont = atlas.font('archivo-600-28');
  const programLines = data.program ? wrap(programFont, `«${data.program}»`, leftWidth, 2) : [];

  // Bottom up: the program (margin 10), the name (margin 14), the acronym (line height .86).
  let lineBottom = bottom;
  for (const line of [...programLines].reverse()) {
    drawText(canvas, programFont, line, X0, baseline(programFont, lineBottom - 33.6, 33.6), ink(GRAY));
    lineBottom -= 33.6;
  }
  lineBottom -= 10;
  for (const line of [...nameLines].reverse()) {
    drawText(canvas, nameFont, line, X0, baseline(nameFont, lineBottom - 43.2, 43.2), ink(INK));
    lineBottom -= 43.2;
  }
  if (nameLines.length) lineBottom -= 14;
  const acronymHeight = acronymFont.size * 0.86;
  drawText(canvas, acronymFont, acronym, X0, baseline(acronymFont, lineBottom - acronymHeight, acronymHeight), ink(INK));
  return canvas.rows;
}

export const measureCardPng = (atlas: Atlas, data: MeasureCard) =>
  encodePng(WIDTH, HEIGHT, drawMeasureCard(atlas, data), palette(data.color, data.lightColor));

export const partyCardPng = (atlas: Atlas, data: PartyCard) =>
  encodePng(WIDTH, HEIGHT, drawPartyCard(atlas, data), palette(data.color, data.lightColor));

/**
 * Draws a few cards that nobody asked for. The Worker calls it in its global scope, when an isolate starts: that time
 * is startup time (limit 1 s), not CPU time of a request (limit 10 ms). Without it, the first card of each isolate
 * runs in the interpreter of V8 and takes 14 to 18 ms; after it, the loops are compiled and a card takes 1 to 3 ms.
 */
export function warmUp(atlas: Atlas, rounds = 4) {
  // Filler text: only the length and the mix of letters matter, so the loops see work like a real card.
  const sample = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore';
  for (let i = 0; i < rounds; i++) {
    measureCardPng(atlas, {
      acronym: 'ABC',
      color: '#123456',
      lightColor: '#abcdef',
      unit: 'medida',
      number: 100 + i,
      title: sample.slice(0, 30 + i * 20),
      excerpt: `${sample}. ${sample}. ${sample}.`,
      page: 10,
    });
    partyCardPng(atlas, {
      acronym: 'ABC',
      name: 'Lorem Ipsum',
      program: 'Dolor sit amet',
      color: '#123456',
      lightColor: '#abcdef',
      count: 123,
      unit: 'medida',
      unitPlural: 'medidas',
    });
  }
}
