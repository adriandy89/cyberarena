import { Injectable, NotFoundException } from '@nestjs/common';
import { hashAnswer } from '@repo/database';
import { xpForQuestion, xpForRoomCompletion, type RoomType } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface SubmitAnswerResult {
  correct: boolean;
  alreadySolved: boolean;
  xpAwarded: number;
  roomCompleted: boolean;
}

export interface RoomProgress {
  solvedQuestionIds: string[];
  roomCompleted: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Answer checking, progress and XP awarding (ADR-011).
 * Idempotency: QuestionSolved has a composite PK and XpEvent a unique
 * [userId, reason] — concurrent duplicates collapse into the "already" path.
 */
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitAnswer(
    userId: string,
    roomSlug: string,
    questionId: string,
    submittedAnswer: string,
  ): Promise<SubmitAnswerResult> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        task: {
          select: { room: { select: { slug: true, type: true } } },
        },
        // one Answer row per question (questionId is its PK)
        answers: { select: { answerHash: true } },
      },
    });
    if (!question || question.task.room.slug !== roomSlug) {
      throw new NotFoundException('question not found in this room');
    }
    const answerHash = question.answers[0]?.answerHash;
    if (!answerHash) {
      throw new NotFoundException('answer missing for question (re-run pnpm db:seed)');
    }

    const correct = hashAnswer(submittedAnswer) === answerHash;
    if (!correct) {
      return { correct: false, alreadySolved: false, xpAwarded: 0, roomCompleted: false };
    }

    const alreadySolved = await this.prisma.questionSolved.findUnique({
      where: { userId_questionId: { userId, questionId } },
      select: { questionId: true },
    });
    if (alreadySolved) {
      return {
        correct: true,
        alreadySolved: true,
        xpAwarded: 0,
        roomCompleted: await this.isRoomCompleted(userId, roomSlug),
      };
    }

    try {
      await this.prisma.questionSolved.create({ data: { userId, questionId } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          correct: true,
          alreadySolved: true,
          xpAwarded: 0,
          roomCompleted: await this.isRoomCompleted(userId, roomSlug),
        };
      }
      throw error;
    }

    const roomType = question.task.room.type as RoomType;
    let xpAwarded = 0;
    try {
      const amount = xpForQuestion(roomType);
      await this.prisma.xpEvent.create({
        data: { userId, amount, reason: `question:${questionId}` },
      });
      xpAwarded += amount;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    let roomCompleted = false;
    if (await this.isRoomCompleted(userId, roomSlug)) {
      roomCompleted = true;
      try {
        const bonus = xpForRoomCompletion(roomType);
        await this.prisma.xpEvent.create({
          data: { userId, amount: bonus, reason: `room-complete:${roomSlug}` },
        });
        xpAwarded += bonus;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    return { correct: true, alreadySolved: false, xpAwarded, roomCompleted };
  }

  async getProgress(userId: string, roomSlug: string): Promise<RoomProgress> {
    const questionIds = await this.roomQuestionIds(roomSlug);
    const solved = await this.prisma.questionSolved.findMany({
      where: { userId, questionId: { in: questionIds } },
      select: { questionId: true },
    });
    return {
      solvedQuestionIds: solved.map((row) => row.questionId),
      roomCompleted: questionIds.length > 0 && solved.length === questionIds.length,
    };
  }

  async isRoomCompleted(userId: string, roomSlug: string): Promise<boolean> {
    const questionIds = await this.roomQuestionIds(roomSlug);
    if (questionIds.length === 0) {
      return false;
    }
    const solved = await this.prisma.questionSolved.count({
      where: { userId, questionId: { in: questionIds } },
    });
    return solved === questionIds.length;
  }

  private async roomQuestionIds(roomSlug: string): Promise<string[]> {
    const room = await this.prisma.room.findUnique({
      where: { slug: roomSlug },
      select: { tasks: { select: { questions: { select: { id: true } } } } },
    });
    if (!room) {
      throw new NotFoundException('room not found');
    }
    return room.tasks.flatMap((task) => task.questions.map((question) => question.id));
  }
}
