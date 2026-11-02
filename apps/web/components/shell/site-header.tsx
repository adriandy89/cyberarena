import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/navigation';
import { Byte } from '../byte/byte';
import { LanguageSwitcher } from '../language-switcher';
import { UserMenu } from '../user-menu';
import { MobileNav } from './mobile-nav';
import { NAV_ITEMS } from './nav-items';
import { NavLink } from './nav-link';

/** Sticky header shared by every page (spec 010 §3.1). */
export async function SiteHeader() {
  const t = await getTranslations('Nav');
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-1.5 rounded-lg"
          aria-label={t('home')}
        >
          <Byte size="xs" className="-my-2 transition-transform group-hover:-rotate-6" />
          <span className="text-lg font-bold tracking-tight">
            Cyber<span className="text-emerald-400">Arena</span>
          </span>
        </Link>

        <nav aria-label={t('main')} className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ href, labelKey, icon: Icon, also }) => (
            <NavLink
              key={href}
              href={href}
              also={also}
              icon={<Icon size={15} aria-hidden="true" />}
            >
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <UserMenu />
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
