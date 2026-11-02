'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ByteScene } from '../../../components/byte/byte-scene';
import { Breadcrumbs } from '../../../components/shell/breadcrumbs';

interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  latencyMs: number;
  timestamp: string;
  /** Labs on demand (phase 011). */
  labs?: {
    enabled: boolean;
    runner: 'up' | 'down' | 'disabled';
    running: number | null;
    lastSweepAt: string | null;
    sweepOk: boolean | null;
    stale: boolean;
  };
}

// Same-origin relative path: Next's /api rewrite proxies to the API (ADR-008).
const API_HEALTH_URL = '/api/health';

function StatusDot({ up }: { up: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${up ? 'bg-emerald-400' : 'bg-red-500'}`}
    />
  );
}

export default function StatusPage() {
  const t = useTranslations('StatusPage');
  const nav = useTranslations('Nav');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_HEALTH_URL}`, { cache: 'no-store' });
      setHealth((await response.json()) as HealthResponse);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Intentional fetch-on-mount for this small status widget. Revisited when a
    // data-fetching layer lands (phase 003+); see specs/000-foundation changelog.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const reachable = health !== null && error === null;
  const healthy = reachable && health?.status === 'ok' && health.db === 'up';
  const mood = loading ? 'scan' : healthy ? 'happy' : 'error';

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-8">
      <Breadcrumbs items={[{ label: nav('status') }]} className="mb-4" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <ByteScene
          mood={mood}
          size="sm"
          tone={loading ? 'default' : healthy ? 'success' : 'danger'}
          message={loading ? t('byteChecking') : healthy ? t('byteHealthy') : t('byteDown')}
        />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {t('api')} <code className="rounded bg-slate-900 px-1.5 py-0.5">/api/health</code>
      </p>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <span className="flex items-center gap-2 font-medium">
            <StatusDot up={reachable && health?.status === 'ok'} /> {t('apiLabel')}
          </span>
          <span className={reachable ? 'text-emerald-400' : 'text-red-400'}>
            {reachable ? t('apiUp') : loading ? t('loading') : t('apiDown')}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <span className="flex items-center gap-2 font-medium">
            <StatusDot up={health?.db === 'up'} /> {t('dbLabel')}
          </span>
          <span className={health?.db === 'up' ? 'text-emerald-400' : 'text-red-400'}>
            {health ? (health.db === 'up' ? t('dbUp') : t('dbDown')) : '—'}
          </span>
        </div>

        {health?.labs?.enabled ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <span className="flex items-center gap-2 font-medium">
              <StatusDot up={health.labs.runner === 'up' && !health.labs.stale && health.labs.sweepOk !== false} />{' '}
              {t('labsLabel')}
            </span>
            <span
              className={`text-right text-sm ${
                health.labs.runner === 'up' && !health.labs.stale ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {health.labs.runner === 'down'
                ? t('labsDown')
                : health.labs.stale || health.labs.sweepOk === false
                  ? t('labsStale')
                  : t('labsUp', { count: health.labs.running ?? 0 })}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
          <span>{t('latency')}</span>
          <span>{health ? `${health.latencyMs} ms` : '—'}</span>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="mt-6 self-start rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-slate-500 disabled:opacity-50"
      >
        {loading ? t('loading') : t('refresh')}
      </button>
    </div>
  );
}
