import { describe, expect, it } from 'vitest';
import { applyCatalogTranslation, applyRoomTranslation, translationGaps } from './translations';

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

describe('applyRoomTranslation options', () => {
  it('translates choice labels by option id and keeps the ids', () => {
    const room = {
      title: 'ES',
      description: 'ES',
      tasks: [
        {
          index: 1,
          title: 'T',
          body: 'cuerpo',
          questions: [
            {
              id: 'r-t01-q01',
              prompt: '¿?',
              hint: 'pista',
              options: [
                { id: 'a', label: 'Uno' },
                { id: 'b', label: 'Dos' },
              ],
            },
          ],
        },
      ],
    };
    applyRoomTranslation(room, {
      tasks: {
        '1': { body: 'body', questions: { 'r-t01-q01': { hint: 'hint', options: { a: 'One' } } } },
      },
    });
    const question = room.tasks[0]!.questions[0]!;
    expect(room.tasks[0]!.body).toBe('body');
    expect(question.hint).toBe('hint');
    expect(question.options).toEqual([
      { id: 'a', label: 'One' },
      { id: 'b', label: 'Dos' },
    ]);
  });
});

describe('translationGaps', () => {
  const room = {
    title: 'ES',
    description: 'ES',
    tasks: [
      {
        index: 1,
        questions: [
          { id: 'r-t01-q01', prompt: 'p', hint: 'pista', options: [{ id: 'a', label: 'x' }] },
          { id: 'r-t01-q02', prompt: 'p', hint: null },
        ],
      },
    ],
  };

  it('lists every missing EN item', () => {
    expect(translationGaps(room, { title: 'EN', tasks: { '1': { title: 'T' } } })).toEqual([
      'description',
      't1.body',
      't1.q01.prompt',
      't1.q01.hint',
      't1.q01.option:a',
      't1.q02.prompt',
    ]);
  });

  it('is empty for a complete translation (no hint needed when the source has none)', () => {
    expect(
      translationGaps(room, {
        title: 'EN',
        description: 'EN',
        tasks: {
          '1': {
            title: 'T',
            body: 'B',
            questions: {
              'r-t01-q01': { prompt: 'P', hint: 'H', options: { a: 'X' } },
              'r-t01-q02': { prompt: 'P' },
            },
          },
        },
      }),
    ).toEqual([]);
  });
});
