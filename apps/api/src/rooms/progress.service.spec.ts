import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from './progress.service';

const CATALOG = [
  {
    slug: 'cs101',
    title: 'Cyber Security 101',
    level: 'beginner',
    modules: [
      {
        slug: 'm1',
        title: 'Módulo 1',
        rooms: [
          {
            slug: 'room-1',
            tasks: [{ questions: [{ id: 'q1' }, { id: 'q2' }] }],
          },
          {
            slug: 'room-2',
            tasks: [{ questions: [{ id: 'q3' }] }],
          },
        ],
      },
    ],
  },
  {
    slug: 'jrpt',
    title: 'Jr Pentester',
    level: 'intermediate',
    modules: [
      {
        slug: 'm2',
        title: 'Módulo 2',
        rooms: [{ slug: 'room-3', tasks: [{ questions: [{ id: 'q4' }, { id: 'q5' }] }] }],
      },
    ],
  },
];

function makeService(solvedIds: string[]) {
  const prisma = {
    catalogPath: {
      findMany: vi.fn().mockResolvedValue(CATALOG),
    },
    questionSolved: {
      findMany: vi.fn().mockResolvedValue(solvedIds.map((id) => ({ questionId: id }))),
    },
  } as unknown as PrismaService;
  return new ProgressService(prisma);
}

describe('ProgressService.getOverview', () => {
  it('computes per-path and total percentages from solved questions', () => {
    const service = makeService(['q1', 'q2', 'q4']);
    const overview = service.getOverview('u1');
    return expect(overview).resolves.toEqual({
      paths: [
        expect.objectContaining({
          slug: 'cs101',
          roomsCompleted: 1,
          roomsTotal: 2,
          solvedQuestions: 2,
          totalQuestions: 3,
          percent: 67,
        }),
        expect.objectContaining({
          slug: 'jrpt',
          roomsCompleted: 0,
          roomsTotal: 1,
          solvedQuestions: 1,
          totalQuestions: 2,
          percent: 50,
        }),
      ],
      totals: { roomsCompleted: 1, roomsTotal: 3, solvedQuestions: 3, totalQuestions: 5 },
    });
  });

  it('returns zeros for users without progress', () => {
    const service = makeService([]);
    return expect(service.getOverview('u1')).resolves.toMatchObject({
      totals: { roomsCompleted: 0, roomsTotal: 3, solvedQuestions: 0, totalQuestions: 5 },
    });
  });
});

describe('ProgressService.getPathProgress', () => {
  it('returns room/module/path percentages', () => {
    const service = makeService(['q1', 'q2', 'q3']);
    return expect(service.getPathProgress('u1', 'cs101')).resolves.toEqual({
      slug: 'cs101',
      percent: 100,
      modules: [
        {
          slug: 'm1',
          title: 'Módulo 1',
          percent: 100,
          rooms: [
            { slug: 'room-1', solved: 2, total: 2, percent: 100, completed: true },
            { slug: 'room-2', solved: 1, total: 1, percent: 100, completed: true },
          ],
        },
      ],
    });
  });

  it('marks partially solved rooms as not completed', () => {
    const service = makeService(['q1']);
    return expect(service.getPathProgress('u1', 'cs101')).resolves.toMatchObject({
      percent: 33,
      modules: [
        {
          percent: 33,
          rooms: [
            { slug: 'room-1', solved: 1, total: 2, percent: 50, completed: false },
            { slug: 'room-2', solved: 0, total: 1, percent: 0, completed: false },
          ],
        },
      ],
    });
  });

  it('throws NotFound for unknown paths', () => {
    const service = makeService([]);
    return expect(service.getPathProgress('u1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });
});
