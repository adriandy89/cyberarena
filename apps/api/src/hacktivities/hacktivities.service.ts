import { Injectable } from '@nestjs/common';
import { DIFFICULTY_IDS, ROOM_TYPES } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service';

export const HACKTIVITIES_SORTS = ['popular', 'newest', 'az', 'za', 'time'] as const;
export type HacktivitiesSort = (typeof HACKTIVITIES_SORTS)[number];

export interface HacktivitiesQuery {
  q?: string;
  difficulty?: string;
  type?: string;
  tag?: string;
  lab?: 'true' | 'false';
  sort: HacktivitiesSort;
  take: number;
  skip: number;
}

interface RoomRow {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  estimatedMinutes: number;
  tags: string[];
  lab: string | null;
  createdAt: Date;
  catalogModule: { catalogPath: { slug: string; title: string } };
  tasks: Array<{ questions: Array<{ id: string }> }>;
}

/**
 * Public room directory with search/filter/sort (phase 006).
 * All rooms fit in memory (<100 by design — see spec §6): one catalog query +
 * one solved query, then filter/sort/aggregate in memory (ADR-012 spirit).
 */
@Injectable()
export class HacktivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: HacktivitiesQuery) {
    const rooms = await this.prisma.room.findMany({
      include: {
        catalogModule: { select: { catalogPath: { select: { slug: true, title: true } } } },
        tasks: { select: { questions: { select: { id: true } } } },
      },
    });

    const completionsByRoom = await this.completionsByRoom(rooms);

    const needle = query.q?.trim().toLowerCase() ?? '';
    const filtered = rooms.filter((room) => {
      if (query.difficulty && room.difficulty !== query.difficulty) return false;
      if (query.type && room.type !== query.type) return false;
      if (query.tag && !room.tags.includes(query.tag)) return false;
      if (query.lab === 'true' && !room.lab) return false;
      if (query.lab === 'false' && room.lab) return false;
      if (needle) {
        const haystack =
          `${room.title} ${room.description} ${room.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const completions = (slug: string) => completionsByRoom.get(slug) ?? 0;
    const sorted = [...filtered].sort((a, b) => {
      switch (query.sort) {
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'az':
          return a.title.localeCompare(b.title);
        case 'za':
          return b.title.localeCompare(a.title);
        case 'time':
          return a.estimatedMinutes - b.estimatedMinutes;
        case 'popular':
        default:
          return completions(b.slug) - completions(a.slug) || a.title.localeCompare(b.title);
      }
    });

    const page = sorted.slice(query.skip, query.skip + query.take);

    const facets = {
      tags: [...new Set(rooms.flatMap((room) => room.tags))].sort(),
      difficulties: DIFFICULTY_IDS.filter((difficulty) =>
        rooms.some((room) => room.difficulty === difficulty),
      ),
      types: [...ROOM_TYPES].filter((type) => rooms.some((room) => room.type === type)),
    };

    return {
      total: filtered.length,
      rooms: page.map((room) => ({
        slug: room.slug,
        title: room.title,
        description: room.description,
        difficulty: room.difficulty,
        type: room.type,
        estimatedMinutes: room.estimatedMinutes,
        tags: room.tags,
        lab: room.lab,
        completions: completions(room.slug),
        pathSlug: room.catalogModule.catalogPath.slug,
        pathTitle: room.catalogModule.catalogPath.title,
      })),
      facets,
    };
  }

  /** Distinct users who solved EVERY question of each room (in memory). */
  private async completionsByRoom(rooms: RoomRow[]): Promise<Map<string, number>> {
    const questionsByRoom = new Map<string, string[]>();
    const allQuestionIds: string[] = [];
    for (const room of rooms) {
      const ids = room.tasks.flatMap((task) => task.questions.map((q) => q.id));
      questionsByRoom.set(room.slug, ids);
      allQuestionIds.push(...ids);
    }
    if (allQuestionIds.length === 0) {
      return new Map();
    }
    const solved = await this.prisma.questionSolved.findMany({
      where: { questionId: { in: allQuestionIds } },
      select: { userId: true, questionId: true },
    });
    const solvedByUser = new Map<string, Set<string>>();
    for (const row of solved) {
      const set = solvedByUser.get(row.userId) ?? new Set<string>();
      set.add(row.questionId);
      solvedByUser.set(row.userId, set);
    }
    const result = new Map<string, number>();
    for (const [slug, ids] of questionsByRoom) {
      if (ids.length === 0) {
        result.set(slug, 0);
        continue;
      }
      let count = 0;
      for (const solvedQuestions of solvedByUser.values()) {
        if (ids.every((id) => solvedQuestions.has(id))) count++;
      }
      result.set(slug, count);
    }
    return result;
  }
}
