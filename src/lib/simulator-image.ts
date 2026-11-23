/**
 * The image of the simulator, drawn on a canvas: a title, the hemicycle, the legend and the band of the site.
 * It has four sizes, two themes and two contents (the seats of each party, or the vote of investiture).
 * The colors of the themes copy `src/styles/tokens.css`: a canvas can not read `light-dark()` for a theme
 * that the page does not show. Contrast: ink on paper 21:1, muted ink 10:1 (light) and 11:1 (dark),
 * black on the yellow band 13:1.
 */
import { ABSOLUTE_MAJORITY, CONGRESS_SEATS } from '@eleccion/congreso';
import { HEMICYCLE, hemicyclePositions, type InvestitureResult, type Vote } from './simulator';

export type ImageFormat = 'wide' | 'square' | 'portrait' | 'story';
export type ImageContent = 'seats' | 'vote';
export type ImageTheme = 'light' | 'dark';

export const IMAGE_FORMATS: Record<ImageFormat, { width: number; height: number; label: string; use: string }> = {
  wide: { width: 1280, height: 720, label: 'Horizontal', use: 'X, WhatsApp y webs' },
  square: { width: 1080, height: 1080, label: 'Cuadrada', use: 'Instagram y Facebook' },
  portrait: { width: 1080, height: 1350, label: 'Vertical', use: 'Publicación de Instagram' },
  story: { width: 1080, height: 1920, label: 'Historia', use: 'Historias y estados' },
};

export interface ImageParty {
  acronym: string;
  color: string;
  seats: number;
  vote: Vote;
}

export interface ImageInput {
  content: ImageContent;
  format: ImageFormat;
  theme: ImageTheme;
  title: string;
  /** The text of the yellow label above the title. */
  kicker: string;
  /** In the order of the hemicycle, from the left. */
  parties: ImageParty[];
  /** The vote only: the acronym of the candidate or sponsor, the result and the sentence of the verdict. */
  candidate?: string;
  result?: InvestitureResult;
  verdict?: string;
  voteColors: Record<Vote, string>;
  brand: string;
  /** The address of the simulator, without «https://». */
  address: string;
  /** Total seats of the chamber (defaults to Congress: 350). */
  totalSeats?: number;
  /** Absolute majority threshold of the chamber (defaults to Congress: 176). */
  majority?: number;
  /** Number of rows in the hemicycle (defaults to Congress: 11). */
  hemicycleRows?: number;
  /** Fallback title when the title input is empty. */
  defaultTitle?: string;
  /** Label shown above the candidate or sponsor acronym in the middle of the vote hemicycle. */
  voteSubjectLabel?: string;
}

const THEMES: Record<ImageTheme, { paper: string; ink: string; muted: string }> = {
  light: { paper: '#ffffff', ink: '#000000', muted: '#3a3a3a' },
  dark: { paper: '#000000', ink: '#ffffff', muted: '#c8c8c8' },
};
const HIGHLIGHT = '#ffd23f';
const ON_HIGHLIGHT = '#000000';
const DISPLAY = '"Big Shoulders Display", "Big Shoulders Fallback", Impact, "Arial Narrow", sans-serif';
const BODY = '"Archivo Variable", "Archivo", "Archivo Fallback", Arial, sans-serif';
const VOTE_NAMES: Record<Vote, string> = { yes: 'Sí', no: 'No', abstain: 'Abstención' };

/** A canvas only draws a web font that is loaded: load the faces of the image before the first drawing. */
export const loadImageFonts = () =>
  Promise.all([`900 40px ${DISPLAY}`, `700 20px ${BODY}`, `800 20px ${BODY}`, `600 20px ${BODY}`].map((font) => document.fonts.load(font))).catch(
    () => undefined,
  );

const hemicycleCache = new Map<string, ReturnType<typeof hemicyclePositions>>();
const hemicycleFor = (totalSeats: number, rows: number) => {
  const key = `${totalSeats}:${rows}`;
  let cached = hemicycleCache.get(key);
  if (!cached) {
    cached = hemicyclePositions(totalSeats, rows);
    hemicycleCache.set(key, cached);
  }
  return cached;
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---- The animation of the video ----
// The empty hemicycle shows for a moment. Then the parties fill their seats one after the other (the largest
// first; in the vote, the yes, then the no, then the abstention). Each seat grows with a small bounce, and the
// row of the party appears in the legend. At the end the middle shows the result, and the image stays still.
const INTRO = 0.6;
const FILL = 4.4;
const POP = 0.28;
const FADE = 0.4;
const HOLD = 2.6;
/** The length of the video, in seconds. */
export const IMAGE_ANIMATION_SECONDS = INTRO + FILL + POP + FADE + HOLD;
/** The part of the animation that moves. After it, the final image stays still for `IMAGE_HOLD_SECONDS`. */
export const IMAGE_HOLD_SECONDS = HOLD;
export const IMAGE_MOVING_SECONDS = IMAGE_ANIMATION_SECONDS - HOLD;
/** The GIF is at half size: the file stays small enough for X (15 MB) and for a message. */
export const GIF_SCALE = 0.5;

const VOTE_ORDER: Record<Vote, number> = { yes: 0, no: 1, abstain: 2 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

/** The order of the parties in the legend of the seats: the largest first. */
const bySeats = (a: ImageParty, b: ImageParty) => b.seats - a.seats || a.acronym.localeCompare(b.acronym, 'es');

/** When each seat and each party starts to appear, in seconds. A seat that no party takes never appears. */
const animationPlan = (input: ImageInput, totalSeats: number) => {
  const offsets: number[] = [];
  let offset = 0;
  for (const party of input.parties) {
    offsets.push(offset);
    offset += party.seats;
  }
  const order = input.parties.map((_, index) => index).filter((index) => input.parties[index].seats > 0);
  if (input.content === 'vote') {
    order.sort((a, b) => VOTE_ORDER[input.parties[a].vote] - VOTE_ORDER[input.parties[b].vote] || a - b);
  } else {
    order.sort((a, b) => bySeats(input.parties[a], input.parties[b]));
  }
  const filled = order.reduce((sum, index) => sum + input.parties[index].seats, 0);
  const seatStart = new Array<number>(totalSeats).fill(Infinity);
  const partyStart = new Array<number>(input.parties.length).fill(Infinity);
  let time = INTRO;
  for (const index of order) {
    const seats = input.parties[index].seats;
    // A small party still takes a moment, so its row is seen; a large party takes longer.
    const duration = FILL * (0.4 / order.length + (0.6 * seats) / filled);
    partyStart[index] = time;
    for (let seat = 0; seat < seats; seat += 1) {
      const position = offsets[index] + seat;
      if (position < totalSeats) seatStart[position] = time + (duration * 0.85 * seat) / seats;
    }
    time += duration;
  }
  return { seatStart, partyStart, fillEnd: time + POP };
};

let cachedPlan: { key: string; plan: ReturnType<typeof animationPlan> } | null = null;
const animationPlanFor = (input: ImageInput, totalSeats: number) => {
  const key = `${totalSeats}|${input.content}|${input.parties.map((party) => `${party.seats}:${party.vote}:${party.acronym}`).join(',')}`;
  if (cachedPlan?.key !== key) cachedPlan = { key, plan: animationPlan(input, totalSeats) };
  return cachedPlan.plan;
};

/**
 * Draws the image. Without `time`, it draws the final image. With `time` (seconds from the start of the video),
 * it draws that frame of the animation.
 */
export const drawSimulatorImage = (canvas: HTMLCanvasElement, input: ImageInput, time = Infinity) => {
  const totalSeats = input.totalSeats ?? CONGRESS_SEATS;
  const majority = input.majority ?? ABSOLUTE_MAJORITY;
  const hemicycleRows = input.hemicycleRows ?? HEMICYCLE.rows;
  const { positions: SEATS, seatRadius: SEAT_RADIUS } = hemicycleFor(totalSeats, hemicycleRows);

  const { width: W, height: H } = IMAGE_FORMATS[input.format];
  // A new size clears the canvas and the stream of a video: change it only when it is different.
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  const plan = animationPlanFor(input, totalSeats);
  const started = (index: number) => Number.isFinite(plan.seatStart[index]) && plan.seatStart[index] <= time;
  /** 0 during the fill, then up to 1: the result in the middle and the verdict fade in. */
  const resultAlpha = clamp01((time - plan.fillEnd) / FADE);
  const theme = THEMES[input.theme];
  // One unit is one pixel of the square image. The wide image is lower, so its unit is smaller.
  const u = Math.min(W / 1080, H / 760);

  const font = (weight: number, size: number, family = BODY) => {
    ctx.font = `${weight} ${Math.round(size)}px ${family}`;
  };
  const spacing = (px: number) => {
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  };
  /** The largest size, from `size` down to `min`, at which the text fits. It leaves that font set. */
  const fitSize = (text: string, weight: number, size: number, min: number, maxWidth: number, family = BODY) => {
    let current = size;
    font(weight, current, family);
    while (ctx.measureText(text).width > maxWidth && current > min) {
      current -= 1;
      font(weight, current, family);
    }
    return current;
  };
  /** The text with an ellipsis if it is wider than `maxWidth` with the current font. */
  const clip = (text: string, maxWidth: number) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  };
  /** The lines of a text in `maxWidth`, at most `maxLines` (the last one with an ellipsis). */
  const wrap = (text: string, maxWidth: number, maxLines: number) => {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const attempt = line ? `${line} ${word}` : word;
      if (ctx.measureText(attempt).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = attempt;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = clip(`${lines[maxLines - 1]} …`, maxWidth);
    }
    return lines;
  };

  const frame = Math.round(12 * u);
  const pad = Math.round(56 * u);
  const left = pad;
  const right = W - pad;
  const contentW = right - left;
  const total = input.parties.reduce((sum, party) => sum + party.seats, 0);

  ctx.fillStyle = theme.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // ---- Header: the yellow label and the title ----
  font(800, 20 * u);
  spacing(3 * u);
  const kicker = input.kicker.toUpperCase();
  const chipH = Math.round(38 * u);
  const chipTop = frame + Math.round(pad * 0.7);
  const chipW = ctx.measureText(kicker).width + 26 * u;
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(left, chipTop, chipW, chipH);
  ctx.fillStyle = ON_HIGHLIGHT;
  ctx.fillText(kicker, left + 13 * u, chipTop + chipH / 2 + 7 * u);
  spacing(0);

  const title = (input.title.trim() || input.defaultTitle || 'Mi Congreso').toUpperCase();
  const titleSize = fitSize(title, 900, 84 * u, 52 * u, contentW, DISPLAY);
  const titleBaseline = chipTop + chipH + 12 * u + titleSize * 0.8;
  ctx.fillStyle = theme.ink;
  ctx.fillText(clip(title, contentW), left, titleBaseline);
  const headerBottom = titleBaseline + 8 * u;

  // ---- Band of the site, at the bottom ----
  const bandH = Math.round(108 * u);
  const bandTop = H - frame - bandH;
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(0, bandTop, W, H - bandTop);
  ctx.fillStyle = theme.ink;
  ctx.fillRect(0, bandTop - frame / 2, W, frame / 2);

  ctx.fillStyle = ON_HIGHLIGHT;
  ctx.textAlign = 'right';
  font(700, 18 * u);
  ctx.fillText('Haz tu simulación en', right, bandTop + bandH / 2 - 10 * u);
  const addressSize = fitSize(input.address, 800, 30 * u, 16 * u, contentW * 0.55);
  const addressW = ctx.measureText(input.address).width;
  ctx.fillText(clip(input.address, contentW * 0.55), right, bandTop + bandH / 2 + addressSize * 0.95);
  ctx.textAlign = 'left';
  const bandLeftW = contentW - Math.max(addressW, 200 * u) - 32 * u;
  fitSize(input.brand.toUpperCase(), 900, 50 * u, 30 * u, bandLeftW, DISPLAY);
  spacing(1 * u);
  ctx.fillText(input.brand.toUpperCase(), left, bandTop + bandH / 2 + 2 * u);
  spacing(0);
  const note =
    (total !== totalSeats ? `Repartidos ${total} de ${totalSeats} escaños. ` : '') + 'Simulación personal: no es una encuesta ni una previsión.';
  fitSize(note, 600, 17 * u, 13 * u, bandLeftW);
  ctx.fillText(clip(note, bandLeftW), left, bandTop + bandH / 2 + 30 * u);

  // ---- Body: the hemicycle and the legend ----
  const bodyTop = headerBottom + 30 * u;
  const bodyBottom = bandTop - 34 * u;
  const bodyH = bodyBottom - bodyTop;
  const side = W / H > 1.4;
  const gap = 40 * u;

  /** The hemicycle in the box, centered. The seats run from y = 3 to y = 205 in the 400 units of its width. */
  const MARK_H = 34 * u;
  const MARK_GAP = 10 * u;
  const hemicycleHeight = (width: number) => (width / 400) * 202 + MARK_H + MARK_GAP;
  const drawHemicycle = (box: Box) => {
    const s = Math.min(box.w / 400, (box.h - MARK_H - MARK_GAP) / 202);
    const hemiH = 202 * s + MARK_H + MARK_GAP;
    const ox = box.x + (box.w - 400 * s) / 2;
    const oy = box.y + (box.h - hemiH) / 2 + MARK_H + MARK_GAP - 3 * s;
    const cx = ox + 200 * s;

    // The seats: each party takes a slice, from the left. A seat that no party takes stays empty.
    const fills: string[] = [];
    for (const party of input.parties) {
      const color = input.content === 'vote' ? input.voteColors[party.vote] : party.color;
      for (let seat = 0; seat < party.seats; seat += 1) fills.push(color);
    }
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = Math.max(1, 0.5 * s);
    const radius = SEAT_RADIUS * 1.08 * s;
    const circle = (x: number, y: number, r: number, color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
    };
    SEATS.forEach((seat, index) => {
      const x = ox + seat.x * s;
      const y = oy + seat.y * s;
      // In the video, a seat is empty until its party arrives. Then its color grows from the middle.
      const grow = clamp01((time - plan.seatStart[index]) / POP);
      if (grow < 1 || !fills[index]) circle(x, y, radius, theme.paper);
      if (grow > 0 && fills[index]) circle(x, y, radius * easeOutBack(grow), fills[index]);
    });

    // The mark of the absolute majority: a dashed line in the middle and a black label above it.
    const markTop = oy + 3 * s - MARK_GAP;
    ctx.save();
    ctx.setLineDash([6 * u, 5 * u]);
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(cx, oy + 128 * s);
    ctx.lineTo(cx, markTop);
    ctx.stroke();
    ctx.restore();
    font(800, 17 * u);
    spacing(1.5 * u);
    const markText = `MAYORÍA ${majority}`;
    const markW = ctx.measureText(markText).width + 22 * u;
    ctx.fillStyle = theme.ink;
    ctx.fillRect(cx - markW / 2, markTop - MARK_H, markW, MARK_H);
    ctx.fillStyle = theme.paper;
    ctx.textAlign = 'center';
    ctx.fillText(markText, cx + 0.75 * u, markTop - MARK_H / 2 + 6 * u);
    spacing(0);

    // The middle: the first party (or the candidate / sponsor), with a bar of its color.
    // In the video, a counter of the seats comes first, and the result takes its place at the end.
    if (input.content === 'vote' && input.result) {
      // The candidate is there from the start, the votes count up, and the bar of the verdict comes at the end.
      const now = { yes: 0, no: 0, abstain: 0 };
      let seatIndex = 0;
      for (const party of input.parties) {
        for (let seat = 0; seat < party.seats; seat += 1, seatIndex += 1) if (seatIndex < totalSeats && started(seatIndex)) now[party.vote] += 1;
      }
      drawMiddle(input.voteSubjectLabel ?? 'CANDIDATO', input.candidate ?? '', `${now.yes} sí · ${now.no} no`, null);
      ctx.globalAlpha = resultAlpha;
      drawMiddle('', '', '', input.result.outcome === 'failed' ? input.voteColors.no : input.voteColors.yes);
    } else {
      // A counter of the seats; then the first party.
      if (resultAlpha < 1) {
        ctx.globalAlpha = 1 - resultAlpha;
        drawMiddle('ESCAÑOS', String(SEATS.filter((_, index) => started(index)).length), `de ${totalSeats}`, null);
      }
      ctx.globalAlpha = resultAlpha;
      const most = Math.max(0, ...input.parties.map((party) => party.seats));
      const leaders = input.parties.filter((party) => party.seats === most && most > 0);
      if (leaders.length === 0) {
        drawMiddle('SIN REPARTIR', '0', 'escaños', theme.ink);
      } else {
        drawMiddle(
          leaders.length > 1 ? 'EMPATE' : 'PRIMERA FUERZA',
          leaders.map((party) => party.acronym).join(' = '),
          most >= majority ? 'Mayoría absoluta' : `A ${majority - most} de la mayoría`,
          leaders.length > 1 ? theme.ink : leaders[0].color,
        );
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // The texts of the middle. The hole of the hemicycle is a half circle: the lines are narrower near its top.
    function drawMiddle(label: string, big: string, sub: string, barColor: string | null) {
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.muted;
      if (sub) {
        fitSize(sub, 700, 11 * s, 7 * s, 124 * s);
        ctx.fillText(clip(sub, 124 * s), cx, oy + 202 * s);
      }
      if (barColor) {
        ctx.fillStyle = barColor;
        ctx.fillRect(cx - 18 * s, oy + 187 * s, 36 * s, 3.4 * s);
        ctx.strokeStyle = theme.ink;
        ctx.lineWidth = Math.max(1, 0.4 * s);
        ctx.strokeRect(cx - 18 * s, oy + 187 * s, 36 * s, 3.4 * s);
      }
      ctx.fillStyle = theme.ink;
      if (big) {
        fitSize(big, 900, 38 * s, 16 * s, 108 * s, DISPLAY);
        ctx.fillText(clip(big, 108 * s), cx, oy + 182 * s);
      }
      if (label) {
        ctx.fillStyle = theme.muted;
        spacing(0.12 * s);
        fitSize(label, 800, 9 * s, 6 * s, 72 * s);
        ctx.fillText(label, cx, oy + 150 * s);
        spacing(0);
      }
    }
  };

  // ---- Legend of the seats: one row for each party, the largest first ----
  const listed = input.parties
    .map((party, index) => ({ ...party, start: plan.partyStart[index], index }))
    .filter((party) => party.seats > 0)
    .sort(bySeats);
  /** The seats of a party that have appeared, from its first seat in the hemicycle. */
  const firstSeat = (index: number) => input.parties.slice(0, index).reduce((sum, party) => sum + party.seats, 0);
  const shownSeats = (index: number) => {
    const first = firstSeat(index);
    let count = 0;
    for (let seat = first; seat < Math.min(first + input.parties[index].seats, totalSeats); seat += 1) if (started(seat)) count += 1;
    return count;
  };
  const seatColumns = side ? (listed.length <= 6 ? 1 : 2) : input.format === 'story' ? (listed.length <= 14 ? 2 : 3) : listed.length <= 6 ? 2 : 3;
  const seatRows = Math.max(1, Math.ceil(listed.length / seatColumns));
  const columnGap = 32 * u;
  const seatLegendHeight = (rowH: number) => seatRows * rowH;
  const drawSeatLegend = (box: Box, rowH: number) => {
    const colW = (box.w - columnGap * (seatColumns - 1)) / seatColumns;
    const top = box.y + (box.h - seatLegendHeight(rowH)) / 2;
    listed.forEach((party, index) => {
      // In the video, the row slides in when its party starts to fill, and its number counts up.
      const appear = easeOutCubic(clamp01((time - party.start) / 0.35));
      if (appear <= 0) return;
      ctx.globalAlpha = appear;
      const column = Math.floor(index / seatRows);
      const row = index % seatRows;
      const x = box.x + column * (colW + columnGap) + (1 - appear) * 24 * u;
      const y = top + row * rowH;
      const middle = y + rowH / 2;
      const radius = rowH * 0.17;
      ctx.beginPath();
      ctx.arc(x + radius + 1, middle, radius, 0, Math.PI * 2);
      ctx.fillStyle = party.color;
      ctx.fill();
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.stroke();

      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'right';
      font(900, rowH * 0.62, DISPLAY);
      ctx.fillText(String(Number.isFinite(time) ? shownSeats(party.index) : party.seats), x + colW, middle + rowH * 0.22);
      // The space for the name does not change while the number counts up.
      const countW = ctx.measureText(String(party.seats)).width;
      ctx.textAlign = 'left';
      // A long name gets a smaller font first, and an ellipsis only if it still does not fit.
      const textX = x + radius * 2 + rowH * 0.28;
      const nameW = colW - (textX - x) - countW - 12 * u;
      fitSize(party.acronym, 700, Math.min(rowH * 0.4, 34 * u), Math.min(rowH * 0.3, 26 * u), nameW);
      ctx.fillText(clip(party.acronym, nameW), textX, middle + rowH * 0.14);

      ctx.fillRect(x, y + rowH - 2 * u, colW, 2 * u);
    });
    ctx.globalAlpha = 1;
  };

  // ---- Legend of the vote: the verdict, then Sí, No and Abstención with their parties ----
  const voteBlocks = (['yes', 'no', 'abstain'] as Vote[]).map((vote) => {
    const members = input.parties.map((party, index) => ({ ...party, index })).filter((party) => party.seats > 0 && party.vote === vote);
    return {
      vote,
      count: input.result?.[vote] ?? 0,
      names: members.map((party) => party.acronym),
      // In the video, a block appears with its first party. A block with no party appears when the fill ends.
      start: Math.min(plan.fillEnd - POP, ...members.map((party) => plan.partyStart[party.index])),
      members,
    };
  });
  const voteLayout = (width: number, k: number) => {
    const columns = side ? 1 : 3;
    const colW = (width - columnGap * (columns - 1)) / columns;
    const headH = 62 * u * k;
    const lineH = 27 * u * k;
    font(900, 40 * u * k, DISPLAY);
    const verdictLines = wrap(input.verdict ?? '', width, 2);
    const verdictH = verdictLines.length * 42 * u * k + 18 * u * k;
    font(600, 20 * u * k);
    const blocks = voteBlocks.map((block) => ({ ...block, lines: wrap(block.names.join(' + ') || '—', colW, side ? 2 : 4) }));
    const blockH = (lines: number) => headH + lines * lineH + 20 * u * k;
    const blocksH = side
      ? blocks.reduce((sum, block) => sum + blockH(block.lines.length), 0)
      : Math.max(...blocks.map((block) => blockH(block.lines.length)));
    return { columns, colW, headH, lineH, verdictLines, verdictH, blocks, blockH, height: verdictH + blocksH };
  };
  const drawVoteLegend = (box: Box, k: number) => {
    const layout = voteLayout(box.w, k);
    let y = box.y + (box.h - layout.height) / 2;
    // In the video, the verdict comes at the end, with the result in the middle.
    ctx.globalAlpha = resultAlpha;
    ctx.fillStyle = theme.ink;
    font(900, 40 * u * k, DISPLAY);
    layout.verdictLines.forEach((line, index) => ctx.fillText(line, box.x, y + 34 * u * k + index * 42 * u * k));
    y += layout.verdictH;
    let columnY = y;
    layout.blocks.forEach((block, index) => {
      const appear = easeOutCubic(clamp01((time - block.start) / 0.35));
      const blockTop = columnY;
      columnY += layout.blockH(block.lines.length);
      if (appear <= 0) return;
      ctx.globalAlpha = appear;
      const x = (side ? box.x : box.x + index * (layout.colW + columnGap)) + (1 - appear) * 24 * u;
      const top = side ? blockTop : y;
      const swatch = 20 * u * k;
      const middle = top + layout.headH / 2;
      ctx.fillStyle = input.voteColors[block.vote];
      ctx.fillRect(x, middle - swatch / 2, swatch, swatch);
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = Math.max(1, 2 * u);
      ctx.strokeRect(x, middle - swatch / 2, swatch, swatch);
      ctx.fillStyle = theme.ink;
      ctx.textAlign = 'right';
      font(900, 54 * u * k, DISPLAY);
      const shown = Number.isFinite(time) ? block.members.reduce((sum, party) => sum + shownSeats(party.index), 0) : block.count;
      ctx.fillText(String(shown), x + layout.colW, middle + 19 * u * k);
      const countW = ctx.measureText(String(block.count)).width;
      ctx.textAlign = 'left';
      // The name of the vote gets a smaller font if it does not fit beside the number.
      const name = VOTE_NAMES[block.vote].toUpperCase();
      const nameX = x + swatch + 12 * u * k;
      const nameW = layout.colW - (nameX - x) - countW - 14 * u;
      spacing(2 * u * k);
      fitSize(name, 800, 22 * u * k, 14 * u, nameW);
      ctx.fillText(clip(name, nameW), nameX, middle + 8 * u * k);
      spacing(0);
      ctx.fillRect(x, top + layout.headH - 2 * u, layout.colW, 2 * u);
      ctx.fillStyle = theme.muted;
      font(600, 20 * u * k);
      block.lines.forEach((line, lineIndex) => ctx.fillText(line, x, top + layout.headH + (lineIndex + 0.8) * layout.lineH));
    });
    ctx.globalAlpha = 1;
  };

  // ---- Place the two parts: side by side in the wide image, one above the other in the others ----
  const isVote = input.content === 'vote' && !!input.result;
  if (side) {
    const hemiW = contentW * 0.57;
    const legendBox: Box = { x: left + hemiW + gap, y: bodyTop, w: contentW - hemiW - gap, h: bodyH };
    drawHemicycle({ x: left, y: bodyTop, w: hemiW, h: bodyH });
    if (isVote) {
      let k = 1;
      while (k > 0.6 && voteLayout(legendBox.w, k).height > bodyH) k -= 0.05;
      drawVoteLegend(legendBox, k);
    } else {
      drawSeatLegend(legendBox, Math.min(64 * u, bodyH / seatRows));
    }
  } else {
    // The legend takes the height it needs (smaller if there is no room); the hemicycle takes the rest.
    // With room to spare (the story), the two parts sit in the middle of the body.
    // The story is tall: its legend has larger rows and letters, so the image has less empty space.
    const tall = input.format === 'story';
    let legendH: number;
    let k = tall ? 1.3 : 1;
    let rowH = 64 * u;
    if (isVote) {
      while (k > 0.7 && voteLayout(contentW, k).height + gap + hemicycleHeight(contentW) * 0.6 > bodyH) k -= 0.05;
      legendH = voteLayout(contentW, k).height;
    } else {
      rowH = Math.max(34 * u, Math.min((tall ? 92 : 64) * u, (bodyH - gap - hemicycleHeight(contentW) * 0.6) / seatRows));
      legendH = seatLegendHeight(rowH);
    }
    const hemiH = Math.min(hemicycleHeight(contentW), bodyH - gap - legendH);
    const top = bodyTop + (bodyH - hemiH - gap - legendH) / 2;
    drawHemicycle({ x: left, y: top, w: contentW, h: hemiH });
    const legendBox: Box = { x: left, y: top + hemiH + gap, w: contentW, h: legendH };
    if (isVote) drawVoteLegend(legendBox, k);
    else drawSeatLegend(legendBox, rowH);
  }

  // ---- Frame ----
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = frame;
  ctx.strokeRect(frame / 2, frame / 2, W - frame, H - frame);
};
