'use client';

import type { AdminLabsOverview } from '@repo/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '../i18n/navigation';
import { FlaskConical, Power, RotateCcw, Square } from './icon';

const REFRESH_MS = 30_000;

/**
 * Admin view of labs on demand (phase 011): runner and sweep health, labs in
 * use with who holds them, the audit trail, and stop / stop-all switches.
 */
export function AdminLabsPanel() {
  const t = useTranslations('AdminLabs');
  const locale = useLocale();
  const [data, setData] = useState<AdminLabsOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/labs', { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      setData((await response.json()) as AdminLabsOverview);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // Admin widget: fetch on mount and every 30 s (same pattern as the users list).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function post(path: string, key: string) {
    setBusy(key);
    try {
      await fetch(path, { method: 'POST', credentials: 'include' });
    } finally {
      setBusy(null);
      setConfirmAll(false);
      await load();
    }
  }

  const health = data?.health;
  return (
    <section className="animate-fade-in mt-6 rounded-xl border border-violet-500/30 bg-violet-500/5 p-5" data-testid="admin-labs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-300">
          <FlaskConical size={16} aria-hidden="true" />
          {t('title')}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-violet-400/60"
        >
          <RotateCcw size={12} aria-hidden="true" />
          {t('refresh')}
        </button>
      </div>

      {failed && <p className="mt-3 text-sm text-red-400">{t('loadFailed')}</p>}
      {!data && !failed && <div className="skeleton mt-3 h-16 rounded-lg" aria-hidden="true" />}

      {data && health && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <dt className="text-slate-500">{t('enabled')}</dt>
              <dd className={health.enabled ? 'text-emerald-400' : 'text-slate-400'}>{health.enabled ? t('yes') : t('no')}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <dt className="text-slate-500">{t('runner')}</dt>
              <dd className={health.runner === 'up' ? 'text-emerald-400' : health.runner === 'down' ? 'text-red-400' : 'text-slate-400'}>
                {t(`runnerState.${health.runner}`)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <dt className="text-slate-500">{t('running')}</dt>
              <dd className="text-slate-200">
                {health.running ?? '—'} / {data.info.maxRunning}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <dt className="text-slate-500">{t('lastSweep')}</dt>
              <dd className={health.stale || health.sweepOk === false ? 'text-amber-400' : 'text-slate-200'}>
                {health.lastSweepAt ? time(health.lastSweepAt) : '—'}
                {health.stale ? ` · ${t('stale')}` : ''}
              </dd>
            </div>
          </dl>
          {data.lastSweep && (data.lastSweep.expired > 0 || data.lastSweep.notRunning.length > 0) ? (
            <p className="mt-2 text-xs text-slate-400">
              {t('sweepSummary', {
                expired: data.lastSweep.expired,
                stopped: data.lastSweep.stopped.join(', ') || '—',
                notRunning: data.lastSweep.notRunning.join(', ') || '—',
              })}
            </p>
          ) : null}

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('inUse')}</h3>
          {data.labs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t('none')}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-800">
              {data.labs.map((lab) => (
                <li key={lab.slug} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-sm text-slate-200">
                      {lab.slug} <span className="text-xs text-slate-500">· {lab.state}</span>
                      {lab.roomSlug ? (
                        <Link href={`/rooms/${lab.roomSlug}`} className="ml-2 text-xs text-violet-300 hover:underline">
                          {lab.roomSlug}
                        </Link>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void post(`/api/admin/labs/${lab.slug}/stop`, lab.slug)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-rose-400/60 hover:text-rose-200 disabled:opacity-50"
                    >
                      <Square size={12} aria-hidden="true" />
                      {t('stop')}
                    </button>
                  </div>
                  {lab.users.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                      {lab.users.map((user) => (
                        <li key={user.userId}>
                          {user.email ?? user.userId} · {t('seen', { time: time(user.lastSeenAt) })} ·{' '}
                          {t('until', { time: time(user.maxUntil) })}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-amber-400/80">{t('noLease')}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {confirmAll ? (
              <>
                <span className="text-xs text-rose-200">{t('confirmAll')}</span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void post('/api/admin/labs/stop-all', '*')}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
                >
                  {t('confirm')}
                </button>
                <button type="button" onClick={() => setConfirmAll(false)} className="text-xs text-slate-400 hover:text-slate-200">
                  {t('cancel')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAll(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
              >
                <Power size={12} aria-hidden="true" />
                {t('stopAll')}
              </button>
            )}
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('events')}</h3>
          {data.events.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t('noEvents')}</p>
          ) : (
            <ol className="mt-2 max-h-56 space-y-0.5 overflow-y-auto font-mono text-[11px] text-slate-400">
              {data.events.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  {time(event.at)} · {event.type} · {event.labSlug}
                  {event.user ? ` · ${event.user.email}` : ''}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
