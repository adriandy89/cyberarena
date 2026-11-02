import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/navigation';
import { ByteToggle } from './byte-toggle';
import { NAV_ITEMS } from './nav-items';

/** Footer shared by every page; "system status" lives here, not in the main nav. */
export async function SiteFooter() {
  const t = await getTranslations('Nav');
  return (
    <footer className="mt-16 border-t border-slate-800/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-xs text-slate-500 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-bold tracking-tight text-slate-300">
            Cyber<span className="text-emerald-400">Arena</span>
          </p>
          <p>{t('footerNote')}</p>
          <p>{t('disclaimer')}</p>
        </div>
        <nav aria-label={t('footer')} className="flex flex-wrap gap-x-5 gap-y-2">
          {NAV_ITEMS.map(({ href, labelKey }) => (
            <Link key={href} href={href} className="transition-colors hover:text-slate-200">
              {t(labelKey)}
            </Link>
          ))}
          <Link href="/dashboard" className="transition-colors hover:text-slate-200">
            {t('dashboard')}
          </Link>
          <Link href="/status" className="transition-colors hover:text-slate-200">
            {t('status')}
          </Link>
        </nav>
        <ByteToggle />
      </div>
    </footer>
  );
}
