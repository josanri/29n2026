/** Small helpers for counting and ordering lists. */

/** Count items by key. Return `[key, count]` pairs from the highest to the lowest count. */
export function countBy<T>(items: T[], getKey: (item: T) => string | string[] | null): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    if (key == null) continue;
    for (const single of Array.isArray(key) ? key : [key]) counts.set(single, (counts.get(single) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export const unique = <T>(items: T[]) => [...new Set(items)];
