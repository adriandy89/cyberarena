import { describe, expect, it } from 'vitest';
import { computeRoomContext, type ContextTreePath } from './room-context';

const room = (slug: string, difficulty = 'easy') => ({
  slug,
  title: slug.toUpperCase(),
  difficulty,
});

const PATHS: ContextTreePath[] = [
  {
    slug: 'cs101',
    title: 'CS101',
    level: 'beginner',
    modules: [
      { slug: 'intro', title: 'Intro', rooms: [room('a', 'info'), room('b')] },
      { slug: 'linux', title: 'Linux', rooms: [room('c'), room('d', 'medium')] },
    ],
  },
  {
    slug: 'jrpt',
    title: 'JrPT',
    level: 'intermediate',
    modules: [{ slug: 'recon', title: 'Recon', rooms: [room('e', 'medium')] }],
  },
];

describe('computeRoomContext', () => {
  it('locates a room with its path, module and position', () => {
    const context = computeRoomContext(PATHS, 'c');
    expect(context).toMatchObject({
      path: { slug: 'cs101', title: 'CS101', level: 'beginner' },
      module: { slug: 'linux', title: 'Linux', index: 2, total: 2 },
      position: { index: 3, total: 4 },
    });
  });

  it('links previous/next rooms across module boundaries', () => {
    const context = computeRoomContext(PATHS, 'c')!;
    expect(context.prev).toEqual({ slug: 'b', title: 'B', difficulty: 'easy' });
    expect(context.next).toEqual({ slug: 'd', title: 'D', difficulty: 'medium' });
    expect(context.nextPath).toBeNull();
  });

  it('has no previous room at the start of a path', () => {
    const context = computeRoomContext(PATHS, 'a')!;
    expect(context.prev).toBeNull();
    expect(context.next?.slug).toBe('b');
  });

  it('suggests the following path after the last room', () => {
    const context = computeRoomContext(PATHS, 'd')!;
    expect(context.next).toBeNull();
    expect(context.nextPath).toEqual({ slug: 'jrpt', title: 'JrPT' });
  });

  it('does not suggest a path after the very last one', () => {
    const context = computeRoomContext(PATHS, 'e')!;
    expect(context.next).toBeNull();
    expect(context.nextPath).toBeNull();
  });

  it('returns null for unknown rooms', () => {
    expect(computeRoomContext(PATHS, 'missing')).toBeNull();
  });
});
