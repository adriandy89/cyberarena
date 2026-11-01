import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Role } from '@repo/database';
import { type PrismaService } from '../prisma/prisma.service';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: Date;
}

export interface ListUsersResult {
  users: UserListItem[];
  nextCursor: string | null;
}

export interface SetRoleInput {
  actorId: string;
  targetUserId: string;
  role: Role;
}

const MAX_TAKE = 100;
const DEFAULT_TAKE = 20;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Paginated user list (admin). Cursor is the last user id (createdAt desc, id asc). */
  async listUsers(take?: number, cursor?: string): Promise<ListUsersResult> {
    const limit = Math.min(Math.max(1, take ?? DEFAULT_TAKE), MAX_TAKE);
    const users = await this.prisma.user.findMany({
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    const hasMore = users.length > limit;
    const page = hasMore ? users.slice(0, limit) : users;
    return {
      users: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  /** Changes a user's role. Admins cannot demote themselves (avoid lockout). */
  async setRole(input: SetRoleInput): Promise<UserListItem> {
    if (input.targetUserId === input.actorId) {
      throw new BadRequestException('admins cannot change their own role');
    }
    const existing = await this.prisma.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('user not found');
    }
    const updated = await this.prisma.user.update({
      where: { id: input.targetUserId },
      data: { role: input.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    return updated;
  }
}
