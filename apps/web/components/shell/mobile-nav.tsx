'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { usePathname } from '../../i18n/navigation';
import { Activity, House, LayoutDashboard, Menu, X } from '../icon';
import { LanguageSwitcher } from '../language-switcher';
import { NAV_ITEMS } from './nav-items';
import { NavLink } from './nav-link';

const DRAWER_ACTIVE = 'bg-emerald-500/10 text-emerald-200';

/**
 * Mobile drawer built on the native <dialog>: showModal() gives focus
 * trapping, Escape to close and inert background for free.
 */
export function MobileNav() {
  const t = useTranslations('Nav');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Close after navigating (the drawer stays mounted across pages).
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={t('menuOpen')}
        aria-haspopup="dialog"
        className="rounded-lg border border-slate-800 p-2 text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-50 md:hidden"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-label={t('menu')}
        onClick={(event) => {
          // A click on the backdrop targets the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        className="m-0 ml-auto h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-transparent p-0 text-slate-100 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex h-full animate-slide-right flex-col gap-6 border-l border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">{t('menu')}</span>
            <button
              type="button"
              onClick={close}
              aria-label={t('menuClose')}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label={t('main')} className="flex flex-col gap-1">
            <NavLink
              href="/"
              icon={<House size={16} aria-hidden="true" />}
              onNavigate={close}
              activeClassName={DRAWER_ACTIVE}
            >
              {t('home')}
            </NavLink>
            {NAV_ITEMS.map(({ href, labelKey, icon: Icon, also }) => (
              <NavLink
                key={href}
                href={href}
                also={also}
                icon={<Icon size={16} aria-hidden="true" />}
                onNavigate={close}
                activeClassName={DRAWER_ACTIVE}
              >
                {t(labelKey)}
              </NavLink>
            ))}
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard size={16} aria-hidden="true" />}
              onNavigate={close}
              activeClassName={DRAWER_ACTIVE}
            >
              {t('dashboard')}
            </NavLink>
            <NavLink
              href="/status"
              icon={<Activity size={16} aria-hidden="true" />}
              onNavigate={close}
              activeClassName={DRAWER_ACTIVE}
            >
              {t('status')}
            </NavLink>
          </nav>

          <div className="mt-auto flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-500">{t('language')}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </dialog>
    </>
  );
}
