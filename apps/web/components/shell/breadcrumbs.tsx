import { useTranslations } from 'next-intl';
import { Link } from '../../i18n/navigation';
import { ChevronRight, House } from '../icon';

export interface Crumb {
  label: string;
  /** Omit for the current page (last crumb). */
  href?: string;
}

/**
 * "Home › … › Current" trail (spec 010 §3.3). Works in Server and Client
 * Components; Home is always prepended.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const t = useTranslations('Nav');
  return (
    <nav aria-label={t('breadcrumbs')} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <li>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-slate-200"
          >
            <House size={13} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t('home')}</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
              <ChevronRight size={13} aria-hidden="true" className="shrink-0 text-slate-700" />
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate rounded px-1 py-0.5 transition-colors hover:text-slate-200"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="truncate px-1 py-0.5 text-slate-300"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
