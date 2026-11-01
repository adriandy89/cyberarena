import { STREAK_MIN_QUESTIONS_PER_DAY } from './gamification';

export interface StreakInfo {
  /** Consecutive qualifying days ending today (or yesterday if today is not yet qualified). */
  current: number;
  /** Longest run of qualifying days in the history. */
  best: number;
  /** Correct answers so far today (UTC). */
  solvedToday: number;
  /** Questions per day required to keep the streak alive. */
  required: number;
  /** Whether today already counts. */
  qualifiedToday: boolean;
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(toDay) - Date.parse(fromDay)) / 86_400_000);
}

/**
 * Pure streak computation (ADR-013). `solveDates` are the timestamps (UTC) of every
 * correct answer; a day "counts" when it has >= STREAK_MIN_QUESTIONS_PER_DAY answers.
 * The current streak may end yesterday (today still in progress).
 */
export function computeStreak(solveDates: Date[] | string[], now: Date = new Date()): StreakInfo {
  const perDay = new Map<string, number>();
  for (const value of solveDates) {
    const date = value instanceof Date ? value : new Date(value);
    const key = toUtcDayKey(date);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const qualifies = (day: string) => (perDay.get(day) ?? 0) >= STREAK_MIN_QUESTIONS_PER_DAY;

  const todayKey = toUtcDayKey(now);
  const solvedToday = perDay.get(todayKey) ?? 0;

  // Current streak: walk back from today (or yesterday when today is not yet qualified).
  let current = 0;
  let cursor = new Date(Date.parse(todayKey));
  if (!qualifies(todayKey)) {
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  while (qualifies(toUtcDayKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  // Best streak across the whole history.
  const days = [...perDay.keys()].filter(qualifies).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return {
    current,
    best: Math.max(best, current),
    solvedToday,
    required: STREAK_MIN_QUESTIONS_PER_DAY,
    qualifiedToday: qualifies(todayKey),
  };
}
