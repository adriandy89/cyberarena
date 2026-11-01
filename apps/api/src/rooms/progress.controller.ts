import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-module-types';
import { SessionGuard } from '../auth/session.guard';
import { ProgressService } from './progress.service';

/** Derived progress views (ADR-012). Session required. */
@Controller('progress')
@UseGuards(SessionGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.progress.getOverview(user.id);
  }

  @Get('paths/:slug')
  pathProgress(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.progress.getPathProgress(user.id, slug);
  }
}
