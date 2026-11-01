import { isFlag } from '@repo/shared';
import type { Catalog, CompiledRoom } from './schemas';

export interface ValidationIssue {
  source: string;
  message: string;
}

/** All cross-references and answer coverage rules (pure, unit tested). */
export function validateCatalog(catalog: Catalog, answers: Record<string, string>): ValidationIssue[] {
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
          issues.push({ source: `module:${module.slug}`, message: `duplicate room '${room.slug}'` });
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
      issues.push({ source: 'answers', message: `orphan answer for unknown question '${questionId}'` });
    }
  }
  for (const room of roomBySlug.values()) {
    for (const task of room.tasks) {
      for (const question of task.questions) {
        if (question.kind === 'flag' && !isFlag(answers[question.id] ?? '')) {
          issues.push({
            source: `answers:${question.id}`,
            message: `flag answer must match FLAG{...}, got '${answers[question.id]}'`,
          });
        }
      }
    }
  }

  return issues;
}
