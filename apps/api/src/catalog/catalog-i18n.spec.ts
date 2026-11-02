import { describe, expect, it } from 'vitest';
import { localizePathDetail, localizeSummaries, type EnCatalog } from './catalog-i18n';
import type { CatalogPathDetail, CatalogPathSummary } from './catalog.service';

const EN: EnCatalog = {
  paths: [
    {
      slug: 'cs101',
      title: 'Cyber Security 101 (EN)',
      description: 'EN description',
      level: 'beginner',
      modules: [
        {
          slug: 'm1',
          title: 'Module one',
          description: 'EN module',
          rooms: [{ slug: 'r1', title: 'Room one', description: 'EN room', difficulty: 'easy' }],
        },
      ],
    },
  ],
};

describe('localizeSummaries', () => {
  it('keeps DB shape and order, swapping only texts', () => {
    const summaries: CatalogPathSummary[] = [
      {
        slug: 'cs101',
        title: 'CS101 ES',
        description: 'desc ES',
        level: 'beginner',
        moduleCount: 1,
        roomCount: 2,
        estimatedMinutes: 60,
        rooms: [
          {
            slug: 'r1',
            title: 'Room ES',
            difficulty: 'easy',
            type: 'walkthrough',
            estimatedMinutes: 30,
          },
          {
            slug: 'r2',
            title: 'Untranslated',
            difficulty: 'easy',
            type: 'walkthrough',
            estimatedMinutes: 30,
          },
        ],
      },
      {
        slug: 'other',
        title: 'Other ES',
        description: 'd',
        level: 'advanced',
        moduleCount: 0,
        roomCount: 0,
        estimatedMinutes: 0,
        rooms: [],
      },
    ];
    const result = localizeSummaries(summaries, EN);
    expect(result.map((path) => path.slug)).toEqual(['cs101', 'other']);
    expect(result[0]).toMatchObject({
      title: 'Cyber Security 101 (EN)',
      description: 'EN description',
      moduleCount: 1,
      roomCount: 2,
      estimatedMinutes: 60,
    });
    expect(result[0]!.rooms.map((room) => room.title)).toEqual(['Room one', 'Untranslated']);
    expect(result[1]!.title).toBe('Other ES');
  });
});

describe('localizePathDetail', () => {
  it('translates path, module and room texts', () => {
    const detail: CatalogPathDetail = {
      slug: 'cs101',
      title: 'ES',
      description: 'ES',
      level: 'beginner',
      modules: [
        {
          slug: 'm1',
          title: 'Módulo',
          description: 'ES',
          rooms: [
            {
              slug: 'r1',
              title: 'Room ES',
              description: 'ES',
              difficulty: 'easy',
              type: 'walkthrough',
              estimatedMinutes: 30,
              tags: [],
              lab: null,
            },
          ],
        },
      ],
    };
    const result = localizePathDetail(detail, EN);
    expect(result.title).toBe('Cyber Security 101 (EN)');
    expect(result.modules[0]).toMatchObject({ title: 'Module one', description: 'EN module' });
    expect(result.modules[0]!.rooms[0]).toMatchObject({
      title: 'Room one',
      description: 'EN room',
      difficulty: 'easy',
    });
  });
});
