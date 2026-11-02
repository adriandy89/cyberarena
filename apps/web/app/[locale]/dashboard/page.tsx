'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { Link, useRouter } from '../../../i18n/navigation';
import { AdminLabsPanel } from '../../../components/admin-labs-panel';
import { DashboardHero } from '../../../components/dashboard-hero';
import { useLevelName } from '../../../components/level-name';
import { GamificationPanels } from '../../../components/gamification-panels';
import { SecurityPanel } from '../../../components/security-panel';
import { Breadcrumbs } from '../../../components/shell/breadcrumbs';
import { PageSkeleton } from '../../../components/skeleton';

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

interface XpSummary {
  totalXp: number;
  solvedCount: number;
  level: {
    index: number;
    name: string;
    threshold: number;
    progressRatio: number;
    xpToNextLevel: number;
  };
}

interface ProgressOverview {
  paths: Array<{
    slug: string;
    title: string;
    level: string;
    roomsCompleted: number;
    roomsTotal: number;
    percent: number;
  }>;
  totals: {
    roomsCompleted: number;
    roomsTotal: number;
    solvedQuestions: number;
    totalQuestions: number;
  };
}

export default function DashboardPage() {
  const t = useTranslations('DashboardPage');
  const nav = useTranslations('Nav');
  const levelName = useLevelName();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [users, setUsers] = useState<UserListItem[] | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [xp, setXp] = useState<XpSummary | null>(null);
  const [overview, setOverview] = useState<ProgressOverview | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      // The i18n router adds the locale prefix itself.
      router.replace('/login?next=/dashboard');
    }
  }, [isPending, session, router]);

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
    void (async () => {
      try {
        const [xpResponse, overviewResponse] = await Promise.all([
          fetch('/api/users/me/xp', { credentials: 'include' }),
          fetch('/api/progress/overview', { credentials: 'include' }),
        ]);
        if (xpResponse.ok) setXp((await xpResponse.json()) as XpSummary);
        if (overviewResponse.ok) setOverview((await overviewResponse.json()) as ProgressOverview);
      } catch {
        // XP card stays hidden on failure
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
    return <PageSkeleton cards={4} />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-6 py-10">
      <Breadcrumbs items={[{ label: nav('dashboard') }]} className="mb-4" />
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      <div className="animate-fade-in mt-6">
        <DashboardHero
          name={me?.name ?? session.user.name}
          paths={overview?.paths ?? null}
          solvedCount={overview?.totals.solvedQuestions ?? 0}
        />
      </div>

      {xp && (
        <section className="animate-fade-in mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t('xpCard')}
            </h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
              {levelName(xp.level.name)} · {xp.totalXp} XP
            </span>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
              style={{ width: `${Math.round(xp.level.progressRatio * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('xpToNext', { xp: xp.level.xpToNextLevel })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t('solvedCount', { count: xp.solvedCount })}
          </p>
        </section>
      )}

      {overview && overview.paths.length > 0 && (
        <section className="animate-fade-in mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('pathsProgress')}
          </h2>
          <ul className="mt-4 space-y-4">
            {overview.paths.map((path) => (
              <li key={path.slug}>
                <Link
                  href={`/paths/${path.slug}`}
                  className="group -mx-2 block rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-200 group-hover:text-emerald-300">
                      {path.title}
                    </span>
                    <span className="text-xs text-slate-400">
                      {path.roomsCompleted}/{path.roomsTotal} {t('roomsDone')} · {path.percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`progress-smooth h-full rounded-full ${path.percent === 100 ? 'bg-emerald-400' : 'bg-emerald-500/70'}`}
                      style={{ width: `${path.percent}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GamificationPanels />

      <section className="animate-fade-in mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
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
            <dd className="font-medium">{me ? (me.emailVerified ? t('yes') : t('no')) : '—'}</dd>
          </div>
        </dl>
      </section>

      <SecurityPanel />

      {me?.role === 'ADMIN' && (
        <section className="animate-fade-in mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
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

      {me?.role === 'ADMIN' && <AdminLabsPanel />}
    </div>
  );
}
