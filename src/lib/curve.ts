/**
 * Smooth lines for the charts: a monotone cubic curve (Fritsch–Carlson). The curve goes through every point and
 * never goes above or below two neighbouring points, so a smooth line does not invent a peak that the data
 * does not have.
 */
export type Point = [number, number];
/** One cubic segment: start, first control point, second control point, end. */
type Segment = [Point, Point, Point, Point];

const round = (value: number) => Number(value.toFixed(1));
const xy = ([x, y]: Point) => `${round(x)},${round(y)}`;

const segmentsOf = (points: Point[]): Segment[] => {
  const n = points.length;
  if (n < 2) return [];
  const dx = points.slice(0, -1).map((point, i) => points[i + 1][0] - point[0]);
  const slope = points.slice(0, -1).map((point, i) => (dx[i] === 0 ? 0 : (points[i + 1][1] - point[1]) / dx[i]));
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  // Fritsch–Carlson: limit the tangents so that the curve stays monotone between two points.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }
  return points.slice(0, -1).map((point, i) => {
    const next = points[i + 1];
    const step = dx[i] / 3;
    return [point, [point[0] + step, point[1] + tangent[i] * step], [next[0] - step, next[1] - tangent[i + 1] * step], next];
  });
};

/** The `d` of an SVG path that goes through the points with a smooth, monotone curve. */
export const smoothPath = (points: Point[]) => {
  const segments = segmentsOf(points);
  if (!segments.length) return points.length ? `M${xy(points[0])}` : '';
  return `M${xy(segments[0][0])}${segments.map(([, c1, c2, end]) => `C${xy(c1)} ${xy(c2)} ${xy(end)}`).join('')}`;
};

/** A closed area between two smooth curves with the same x: the upper one from left to right, the lower one back. */
export const smoothBand = (upper: Point[], lower: Point[]) => {
  const top = segmentsOf(upper);
  const bottom = segmentsOf(lower).reverse();
  if (!top.length || !bottom.length) return '';
  const back = bottom.map(([start, c1, c2]) => `C${xy(c2)} ${xy(c1)} ${xy(start)}`).join('');
  return `${smoothPath(upper)}L${xy(lower[lower.length - 1])}${back}Z`;
};
