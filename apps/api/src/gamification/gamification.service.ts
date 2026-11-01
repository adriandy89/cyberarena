import { Injectable } from '@nestjs/common';
import { computeStreak, getLevelForXp } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getStreak(userId: string) {
    const rows = await this.prisma.questionSolved.findMany({
      where: { userId },
      select: { solvedAt: true },
    });
    return computeStreak(rows.map((row) => row.solvedAt));
  }

  async getSkills(userId: string) {
    const rooms = await this.prisma.room.findMany({
      select: { tags: true, tasks: { select: { questions: { select: { id: true } } } } },
    });
    const allQuestionIds = rooms.flatMap((room) =>
      room.tasks.flatMap((task) => task.questions.map((q) => q.id)),
    );
    const solved = allQuestionIds.length
      ? new Set(
          (
            await this.prisma.questionSolved.findMany({
              where: { userId, questionId: { in: allQuestionIds } },
              select: { questionId: true },
            })
          ).map((row) => row.questionId),
        )
      : new Set<string>();

    const byTag = new Map<string, { solved: number; total: number }>();
    for (const room of rooms) {
      for (const tag of room.tags) {
        const entry = byTag.get(tag) ?? { solved: 0, total: 0 };
        for (const task of room.tasks) {
          for (const question of task.questions) {
            entry.total += 1;
            if (solved.has(question.id)) entry.solved += 1;
          }
        }
        byTag.set(tag, entry);
      }
    }
    return [...byTag.entries()]
      .map(([tag, entry]) => ({
        tag,
        solved: entry.solved,
        total: entry.total,
        percent: entry.total > 0 ? Math.round((entry.solved / entry.total) * 100) : 0,
      }))
      .sort((a, b) => b.percent - a.percent || a.tag.localeCompare(b.tag));
  }

  async getCertificates(userId: string) {
    const paths = await this.prisma.catalogPath.findMany({
      orderBy: { order: 'asc' },
      select: {
        slug: true,
        title: true,
        modules: {
          select: {
            rooms: {
              select: {
                slug: true,
                type: true,
                tasks: { select: { questions: { select: { id: true } } } },
              },
            },
          },
        },
      },
    });
    const allQuestionIds = paths.flatMap((path) =>
      path.modules.flatMap((module) =>
        module.rooms.flatMap((room) => room.tasks.flatMap((task) => task.questions.map((q) => q.id))),
      ),
    );
    const solvedRows = allQuestionIds.length
      ? await this.prisma.questionSolved.findMany({
          where: { userId, questionId: { in: allQuestionIds } },
          select: { questionId: true, solvedAt: true },
        })
      : [];
    const solvedByQuestion = new Map(solvedRows.map((row) => [row.questionId, row.solvedAt]));

    const xpEvents = await this.prisma.xpEvent.findMany({
      where: { userId },
      select: { amount: true, reason: true },
    });
    const xpByReason = new Map(xpEvents.map((event) => [event.reason, event.amount]));

    const certificates: Array<{
      pathSlug: string;
      pathTitle: string;
      completedAt: Date;
      xpInPath: number;
    }> = [];
    for (const path of paths) {
      let total = 0;
      let solved = 0;
      let completedAt: Date | null = null;
      let xpInPath = 0;
      for (const module of path.modules) {
        for (const room of module.rooms) {
          if (xpByReason.has(`room-complete:${room.slug}`)) {
            xpInPath += xpByReason.get(`room-complete:${room.slug}`)!;
          }
          for (const task of room.tasks) {
            for (const question of task.questions) {
              total += 1;
              const solvedAt = solvedByQuestion.get(question.id);
              if (solvedAt) {
                solved += 1;
                xpInPath += xpByReason.get(`question:${question.id}`) ?? 0;
                if (!completedAt || solvedAt > completedAt) completedAt = solvedAt;
              }
            }
          }
        }
      }
      if (total > 0 && solved === total && completedAt) {
        certificates.push({ pathSlug: path.slug, pathTitle: path.title, completedAt, xpInPath });
      }
    }
    return certificates;
  }

  async getLeaderboard(period: 'all' | 'month', limit = 20) {
    const since =
      period === 'month'
        ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
        : null;
    const grouped = await this.prisma.xpEvent.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      ...(since ? { where: { createdAt: { gte: since } } } : {}),
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });
    if (grouped.length === 0) {
      return { period, entries: [] };
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((row) => row.userId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((user) => [user.id, user.name]));
    return {
      period,
      entries: grouped.map((row, index) => {
        const xp = row._sum.amount ?? 0;
        return {
          rank: index + 1,
          userId: row.userId,
          name: nameById.get(row.userId) ?? '—',
          xp,
          levelName: getLevelForXp(xp).level.name,
        };
      }),
    };
  }
}
