'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { authClient } from '../lib/auth-client';
import { Link, useRouter } from '../i18n/navigation';

export function UserMenu() {
  const t = useTranslations('UserMenu');
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [isPendingAction, startTransition] = useTransition();

  if (isPending) {
    return <span className="text-xs text-slate-500">…</span>;
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm font-semibold transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
      >
        {t('signIn')}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/dashboard"
        className="hidden text-sm text-slate-300 transition-colors hover:text-slate-100 sm:block"
      >
        <span className="font-medium">{session.user.name}</span>
        <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          {String(session.user.role ?? 'STUDENT')}
        </span>
      </Link>
      <button
        type="button"
        disabled={isPendingAction}
        onClick={() =>
          startTransition(async () => {
            await authClient.signOut();
            // useRouter from i18n/navigation already prefixes the locale.
            router.replace('/');
            router.refresh();
          })
        }
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
      >
        {t('signOut')}
      </button>
    </div>
  );
}
