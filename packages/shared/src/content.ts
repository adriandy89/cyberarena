/**
 * Core content types v1: Path -> Module -> Room -> Task -> Question.
 * Persistence lands in phase 002 (content engine); these types are the contract.
 */

import type { Difficulty } from './difficulty';
import type { RoomType } from './gamification';

export interface Path {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  /** Audience level of the whole path. */
  readonly level: PathLevel;
  readonly modules: readonly Module[];
}

export type PathLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Module {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly rooms: readonly Room[];
}

export interface Room {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: Difficulty;
  readonly type: RoomType;
  readonly estimatedMinutes: number;
  readonly tags: readonly string[];
  /** Lab slug if the room ships a docker lab (labs/<slug>/compose.yaml), else null. */
  readonly lab: string | null;
  readonly tasks: readonly Task[];
}

export interface Task {
  /** 1-based order within the room. */
  readonly index: number;
  readonly title: string;
  readonly questions: readonly Question[];
}

export type QuestionKind = 'flag' | 'text' | 'choice';

export interface QuestionBase {
  /** Stable id: `<room-slug>-t<NN>-q<NN>`. Changing it breaks recorded progress. */
  readonly id: string;
  readonly prompt: string;
  readonly hint: string | null;
  readonly kind: QuestionKind;
}

export interface FlagQuestion extends QuestionBase {
  readonly kind: 'flag';
}

export interface TextQuestion extends QuestionBase {
  readonly kind: 'text';
}

export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
}

export interface ChoiceQuestion extends QuestionBase {
  readonly kind: 'choice';
  readonly options: readonly ChoiceOption[];
}

export type Question = FlagQuestion | TextQuestion | ChoiceQuestion;

/** Flag format used across the platform: FLAG{snake_case_text}. */
export const FLAG_PATTERN = /^FLAG\{[A-Za-z0-9_]+\}$/;

export function isFlag(value: string): boolean {
  return FLAG_PATTERN.test(value.trim());
}

/** Normalizes any answer: trims edges and collapses inner whitespace. */
export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Server-side answer comparison. Flags compare case-insensitively (lenient,
 * student-friendly); free text compares on normalized exact match.
 */
export function isCorrectAnswer(submitted: string, expected: string, kind: QuestionKind): boolean {
  const a = normalizeAnswer(submitted);
  const b = normalizeAnswer(expected);
  if (a.length === 0) return false;
  if (kind === 'flag') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}
