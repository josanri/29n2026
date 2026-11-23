/**
 * Generates the static Open Graph and Google Discover cards (1200 × 675, 16:9, «Edición Tinta») for the home
 * page and the six main sections of the site:
 *   public/<election>/og/portada.png
 *   public/<election>/og/simulador.png
 *   public/<election>/og/encuestas.png
 *   public/<election>/og/debates.png
 *   public/<election>/og/categorias.png
 *   public/<election>/og/tests.png
 *   public/<election>/og/calendario.png
 *
 * Uses the same pre-rasterized glyph atlas (`worker/og/atlas.bin`) and indexed PNG encoder (`worker/og/png.ts`)
 * as the Cloudflare Worker, so it needs no browser or external dependencies and runs in under one second.
 *
 * Use: npm run og:secciones
 *      node scripts/og_sections.ts [election]   (default «2026/generales»)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAtlas, type Atlas, type Font, type Glyph } from '../worker/og/atlas.ts';
import { encodePng } from '../worker/og/png.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ELECTION = process.argv[2] || process.env.ELECTION || '2026/generales';
const DATA_DIR = join(ROOT, 'src', 'data', ELECTION);
const OUT_DIR = join(ROOT, 'public', ELECTION, 'og');
mkdirSync(OUT_DIR, { recursive: true });

const atlasBytes = readFileSync(join(ROOT, 'worker', 'og', 'atlas.bin'));
const atlas = loadAtlas(atlasBytes.buffer.slice(atlasBytes.byteOffset, atlasBytes.byteOffset + atlasBytes.byteLength));

const WIDTH = 1200;
const HEIGHT = 675;
const YELLOW = '#ffd23f';
const WHITE = '#ffffff';
const BLACK = '#000000';
const MUTED = '#c8c8c8';
const SUBTLE = '#3a3a3a';

type Rgb = [number, number, number];
interface ClipBox { x0: number; y0: number; x1: number; y1: number; }
interface Canvas { width: number; height: number; stride: number; rows: Uint8Array; atlas: Atlas; pal: Palette; }

function hexToRgb(color: string): Rgb {
  const digits = color.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((x) => x + x).join('') : digits.slice(0, 6);
  const v = Number.parseInt(full, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

class Palette {
  private ramps = new Map<string, number>();
  private solids = new Map<string, number>();
  private rampEnd = 0;
  private solidStart = 256;
  private bytes = new Uint8Array(256 * 3);

  ramp(bgHex: string, fgHex: string): number {
    const key = `${bgHex.toLowerCase()}>${fgHex.toLowerCase()}`;
    const existing = this.ramps.get(key);
    if (existing !== undefined) return existing;
    if (this.rampEnd + 16 > this.solidStart) throw new Error(`Palette overflow: ${key}`);
    const base = this.rampEnd;
    this.rampEnd += 16;
    const from = hexToRgb(bgHex);
    const to = hexToRgb(fgHex);
    for (let s = 0; s < 16; s++) {
      for (let c = 0; c < 3; c++) this.bytes[(base + s) * 3 + c] = Math.round(from[c] + ((to[c] - from[c]) * s) / 15);
    }
    this.ramps.set(key, base);
    return base;
  }

  solid(hexColor: string): number {
    const key = hexColor.toLowerCase();
    const existing = this.solids.get(key);
    if (existing !== undefined) return existing;
    if (this.solidStart - 1 < this.rampEnd) throw new Error(`Palette overflow solid: ${key}`);
    this.solidStart--;
    const [r, g, b] = hexToRgb(hexColor);
    this.bytes[this.solidStart * 3] = r;
    this.bytes[this.solidStart * 3 + 1] = g;
    this.bytes[this.solidStart * 3 + 2] = b;
    this.solids.set(key, this.solidStart);
    return this.solidStart;
  }

  finish(): Uint8Array {
    return this.bytes;
  }
}

function createCanvas(accentHex = YELLOW): Canvas {
  const pal = new Palette();
  const stride = WIDTH + 1;
  const rows = new Uint8Array(stride * HEIGHT);
  rows.fill(pal.solid(BLACK));
  for (let y = 0; y < HEIGHT; y++) rows[y * stride] = 0;
  const c: Canvas = { width: WIDTH, height: HEIGHT, stride, rows, atlas, pal };
  fillRect(c, 0, 0, WIDTH, 12, pal.solid(accentHex));
  fillRect(c, 0, HEIGHT - 6, WIDTH, 6, pal.solid(accentHex));
  return c;
}

function fillRect(c: Canvas, x: number, y: number, w: number, h: number, idx: number) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(c.width, Math.round(x + w));
  const y1 = Math.min(c.height, Math.round(y + h));
  if (x1 <= x0 || y1 <= y0) return;
  for (let r = y0; r < y1; r++) c.rows.fill(idx, r * c.stride + 1 + x0, r * c.stride + 1 + x1);
}

function strokeRect(c: Canvas, x: number, y: number, w: number, h: number, t: number, idx: number) {
  fillRect(c, x, y, w, t, idx);
  fillRect(c, x, y + h - t, w, t, idx);
  fillRect(c, x, y, t, h, idx);
  fillRect(c, x + w - t, y, t, h, idx);
}

function fillCircle(c: Canvas, cx: number, cy: number, r: number, rampBase: number, clipBox: ClipBox | null = null) {
  const minY = Math.max(clipBox ? clipBox.y0 : 0, Math.floor(cy - r - 1));
  const maxY = Math.min((clipBox ? clipBox.y1 : c.height) - 1, Math.ceil(cy + r + 1));
  const minX = Math.max(clipBox ? clipBox.x0 : 0, Math.floor(cx - r - 1));
  const maxX = Math.min((clipBox ? clipBox.x1 : c.width) - 1, Math.ceil(cx + r + 1));
  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    const rowStart = y * c.stride + 1;
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x + 0.5 - cx, dy);
      const cov = r - dist + 0.5;
      if (cov <= 0) continue;
      const step = cov >= 1 ? 15 : Math.round(cov * 15);
      const cur = c.rows[rowStart + x];
      const curStep = cur >= rampBase && cur < rampBase + 16 ? cur - rampBase : 0;
      c.rows[rowStart + x] = rampBase + (step > curStep ? step : curStep);
    }
  }
}

function fillRingCircle(c: Canvas, cx: number, cy: number, outerR: number, ringW: number, bgToRing: number, fillToRing: number) {
  const innerR = outerR - ringW;
  const minY = Math.max(0, Math.floor(cy - outerR - 1));
  const maxY = Math.min(c.height - 1, Math.ceil(cy + outerR + 1));
  const minX = Math.max(0, Math.floor(cx - outerR - 1));
  const maxX = Math.min(c.width - 1, Math.ceil(cx + outerR + 1));
  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    const rowStart = y * c.stride + 1;
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x + 0.5 - cx, dy);
      const outside = Math.min(1, Math.max(0, outerR - dist + 0.5));
      if (outside <= 0) continue;
      const inside = Math.min(1, Math.max(0, innerR - dist + 0.5));
      c.rows[rowStart + x] = inside > 0 ? fillToRing + Math.round((1 - inside) * 15) : bgToRing + Math.round(outside * 15);
    }
  }
}

function drawLine(c: Canvas, x0: number, y0: number, x1: number, y1: number, thickness: number, rampBase: number) {
  const half = thickness / 2;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1));
  const maxX = Math.min(c.width - 1, Math.ceil(Math.max(x0, x1) + half + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1));
  const maxY = Math.min(c.height - 1, Math.ceil(Math.max(y0, y1) + half + 1));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) {
    const rowStart = y * c.stride + 1;
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / lenSq));
      const dist = Math.hypot(x + 0.5 - (x0 + t * dx), y + 0.5 - (y0 + t * dy));
      const cov = half - dist + 0.5;
      if (cov <= 0) continue;
      const step = cov >= 1 ? 15 : Math.round(cov * 15);
      const cur = c.rows[rowStart + x];
      const curStep = cur >= rampBase && cur < rampBase + 16 ? cur - rampBase : 0;
      c.rows[rowStart + x] = rampBase + (step > curStep ? step : curStep);
    }
  }
}

function glyphOf(font: Font, cp: number): Glyph | undefined {
  const g = font.glyph(cp);
  if (g) return g;
  const base = String.fromCodePoint(cp).normalize('NFD').codePointAt(0)!;
  return font.glyph(base) ?? font.glyph(63);
}

const codePoints = (text: string) => Array.from(text.replace(/[\s\u00a0]+/g, ' '), (ch) => ch.codePointAt(0)!);

function measure(font: Font, text: string, spacing = 0): number {
  const pts = codePoints(text);
  let w = 0;
  for (let i = 0; i < pts.length; i++) {
    w += (glyphOf(font, pts[i])?.advance ?? 0) + spacing;
    if (i > 0) w += font.kern(pts[i - 1], pts[i]);
  }
  return w;
}

function wrap(font: Font, text: string, maxW: number, maxLines: number, spacing = 0): string[] {
  const space = (font.glyph(32)?.advance ?? 0) + spacing;
  const lines: string[] = [];
  let line = '';
  let lw = 0;
  for (const w of text.trim().split(/\s+/)) {
    const ww = measure(font, w, spacing);
    if (!line) {
      line = w;
      lw = ww;
    } else if (lw + space + ww <= maxW) {
      line += ` ${w}`;
      lw += space + ww;
    } else {
      lines.push(line);
      line = w;
      lw = ww;
    }
    if (lines.length > maxLines) break;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

const baseline = (font: Font, top: number, lh: number) => Math.round(top + (lh - (font.ascent + font.descent)) / 2 + font.ascent);

function drawText(c: Canvas, font: Font, text: string, x: number, y: number, rampBase: number, spacing = 0, align: 'left' | 'center' | 'right' = 'left'): number {
  const width = measure(font, text, spacing);
  let pen = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  const pts = codePoints(text);
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) pen += font.kern(pts[i - 1], pts[i]);
    const glyph = glyphOf(font, pts[i]);
    if (!glyph) continue;
    const gx = Math.round(pen + glyph.left);
    const gy = y + glyph.top;
    for (let r = 0; r < glyph.height; r++) {
      const row = gy + r;
      if (row < 0 || row >= c.height) continue;
      const source = glyph.offset + r * glyph.width;
      const target = row * c.stride + 1 + gx;
      const from = Math.max(0, -gx);
      const to = Math.min(glyph.width, c.width - gx);
      for (let col = from; col < to; col++) {
        const level = c.atlas.pixels[source + col];
        if (level === 0) continue;
        const cur = c.rows[target + col];
        const curStep = cur >= rampBase && cur < rampBase + 16 ? cur - rampBase : 0;
        c.rows[target + col] = rampBase + (level > curStep ? level : curStep);
      }
    }
    pen += glyph.advance + spacing;
  }
  return width;
}

function drawWordmark(c: Canvas, x: number, top: number, dotHex = YELLOW) {
  const font = c.atlas.font('bsd-900-52');
  const y = baseline(font, top, 52);
  let pen = x + drawText(c, font, 'ELECT', x, y, c.pal.ramp(BLACK, WHITE), 0.52);
  const r = (52 * 0.675) / 2;
  pen += 52 * 0.075;
  fillRingCircle(c, pen + r, top + 26, r, 52 * 0.07, c.pal.ramp(BLACK, WHITE), c.pal.ramp(dotHex, WHITE));
  pen += 2 * r + 52 * 0.075;
  drawText(c, font, 'SFERA', pen, y, c.pal.ramp(BLACK, WHITE), 0.52);
}

function drawBadge(c: Canvas, text: string, x: number, y: number, bgHex = YELLOW, fgHex = BLACK, padX = 14, padY = 6) {
  const font = c.atlas.font('archivo-800-26');
  const w = Math.round(measure(font, text) + padX * 2);
  const h = 26 + padY * 2;
  fillRect(c, x, y, w, h, c.pal.solid(bgHex));
  drawText(c, font, text, x + padX, Math.round(y + h / 2 + (font.ascent - font.descent) / 2), c.pal.ramp(bgHex, fgHex));
  return { w, h };
}

interface LeftColumnSpec {
  kicker: string;
  line1: string;
  line2: string;
  subtitle: string;
  stats: [string, string][];
  footerRight: string;
  colW?: number;
  accentHex?: string;
}

function drawLeftColumn(c: Canvas, spec: LeftColumnSpec) {
  const padX = 64;
  const colW = spec.colW ?? 606;
  const accentHex = spec.accentHex ?? YELLOW;
  const whiteRamp = c.pal.ramp(BLACK, WHITE);
  const mutedRamp = c.pal.ramp(BLACK, MUTED);
  const accRamp = c.pal.ramp(BLACK, accentHex);

  drawWordmark(c, padX, 46, accentHex);
  const kw = Math.round(measure(atlas.font('archivo-800-26'), spec.kicker) + 28);
  drawBadge(c, spec.kicker, padX + colW - kw, 50, accentHex, BLACK);
  fillRect(c, padX, 118, colW, 3, c.pal.solid(accentHex));

  const disp = atlas.font('bsd-900-100');
  drawText(c, disp, spec.line1, padX, baseline(disp, 148, 92), whiteRamp, 1);
  drawText(c, disp, spec.line2, padX, baseline(disp, 240, 92), accRamp, 1);

  const subFont = atlas.font('archivo-700-36');
  let y = 364;
  for (const l of wrap(subFont, spec.subtitle, colW, 2)) {
    drawText(c, subFont, l, padX, baseline(subFont, y, 46), whiteRamp);
    y += 46;
  }

  const statY = 486;
  fillRect(c, padX, statY, colW, 3, c.pal.solid(SUBTLE));
  let sx = padX;
  for (const [num, lbl] of spec.stats) {
    const nw = drawText(c, atlas.font('archivo-800-30'), num, sx, baseline(atlas.font('archivo-800-30'), statY + 16, 36), accRamp);
    const lw = lbl ? drawText(c, atlas.font('archivo-500-26'), lbl, sx + nw + 8, baseline(atlas.font('archivo-500-26'), statY + 20, 32), mutedRamp) : 0;
    sx += nw + lw + (lbl ? 32 : 26);
  }

  const footY = c.height - 96;
  fillRect(c, padX, footY, colW, 4, c.pal.solid(accentHex));
  drawBadge(c, 'electosfera.es', padX, footY + 20, accentHex, BLACK, 16, 7);
  drawText(c, atlas.font('archivo-800-26'), spec.footerRight, padX + colW, baseline(atlas.font('archivo-800-26'), footY + 24, 34), mutedRamp, 0, 'right');
}

// ── Live Data Counts ────────────────────────────────────────────────────────────────────────────────────────────

const formatInt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function readLiveCounts() {
  const programsDir = join(DATA_DIR, 'programas');
  const files = readdirSync(programsDir).filter((f) => f.endsWith('.json'));
  let published = 0;
  let totalMeasures = 0;
  const catCounts = new Map<string, number>();
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(programsDir, file), 'utf8'));
    const announced = (data.medidas ?? []).filter((m: any) => !m.pendiente && !m.oculta);
    if (announced.length > 0) {
      published++;
      totalMeasures += announced.length;
      for (const m of announced) {
        if (m.categoria) catCounts.set(m.categoria, (catCounts.get(m.categoria) ?? 0) + 1);
      }
    }
  }
  const debatesDir = join(DATA_DIR, 'debates');
  let publishedDebates = 0;
  try {
    for (const file of readdirSync(debatesDir).filter((f) => f.endsWith('.json'))) {
      const debate = JSON.parse(readFileSync(join(debatesDir, file), 'utf8'));
      if (debate.published !== false) publishedDebates++;
    }
  } catch {
    publishedDebates = 0;
  }
  const categoryCounts = [...catCounts.values()].sort((a, b) => b - a);
  return { totalParties: files.length, published, totalMeasures, categoryCounts, publishedDebates };
}

const live = readLiveCounts();

function save(c: Canvas, filename: string) {
  const png = encodePng(c.width, c.height, c.rows, c.pal.finish());
  writeFileSync(join(OUT_DIR, filename), png);
  return { file: `public/${ELECTION}/og/${filename}`, KB: (png.length / 1024).toFixed(1) };
}

// ── 0. PORTADA ──────────────────────────────────────────────────────────────────────────────────────────────────

function renderPortada() {
  const c = createCanvas();
  // Dense 1,150-dot halftone megaball anchored cleanly on the right
  const cx = 1055, cy = 342, radius = 290, dotCount = 1150;
  fillCircle(c, cx, cy, radius, c.pal.ramp(BLACK, YELLOW));
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
  const pts = grid.slice(0, dotCount);
  const maxDist = pts[pts.length - 1].dist + 0.5;
  const unit = (radius - 1.5) / maxDist;
  const [lx, ly, lz] = [-0.5, -0.6, 0.62];
  const dotRamp = c.pal.ramp(YELLOW, BLACK);
  for (const pt of pts) {
    const nx = pt.x / maxDist, ny = pt.y / maxDist;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const light = Math.max(0, nx * lx + ny * ly + nz * lz);
    const shade = Math.min(0.95, 0.14 + 0.88 * (1 - light));
    fillCircle(c, cx + pt.x * unit, cy + pt.y * unit, (shade * unit) / 2, dotRamp);
  }
  // Restore top/bottom edge bars
  fillRect(c, 0, 0, WIDTH, 12, c.pal.solid(YELLOW));
  fillRect(c, 0, HEIGHT - 6, WIDTH, 6, c.pal.solid(YELLOW));

  drawLeftColumn(c, {
    colW: 668,
    kicker: 'ELECCIONES 29N · 2026',
    line1: 'EL 29N EN DATOS',
    line2: 'PUNTO POR PUNTO',
    subtitle: 'Programas, encuestas, debates, simulador y tests electorales.',
    stats: [
      [String(live.published), 'programas'],
      [formatInt(live.totalMeasures), 'medidas'],
      [String(live.categoryCounts.length), 'categorías'],
    ],
    footerRight: `${live.totalParties} partidos · 52 provincias`,
  });

  return save(c, 'portada.png');
}

// ── 1. SIMULADOR ────────────────────────────────────────────────────────────────────────────────────────────────

function renderSimulador() {
  const c = createCanvas();
  drawLeftColumn(c, {
    kicker: 'HERRAMIENTA · 29N',
    line1: 'SIMULADOR',
    line2: 'DE CONGRESO',
    subtitle: 'Reparte los 350 escaños y prueba pactos de investidura.',
    stats: [['350', 'escaños'], ['176', 'mayoría']],
    footerRight: 'Pactos · Art. 99 CE',
  });

  const cx = 936, cy = 448, innerR = 96, outerR = 224, rows = 11;
  const step = (outerR - innerR) / (rows - 1);
  const radii = Array.from({ length: rows }, (_, r) => innerR + r * step);
  const radiiSum = radii.reduce((a, b) => a + b, 0);
  const perRow = radii.map((r) => Math.round((350 * r) / radiiSum));
  perRow[rows - 1] += 350 - perRow.reduce((a, b) => a + b, 0);

  const seats: { x: number; y: number; angle: number; radius: number }[] = [];
  radii.forEach((radius, rIdx) => {
    const count = perRow[rIdx];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * (1 - (count === 1 ? 0.5 : i / (count - 1)));
      seats.push({ x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle), angle, radius });
    }
  });
  seats.sort((a, b) => b.angle - a.angle || a.radius - b.radius);

  const seatR = step * 0.4;
  const yellowRamp = c.pal.ramp(BLACK, YELLOW);
  const mutedSeatRamp = c.pal.ramp(BLACK, '#5c5c5c');
  const whiteRamp = c.pal.ramp(BLACK, WHITE);

  for (let y = cy - outerR - 24; y < cy - innerR + 6; y += 14) {
    fillRect(c, cx - 2, y, 4, 8, c.pal.solid(WHITE));
  }
  for (let i = 0; i < seats.length; i++) {
    fillCircle(c, seats[i].x, seats[i].y, seatR, i < 176 ? yellowRamp : mutedSeatRamp);
  }

  drawText(c, atlas.font('bsd-900-84'), '176', cx, baseline(atlas.font('bsd-900-84'), cy - 86, 72), whiteRamp, 0, 'center');
  drawText(c, atlas.font('archivo-800-26'), 'MAYORÍA', cx, baseline(atlas.font('archivo-800-26'), cy - 12, 28), yellowRamp, 0, 'center');
  fillRect(c, cx - outerR, cy + 28, outerR * 2, 3, c.pal.solid(SUBTLE));
  drawText(c, atlas.font('archivo-500-26'), 'Herramienta, no encuesta', cx, baseline(atlas.font('archivo-500-26'), cy + 44, 32), c.pal.ramp(BLACK, MUTED), 0, 'center');

  return save(c, 'simulador.png');
}

// ── 2. ENCUESTAS (Party-agnostic scatter + trend curves) ────────────────────────────────────────────────────────

function renderEncuestas() {
  const c = createCanvas();
  drawLeftColumn(c, {
    kicker: 'SONDEOS · 29N',
    line1: 'ENCUESTAS',
    line2: 'DEL 29N',
    subtitle: 'Estimación de voto y evolución con enlace a cada fuente.',
    stats: [['5', 'encuestadoras'], ['2026', 'evolución']],
    footerRight: 'CIS · 40dB. · GAD3 · +2',
  });

  const gx0 = 720, gy0 = 136, gw = 424, gh = 384;
  const gridCol = c.pal.solid('#262626');
  const axisCol = c.pal.solid('#555555');
  const mutedRamp = c.pal.ramp(BLACK, MUTED);

  for (let pct = 10; pct <= 40; pct += 10) {
    const y = Math.round(gy0 + gh - ((pct - 5) / 38) * gh);
    fillRect(c, gx0, y, gw, 2, gridCol);
    drawText(c, atlas.font('archivo-500-26'), `${pct}%`, gx0, baseline(atlas.font('archivo-500-26'), y - 34, 30), c.pal.ramp(BLACK, '#777777'));
  }
  for (let i = 1; i <= 4; i++) {
    const x = Math.round(gx0 + 54 + (i / 5) * (gw - 68));
    fillRect(c, x, gy0, 2, gh, c.pal.solid('#181818'));
  }
  fillRect(c, gx0, gy0 + gh, gw, 3, axisCol);

  const series = [
    { color: YELLOW, width: 6, dotR: 7, vals: [31.5, 33.0, 32.1, 34.0, 33.4, 35.0, 34.4] },
    { color: WHITE, width: 5, dotR: 6, vals: [29.0, 28.4, 29.8, 28.9, 30.2, 29.6, 30.4] },
    { color: '#9e9e9e', width: 4, dotR: 5, vals: [15.5, 16.2, 15.8, 17.0, 16.5, 17.4, 17.1] },
    { color: '#5c5c5c', width: 4, dotR: 5, vals: [10.4, 9.8, 10.6, 9.9, 10.3, 9.7, 10.1] },
  ];
  const scatterOffsets = [
    [-1.4, 1.8, -1.1, 1.5, -1.7, 1.2, -0.9],
    [1.6, -1.2, 1.3, -1.6, 1.1, -1.4, 1.5],
    [-1.0, 1.2, -0.8, 1.1, -1.3, 0.9, -1.1],
    [0.9, -0.8, 1.1, -0.9, 0.8, -1.1, 0.7],
  ];

  const xAt = (i: number, n: number) => gx0 + 60 + (i / (n - 1)) * (gw - 76);
  const yAt = (v: number) => gy0 + gh - ((v - 5) / 38) * gh;

  for (let sIdx = 0; sIdx < series.length; sIdx++) {
    const s = series[sIdx];
    const scatterRamp = c.pal.ramp(BLACK, sIdx === 0 ? '#7a651e' : '#3d3d3d');
    for (let i = 0; i < s.vals.length; i++) {
      const px = xAt(i, s.vals.length) + (i % 2 === 0 ? -8 : 8);
      fillCircle(c, px, yAt(s.vals[i] + scatterOffsets[sIdx][i]), 4, scatterRamp);
      fillCircle(c, px + 10, yAt(s.vals[i] - scatterOffsets[sIdx][i] * 0.7), 3.5, scatterRamp);
    }
  }
  for (const s of series) {
    const ramp = c.pal.ramp(BLACK, s.color);
    for (let i = 0; i < s.vals.length - 1; i++) {
      drawLine(c, xAt(i, s.vals.length), yAt(s.vals[i]), xAt(i + 1, s.vals.length), yAt(s.vals[i + 1]), s.width, ramp);
    }
    for (let i = 0; i < s.vals.length; i++) {
      fillCircle(c, xAt(i, s.vals.length), yAt(s.vals[i]), i === s.vals.length - 1 ? s.dotR + 1.5 : s.dotR - 1, ramp);
    }
  }

  drawText(c, atlas.font('archivo-500-26'), 'Media móvil y sondeos publicados', gx0 + gw / 2, baseline(atlas.font('archivo-500-26'), gy0 + gh + 22, 32), mutedRamp, 0, 'center');
  return save(c, 'encuestas.png');
}

// ── 3. DEBATES (Party-agnostic acoustic waveform + turn tracks) ─────────────────────────────────────────────────

function renderDebates() {
  const c = createCanvas();
  const debateCount = Math.max(1, live.publishedDebates);
  drawLeftColumn(c, {
    kicker: 'DEBATES · 29N',
    line1: 'DEBATES',
    line2: 'AL MINUTO',
    subtitle: 'Transcripción íntegra, reparto de tiempos, citas y temas.',
    stats: [[String(debateCount), debateCount === 1 ? 'debate' : 'debates'], ['100%', 'transcritos']],
    footerRight: 'Tiempos · Interrupciones',
  });

  const tx0 = 720, tw = 424, waveY = 186, barCount = 46;
  const barStep = tw / barCount;
  for (let i = 0; i < barCount; i++) {
    const env = Math.abs(Math.sin(i * 0.42) * Math.cos(i * 0.19)) * 0.72 + Math.abs(Math.sin(i * 1.13)) * 0.28;
    const h = Math.max(8, Math.round(env * 86));
    const col = i % 7 === 0 || (i >= 18 && i <= 25) ? YELLOW : i % 3 === 0 ? WHITE : '#5c5c5c';
    fillRect(c, Math.round(tx0 + i * barStep), Math.round(waveY - h / 2), Math.max(4, Math.floor(barStep - 3)), h, c.pal.solid(col));
  }

  for (let i = 0; i <= 4; i++) {
    fillRect(c, Math.round(tx0 + (i / 4) * tw), 256, 2, 260, c.pal.solid('#262626'));
  }

  const tracks = [
    { color: YELLOW, segs: [[0.0, 0.15], [0.28, 0.41], [0.60, 0.74], [0.88, 0.99]] },
    { color: WHITE, segs: [[0.15, 0.28], [0.46, 0.60], [0.74, 0.85]] },
    { color: '#9e9e9e', segs: [[0.04, 0.12], [0.39, 0.47], [0.68, 0.79], [0.85, 0.93]] },
    { color: '#5c5c5c', segs: [[0.19, 0.30], [0.51, 0.63], [0.79, 0.89]] },
  ];

  let ty = 274;
  for (const t of tracks) {
    fillRect(c, tx0, ty, tw, 36, c.pal.solid('#161616'));
    for (const [a, b] of t.segs) {
      fillRect(c, tx0 + a * tw, ty, Math.max(10, (b - a) * tw - 3), 36, c.pal.solid(t.color));
    }
    ty += 58;
  }

  fillRect(c, tx0, 516, tw, 3, c.pal.solid('#555555'));
  const fTime = atlas.font('archivo-500-26');
  const mRamp = c.pal.ramp(BLACK, MUTED);
  drawText(c, fTime, '00:00', tx0, baseline(fTime, 530, 30), mRamp);
  drawText(c, fTime, '45:00', tx0 + tw / 2, baseline(fTime, 530, 30), mRamp, 0, 'center');
  drawText(c, fTime, '90:00', tx0 + tw, baseline(fTime, 530, 30), mRamp, 0, 'right');

  return save(c, 'debates.png');
}

// ── 4. TESTS (Dual-side halftone sphere in official tokens.css colors) ──────────────────────────────────────────

function renderTests() {
  const c = createCanvas();
  drawLeftColumn(c, {
    kicker: 'TESTS · 29N',
    line1: 'TESTS',
    line2: 'ELECTORALES',
    subtitle: `Compara tus respuestas con los ${live.published} programas sin siglas.`,
    stats: [['Sin siglas', ''], ['Temas', 'que dividen']],
    footerRight: 'A favor · En contra · Matices',
  });

  const cx = 960, cy = 338, radius = 232;
  const sideA = '#3157c9';
  const sideB = '#e0462f';
  const clipLeft: ClipBox = { x0: 0, y0: 0, x1: cx - 5, y1: c.height };
  const clipRight: ClipBox = { x0: cx + 5, y0: 0, x1: c.width, y1: c.height };

  fillCircle(c, cx, cy, radius, c.pal.ramp(BLACK, sideA), clipLeft);
  fillCircle(c, cx, cy, radius, c.pal.ramp(BLACK, sideB), clipRight);

  const dotCount = 950;
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
  const pts = grid.slice(0, dotCount);
  const maxDist = pts[pts.length - 1].dist + 0.5;
  const unit = (radius - 2) / maxDist;
  const [lx, ly, lz] = [-0.5, -0.6, 0.62];
  const dotA = c.pal.ramp(sideA, BLACK);
  const dotB = c.pal.ramp(sideB, BLACK);
  for (const pt of pts) {
    const nx = pt.x / maxDist, ny = pt.y / maxDist;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const light = Math.max(0, nx * lx + ny * ly + nz * lz);
    const shade = Math.min(0.95, 0.14 + 0.88 * (1 - light));
    const px = cx + pt.x * unit, py = cy + pt.y * unit, pr = (shade * unit) / 2;
    if (px < cx - 5) fillCircle(c, px, py, pr, dotA, clipLeft);
    else if (px > cx + 5) fillCircle(c, px, py, pr, dotB, clipRight);
  }

  drawText(c, atlas.font('archivo-800-26'), 'POSTURA A', cx - 18, baseline(atlas.font('archivo-800-26'), cy + radius + 16, 32), c.pal.ramp(BLACK, '#6f92f2'), 0, 'right');
  drawText(c, atlas.font('archivo-800-26'), 'POSTURA B', cx + 18, baseline(atlas.font('archivo-800-26'), cy + radius + 16, 32), c.pal.ramp(BLACK, sideB), 0, 'left');

  return save(c, 'tests.png');
}

// ── 5. CATEGORÍAS (Exact 21-petal CategoryRose.astro from live measure counts) ──────────────────────────────────

function renderCategorias() {
  const c = createCanvas();
  const nCats = live.categoryCounts.length;
  const totalFmt = formatInt(live.totalMeasures);
  drawLeftColumn(c, {
    kicker: 'TAXONOMÍA · 29N',
    line1: `${nCats} CATEGORÍAS`,
    line2: `${totalFmt} MEDIDAS`,
    subtitle: 'Compara el peso de vivienda, economía, sanidad o impuestos.',
    stats: [[String(live.published), 'programas'], [String(nCats), 'temas comunes']],
    footerRight: 'Taxonomía comparable',
  });

  const counts = live.categoryCounts;
  const maxCount = Math.max(1, ...counts);
  const n = counts.length;
  const cx = 936, cy = 338, RIM = 228, HOLE = 88;
  const step = (2 * Math.PI) / n;
  const petalRadii = counts.map((cnt) => Math.sqrt(HOLE * HOLE + (RIM * RIM - HOLE * HOLE) * (cnt / maxCount)));

  const yellowRamp = c.pal.ramp(BLACK, YELLOW);
  const whiteRamp = c.pal.ramp(BLACK, WHITE);
  const trackDotIdx = c.pal.solid('#4d4d4d');
  const blackIdx = c.pal.solid(BLACK);

  const minX = Math.floor(cx - RIM - 4), maxX = Math.ceil(cx + RIM + 4);
  const minY = Math.floor(cy - RIM - 4), maxY = Math.ceil(cy + RIM + 4);
  const sepHalfPx = 1.6;

  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    const rowStart = y * c.stride + 1;
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dist = Math.hypot(dx, dy);
      if (dist > RIM + 2.5 || dist < HOLE - 2.5) continue;

      let ang = Math.atan2(dy, dx) + Math.PI / 2;
      if (ang < 0) ang += 2 * Math.PI;
      const idx = Math.min(n - 1, Math.floor(ang / step));
      const localAng = ang - idx * step;
      const distToEdge = Math.min(localAng, step - localAng) * dist;

      const rimDist = Math.abs(dist - RIM);
      if (rimDist <= 2.0) {
        c.rows[rowStart + x] = whiteRamp + Math.round(Math.min(1, Math.max(0, 1.8 - rimDist)) * 15);
        continue;
      }
      const holeDist = Math.abs(dist - HOLE);
      if (holeDist <= 2.2) {
        c.rows[rowStart + x] = whiteRamp + Math.round(Math.min(1, Math.max(0, 2.0 - holeDist)) * 15);
        continue;
      }
      if (dist <= HOLE || dist >= RIM) continue;

      const pRad = petalRadii[idx];
      if (dist <= pRad + 0.6 && distToEdge >= sepHalfPx - 0.5) {
        const cov = Math.min(Math.min(1, Math.max(0, pRad - dist + 0.5)), Math.min(1, Math.max(0, distToEdge - sepHalfPx + 0.5)));
        if (cov > 0) c.rows[rowStart + x] = yellowRamp + Math.round(cov * 15);
      } else if (distToEdge >= 1.2) {
        const rx = (dx + dy) * 0.70710678;
        const ry = (dy - dx) * 0.70710678;
        const cell = 8.5;
        const mx = ((rx % cell) + cell) % cell - cell / 2;
        const my = ((ry % cell) + cell) % cell - cell / 2;
        if (mx * mx + my * my <= 1.75 * 1.75) c.rows[rowStart + x] = trackDotIdx;
      } else {
        c.rows[rowStart + x] = blackIdx;
      }
    }
  }

  drawText(c, atlas.font('archivo-800-46'), totalFmt, cx, baseline(atlas.font('archivo-800-46'), cy - 38, 46), whiteRamp, -0.5, 'center');
  drawText(c, atlas.font('archivo-800-26'), 'medidas', cx, baseline(atlas.font('archivo-800-26'), cy + 12, 28), yellowRamp, 0, 'center');

  return save(c, 'categorias.png');
}

// ── 6. CALENDARIO ───────────────────────────────────────────────────────────────────────────────────────────────

function renderCalendario() {
  const c = createCanvas();
  drawLeftColumn(c, {
    kicker: 'FECHAS · 29N',
    line1: 'CALENDARIO',
    line2: 'ELECTORAL',
    subtitle: 'Voto por correo, campaña y fechas clave para tu agenda.',
    stats: [['29 NOV', 'elecciones'], ['.ics', 'Google Calendar']],
    footerRight: 'Plazos oficiales · 2026',
  });

  const bx = 740, by = 104, bw = 396, bh = 468;
  strokeRect(c, bx, by, bw, bh, 5, c.pal.solid(YELLOW));
  fillRect(c, bx, by, bw, 68, c.pal.solid(YELLOW));
  drawText(c, atlas.font('archivo-800-30'), 'NOVIEMBRE 2026', bx + bw / 2, baseline(atlas.font('archivo-800-30'), by + 16, 36), c.pal.ramp(YELLOW, BLACK), 0, 'center');
  drawText(c, atlas.font('bsd-900-150'), '29', bx + bw / 2, baseline(atlas.font('bsd-900-150'), by + 92, 140), c.pal.ramp(BLACK, WHITE), 0, 'center');
  drawText(c, atlas.font('archivo-800-26'), 'JORNADA ELECTORAL', bx + bw / 2, baseline(atlas.font('archivo-800-26'), by + 244, 32), c.pal.ramp(BLACK, YELLOW), 0, 'center');

  fillRect(c, bx + 24, by + 292, bw - 48, 3, c.pal.solid(SUBTLE));
  const cellW = 46, cellH = 26, gx = bx + 38, gy = by + 312;
  for (let day = 1; day <= 30; day++) {
    const offset = day + 5;
    const row = Math.floor(offset / 7);
    const col = offset % 7;
    const isVote = day === 29;
    const isCampaign = day >= 13 && day <= 27;
    fillRect(c, gx + col * cellW, gy + row * cellH, 36, 18, c.pal.solid(isVote ? YELLOW : isCampaign ? '#4a4a4a' : '#1f1f1f'));
  }

  return save(c, 'calendario.png');
}

const results = [
  renderPortada(),
  renderSimulador(),
  renderEncuestas(),
  renderDebates(),
  renderTests(),
  renderCategorias(),
  renderCalendario(),
];
console.table(results);
