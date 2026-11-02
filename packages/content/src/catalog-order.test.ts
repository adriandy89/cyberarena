import { describe, expect, it } from 'vitest';
import { sortPathsByOrder } from './catalog-order';

describe('sortPathsByOrder', () => {
  it('sorts by the explicit order, not by slug', () => {
    const { paths, issues } = sortPathsByOrder([
      { slug: 'advanced-pentesting', order: 4 },
      { slug: 'cyber-security-101', order: 1 },
      { slug: 'webapp-pentesting', order: 3 },
      { slug: 'jr-penetration-tester', order: 2 },
    ]);
    expect(paths.map((path) => path.slug)).toEqual([
      'cyber-security-101',
      'jr-penetration-tester',
      'webapp-pentesting',
      'advanced-pentesting',
    ]);
    expect(issues).toEqual([]);
  });

  it('reports duplicate orders', () => {
    const { issues } = sortPathsByOrder([
      { slug: 'a-path', order: 1 },
      { slug: 'b-path', order: 1 },
    ]);
    expect(issues).toEqual(["paths 'a-path' and 'b-path' share order 1"]);
  });
});
