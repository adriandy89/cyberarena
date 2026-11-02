'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '../i18n/navigation';
import type { ByteMood } from './byte/byte';
import { ByteScene } from './byte/byte-scene';
import { Flame, Play, Route } from './icon';
import { Skeleton } from './skeleton';

interface StreakInfo {
  current: number;
  best: number;
  qualifiedToday: boolean;
  solvedToday: number;
  required: number;
}

export interface OverviewPath {
  slug: string;
  title: string;
  percent: number;
  roomsCompleted: number;
}

interface PathTree {
  modules: Array<{ rooms: Array<{ slug: string; title: string }> }>;
}

interface PathProgressData {
  modules: Array<{ rooms: Array<{ slug: string; percent: number }> }>;
}

type NextStep =
  | { kind: 'room'; path: OverviewPath; room: { slug: string; title: string }; started: boolean }
  | { kind: 'done' };

function greetingKey(hour: number): string {
  if (hour >= 6 && hour < 13) return 'morning';
  if (hour >= 13 && hour < 20) return 'afternoon';
  if (hour >= 20) return 'evening';
  return 'night';
}

/**
 * Dashboard header: Byte greets the student (time of day + streak) and a
 * "continue" card jumps to the first unfinished room of the first unfinished
 * path, in catalog order (spec 010 T015).
 */
export function DashboardHero({
  name,
  paths,
  solvedCount,
}: {
  name: string;
  paths: OverviewPath[] | null;
  /** Questions solved overall (XP summary); 0 means "not started". */
  solvedCount: number;
}) {
  const t = useTranslations('DashboardPage');
  const tByte = useTranslations('Byte');
  const locale = useLocale();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [next, setNext] = useState<NextStep | null>(null);
  const [greeting] = useState(() => {
    const now = new Date();
    const list = tByte.raw(`greetings.${greetingKey(now.getHours())}`) as string[];
    return list[now.getDate() % list.length] ?? '';
  });

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/me/streak', { credentials: 'include' });
        if (response.ok) setStreak((await response.json()) as StreakInfo);
      } catch {
        // the greeting works without streak data
      }
    })();
  }, []);

  useEffect(() => {
    if (!paths) return;
    void (async () => {
      const candidates = paths.filter((path) => path.percent < 100);
      if (candidates.length === 0) {
        setNext({ kind: 'done' });
        return;
      }
      try {
        // Prefer the first unfinished path the student already touched; else the first one.
        const progresses = await Promise.all(
          candidates.map(async (path) => {
            const response = await fetch(`/api/progress/paths/${path.slug}`, {
              credentials: 'include',
            });
            return response.ok ? ((await response.json()) as PathProgressData) : null;
          }),
        );
        const touched = progresses.findIndex((item) =>
          item?.modules.some((module) => module.rooms.some((room) => room.percent > 0)),
        );
        const index = touched === -1 ? 0 : touched;
        const target = candidates[index]!;
        const progress = progresses[index] ?? null;
        const localeParam = locale === 'en' ? '?locale=en' : '';
        const treeRes = await fetch(`/api/catalog/paths/${target.slug}${localeParam}`);
        if (!treeRes.ok) return;
        const tree = (await treeRes.json()) as PathTree;
        const percentBySlug = new Map(
          (progress?.modules ?? []).flatMap((module) =>
            module.rooms.map((room) => [room.slug, room.percent] as const),
          ),
        );
        const rooms = tree.modules.flatMap((module) => module.rooms);
        const room =
          rooms.find((candidate) => (percentBySlug.get(candidate.slug) ?? 0) < 100) ?? rooms[0];
        if (room) {
          setNext({ kind: 'room', path: target, room, started: touched !== -1 });
        }
      } catch {
        // the card simply stays hidden
      }
    })();
  }, [paths, locale]);

  const hasProgress = solvedCount > 0;
  let mood: ByteMood = 'wave';
  let extra = '';
  if (!hasProgress) {
    mood = 'point';
    extra = t('byteNoProgress');
  } else if (streak && streak.current > 0) {
    mood = streak.current >= 3 ? 'happy' : 'wave';
    extra = t('byteStreak', { count: streak.current });
  } else if (streak) {
    extra = t('byteStreakZero', { required: streak.required });
  }

  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
          {t('hello', { name })}
        </p>
        <ByteScene
          mood={mood}
          size="sm"
          className="mt-3"
          message={extra ? `${greeting} ${extra}` : greeting}
        />
        {streak ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Flame
              size={14}
              aria-hidden="true"
              className={streak.current > 0 ? 'text-orange-400' : 'text-slate-600'}
            />
            {t('streakShort', { count: streak.current, best: streak.best })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-500/30 bg-linear-to-br from-emerald-500/10 to-transparent p-5">
        {next === null ? (
          <Skeleton className="h-20 w-full" />
        ) : next.kind === 'done' ? (
          <p className="text-sm text-emerald-200">{t('allDone')}</p>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                {next.started ? t('continueTitle') : t('startTitle')}
              </p>
              <p className="mt-2 text-lg leading-snug font-semibold text-slate-100">
                {next.room.title}
              </p>
              <Link
                href={`/paths/${next.path.slug}`}
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
              >
                <Route size={13} aria-hidden="true" />
                {next.path.title} · {next.path.percent}%
              </Link>
            </div>
            <Link
              href={`/rooms/${next.room.slug}`}
              className="btn-press inline-flex items-center justify-center gap-2 self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              <Play size={15} aria-hidden="true" />
              {next.started ? t('continueCta') : t('startCta')}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
