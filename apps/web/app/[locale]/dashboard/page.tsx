'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { useRouter } from '../../../i18n/navigation';

type Role = 'STUDENT' | 'ADMIN';

interface MeResponse {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
}

interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const t = useTranslations('DashboardPage');
  const router = useRouter();
  const locale = useLocale();
  const { data: session, isPending } = authClient.useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [users, setUsers] = useState<UserListItem[] | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.replace(`/${locale}/login`);
    }
  }, [isPending, session, router, locale]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { users: UserListItem[] };
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    }
  }, []);

  // Intentional fetch-on-mount client widgets; a data layer lands in 003+.
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/users/me', { credentials: 'include' });
        if (response.ok) {
          setMe((await response.json()) as MeResponse);
        }
      } catch {
        // Profile is a nice-to-have here; the session already proves we are in.
      }
    })();
  }, []);

  useEffect(() => {
    if (me?.role === 'ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadUsers();
    }
  }, [me, loadUsers]);

  async function changeRole(targetId: string, role: Role) {
    setRoleError(null);
    try {
      const response = await fetch(`/api/users/${targetId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setRoleError(body?.message ?? t('roleChangeFailed'));
        return;
      }
      await loadUsers();
    } catch {
      setRoleError(t('roleChangeFailed'));
    }
  }

  if (isPending || !session) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">…</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {t('profile')}
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{t('name')}</dt>
            <dd className="font-medium">{me?.name ?? session.user.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('email')}</dt>
            <dd className="font-medium">{me?.email ?? session.user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('role')}</dt>
            <dd>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                {me?.role ?? 'STUDENT'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('emailVerified')}</dt>
            <dd className="font-medium">
              {me ? (me.emailVerified ? t('yes') : t('no')) : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {me?.role === 'ADMIN' && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('adminUsers')}
          </h2>
          {roleError && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-400">
              {roleError}
            </p>
          )}
          <ul className="mt-3 divide-y divide-slate-800">
            {(users ?? []).map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.role}
                    disabled={user.id === me.id}
                    onChange={(event) => void changeRole(user.id, event.target.value as Role)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs disabled:opacity-40"
                    aria-label={t('role')}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  {user.id === me.id && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-600">
                      {t('you')}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {users !== null && users.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">{t('noUsers')}</p>
          )}
        </section>
      )}
    </div>
  );
}
