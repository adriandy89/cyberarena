import { NotFoundException } from '@nestjs/common';
import { hashAnswer } from '@repo/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BadgesService } from '../gamification/badges.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from './rooms.service';

const ROOM = 'intro-room';
const ROOM_TYPE = 'walkthrough';

function baseMocks() {
  return {
    question: {
      findUnique: vi.fn().mockResolvedValue({
        id: `${ROOM}-t01-q01`,
        task: { room: { slug: ROOM, type: ROOM_TYPE } },
        answers: [{ answerHash: hashAnswer('FLAG{ok}') }],
      }),
    },
    questionSolved: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([{ questionId: `${ROOM}-t01-q01` }]),
    },
    xpEvent: {
      create: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 30 } }),
    },
    room: {
      findUnique: vi.fn().mockResolvedValue({
        tasks: [{ questions: [{ id: `${ROOM}-t01-q01` }] }],
      }),
    },
  };
}

function makeService(mocks = baseMocks()) {
  const badges = { evaluate: vi.fn().mockResolvedValue(undefined) };
  const service = new RoomsService(
    mocks as unknown as PrismaService,
    badges as unknown as BadgesService,
  );
  return { service, mocks, badges };
}

describe('RoomsService.submitAnswer', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('reports a level-up when the awarded XP crosses a threshold', async () => {
    // 30 XP awarded (10 + 20 bonus) taking the total from 190 to 220: NEOPHYTE -> APPRENTICE
    ctx.mocks.xpEvent.aggregate.mockResolvedValue({ _sum: { amount: 220 } });
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{ok}');
    expect(result.level).toEqual({ before: 0, after: 1, name: 'APPRENTICE' });
  });

  it('reports the same level when no threshold is crossed', async () => {
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{ok}');
    expect(result.level).toEqual({ before: 0, after: 0, name: 'NEOPHYTE' });
  });

  it('omits the level when the XP total cannot be read', async () => {
    ctx.mocks.xpEvent.aggregate.mockRejectedValue(new Error('db down'));
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{ok}');
    expect(result.correct).toBe(true);
    expect(result).not.toHaveProperty('level');
  });

  it('rejects a wrong answer without recording anything', async () => {
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{no}');
    expect(result).toEqual({
      correct: false,
      alreadySolved: false,
      xpAwarded: 0,
      roomCompleted: false,
    });
    expect(ctx.mocks.questionSolved.create).not.toHaveBeenCalled();
  });

  it('awards question XP on first correct answer (walkthrough = 10)', async () => {
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{ok}');
    expect(result.correct).toBe(true);
    expect(result.alreadySolved).toBe(false);
    expect(result.xpAwarded).toBeGreaterThanOrEqual(10);
    expect(ctx.mocks.xpEvent.create).toHaveBeenCalledWith({
      data: { userId: 'u1', amount: 10, reason: `question:${ROOM}-t01-q01` },
    });
  });

  it('adds the room completion bonus exactly when the room becomes complete', async () => {
    // single-question room: solving it completes the room -> 10 + 20 bonus
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, ' flag{OK} ');
    expect(result.roomCompleted).toBe(true);
    expect(result.xpAwarded).toBe(30);
    const reasons = ctx.mocks.xpEvent.create.mock.calls.map((c) => c[0].data.reason);
    expect(reasons).toContain(`room-complete:${ROOM}`);
  });

  it('returns alreadySolved (no XP) when the question was solved before', async () => {
    ctx.mocks.questionSolved.findUnique.mockResolvedValue({ questionId: `${ROOM}-t01-q01` });
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{ok}');
    expect(result).toMatchObject({ correct: true, alreadySolved: true, xpAwarded: 0 });
    expect(ctx.mocks.xpEvent.create).not.toHaveBeenCalled();
  });

  it('collapses a concurrent duplicate solve (P2002 on QuestionSolved) into alreadySolved', async () => {
    ctx.mocks.questionSolved.findUnique.mockResolvedValue(null);
    ctx.mocks.questionSolved.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{ok}');
    expect(result.alreadySolved).toBe(true);
    expect(result.xpAwarded).toBe(0);
  });

  it('ignores duplicate XP events (P2002 on XpEvent unique reason)', async () => {
    ctx.mocks.xpEvent.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    const result = await ctx.service.submitAnswer('u1', ROOM, `${ROOM}-t01-q01`, 'FLAG{ok}');
    expect(result.correct).toBe(true);
    expect(result.xpAwarded).toBe(0); // both question and bonus collapsed
  });

  it('throws NotFound when the question belongs to another room', async () => {
    await expect(
      ctx.service.submitAnswer('u1', 'other-room', `${ROOM}-t01-q01`, 'FLAG{ok}'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the answer row is missing (seed not run)', async () => {
    ctx.mocks.question.findUnique.mockResolvedValue({
      id: 'q',
      task: { room: { slug: ROOM, type: ROOM_TYPE } },
      answers: [],
    });
    await expect(ctx.service.submitAnswer('u1', ROOM, 'q', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('RoomsService.getProgress', () => {
  it('returns solved ids and completion state', async () => {
    const { service } = makeService();
    const progress = await service.getProgress('u1', ROOM);
    expect(progress.solvedQuestionIds).toEqual([`${ROOM}-t01-q01`]);
    expect(progress.roomCompleted).toBe(true);
  });

  it('reports incomplete rooms', async () => {
    const mocks = baseMocks();
    mocks.room.findUnique.mockResolvedValue({
      tasks: [{ questions: [{ id: 'a' }, { id: 'b' }] }],
    });
    mocks.questionSolved.findMany.mockResolvedValue([{ questionId: 'a' }]);
    const { service } = makeService(mocks);
    const progress = await service.getProgress('u1', ROOM);
    expect(progress.roomCompleted).toBe(false);
  });

  it('throws NotFound for unknown rooms', async () => {
    const mocks = baseMocks();
    mocks.room.findUnique.mockResolvedValue(null);
    const { service } = makeService(mocks);
    await expect(service.getProgress('u1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });
});
