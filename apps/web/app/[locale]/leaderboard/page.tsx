'use client';

import { cn } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Byte } from '../../../components/byte/byte';
import { ByteScene } from '../../../components/byte/byte-scene';
import { Trophy } from '../../../components/icon';
import { Breadcrumbs } from '../../../components/shell/breadcrumbs';
import { Skeleton } from '../../../components/skeleton';

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  levelName: string;
}

type Period = 'all' | 'month';

const PODIUM_STYLE: Record<number, { height: string; tone: string; delay: string }> = {
  1: {
    height: 'h-28',
    tone: 'border-amber-400/50 bg-amber-400/10 text-amber-300',
    delay: '[animation-delay:200ms]',
  },
  2: {
    height: 'h-20',
    tone: 'border-slate-300/40 bg-slate-300/10 text-slate-200',
    delay: '[animation-delay:100ms]',
  },
  3: {
    height: 'h-16',
    tone: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    delay: '[animation-delay:300ms]',
  },
};

export default function LeaderboardPage() {
  const t = useTranslations('LeaderboardPage');
  const nav = useTranslations('Nav');
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

  // Podium order on screen: 2nd, 1st, 3rd.
  const podium = [2, 1, 3]
    .map((rank) => entries?.find((entry) => entry.rank === rank))
    .filter((entry): entry is LeaderboardEntry => Boolean(entry));
  const rest = (entries ?? []).filter((entry) => entry.rank > 3);

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-10">
      <Breadcrumbs items={[{ label: nav('leaderboard') }]} className="mb-4" />
      <div className="flex items-center gap-3">
        <Trophy size={22} aria-hidden="true" className="text-amber-400" />
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      </div>

      <div className="mt-4 inline-flex self-start rounded-full border border-slate-800 bg-slate-900/80 p-1">
        {(['all', 'month'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPeriod(option)}
            aria-pressed={period === option}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
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
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <ByteScene mood="sleep" message={t('empty')} className="mt-10" />
      ) : (
        <>
          <ol className="mt-8 grid grid-cols-3 items-end gap-3" aria-label={t('podium')}>
            {podium.map((entry) => {
              const style = PODIUM_STYLE[entry.rank]!;
              return (
                <li
                  key={`${period}-${entry.rank}`}
                  className={cn(
                    'flex animate-pop flex-col items-center gap-2 text-center',
                    style.delay,
                  )}
                >
                  {entry.rank === 1 ? <Byte mood="celebrate" size="sm" /> : null}
                  <span className="w-full truncate text-sm font-semibold text-slate-100">
                    {entry.name}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 tabular-nums">
                    {entry.xp} XP
                  </span>
                  <div
                    className={cn(
                      'flex w-full items-start justify-center rounded-t-xl border pt-2 font-mono text-2xl font-bold',
                      style.height,
                      style.tone,
                    )}
                  >
                    {entry.rank}
                  </div>
                </li>
              );
            })}
          </ol>

          {rest.length > 0 ? (
            <ol className="mt-6 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
              {rest.map((entry) => (
                <li
                  key={entry.rank}
                  className="flex animate-fade-in items-center justify-between gap-4 px-4 py-3.5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-8 shrink-0 text-center text-sm font-bold text-slate-500">
                      #{entry.rank}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-200">
                      {entry.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-sm font-bold text-emerald-400">{entry.xp} XP</span>
                    <span className="ml-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                      {entry.levelName}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </div>
  );
}
