/**
 * Gamification constants and pure logic shared by web and api.
 * These values are the single source of truth (constitution §3: specs rule,
 * and this module is the executable spec of the gamification rules).
 */

/** XP awarded per correctly answered question, by room type. */
export const XP_PER_QUESTION = {
  walkthrough: 10,
  challenge: 30,
  capstone: 40,
} as const;

export type RoomType = keyof typeof XP_PER_QUESTION;

export const ROOM_TYPES: readonly RoomType[] = ['walkthrough', 'challenge', 'capstone'];

/** XP awarded for completing an entire room (all questions), by room type. */
export const XP_ROOM_COMPLETION_BONUS = {
  walkthrough: 20,
  challenge: 60,
  capstone: 80,
} as const;

export function xpForQuestion(roomType: RoomType): number {
  return XP_PER_QUESTION[roomType];
}

export function xpForRoomCompletion(roomType: RoomType): number {
  return XP_ROOM_COMPLETION_BONUS[roomType];
}

export interface Level {
  readonly index: number;
  /** Display name (stable identifier, translated in the UI). */
  readonly name: string;
  /** Cumulative XP required to reach this level. */
  readonly threshold: number;
}

/**
 * 21 levels with increasing thresholds, inspired by TryHackMe's progression
 * (values adapted for our own XP scale).
 */
export const LEVELS: readonly Level[] = [
  { index: 0, name: 'NEOPHYTE', threshold: 0 },
  { index: 1, name: 'APPRENTICE', threshold: 200 },
  { index: 2, name: 'PATHFINDER', threshold: 500 },
  { index: 3, name: 'SEEKER', threshold: 1000 },
  { index: 4, name: 'VISIONARY', threshold: 1500 },
  { index: 5, name: 'VOYAGER', threshold: 2000 },
  { index: 6, name: 'ADEPT', threshold: 3000 },
  { index: 7, name: 'HACKER', threshold: 4000 },
  { index: 8, name: 'MAGE', threshold: 8000 },
  { index: 9, name: 'WIZARD', threshold: 12000 },
  { index: 10, name: 'MASTER', threshold: 15000 },
  { index: 11, name: 'GURU', threshold: 17000 },
  { index: 12, name: 'LEGEND', threshold: 20000 },
  { index: 13, name: 'GUARDIAN', threshold: 35000 },
  { index: 14, name: 'TITAN', threshold: 50000 },
  { index: 15, name: 'SAGE', threshold: 65000 },
  { index: 16, name: 'VANGUARD', threshold: 80000 },
  { index: 17, name: 'SHOGUN', threshold: 95000 },
  { index: 18, name: 'ASCENDED', threshold: 110000 },
  { index: 19, name: 'MYTHIC', threshold: 130000 },
  { index: 20, name: 'GRANDMASTER', threshold: 150000 },
] as const;

export interface LevelProgress {
  readonly level: Level;
  readonly currentXp: number;
  /** XP missing to reach the next level (0 when at GRANDMASTER). */
  readonly xpToNextLevel: number;
  /** 0..1 progress ratio towards the next level (1 when maxed). */
  readonly progressRatio: number;
}

/** Returns the level and progress for a given total XP (clamped to >= 0). */
export function getLevelForXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  let level: Level = LEVELS[0]!;
  for (const candidate of LEVELS) {
    if (xp >= candidate.threshold) {
      level = candidate;
    } else {
      break;
    }
  }
  const next = LEVELS[level.index + 1];
  if (!next) {
    return { level, currentXp: xp, xpToNextLevel: 0, progressRatio: 1 };
  }
  const span = next.threshold - level.threshold;
  const gained = xp - level.threshold;
  return {
    level,
    currentXp: xp,
    xpToNextLevel: next.threshold - xp,
    progressRatio: Math.min(1, Math.max(0, gained / span)),
  };
}

/** Minimum correctly-answered questions per day to keep the streak alive. */
export const STREAK_MIN_QUESTIONS_PER_DAY = 3;

export function isStreakDay(correctAnswersToday: number): boolean {
  return correctAnswersToday >= STREAK_MIN_QUESTIONS_PER_DAY;
}
