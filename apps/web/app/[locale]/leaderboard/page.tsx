'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  levelName: string;
}

type Period = 'all' | 'month';

export default function LeaderboardPage() {
  const t = useTranslations('LeaderboardPage');
  const [period, setPeriod] = useState<Period>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  const load = useCallback(async (selected: Period) => {
    try {
      const response = await fetch(`/api/leaderboard?period=${selected}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = (await response.json()) as { entries: LeaderboardEntry[] };
        setEntries(data.entries);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    // Intentional fetch-on-mount widget; a data layer lands in a later phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(period);
  }, [period, load]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      <div className="mt-4 inline-flex self-start rounded-full border border-slate-800 bg-slate-900/80 p-1">
        {(['all', 'month'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPeriod(option)}
            aria-pressed={period === option}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              period === option
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t(`period.${option}`)}
          </button>
        ))}
      </div>

      {entries === null ? (
        <p className="mt-10 text-sm text-slate-500">…</p>
      ) : entries.length === 0 ? (
        <p className="mt-10 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          {t('empty')}
        </p>
      ) : (
        <ol className="mt-6 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
          {entries.map((entry) => (
            <li key={entry.rank} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`w-8 shrink-0 text-center text-sm font-bold ${
                    entry.rank === 1
                      ? 'text-amber-400'
                      : entry.rank === 2
                        ? 'text-slate-300'
                        : entry.rank === 3
                          ? 'text-orange-500'
                          : 'text-slate-500'
                  }`}
                >
                  #{entry.rank}
                </span>
                <span className="truncate text-sm font-medium text-slate-200">{entry.name}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="text-sm font-bold text-emerald-400">{entry.xp} XP</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {entry.levelName}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
