import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeRoomContext, type RoomContext } from './room-context';

export interface CatalogRoomLink {
  slug: string;
  title: string;
  difficulty: string;
  type: string;
  estimatedMinutes: number;
}

export interface CatalogPathSummary {
  slug: string;
  title: string;
  description: string;
  level: string;
  moduleCount: number;
  roomCount: number;
  estimatedMinutes: number;
  rooms: CatalogRoomLink[];
}

export interface CatalogRoomSummary {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  estimatedMinutes: number;
  tags: string[];
  lab: string | null;
}

export interface CatalogModuleDetail {
  slug: string;
  title: string;
  description: string;
  rooms: CatalogRoomSummary[];
}

export interface CatalogPathDetail {
  slug: string;
  title: string;
  description: string;
  level: string;
  modules: CatalogModuleDetail[];
}

export interface CatalogQuestionPublic {
  id: string;
  prompt: string;
  hint: string | null;
  kind: string;
  options: unknown;
  index: number;
}

export interface CatalogTaskDetail {
  id: string;
  index: number;
  title: string;
  body: string;
  questions: CatalogQuestionPublic[];
}

export interface CatalogRoomDetail extends CatalogRoomSummary {
  labUrl: string | null;
  /** Secondary labs some tasks use (phase 011). */
  extraLabs: string[];
  tasks: CatalogTaskDetail[];
}

/**
 * Read-only catalog access. The Answer table is NEVER queried here —
 * answers/hashes stay server-side and are only used by answer checking
 * (phase 003).
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPaths(): Promise<CatalogPathSummary[]> {
    const paths = await this.prisma.catalogPath.findMany({
      orderBy: { order: 'asc' },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          select: {
            rooms: {
              orderBy: { order: 'asc' },
              select: {
                slug: true,
                title: true,
                difficulty: true,
                type: true,
                estimatedMinutes: true,
              },
            },
          },
        },
      },
    });
    return paths.map((path) => {
      const rooms = path.modules.flatMap((module) => module.rooms);
      return {
        slug: path.slug,
        title: path.title,
        description: path.description,
        level: path.level,
        moduleCount: path.modules.length,
        roomCount: rooms.length,
        estimatedMinutes: rooms.reduce((total, room) => total + room.estimatedMinutes, 0),
        rooms,
      };
    });
  }

  async getPath(slug: string): Promise<CatalogPathDetail> {
    const path = await this.prisma.catalogPath.findUnique({
      where: { slug },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            rooms: {
              orderBy: { order: 'asc' },
              select: {
                slug: true,
                title: true,
                description: true,
                difficulty: true,
                type: true,
                estimatedMinutes: true,
                tags: true,
                lab: true,
                labUrl: true,
              },
            },
          },
        },
      },
    });
    if (!path) {
      throw new NotFoundException('path not found');
    }
    return {
      slug: path.slug,
      title: path.title,
      description: path.description,
      level: path.level,
      modules: path.modules.map((module) => ({
        slug: module.slug,
        title: module.title,
        description: module.description,
        rooms: module.rooms,
      })),
    };
  }

  /** Room position inside its path, with previous/next links (spec 010). */
  async getRoomContext(slug: string): Promise<RoomContext> {
    const paths = await this.prisma.catalogPath.findMany({
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
              select: { slug: true, title: true, difficulty: true },
            },
          },
        },
      },
    });
    const context = computeRoomContext(paths, slug);
    if (!context) {
      throw new NotFoundException('room not found');
    }
    return context;
  }

  async getRoom(slug: string): Promise<CatalogRoomDetail> {
    const room = await this.prisma.room.findUnique({
      where: { slug },
      include: {
        tasks: {
          orderBy: { index: 'asc' },
          include: {
            questions: {
              orderBy: { index: 'asc' },
              select: {
                id: true,
                prompt: true,
                hint: true,
                kind: true,
                options: true,
                index: true,
              },
            },
          },
        },
      },
    });
    if (!room) {
      throw new NotFoundException('room not found');
    }
    return {
      slug: room.slug,
      title: room.title,
      description: room.description,
      difficulty: room.difficulty,
      type: room.type,
      estimatedMinutes: room.estimatedMinutes,
      tags: room.tags,
      lab: room.lab,
      labUrl: room.labUrl,
      extraLabs: room.extraLabs,
      tasks: room.tasks.map((task) => ({
        id: task.id,
        index: task.index,
        title: task.title,
        body: task.body,
        questions: task.questions,
      })),
    };
  }
}
