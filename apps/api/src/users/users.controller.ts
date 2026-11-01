import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Role } from '@repo/database';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-module-types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SessionGuard } from '../auth/session.guard';
import { UsersService } from './users.service';

const setRoleSchema = z.object({ role: z.enum(['STUDENT', 'ADMIN']) });

@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Own profile from the session (no extra query). */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: (user as { role?: Role }).role ?? Role.STUDENT,
    };
  }

  /** XP total, level and solved count for the dashboard. */
  @Get('me/xp')
  meXp(@CurrentUser() user: AuthUser) {
    return this.users.getXpSummary(user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  list(@Query('take') take?: string, @Query('cursor') cursor?: string) {
    const parsedTake = take ? Number(take) : undefined;
    return this.users.listUsers(
      Number.isFinite(parsedTake) ? parsedTake : undefined,
      cursor || undefined,
    );
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  setRole(
    @Param('id') id: string,
    // Nest 12 Standard Schema: the global StandardSchemaValidationPipe
    // validates the body against this schema (see AppModule APP_PIPE).
    @Body({ schema: setRoleSchema }) body: { role: Role },
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setRole({
      actorId: actor.id,
      targetUserId: id,
      role: body.role,
    });
  }
}
