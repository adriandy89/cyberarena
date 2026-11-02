import { describe, expect, it } from 'vitest';
import { applyCatalogTranslation } from './translations';

function catalog() {
  return {
    paths: [
      {
        slug: 'cs101',
        title: 'CS101 ES',
        description: 'Ruta',
        modules: [
          { slug: 'm1', title: 'Módulo uno', description: 'Desc ES' },
          { slug: 'm2', title: 'Módulo dos', description: 'Desc ES' },
        ],
      },
    ],
  };
}

describe('applyCatalogTranslation', () => {
  it('translates path and module texts in place', () => {
    const data = catalog();
    const missing = applyCatalogTranslation(data, {
      paths: { cs101: { title: 'CS101', description: 'Path' } },
      modules: {
        m1: { title: 'Module one', description: 'Desc EN' },
        m2: { title: 'Module two', description: 'Desc EN' },
      },
    });
    expect(missing).toEqual([]);
    expect(data.paths[0]!.title).toBe('CS101');
    expect(data.paths[0]!.modules.map((module) => module.title)).toEqual([
      'Module one',
      'Module two',
    ]);
  });

  it('reports every untranslated path or module', () => {
    const data = catalog();
    const missing = applyCatalogTranslation(data, {
      paths: {},
      modules: { m1: { title: 'Module one', description: 'Desc EN' } },
    });
    expect(missing).toEqual(['path:cs101', 'module:m2']);
    expect(data.paths[0]!.title).toBe('CS101 ES');
  });
});
