import { Injectable, Logger } from '@nestjs/common';
import { computeStreak } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Static badge ids (i18n names live in the web messages: badges.<id>.*). */
export const STATIC_BADGE_IDS = [
  'first-question',
  'room-first',
  'questions-10',
  'questions-50',
  'questions-100',
  'streak-3',
  'streak-7',
  'streak-30',
] as const;

export interface BadgeAward {
  id: string;
  awardedAt: Date;
}

/**
 * Badge awarding (ADR-013): evaluated best-effort after each correct answer.
 * Idempotent — UserBadge has a composite PK and duplicates collapse (P2002).
 * Badges never award XP (no evaluation loops).
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<{ awarded: BadgeAward[]; definitions: Array<{ id: string; earned: boolean }> }> {
    const awarded = await this.prisma.userBadge.findMany({
      where: { userId },
      orderBy: { awardedAt: 'asc' },
    });
    const earned = new Set(awarded.map((row) => row.badgeId));

    const definitions: Array<{ id: string; earned: boolean }> = STATIC_BADGE_IDS.map((id) => ({
      id,
      earned: earned.has(id),
    }));
    for (const row of awarded) {
      if (row.badgeId.startsWith('path-complete:')) {
        definitions.push({ id: row.badgeId, earned: true });
      }
    }
    return {
      awarded: awarded.map((row) => ({ id: row.badgeId, awardedAt: row.awardedAt })),
      definitions,
    };
  }

  /** Recomputes conditions and inserts any missing badges. Safe to call often. */
  async evaluate(userId: string): Promise<void> {
    try {
      const [solvedCount, solvedDates, awarded] = await Promise.all([
        this.prisma.questionSolved.count({ where: { userId } }),
        this.prisma.questionSolved.findMany({
          where: { userId },
          select: { solvedAt: true },
        }),
        this.prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
      ]);
      const earned = new Set(awarded.map((row) => row.badgeId));
      const streak = computeStreak(solvedDates.map((row) => row.solvedAt));

      const candidates: string[] = [];
      if (solvedCount >= 1) candidates.push('first-question');
      for (const threshold of [10, 50, 100]) {
        if (solvedCount >= threshold) candidates.push(`questions-${threshold}`);
      }
      if (streak.current >= 3 || streak.best >= 3) candidates.push('streak-3');
      if (streak.current >= 7 || streak.best >= 7) candidates.push('streak-7');
      if (streak.current >= 30 || streak.best >= 30) candidates.push('streak-30');

      if (solvedCount > 0) {
        const completedPaths = await this.completedPaths(userId);
        if (completedPaths.completedRooms >= 1) candidates.push('room-first');
        for (const pathSlug of completedPaths.pathSlugs) {
          candidates.push(`path-complete:${pathSlug}`);
        }
      }

      const missing = candidates.filter((id) => !earned.has(id));
      for (const badgeId of missing) {
        await this.prisma.userBadge
          .create({ data: { userId, badgeId } })
          .catch((error) => {
            if ((error as { code?: string }).code !== 'P2002') throw error;
          });
      }
    } catch (error) {
      // Badges must never break the answer flow.
      this.logger.error(`badge evaluation failed for ${userId}: ${String(error)}`);
    }
  }

  /** Room/path completion derived from QuestionSolved (see ProgressService, ADR-012). */
  private async completedPaths(userId: string): Promise<{ completedRooms: number; pathSlugs: string[] }> {
    const paths = await this.prisma.catalogPath.findMany({
      select: {
        slug: true,
        modules: {
          select: {
            rooms: { select: { tasks: { select: { questions: { select: { id: true } } } } } },
          },
        },
      },
    });
    const allQuestionIds = paths.flatMap((path) =>
      path.modules.flatMap((module) =>
        module.rooms.flatMap((room) => room.tasks.flatMap((task) => task.questions.map((q) => q.id))),
      ),
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

    let completedRooms = 0;
    const pathSlugs: string[] = [];
    for (const path of paths) {
      let pathTotal = 0;
      let pathSolved = 0;
      for (const module of path.modules) {
        for (const room of module.rooms) {
          const total = room.tasks.reduce((sum, task) => sum + task.questions.length, 0);
          const solvedCount = room.tasks.reduce(
            (sum, task) => sum + task.questions.filter((q) => solved.has(q.id)).length,
            0,
          );
          pathTotal += total;
          pathSolved += solvedCount;
          if (total > 0 && solvedCount === total) completedRooms++;
        }
      }
      if (pathTotal > 0 && pathSolved === pathTotal) pathSlugs.push(path.slug);
    }
    return { completedRooms, pathSlugs };
  }
}
