import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-module-types';
import { SessionGuard } from '../auth/session.guard';
import { BadgesService } from './badges.service';
import { GamificationService } from './gamification.service';

const leaderboardPeriodSchema = z.enum(['all', 'month']).catch('all');

@Controller()
export class GamificationController {
  constructor(
    private readonly gamification: GamificationService,
    private readonly badges: BadgesService,
  ) {}

  /** Public leaderboard: no sensitive data beyond display name, XP and level. */
  @Get('leaderboard')
  leaderboard(@Query('period', { schema: leaderboardPeriodSchema }) period: 'all' | 'month') {
    return this.gamification.getLeaderboard(period);
  }

  @Get('me/streak')
  @UseGuards(SessionGuard)
  streak(@CurrentUser() user: AuthUser) {
    return this.gamification.getStreak(user.id);
  }

  @Get('me/badges')
  @UseGuards(SessionGuard)
  myBadges(@CurrentUser() user: AuthUser) {
    return this.badges.listForUser(user.id);
  }

  @Get('me/skills')
  @UseGuards(SessionGuard)
  skills(@CurrentUser() user: AuthUser) {
    return this.gamification.getSkills(user.id);
  }

  @Get('me/certificates')
  @UseGuards(SessionGuard)
  certificates(@CurrentUser() user: AuthUser) {
    return this.gamification.getCertificates(user.id);
  }
}
