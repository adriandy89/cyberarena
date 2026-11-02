import { cn } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { Byte } from './byte/byte';

/** Shimmering placeholder block (uses the `skeleton` utility from globals.css). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} />;
}

/** Byte scanning + an accessible "loading" status, for route-level loading UIs. */
export function LoadingByte({ className }: { className?: string }) {
  const t = useTranslations('States');
  return (
    <div role="status" className={cn('flex items-center gap-3 text-sm text-slate-500', className)}>
      <Byte mood="scan" size="sm" />
      <span>{t('loading')}</span>
    </div>
  );
}

/** Generic page skeleton: breadcrumb, title, subtitle and a few cards. */
export function PageSkeleton({
  cards = 3,
  maxWidth = 'max-w-3xl',
}: {
  cards?: number;
  maxWidth?: string;
}) {
  return (
    <div className={cn('mx-auto flex flex-col px-6 py-10', maxWidth)}>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-6 h-7 w-2/3" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <LoadingByte className="mt-8" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
