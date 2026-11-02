import { Body, Controller, Get, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { LabSessionView, LabsInfo } from '@repo/shared';
import type { AuthUser } from '../auth/auth-module-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { RATE_LIMITS } from '../http/rate-limits';
import { labError, LabsService } from './labs.service';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const startSchema = z.object({ switch: z.boolean().optional() }).strict();

function checkSlug(slug: string): string {
  if (!SLUG.test(slug) || slug.length > 64) throw labError(HttpStatus.NOT_FOUND, 'LAB_UNKNOWN', 'Unknown lab');
  return slug;
}

/** Labs on demand (phase 011, ADR-015). */
@Controller('labs')
export class LabsController {
  constructor(private readonly labs: LabsService) {}

  /** Public: lets the web choose between the start button and the manual commands. */
  @Get()
  @Throttle(RATE_LIMITS.publicRead)
  info(): LabsInfo {
    return this.labs.info();
  }

  @Get(':slug')
  @UseGuards(SessionGuard)
  @Throttle(RATE_LIMITS.labStatus)
  status(@Param('slug') slug: string, @CurrentUser() user: AuthUser): Promise<LabSessionView> {
    return this.labs.status(checkSlug(slug), user.id);
  }

  @Post(':slug/start')
  @UseGuards(SessionGuard)
  @Throttle(RATE_LIMITS.labAction)
  start(
    @Param('slug') slug: string,
    @Body({ schema: startSchema }) body: z.infer<typeof startSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<LabSessionView> {
    return this.labs.start(checkSlug(slug), user.id, body.switch === true);
  }

  @Post(':slug/heartbeat')
  @UseGuards(SessionGuard)
  @Throttle(RATE_LIMITS.labHeartbeat)
  heartbeat(@Param('slug') slug: string, @CurrentUser() user: AuthUser): Promise<{ active: boolean }> {
    return this.labs.heartbeat(checkSlug(slug), user.id);
  }

  @Post(':slug/extend')
  @UseGuards(SessionGuard)
  @Throttle(RATE_LIMITS.labAction)
  extend(@Param('slug') slug: string, @CurrentUser() user: AuthUser): Promise<LabSessionView> {
    return this.labs.extend(checkSlug(slug), user.id);
  }

  @Post(':slug/stop')
  @UseGuards(SessionGuard)
  @Throttle(RATE_LIMITS.labAction)
  stop(@Param('slug') slug: string, @CurrentUser() user: AuthUser): Promise<LabSessionView> {
    return this.labs.stop(checkSlug(slug), user.id);
  }
}
