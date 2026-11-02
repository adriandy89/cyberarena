import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-module-types';
import { SessionGuard } from '../auth/session.guard';
import { RATE_LIMITS } from '../http/rate-limits';
import { LabsService } from '../labs/labs.service';
import { RoomsService } from './rooms.service';

const submitAnswerSchema = z.object({
  questionId: z.string().min(3).max(120),
  answer: z.string().min(1).max(500),
});

@Controller('rooms')
@UseGuards(SessionGuard)
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly labs: LabsService,
  ) {}

  /** Checks an answer server-side (hash comparison, ADR-011) and awards XP. */
  @Throttle(RATE_LIMITS.answers)
  @Post(':slug/answers')
  submit(
    @Param('slug') slug: string,
    @Body({ schema: submitAnswerSchema }) body: { questionId: string; answer: string },
    @CurrentUser() user: AuthUser,
  ) {
    // Working on the room counts as using its lab (phase 011): best effort.
    void this.labs.touchForRoom(user.id, slug).catch(() => undefined);
    return this.rooms.submitAnswer(user.id, slug, body.questionId, body.answer);
  }

  @Get(':slug/progress')
  progress(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.rooms.getProgress(user.id, slug);
  }
}
