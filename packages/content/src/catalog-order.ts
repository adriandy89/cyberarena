/**
 * Path ordering (spec 010 T020). Paths declare an explicit `order` (1-based)
 * instead of depending on file-system glob order, which put "advanced"
 * first alphabetically and may differ between Windows and Linux.
 */
export interface OrderedPath {
  slug: string;
  order: number;
}

export interface PathOrderResult<T extends OrderedPath> {
  paths: T[];
  /** Human-readable problems (duplicate orders); empty when valid. */
  issues: string[];
}

export function sortPathsByOrder<T extends OrderedPath>(paths: T[]): PathOrderResult<T> {
  const issues: string[] = [];
  const byOrder = new Map<number, string>();
  for (const path of paths) {
    const previous = byOrder.get(path.order);
    if (previous) {
      issues.push(`paths '${previous}' and '${path.slug}' share order ${path.order}`);
    } else {
      byOrder.set(path.order, path.slug);
    }
  }
  const sorted = [...paths].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return { paths: sorted, issues };
}
