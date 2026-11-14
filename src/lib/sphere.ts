/**
 * The halftone sphere of the home page: a hexagonal grid of dots inside a circle, one dot per measure.
 * The categories are horizontal bands from the top to the bottom. The size of a dot follows a light that
 * comes from the top left: a dark zone has large dots, as in a printed halftone.
 * Everything is computed at build time from all the programs, so a new program enters the sphere with no other change.
 * A measure that a program reserves but has not announced yet (`isPending`) is not a measure: it has no dot.
 * The build stops if the dots and the measures do not agree.
 */
import { allMeasures, totalMeasures } from './programs';
import { categories } from './taxonomy';
import { countBy } from './collections';

export interface SphereDot {
  /** Position in a 0..100 box. */
  x: number;
  y: number;
  /** Radius of the dot when no category is selected, in the same units. */
  r: number;
  /** Index of its category in `sphereCategories`. */
  category: number;
}

export interface SphereCategory {
  id: string;
  /** Full name, for the caption: «Vivienda». */
  name: string;
  /** First word or phrase of the name, for a chip: «Pensiones y cohesión social» is «Pensiones». */
  shortName: string;
  count: number;
}

// The measures come from the one source of `programs.ts`: the reserved numbers with no measure yet are not counted.
const total = totalMeasures;

/** Categories with measures, from the one with most measures to the one with fewest. */
export const sphereCategories: SphereCategory[] = countBy(allMeasures, (measure) => measure.categoryId)
  .map(([id, count]) => {
    const name = categories.find((category) => category.id === id)?.name ?? id;
    return { id, name, shortName: name.split(/ y |, /)[0], count };
  })
  .sort((a, b) => b.count - a.count);

/** Fraction of the grid step that a dot takes when it is selected, and when it is not. */
export const SELECTED_DOT = 0.93;
export const MUTED_DOT = 0.24;
/** Radius of the sphere in the 0..100 box. */
const SPHERE_RADIUS = 49.5;

const buildSphere = () => {
  // A hexagonal grid with a step of 1. The points nearest to the center make the disc: one point per measure.
  const grid: { x: number; y: number; dist: number; shade: number }[] = [];
  const half = Math.ceil(Math.sqrt(total / 2.7)) + 4; // enough rows and columns to hold `total` points
  for (let j = -half; j <= half; j++) {
    for (let i = -half; i <= half; i++) {
      const x = i + (j % 2 !== 0 ? 0.5 : 0);
      const y = j * 0.866;
      grid.push({ x, y, dist: Math.hypot(x, y), shade: 0 });
    }
  }
  grid.sort((a, b) => a.dist - b.dist);
  const points = grid.slice(0, total);
  const radius = points[points.length - 1].dist + 0.5;

  // The light comes from the top left.
  const [lx, ly, lz] = [-0.5, -0.6, 0.62];
  for (const point of points) {
    const nx = point.x / radius;
    const ny = point.y / radius;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const light = Math.max(0, nx * lx + ny * ly + nz * lz);
    point.shade = Math.min(1.02, 0.16 + 0.92 * (1 - light));
  }

  // The categories are bands from the top to the bottom of the sphere.
  points.sort((a, b) => a.y - b.y || a.x - b.x);
  const unit = SPHERE_RADIUS / radius;
  const dots: SphereDot[] = [];
  let index = 0;
  sphereCategories.forEach((category, categoryIndex) => {
    for (let n = 0; n < category.count; n++) {
      const point = points[index++];
      dots.push({ x: 50 + point.x * unit, y: 50 + point.y * unit, r: (point.shade * unit) / 2, category: categoryIndex });
    }
  });
  return { dots, unit };
};

const sphere = buildSphere();
// One dot per measure, and every category in its band: a mismatch is a bug, so the build stops.
if (sphere.dots.length !== total || sphereCategories.reduce((sum, category) => sum + category.count, 0) !== total) {
  throw new Error(`La esfera tiene ${sphere.dots.length} puntos para ${total} medidas.`);
}

export const sphereDots = sphere.dots;
/** The size of one grid step in the 0..100 box. A dot of 0.93 steps has a radius of `0.93 * unit / 2`. */
export const sphereStep = sphere.unit;
export const sphereTotal = total;
