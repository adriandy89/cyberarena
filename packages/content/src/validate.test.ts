import { describe, expect, it } from 'vitest';
import type { Catalog, CompiledRoom } from './schemas';
import { validateCatalog } from './validate';

function room(
  slug: string,
  taskIndexes: number[] = [1],
  questionIds: string[][] = [['q']],
): CompiledRoom {
  return {
    slug,
    title: `Room ${slug}`,
    description: 'A sample room for validation tests.',
    difficulty: 'easy',
    type: 'walkthrough',
    estimatedMinutes: 30,
    tags: [],
    lab: null,
    labUrl: null,
    tasks: taskIndexes.map((index, i) => ({
      index,
      title: `Task ${index}`,
      body: 'guide body',
      questions: (questionIds[i] ?? []).map((id) => ({
        id: `${slug}-t0${index}-q0${id}`,
        prompt: `Prompt ${id}`,
        hint: null,
        kind: 'flag' as const,
      })),
    })),
  };
}

function catalogWith(rooms: CompiledRoom[]): Catalog {
  return {
    generatedAt: '2026-11-01T00:00:00.000Z',
    paths: [
      {
        slug: 'path',
        title: 'Path',
        description: 'Sample path',
        level: 'beginner',
        modules: [
          {
            slug: 'module',
            title: 'Module',
            description: 'Sample module',
            rooms,
          },
        ],
      },
    ],
  };
}

function answersFor(rooms: CompiledRoom[]): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const r of rooms) {
    for (const task of r.tasks) {
      for (const question of task.questions) {
        answers[question.id] = 'FLAG{ok}';
      }
    }
  }
  return answers;
}

describe('validateCatalog', () => {
  it('accepts a consistent catalog', () => {
    const rooms = [room('linux-1', [1, 2], [['1'], ['1', '2']])];
    expect(validateCatalog(catalogWith(rooms), answersFor(rooms))).toEqual([]);
  });

  it('detects missing answers', () => {
    const rooms = [room('linux-1')];
    const issues = validateCatalog(catalogWith(rooms), {});
    expect(issues).toContainEqual({
      source: 'answers',
      message: "missing answer for 'linux-1-t01-q0q'",
    });
  });

  it('detects orphan answers', () => {
    const rooms = [room('linux-1')];
    const issues = validateCatalog(catalogWith(rooms), { 'ghost-t01-q01': 'FLAG{x}' });
    expect(issues.some((i) => i.message.includes('orphan answer'))).toBe(true);
  });

  it('detects malformed flag answers', () => {
    const rooms = [room('linux-1')];
    const issues = validateCatalog(catalogWith(rooms), { 'linux-1-t01-q0q': 'no-braces' });
    expect(issues.some((i) => i.message.includes('must match FLAG{...}'))).toBe(true);
  });

  it('detects duplicate rooms across modules and task index gaps', () => {
    const rooms = [room('linux-1', [1]), room('linux-1', [1])];
    const issues = validateCatalog(catalogWith(rooms), answersFor(rooms));
    expect(issues.some((i) => i.message.includes('appears in more than one module'))).toBe(true);

    const roomsBadIndex = [room('linux-1', [2])];
    const issuesIndex = validateCatalog(catalogWith(roomsBadIndex), answersFor(roomsBadIndex));
    expect(
      issuesIndex.some((i) => i.message.includes('task file order does not match index')),
    ).toBe(true);
  });

  it('detects question ids that do not belong to their room', () => {
    const rooms = [
      {
        ...room('linux-1'),
        tasks: [
          {
            index: 1,
            title: 'Task 1',
            body: 'guide body',
            questions: [
              { id: 'other-room-t01-q01', prompt: 'p', hint: null, kind: 'flag' as const },
            ],
          },
        ],
      },
    ];
    const issues = validateCatalog(catalogWith(rooms), { 'other-room-t01-q01': 'FLAG{x}' });
    expect(issues.some((i) => i.message.includes("id must start with 'linux-1-t'"))).toBe(true);
  });
});
