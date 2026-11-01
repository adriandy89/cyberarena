import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@repo/database';
import { type PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const baseUser = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  role: Role.STUDENT,
  emailVerified: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return overrides as unknown as PrismaService;
}

describe('UsersService', () => {
  let service: UsersService;

  describe('listUsers', () => {
    it('returns users and null cursor when fewer than the limit', async () => {
      const findMany = vi.fn().mockResolvedValue([baseUser]);
      service = new UsersService(mockPrisma({ user: { findMany } }));
      const result = await service.listUsers(20);
      expect(result.users).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
      );
    });

    it('returns nextCursor when there are more pages', async () => {
      const many = Array.from({ length: 21 }, (_, i) => ({ ...baseUser, id: `u${i}` }));
      const findMany = vi.fn().mockResolvedValue(many);
      service = new UsersService(mockPrisma({ user: { findMany } }));
      const result = await service.listUsers(20);
      expect(result.users).toHaveLength(20);
      expect(result.nextCursor).toBe('u19');
    });

    it('clamps take to the maximum', async () => {
      const findMany = vi.fn().mockResolvedValue([]);
      service = new UsersService(mockPrisma({ user: { findMany } }));
      await service.listUsers(5000);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 101 }));
    });
  });

  describe('setRole', () => {
    beforeEach(() => {
      service = new UsersService(
        mockPrisma({
          user: {
            findUnique: vi.fn().mockResolvedValue({ id: 'u2' }),
            update: vi.fn().mockResolvedValue({ ...baseUser, id: 'u2', role: Role.ADMIN }),
          },
        }),
      );
    });

    it('promotes another user', async () => {
      const result = await service.setRole({
        actorId: 'u1',
        targetUserId: 'u2',
        role: Role.ADMIN,
      });
      expect(result.role).toBe(Role.ADMIN);
    });

    it('rejects changing your own role (lockout protection)', async () => {
      await expect(
        service.setRole({ actorId: 'u1', targetUserId: 'u1', role: Role.STUDENT }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for unknown users', async () => {
      service = new UsersService(
        mockPrisma({
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        }),
      );
      await expect(
        service.setRole({ actorId: 'u1', targetUserId: 'ghost', role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
