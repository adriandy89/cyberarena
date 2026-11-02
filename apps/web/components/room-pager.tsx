import { useTranslations } from 'next-intl';
import { Link } from '../i18n/navigation';
import { ArrowLeft, ArrowRight, Route } from './icon';

export interface RoomLink {
  slug: string;
  title: string;
  difficulty: string;
}

export interface RoomContext {
  path: { slug: string; title: string; level: string };
  module: { slug: string; title: string; index: number; total: number };
  position: { index: number; total: number };
  prev: RoomLink | null;
  next: RoomLink | null;
  nextPath: { slug: string; title: string } | null;
}

const CARD =
  'card-hover group flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-emerald-500/40';

/** Previous / next room navigation across the whole path (spec 010 T012). */
export function RoomPager({ context }: { context: RoomContext }) {
  const t = useTranslations('RoomPage');
  const { prev, next, nextPath, path } = context;

  return (
    <nav aria-label={t('pagerLabel')} className="flex flex-col gap-3 sm:flex-row">
      {prev ? (
        <Link href={`/rooms/${prev.slug}`} className={CARD} rel="prev">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <ArrowLeft
              size={13}
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
            />
            {t('prevRoom')}
          </span>
          <span className="truncate text-sm font-medium text-slate-200">{prev.title}</span>
        </Link>
      ) : (
        <Link href={`/paths/${path.slug}`} className={CARD}>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Route size={13} aria-hidden="true" />
            {t('backToPath')}
          </span>
          <span className="truncate text-sm font-medium text-slate-200">{path.title}</span>
        </Link>
      )}

      {next ? (
        <Link
          href={`/rooms/${next.slug}`}
          className={`${CARD} sm:items-end sm:text-right`}
          rel="next"
        >
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            {t('nextRoom')}
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
          <span className="max-w-full truncate text-sm font-medium text-slate-200">
            {next.title}
          </span>
        </Link>
      ) : nextPath ? (
        <Link href={`/paths/${nextPath.slug}`} className={`${CARD} sm:items-end sm:text-right`}>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            {t('nextPath')}
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
          <span className="max-w-full truncate text-sm font-medium text-slate-200">
            {nextPath.title}
          </span>
        </Link>
      ) : (
        <Link href={`/paths/${path.slug}`} className={`${CARD} sm:items-end sm:text-right`}>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            {t('backToPath')}
            <Route size={13} aria-hidden="true" />
          </span>
          <span className="max-w-full truncate text-sm font-medium text-slate-200">
            {path.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
