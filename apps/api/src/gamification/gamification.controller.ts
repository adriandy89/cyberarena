import { Controller, Get, Header, NotFoundException, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-module-types';
import { SessionGuard } from '../auth/session.guard';
import { BadgesService } from './badges.service';
import { GamificationService } from './gamification.service';
import { CertificatePdfService } from './certificate-pdf.service';

const leaderboardPeriodSchema = z.enum(['all', 'month']).catch('all');
const localeSchema = z.enum(['es', 'en']).catch('es');

@Controller()
export class GamificationController {
  constructor(
    private readonly gamification: GamificationService,
    private readonly badges: BadgesService,
    private readonly certificatePdf: CertificatePdfService,
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

  @Get('me/certificates/:slug/pdf')
  @UseGuards(SessionGuard)
  @Header('Content-Type', 'application/pdf')
  async downloadCertificatePdf(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Query('locale', { schema: localeSchema }) locale: 'es' | 'en',
    @Res() res: Response,
  ) {
    try {
      const { buffer, filename } = await this.certificatePdf.build(user.id, user.name, slug, locale);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException('certificate not available');
    }
  }
}
