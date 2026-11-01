import { createHash } from 'node:crypto';
import { normalizeAnswer } from '@repo/shared';

/**
 * Canonical answer hashing for storage (phase 002).
 * Same comparison rule as @repo/shared isCorrectAnswer: normalized
 * (trim + collapse whitespace) and case-insensitive.
 */
export function hashAnswer(answer: string): string {
  return createHash('sha256').update(normalizeAnswer(answer).toLowerCase()).digest('hex');
}
