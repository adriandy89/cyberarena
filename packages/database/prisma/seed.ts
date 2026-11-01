/**
 * Seed: syncs the compiled content catalog (packages/content/dist) into the
 * database. Idempotent — upserts by stable slugs/ids; catalog rows missing
 * from the sources are removed (progress tables in later phases reference
 * these ids, so ids must never be renamed casually).
 *
 * Answers are hashed (see src/answers.ts) and NEVER stored in clear.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: '.env', quiet: true });
config({ path: '../../.env', quiet: true });

import { createPrismaClient } from '../src/client.js';
import { hashAnswer } from '../src/answers.js';

interface SeedQuestion {
  id: string;
  prompt: string;
  hint: string | null;
  kind: 'flag' | 'text' | 'choice';
  options?: Array<{ id: string; label: string }> | null;
}

interface SeedTask {
  index: number;
  title: string;
  body: string;
  questions: SeedQuestion[];
}

interface SeedRoom {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  estimatedMinutes: number;
  tags: string[];
  lab: string | null;
  labUrl?: string | null;
  tasks: SeedTask[];
}

interface SeedModule {
  slug: string;
  title: string;
  description: string;
  rooms: SeedRoom[];
}

interface SeedPath {
  slug: string;
  title: string;
  description: string;
  level: string;
  modules: SeedModule[];
}

interface CatalogFile {
  paths: SeedPath[];
}

const CONTENT_DIST = path.resolve(import.meta.dirname, '../../content/dist');

async function main(): Promise<void> {
  const catalog = JSON.parse(
    await readFile(path.join(CONTENT_DIST, 'catalog.json'), 'utf8'),
  ) as CatalogFile;
  const answers = JSON.parse(
    await readFile(path.join(CONTENT_DIST, 'answers.json'), 'utf8'),
  ) as Record<string, string>;

  const prisma = createPrismaClient();
  const stats = { paths: 0, modules: 0, rooms: 0, tasks: 0, questions: 0, deleted: 0 };

  try {
    const validPathSlugs = new Set<string>();
    const validModuleSlugs = new Set<string>();
    const validRoomSlugs = new Set<string>();
    const validTaskIds = new Set<string>();
    const validQuestionIds = new Set<string>();

    for (const [pathOrder, seedPath] of catalog.paths.entries()) {
      validPathSlugs.add(seedPath.slug);
      await prisma.catalogPath.upsert({
        where: { slug: seedPath.slug },
        create: {
          slug: seedPath.slug,
          title: seedPath.title,
          description: seedPath.description,
          level: seedPath.level,
          order: pathOrder,
        },
        update: {
          title: seedPath.title,
          description: seedPath.description,
          level: seedPath.level,
          order: pathOrder,
        },
      });
      stats.paths++;

      for (const [moduleOrder, seedModule] of seedPath.modules.entries()) {
        validModuleSlugs.add(seedModule.slug);
        const moduleData = {
          slug: seedModule.slug,
          title: seedModule.title,
          description: seedModule.description,
          order: moduleOrder,
        };
        const existingModule = await prisma.catalogModule.findUnique({ where: { slug: seedModule.slug } });
        const catalogModule = existingModule
          ? await prisma.catalogModule.update({ where: { id: existingModule.id }, data: moduleData })
          : await prisma.catalogModule.create({
              data: { ...moduleData, catalogPath: { connect: { slug: seedPath.slug } } },
            });
        stats.modules++;

        for (const [roomOrder, seedRoom] of seedModule.rooms.entries()) {
          validRoomSlugs.add(seedRoom.slug);
          const roomData = {
            slug: seedRoom.slug,
            title: seedRoom.title,
            description: seedRoom.description,
            difficulty: seedRoom.difficulty,
            type: seedRoom.type,
            estimatedMinutes: seedRoom.estimatedMinutes,
            tags: seedRoom.tags,
            lab: seedRoom.lab,
            labUrl: seedRoom.labUrl ?? null,
            order: roomOrder,
          };
          const existingRoom = await prisma.room.findUnique({ where: { slug: seedRoom.slug } });
          const room = existingRoom
            ? await prisma.room.update({ where: { id: existingRoom.id }, data: roomData })
            : await prisma.room.create({
                data: { ...roomData, catalogModule: { connect: { id: catalogModule.id } } },
              });
          stats.rooms++;

          for (const seedTask of seedRoom.tasks) {
            const taskId = `${seedRoom.slug}-t${String(seedTask.index).padStart(2, '0')}`;
            validTaskIds.add(taskId);
            await prisma.task.upsert({
              where: { id: taskId },
              create: {
                id: taskId,
                roomId: room.id,
                index: seedTask.index,
                title: seedTask.title,
                body: seedTask.body,
              },
              update: { index: seedTask.index, title: seedTask.title, body: seedTask.body },
            });
            stats.tasks++;

            for (const [questionIndex, question] of seedTask.questions.entries()) {
              validQuestionIds.add(question.id);
              await prisma.question.upsert({
                where: { id: question.id },
                create: {
                  id: question.id,
                  taskId,
                  prompt: question.prompt,
                  hint: question.hint,
                  kind: question.kind,
                  options: question.options ?? undefined,
                  index: questionIndex,
                },
                update: {
                  prompt: question.prompt,
                  hint: question.hint,
                  kind: question.kind,
                  options: question.options ?? undefined,
                  index: questionIndex,
                },
              });
              await prisma.answer.upsert({
                where: { questionId: question.id },
                create: {
                  questionId: question.id,
                  answerHash: hashAnswer(answers[question.id] ?? ''),
                  kind: question.kind,
                },
                update: { answerHash: hashAnswer(answers[question.id] ?? ''), kind: question.kind },
              });
              stats.questions++;
            }
          }
        }
      }
    }

    // Remove catalog rows that no longer exist in the sources (cascades clean
    // tasks/questions/answers).
    const deletion = await prisma.catalogPath.deleteMany({
      where: { slug: { notIn: [...validPathSlugs] } },
    });
    if (deletion.count > 0) stats.deleted += deletion.count;
    const deletedModules = await prisma.catalogModule.deleteMany({
      where: { slug: { notIn: [...validModuleSlugs] } },
    });
    if (deletedModules.count > 0) stats.deleted += deletedModules.count;
    const deletedRooms = await prisma.room.deleteMany({
      where: { slug: { notIn: [...validRoomSlugs] } },
    });
    if (deletedRooms.count > 0) stats.deleted += deletedRooms.count;
    const deletedTasks = await prisma.task.deleteMany({
      where: { id: { notIn: [...validTaskIds] } },
    });
    if (deletedTasks.count > 0) stats.deleted += deletedTasks.count;
    const deletedQuestions = await prisma.question.deleteMany({
      where: { id: { notIn: [...validQuestionIds] } },
    });
    if (deletedQuestions.count > 0) stats.deleted += deletedQuestions.count;

    console.log(
      `[seed] catalog synced: ${stats.paths} paths, ${stats.modules} modules, ` +
        `${stats.rooms} rooms, ${stats.tasks} tasks, ${stats.questions} questions ` +
        `(answers hashed; ${stats.deleted} stale rows removed)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
