/** Difficulty scale for rooms (TryHackMe-style). Ordered from easiest to hardest. */

export interface DifficultyMeta {
  readonly id: Difficulty;
  /** Stable label (not translated — used as key in the UI). */
  readonly label: string;
  /** Tailwind color tokens used by DifficultyBadge (packages/ui). */
  readonly color: string;
}

export const DIFFICULTIES = [
  { id: 'info', label: 'Info', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  { id: 'easy', label: 'Easy', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'medium', label: 'Medium', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'hard', label: 'Hard', color: 'bg-orange-600/15 text-orange-500 border-orange-600/30' },
  { id: 'insane', label: 'Insane', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
] as const satisfies readonly { readonly id: Difficulty; readonly label: string; readonly color: string }[];

export type Difficulty = 'info' | 'easy' | 'medium' | 'hard' | 'insane';

export const DIFFICULTY_IDS: readonly Difficulty[] = DIFFICULTIES.map((d) => d.id);

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTY_IDS as readonly string[]).includes(value);
}

export function difficultyMeta(difficulty: Difficulty): DifficultyMeta {
  return DIFFICULTIES.find((d) => d.id === difficulty)!;
}
