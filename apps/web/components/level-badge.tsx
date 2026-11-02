import { cn } from '@repo/ui';
import { useTranslations } from 'next-intl';

export type PathLevel = 'beginner' | 'intermediate' | 'advanced';

const LEVEL_CLASSES: Record<PathLevel, string> = {
  beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  intermediate: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  advanced: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function isLevel(value: string): value is PathLevel {
  return value in LEVEL_CLASSES;
}

/** Path level pill (Iniciación / Intermedio / Avanzado). */
export function LevelBadge({ level, className }: { level: string; className?: string }) {
  const t = useTranslations('PathsPage.levels');
  const safe: PathLevel = isLevel(level) ? level : 'beginner';
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        LEVEL_CLASSES[safe],
        className,
      )}
    >
      {t(safe)}
    </span>
  );
}
