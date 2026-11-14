/**
 * The chart of the polls page, as SVG markup. The same function draws the chart at build time (the first view,
 * also without JavaScript) and in the browser, when the reader changes the measure, the scale, the pollster,
 * the parties or the width.
 * - The drawing has the real width in pixels: the text never stretches. A zoom makes the chart wider than its
 *   box, and the box scrolls.
 * - The time axis adapts to the space: a mark every week, every half month or every month.
 * - The vertical scale is linear or logarithmic. The logarithmic scale separates the small parties
 *   (0,1 % to 2 %); a value under its floor (0,1 % or 1 seat) is drawn on the floor.
 */
import { smoothBand, smoothPath, type Point } from './curve';
import { tooltip } from './tooltip';

export type Metric = 'pct' | 'seats';
export type Scale = 'linear' | 'log';
/** A value with its margin: [middle, low, high]. */
type Value = [number, number, number];

export interface PollChartData {
  /** Start and end of the time axis, and the day of the election (milliseconds). */
  start: number;
  end: number;
  election: number;
  /** The date of the last poll: a line that stops 14 days before it has no label at the right. */
  lastDate: number;
  majority: number;
  parties: { id: string; acronym: string; label: string; color: string }[];
  /** One entry per poll, for the dots and their tooltips. */
  polls: { t: number; pollster: string; source: string; date: string }[];
  metrics: Record<
    Metric,
    {
      /** One series per filter («all» and each pollster). `party` is the index in `parties`. */
      series: { id: string; empty: boolean; lines: { party: number; points: [number, ...Value][] }[] }[];
      /** [poll index, party index, middle, low, high]. */
      dots: [number, number, ...Value][];
    }
  >;
}

export interface PollChartOptions {
  metric: Metric;
  scale: Scale;
  filter: string;
  hidden: ReadonlySet<string>;
  /** The width of the box of the chart, in pixels. */
  width: number;
  /** 1 is the width of the box; 2 is twice as wide, and so on. */
  zoom: number;
}

const DAY = 86_400_000;
const MIN_WIDTH = 680;
const M = { top: 16, right: 104, bottom: 34, left: 48 };
const LABEL_GAP = 13;

const one = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatValue = (metric: Metric, [mid, lo, hi]: Value) =>
  metric === 'pct' ? one(mid) : Math.round(lo) === Math.round(hi) ? String(Math.round(mid)) : `${Math.round(lo)}–${Math.round(hi)}`;

const axes = {
  pct: {
    max: 40,
    floor: 0.1,
    linear: [0, 10, 20, 30, 40],
    log: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 40],
    tick: (value: number) => `${value.toLocaleString('es-ES')} %`,
  },
  seats: {
    max: 200,
    floor: 1,
    linear: [0, 50, 100, 150, 200],
    log: [1, 2, 5, 10, 20, 50, 100, 200],
    tick: (value: number) => String(value),
  },
} as const;

/** The size of the drawing for a box of `width` pixels. The height follows the box, not the zoom. */
export const chartSize = (width: number, zoom: number) => {
  const base = Math.max(MIN_WIDTH, Math.round(width));
  return { W: Math.round(base * zoom), H: Math.round(Math.min(460, Math.max(340, base * 0.42))) };
};

/** The marks of the time axis: every week, every half month or every month, the first one that has room. */
const timeTicks = (start: number, end: number, pxPerDay: number) => {
  const ticks: { t: number; label: string }[] = [];
  const month = (t: number) => new Date(t).toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' });
  const dayMonth = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const MIN_PX = 58;
  if (pxPerDay * 7 >= MIN_PX) {
    // Mondays.
    const first = new Date(start);
    const offset = (8 - first.getUTCDay()) % 7;
    for (let t = start + offset * DAY; t <= end; t += 7 * DAY) ticks.push({ t, label: dayMonth(t) });
  } else {
    const half = pxPerDay * 15 >= MIN_PX;
    const date = new Date(start);
    for (let y = date.getUTCFullYear(), m = date.getUTCMonth(); ; m++) {
      const first = Date.UTC(y, m, 1, 12);
      if (first > end) break;
      if (first >= start) ticks.push({ t: first, label: half ? dayMonth(first) : month(first) });
      const middle = Date.UTC(y, m, 15, 12);
      if (half && middle >= start && middle <= end) ticks.push({ t: middle, label: dayMonth(middle) });
    }
  }
  return ticks;
};

const r = (value: number) => Math.round(value * 10) / 10;

/** The vertical position of a value, for a chart of height H. */
const yScale = (metric: Metric, scale: Scale, H: number) => {
  const axis = axes[metric];
  const bottom = H - M.bottom;
  return scale === 'log'
    ? (value: number) =>
        bottom - (Math.log(Math.min(Math.max(value, axis.floor), axis.max) / axis.floor) / Math.log(axis.max / axis.floor)) * (bottom - M.top)
    : (value: number) => bottom - (Math.min(value, axis.max) / axis.max) * (bottom - M.top);
};

/**
 * The values of the vertical axis alone, on the paper. The page puts it over the left edge of the chart when the
 * chart scrolls, so the reader always sees the scale.
 */
export const renderYAxis = (options: PollChartOptions) => {
  const { H } = chartSize(options.width, options.zoom);
  const axis = axes[options.metric];
  const y = yScale(options.metric, options.scale, H);
  const ticks = axis[options.scale]
    .map((value) => `<text x="${M.left - 8}" y="${r(y(value))}" text-anchor="end" dominant-baseline="middle">${axis.tick(value)}</text>`)
    .join('');
  return `<svg viewBox="0 0 ${M.left} ${H}" width="${M.left}" height="${H}" aria-hidden="true"><g class="poll-chart__grid">${ticks}</g></svg>`;
};
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const renderPollChart = (data: PollChartData, options: PollChartOptions) => {
  const { metric, scale, filter, hidden } = options;
  const { W, H } = chartSize(options.width, options.zoom);
  const axis = axes[metric];
  const plotBottom = H - M.bottom;
  const x = (t: number) => M.left + ((t - data.start) / (data.end - data.start)) * (W - M.left - M.right);
  const y = yScale(metric, scale, H);
  const view = data.metrics[metric];
  const serie = view.series.find((item) => item.id === filter) ?? view.series[0];
  const party = (index: number) => data.parties[index];
  const lines = serie.lines.filter((line) => !hidden.has(party(line.party).id) && line.points.length > 1);
  const pointsOf = (points: [number, ...Value][], key: 1 | 2 | 3): Point[] => points.map((point) => [x(point[0]), y(point[key])]);

  const out: string[] = [];
  out.push(`<svg class="poll-chart__svg--${scale}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escape(
    metric === 'pct'
      ? 'Estimación de voto por partido, de junio a noviembre de 2026, con su margen de error. Los datos están también en las tablas de abajo.'
      : `Escaños estimados por partido, con la horquilla de cada encuestadora y la mayoría absoluta de ${data.majority}.`,
  )}">`);

  // The grid: the values, the dates, the day of the election and, for the seats, the absolute majority.
  out.push('<g class="poll-chart__grid" aria-hidden="true">');
  for (const value of axis[scale]) {
    const ty = r(y(value));
    out.push(`<line x1="${M.left}" x2="${W - M.right}" y1="${ty}" y2="${ty}"/>`);
    out.push(`<text x="${M.left - 8}" y="${ty}" text-anchor="end" dominant-baseline="middle">${axis.tick(value)}</text>`);
  }
  const ticks = timeTicks(data.start, data.election, (W - M.left - M.right) / ((data.end - data.start) / DAY));
  for (const tick of ticks) {
    const tx = r(x(tick.t));
    out.push(`<line class="poll-chart__day" x1="${tx}" x2="${tx}" y1="${M.top}" y2="${plotBottom}"/>`);
    out.push(`<text x="${tx}" y="${plotBottom + 20}" text-anchor="middle">${tick.label}</text>`);
  }
  const ex = r(x(data.election));
  out.push(`<line class="poll-chart__election" x1="${ex}" x2="${ex}" y1="${M.top}" y2="${plotBottom}"/>`);
  out.push(`<text class="poll-chart__election-label" x="${ex - 6}" y="${M.top + 10}" text-anchor="end">29N</text>`);
  if (metric === 'seats') {
    const my = r(y(data.majority));
    out.push(`<line class="poll-chart__majority" x1="${M.left}" x2="${ex}" y1="${my}" y2="${my}"/>`);
    out.push(`<text class="poll-chart__majority-label" x="${M.left + 6}" y="${my - 6}">Mayoría absoluta: ${data.majority}</text>`);
  }
  out.push('</g>');

  if (serie.empty) {
    out.push(`<text class="poll-chart__empty" x="${(M.left + W - M.right) / 2}" y="${H / 2}" text-anchor="middle">Esta encuestadora no publica escaños.</text>`);
  }
  // The halos first, under every line: a faint fill in the party color.
  for (const line of lines) {
    out.push(`<path class="poll-chart__band" style="fill:${party(line.party).color}" d="${smoothBand(pointsOf(line.points, 3), pointsOf(line.points, 2))}"/>`);
  }
  for (const line of lines) {
    const d = smoothPath(pointsOf(line.points, 1));
    out.push(`<path class="poll-chart__casing" d="${d}"/><path class="poll-chart__line" style="stroke:${party(line.party).color}" d="${d}"/>`);
  }

  // The labels at the end of the lines: at least LABEL_GAP between them, and the last one inside the chart.
  const labels = lines
    .filter((line) => data.lastDate - line.points.at(-1)![0] < 14 * DAY)
    .map((line) => {
      const [, ...value] = line.points.at(-1)!;
      return { party: party(line.party), text: formatValue(metric, value as Value), y: y(value[0]) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + LABEL_GAP);
  for (let i = labels.length - 1; i >= 0; i--) labels[i].y = Math.min(labels[i].y, i === labels.length - 1 ? H - 8 : labels[i + 1].y - LABEL_GAP);
  for (const label of labels) {
    out.push(
      `<text class="poll-chart__label" x="${W - M.right + 10}" y="${r(label.y)}" dominant-baseline="middle"><tspan class="poll-chart__label-name">${escape(label.party.label)}</tspan> ${label.text}</text>`,
    );
  }

  // The dots: one per poll and party. With one pollster, only its own.
  out.push('<g class="poll-chart__dots">');
  for (const [pollIndex, partyIndex, ...value] of view.dots) {
    const poll = data.polls[pollIndex];
    const item = party(partyIndex);
    if (hidden.has(item.id) || (filter !== 'all' && poll.pollster !== filter)) continue;
    const title =
      metric === 'pct'
        ? `${item.acronym}: ${one(value[0])} % (±${one(value[2] - value[0])})`
        : `${item.acronym}: ${formatValue('seats', value as Value)} escaños`;
    out.push(
      `<circle cx="${r(x(poll.t))}" cy="${r(y(value[0]))}" r="4.5" style="fill:${item.color}" data-tooltip="${escape(tooltip(title, poll.source, poll.date))}"/>`,
    );
  }
  out.push('</g></svg>');
  return out.join('');
};
