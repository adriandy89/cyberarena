import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return overrides as unknown as PrismaService;
}

describe('CatalogService', () => {
  let service: CatalogService;

  describe('listPaths', () => {
    it('aggregates module/room counts and total minutes', async () => {
      const findMany = vi.fn().mockResolvedValue([
        {
          slug: 'cs101',
          title: 'Cyber Security 101',
          description: 'desc',
          level: 'beginner',
          modules: [
            { rooms: [{ estimatedMinutes: 30 }, { estimatedMinutes: 45 }] },
            { rooms: [{ estimatedMinutes: 15 }] },
          ],
        },
      ]);
      service = new CatalogService(mockPrisma({ catalogPath: { findMany } }));
      const result = await service.listPaths();
      expect(result[0]).toMatchObject({
        slug: 'cs101',
        moduleCount: 2,
        roomCount: 3,
        estimatedMinutes: 90,
      });
    });
  });

  describe('getPath', () => {
    it('returns the module tree without answer data', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        slug: 'cs101',
        title: 'CS101',
        description: 'd',
        level: 'beginner',
        modules: [
          {
            slug: 'm1',
            title: 'M1',
            description: 'd',
            rooms: [{ slug: 'room-1', title: 'Room 1', difficulty: 'easy' }],
          },
        ],
      });
      service = new CatalogService(mockPrisma({ catalogPath: { findUnique } }));
      const path = await service.getPath('cs101');
      expect(path.modules[0]!.rooms[0]).not.toHaveProperty('answers');
      expect(JSON.stringify(path)).not.toContain('answerHash');
    });

    it('throws NotFound for unknown paths', async () => {
      service = new CatalogService(
        mockPrisma({ catalogPath: { findUnique: vi.fn().mockResolvedValue(null) } }),
      );
      await expect(service.getPath('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getRoom', () => {
    it('returns tasks with bodies and questions, never answers', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        slug: 'room-1',
        title: 'R1',
        description: 'd',
        difficulty: 'easy',
        type: 'walkthrough',
        estimatedMinutes: 30,
        tags: [],
        lab: null,
        tasks: [
          {
            id: 'room-1-t01',
            index: 1,
            title: 'T1',
            body: 'guide...',
            questions: [{ id: 'room-1-t01-q01', prompt: 'p', hint: null, kind: 'flag', index: 0 }],
          },
        ],
      });
      service = new CatalogService(mockPrisma({ room: { findUnique } }));
      const room = await service.getRoom('room-1');
      expect(room.tasks[0]!.body).toBe('guide...');
      expect(JSON.stringify(room)).not.toContain('answerHash');
    });

    it('throws NotFound for unknown rooms', async () => {
      service = new CatalogService(
        mockPrisma({ room: { findUnique: vi.fn().mockResolvedValue(null) } }),
      );
      await expect(service.getRoom('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getRoomContext', () => {
    const tree = [
      {
        slug: 'cs101',
        title: 'CS101',
        level: 'beginner',
        modules: [
          {
            slug: 'm1',
            title: 'M1',
            rooms: [
              { slug: 'room-1', title: 'R1', difficulty: 'info' },
              { slug: 'room-2', title: 'R2', difficulty: 'easy' },
            ],
          },
        ],
      },
    ];

    it('reads the ordered tree and resolves prev/next', async () => {
      const findMany = vi.fn().mockResolvedValue(tree);
      service = new CatalogService(mockPrisma({ catalogPath: { findMany } }));
      const context = await service.getRoomContext('room-2');
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { order: 'asc' } }));
      expect(context.prev?.slug).toBe('room-1');
      expect(context.position).toEqual({ index: 2, total: 2 });
    });

    it('throws NotFound for rooms outside every path', async () => {
      service = new CatalogService(
        mockPrisma({ catalogPath: { findMany: vi.fn().mockResolvedValue(tree) } }),
      );
      await expect(service.getRoomContext('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
