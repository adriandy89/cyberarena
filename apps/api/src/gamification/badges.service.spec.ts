import { describe, expect, it, vi } from 'vitest';
import { computeStreak } from '@repo/shared';
import { BadgesService } from './badges.service';
import type { PrismaService } from '../prisma/prisma.service';

function nowDaysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function catalogMock() {
  return [
    {
      slug: 'cs101',
      modules: [
        {
          rooms: [
            { tasks: [{ questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }] }] },
          ],
        },
      ],
    },
  ];
}

describe('BadgesService.evaluate', () => {
  it('awards first-question, room-first, path-complete and thresholds idempotently', async () => {
    const created: string[] = [];
    const prisma = {
      questionSolved: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn()
          .mockResolvedValueOnce([ // solvedDates (select solvedAt)
            { solvedAt: nowDaysAgo(0) },
            { solvedAt: nowDaysAgo(0) },
            { solvedAt: nowDaysAgo(0) },
          ])
          .mockResolvedValueOnce([ // catalog solved (select questionId)
            { questionId: 'q1' },
            { questionId: 'q2' },
            { questionId: 'q3' },
          ]),
      },
      userBadge: {
        findMany: vi.fn()
          .mockResolvedValueOnce([]) // evaluate: nothing earned yet
          .mockResolvedValueOnce([{ badgeId: 'first-question' }]), // listForUser after
        create: vi.fn().mockImplementation(({ data }) => {
          created.push(data.badgeId);
          return Promise.resolve(data);
        }),
      },
      catalogPath: { findMany: vi.fn().mockResolvedValue(catalogMock()) },
    } as unknown as PrismaService;
    const service = new BadgesService(prisma);

    await service.evaluate('u1');
    expect(created).toContain('first-question');
    expect(created).toContain('room-first');
    expect(created).toContain('path-complete:cs101');
    expect(created).not.toContain('questions-10'); // only 3 solved

    const list = await service.listForUser('u1');
    expect(list.awarded.map((badge) => badge.id)).toContain('first-question');
  });

  it('skips already earned badges', async () => {
    const created: string[] = [];
    const prisma = {
      questionSolved: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([{ solvedAt: nowDaysAgo(0) }]),
      },
      userBadge: {
        findMany: vi.fn().mockResolvedValue([{ badgeId: 'first-question' }]),
        create: vi.fn().mockImplementation(({ data }) => {
          created.push(data.badgeId);
          return Promise.resolve(data);
        }),
      },
      catalogPath: { findMany: vi.fn().mockResolvedValue(catalogMock()) },
    } as unknown as PrismaService;
    await new BadgesService(prisma).evaluate('u1');
    expect(created).toEqual([]);
  });

  it('never throws (answer flow protection)', async () => {
    const prisma = {
      questionSolved: { count: vi.fn().mockRejectedValue(new Error('db down')), findMany: vi.fn() },
      userBadge: { findMany: vi.fn(), create: vi.fn() },
      catalogPath: { findMany: vi.fn() },
    } as unknown as PrismaService;
    await expect(new BadgesService(prisma).evaluate('u1')).resolves.toBeUndefined();
  });
});

describe('streak integration shape', () => {
  it('matches the streak badge thresholds via computeStreak', () => {
    const threeDays = [0, 1, 2].flatMap((offset) =>
      [0, 1, 2].map(() => nowDaysAgo(offset)),
    );
    expect(computeStreak(threeDays).current).toBeGreaterThanOrEqual(3);
  });
});
