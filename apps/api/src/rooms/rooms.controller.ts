import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-module-types';
import { SessionGuard } from '../auth/session.guard';
import { RoomsService } from './rooms.service';

const submitAnswerSchema = z.object({
  questionId: z.string().min(3).max(120),
  answer: z.string().min(1).max(500),
});

@Controller('rooms')
@UseGuards(SessionGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** Checks an answer server-side (hash comparison, ADR-011) and awards XP. */
  @Post(':slug/answers')
  submit(
    @Param('slug') slug: string,
    @Body({ schema: submitAnswerSchema }) body: { questionId: string; answer: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.submitAnswer(user.id, slug, body.questionId, body.answer);
  }

  @Get(':slug/progress')
  progress(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.rooms.getProgress(user.id, slug);
  }
}
