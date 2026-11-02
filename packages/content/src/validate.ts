import { DIFFICULTY_IDS, isFlag, type Difficulty } from '@repo/shared';
import type { Catalog, CompiledRoom } from './schemas';

export interface ValidationIssue {
  source: string;
  message: string;
}

/**
 * All cross-references and answer coverage rules (pure, unit tested).
 * `labSlugs` (the folders with a labs/<slug>/compose.yaml) enables the check
 * that every room `lab` exists (phase 011).
 */
export function validateCatalog(
  catalog: Catalog,
  answers: Record<string, string[]>,
  labSlugs?: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roomBySlug = new Map<string, CompiledRoom>();
  const questionIds = new Set<string>();

  for (const path of catalog.paths) {
    const moduleSlugs = new Set<string>();
    for (const module of path.modules) {
      if (moduleSlugs.has(module.slug)) {
        issues.push({ source: `path:${path.slug}`, message: `duplicate module '${module.slug}'` });
      }
      moduleSlugs.add(module.slug);
      const roomSlugs = new Set<string>();
      for (const room of module.rooms) {
        if (roomSlugs.has(room.slug)) {
          issues.push({
            source: `module:${module.slug}`,
            message: `duplicate room '${room.slug}'`,
          });
        }
        roomSlugs.add(room.slug);
        if (roomBySlug.has(room.slug)) {
          issues.push({
            source: `room:${room.slug}`,
            message: 'room appears in more than one module',
          });
        }
        roomBySlug.set(room.slug, room);
        if (room.labUrl && !room.lab) {
          issues.push({
            source: `room:${room.slug}`,
            message: 'labUrl is set but lab is null (labUrl requires a lab slug)',
          });
        }
        if (room.lab && labSlugs && !labSlugs.has(room.lab)) {
          issues.push({
            source: `room:${room.slug}`,
            message: `lab '${room.lab}' does not exist (expected labs/${room.lab}/compose.yaml)`,
          });
        }
        room.tasks.forEach((task, taskIndex) => {
          if (task.index !== taskIndex + 1) {
            issues.push({
              source: `room:${room.slug}`,
              message: `task file order does not match index (expected ${taskIndex + 1}, got ${task.index})`,
            });
          }
          for (const question of task.questions) {
            if (questionIds.has(question.id)) {
              issues.push({ source: `question:${question.id}`, message: 'duplicate question id' });
            }
            questionIds.add(question.id);
            const expectedPrefix = `${room.slug}-t`;
            if (!question.id.startsWith(expectedPrefix)) {
              issues.push({
                source: `question:${question.id}`,
                message: `id must start with '${expectedPrefix}' (room slug + task)`,
              });
            }
          }
        });
      }
    }
  }

  // Answers: every question needs one, no orphans, flags must be well formed.
  for (const questionId of questionIds) {
    const answer = answers[questionId];
    if (answer === undefined) {
      issues.push({ source: `answers`, message: `missing answer for '${questionId}'` });
    }
  }
  for (const [questionId] of Object.entries(answers)) {
    if (!questionIds.has(questionId)) {
      issues.push({
        source: 'answers',
        message: `orphan answer for unknown question '${questionId}'`,
      });
    }
  }
  for (const room of roomBySlug.values()) {
    for (const task of room.tasks) {
      for (const question of task.questions) {
        const accepted = answers[question.id] ?? [];
        if (question.kind === 'flag') {
          for (const value of accepted.filter((candidate) => !isFlag(candidate))) {
            issues.push({
              source: `answers:${question.id}`,
              message: `flag answer must match FLAG{...}, got '${value}'`,
            });
          }
        }
        if (question.kind === 'choice') {
          const optionIds = new Set(question.options.map((option) => option.id));
          for (const value of accepted.filter((candidate) => !optionIds.has(candidate))) {
            issues.push({
              source: `answers:${question.id}`,
              message: `choice answer '${value}' is not one of its options (${[...optionIds].join(', ')})`,
            });
          }
        }
      }
    }
  }

  return issues;
}

/** Commands and technical literals: these legitimately run to several words. */
const LITERAL_HINT = /[-/|.=$:'"<>{}[\]()_*\\]|\d/;

/**
 * Non-blocking answer checks (spec 107): a text answer that is a natural-
 * language phrase of 4+ words is nearly impossible to type exactly; ask it as
 * a choice question or accept a short term with alternatives instead.
 */
export function answerWarnings(catalog: Catalog, answers: Record<string, string[]>): string[] {
  const warnings: string[] = [];
  for (const path of catalog.paths) {
    for (const module of path.modules) {
      for (const room of module.rooms) {
        for (const task of room.tasks) {
          for (const question of task.questions) {
            if (question.kind !== 'text') continue;
            const canonical = answers[question.id]?.[0] ?? '';
            const words = canonical.trim().split(/\s+/).length;
            if (words >= 4 && !LITERAL_HINT.test(canonical)) {
              warnings.push(
                `answers:${question.id}: phrase answer (${words} words) '${canonical}'`,
              );
            }
          }
        }
      }
    }
  }
  return warnings;
}

/**
 * Non-blocking ordering checks (spec 010 T025), printed as build warnings:
 * - a room easier than the previous one in the same module ("info" theory
 *   rooms are ignored: they are not a difficulty step);
 * - a task linking to `/rooms/<slug>` that only comes later in the roadmap.
 */
export function orderWarnings(catalog: Catalog): string[] {
  const warnings: string[] = [];
  const position = new Map<string, number>();
  const flat = catalog.paths.flatMap((path) => path.modules.flatMap((module) => module.rooms));
  flat.forEach((room, index) => position.set(room.slug, index));

  const rank = (difficulty: string) => DIFFICULTY_IDS.indexOf(difficulty as Difficulty);
  for (const path of catalog.paths) {
    for (const module of path.modules) {
      let previous: CompiledRoom | null = null;
      for (const room of module.rooms) {
        if (room.difficulty === 'info') continue;
        if (previous && rank(room.difficulty) < rank(previous.difficulty)) {
          warnings.push(
            `module:${module.slug}: '${room.slug}' (${room.difficulty}) comes after '${previous.slug}' (${previous.difficulty})`,
          );
        }
        previous = room;
      }
    }
  }

  for (const room of flat) {
    const here = position.get(room.slug)!;
    for (const task of room.tasks) {
      for (const match of task.body.matchAll(/\/rooms\/([a-z0-9-]+)/g)) {
        const target = match[1]!;
        const there = position.get(target);
        if (there !== undefined && there > here) {
          warnings.push(`room:${room.slug}: task ${task.index} links forward to '${target}'`);
        }
      }
    }
  }
  return warnings;
}
