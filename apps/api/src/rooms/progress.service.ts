import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Progress derived at read time from QuestionSolved (ADR-012): one catalog
 * query + one solved query, aggregation in memory.
 */
@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string) {
    const paths = await this.loadCatalog();
    const solved = await this.solvedSet(userId, this.allQuestionIds(paths));
    const pathSummaries = paths.map((path) => this.summarizePath(path, solved));
    return {
      paths: pathSummaries.map((path) => ({
        slug: path.slug,
        title: path.title,
        level: path.level,
        roomsCompleted: path.roomsCompleted,
        roomsTotal: path.roomsTotal,
        solvedQuestions: path.solvedQuestions,
        totalQuestions: path.totalQuestions,
        percent: path.percent,
      })),
      totals: {
        roomsCompleted: pathSummaries.reduce((sum, path) => sum + path.roomsCompleted, 0),
        roomsTotal: pathSummaries.reduce((sum, path) => sum + path.roomsTotal, 0),
        solvedQuestions: pathSummaries.reduce((sum, path) => sum + path.solvedQuestions, 0),
        totalQuestions: pathSummaries.reduce((sum, path) => sum + path.totalQuestions, 0),
      },
    };
  }

  async getPathProgress(userId: string, pathSlug: string) {
    const paths = await this.loadCatalog();
    const path = paths.find((candidate) => candidate.slug === pathSlug);
    if (!path) {
      throw new NotFoundException('path not found');
    }
    const solved = await this.solvedSet(userId, this.allQuestionIds([path]));
    const [solvedQuestions, totalQuestions] = this.pathCounts(path, solved);
    return {
      slug: path.slug,
      percent: percentOf(solvedQuestions, totalQuestions),
      modules: path.modules.map((module) => {
        const roomDetails = module.rooms.map((room) => {
          const total = room.tasks.reduce((sum, task) => sum + task.questions.length, 0);
          const solvedCount = room.tasks.reduce(
            (sum, task) => sum + task.questions.filter((q) => solved.has(q.id)).length,
            0,
          );
          return {
            slug: room.slug,
            solved: solvedCount,
            total,
            percent: percentOf(solvedCount, total),
            completed: total > 0 && solvedCount === total,
          };
        });
        const moduleTotal = roomDetails.reduce((sum, room) => sum + room.total, 0);
        const moduleSolved = roomDetails.reduce((sum, room) => sum + room.solved, 0);
        return {
          slug: module.slug,
          title: module.title,
          percent: percentOf(moduleSolved, moduleTotal),
          rooms: roomDetails,
        };
      }),
    };
  }

  // --- internals ---

  private loadCatalog() {
    return this.prisma.catalogPath.findMany({
      orderBy: { order: 'asc' },
      select: {
        slug: true,
        title: true,
        level: true,
        modules: {
          orderBy: { order: 'asc' },
          select: {
            slug: true,
            title: true,
            rooms: {
              orderBy: { order: 'asc' },
              select: {
                slug: true,
                tasks: { select: { questions: { select: { id: true } } } },
              },
            },
          },
        },
      },
    });
  }

  private async solvedSet(userId: string, questionIds: string[]): Promise<Set<string>> {
    if (questionIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.questionSolved.findMany({
      where: { userId, questionId: { in: questionIds } },
      select: { questionId: true },
    });
    return new Set(rows.map((row) => row.questionId));
  }

  private allQuestionIds(paths: Array<{ modules: Array<{ rooms: RoomShape[] }> }>): string[] {
    return paths.flatMap((path) =>
      path.modules.flatMap((module) =>
        module.rooms.flatMap((room) =>
          room.tasks.flatMap((task) => task.questions.map((q) => q.id)),
        ),
      ),
    );
  }

  private pathCounts(
    path: PathShape,
    solved: Set<string>,
  ): [solvedQuestions: number, totalQuestions: number, roomsCompleted: number, roomsTotal: number] {
    let solvedQuestions = 0;
    let totalQuestions = 0;
    let roomsCompleted = 0;
    for (const module of path.modules) {
      for (const room of module.rooms) {
        const total = room.tasks.reduce((sum, task) => sum + task.questions.length, 0);
        const solvedCount = room.tasks.reduce(
          (sum, task) => sum + task.questions.filter((q) => solved.has(q.id)).length,
          0,
        );
        totalQuestions += total;
        solvedQuestions += solvedCount;
        if (total > 0 && solvedCount === total) {
          roomsCompleted++;
        }
      }
    }
    return [
      solvedQuestions,
      totalQuestions,
      roomsCompleted,
      path.modules.reduce((sum, m) => sum + m.rooms.length, 0),
    ];
  }

  private summarizePath(path: PathShape, solved: Set<string>) {
    const [solvedQuestions, totalQuestions, roomsCompleted, roomsTotal] = this.pathCounts(
      path,
      solved,
    );
    return {
      slug: path.slug,
      title: path.title,
      level: path.level,
      roomsCompleted,
      roomsTotal,
      solvedQuestions,
      totalQuestions,
      percent: percentOf(solvedQuestions, totalQuestions),
    };
  }
}

interface QuestionRef {
  id: string;
}
interface RoomShape {
  slug: string;
  tasks: Array<{ questions: QuestionRef[] }>;
}
interface PathShape {
  slug: string;
  title: string;
  level: string;
  modules: Array<{ slug: string; title: string; rooms: RoomShape[] }>;
}

function percentOf(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}
