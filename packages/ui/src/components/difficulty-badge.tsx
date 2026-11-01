import { difficultyMeta, type Difficulty } from '@repo/shared';
import { cn } from '../utils/cn';

export interface DifficultyBadgeProps {
  difficulty: Difficulty;
  className?: string;
}

/** Small colored pill showing a room difficulty (Info/Easy/Medium/Hard/Insane). */
export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const meta = difficultyMeta(difficulty);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        meta.color,
        className,
      )}
      data-difficulty={difficulty}
    >
      {meta.label}
    </span>
  );
}
