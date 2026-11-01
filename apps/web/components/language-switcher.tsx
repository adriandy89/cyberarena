'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '../i18n/navigation';
import { routing } from '../i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/80 p-1"
      aria-busy={isPending}
    >
      {routing.locales.map((availableLocale) => (
        <button
          key={availableLocale}
          type="button"
          disabled={isPending}
          aria-pressed={locale === availableLocale}
          onClick={() =>
            startTransition(() => {
              router.replace(pathname, { locale: availableLocale });
            })
          }
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
            locale === availableLocale
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {availableLocale}
        </button>
      ))}
    </div>
  );
}
