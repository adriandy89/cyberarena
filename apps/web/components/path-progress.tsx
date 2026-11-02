'use client';

import { isDifficulty } from '@repo/shared';
import { cn, DifficultyBadge } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '../i18n/navigation';
import { Byte } from './byte/byte';
import { ByteScene } from './byte/byte-scene';
import { Confetti } from './byte/confetti';
import { ArrowRight, Award, CircleCheck, Clock, Play } from './icon';
import { Skeleton } from './skeleton';

export interface PathTree {
  slug: string;
  title: string;
  description: string;
  level: string;
  modules: Array<{
    slug: string;
    title: string;
    description: string;
    rooms: Array<{
      slug: string;
      title: string;
      description: string;
      difficulty: string;
      type: string;
      estimatedMinutes: number;
      lab?: string | null;
      labUrl?: string | null;
    }>;
  }>;
}

interface RoomProgress {
  slug: string;
  solved: number;
  total: number;
  percent: number;
  completed: boolean;
}

interface ModuleProgress {
  slug: string;
  title: string;
  percent: number;
  rooms: RoomProgress[];
}

interface PathProgressData {
  slug: string;
  percent: number;
  modules: ModuleProgress[];
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`progress-smooth h-full rounded-full ${percent === 100 ? 'bg-emerald-400' : 'bg-emerald-500/70'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Small circular progress indicator for module headers and the index. */
function Ring({ percent, size = 28 }: { percent: number; size?: number }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="shrink-0 -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth="3"
        className="stroke-slate-800"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        className={cn(
          'transition-[stroke-dashoffset] duration-700',
          percent === 100 ? 'stroke-emerald-400' : 'stroke-emerald-500/80',
        )}
      />
    </svg>
  );
}

const CTA =
  'btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400';

/**
 * Renders the path tree merged with the signed-in user's derived progress
 * (/api/progress/paths/:slug): module index, "continue where you left off",
 * per-module rings and a celebration at 100 %. Guests see a login teaser.
 */
export function PathProgress({ pathSlug, tree }: { pathSlug: string; tree: PathTree }) {
  const t = useTranslations('PathProgress');
  const [progress, setProgress] = useState<PathProgressData | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/progress/paths/${pathSlug}`, {
          credentials: 'include',
        });
        if (response.status === 401) {
          setIsGuest(true);
          return;
        }
        if (response.ok) {
          setProgress((await response.json()) as PathProgressData);
        }
      } catch {
        // guest-like empty state on network failure
        setIsGuest(true);
      }
    })();
  }, [pathSlug]);

  const progressByRoom = new Map<string, RoomProgress>();
  for (const moduleProgress of progress?.modules ?? []) {
    for (const room of moduleProgress.rooms) {
      progressByRoom.set(room.slug, room);
    }
  }

  const rooms = tree.modules.flatMap((module) => module.rooms);
  const firstRoom = rooms[0];
  const nextRoom = rooms.find((room) => (progressByRoom.get(room.slug)?.percent ?? 0) < 100);
  const overall = progress?.percent ?? 0;
  const loading = !isGuest && progress === null;

  let header: ReactNode;
  if (isGuest) {
    header = (
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
        <Byte mood="point" size="xs" />
        <p className="flex-1">
          {t('guestTeaser')}{' '}
          <Link
            href={`/login?next=/paths/${pathSlug}`}
            className="font-semibold text-emerald-400 hover:text-emerald-300"
          >
            {t('guestCta')}
          </Link>
        </p>
        {firstRoom ? (
          <Link href={`/rooms/${firstRoom.slug}`} className={CTA}>
            <Play size={15} aria-hidden="true" />
            {t('firstRoom')}
          </Link>
        ) : null}
      </div>
    );
  } else if (loading) {
    header = <Skeleton className="h-24 w-full rounded-xl" />;
  } else if (overall === 100) {
    header = (
      <div className="relative rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
        <Confetti burst={1} />
        <ByteScene mood="celebrate" tone="success" message={t('completedByte')}>
          <Link href={`/certificate/${pathSlug}`} className={CTA}>
            <Award size={15} aria-hidden="true" />
            {t('certificate')}
          </Link>
        </ByteScene>
      </div>
    );
  } else {
    header = (
      <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-300">{t('overallProgress')}</span>
            <span className="font-bold text-slate-200">{overall}%</span>
          </div>
          <div className="mt-2">
            <Bar percent={overall} />
          </div>
        </div>
        {nextRoom ? (
          <Link href={`/rooms/${nextRoom.slug}`} className={cn(CTA, 'self-start sm:self-auto')}>
            <Play size={15} aria-hidden="true" />
            <span className="flex flex-col leading-tight">
              <span>{overall > 0 ? t('continue') : t('start')}</span>
              <span className="max-w-[14rem] truncate text-[11px] font-medium text-slate-900/80">
                {nextRoom.title}
              </span>
            </span>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block">
        <nav aria-label={t('modulesIndex')} className="sticky top-24 space-y-1">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t('modulesIndex')}
          </p>
          {tree.modules.map((moduleItem, index) => {
            const percent = progress?.modules.find((m) => m.slug === moduleItem.slug)?.percent ?? 0;
            return (
              <a
                key={moduleItem.slug}
                href={`#module-${moduleItem.slug}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-100"
              >
                {isGuest ? (
                  <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-600">
                    {index + 1}
                  </span>
                ) : (
                  <Ring percent={percent} size={20} />
                )}
                <span className="truncate">{moduleItem.title}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 space-y-10">
        {header}

        {tree.modules.map((moduleItem, moduleIndex) => {
          const moduleProgress = progress?.modules.find(
            (candidate) => candidate.slug === moduleItem.slug,
          );
          return (
            <section
              key={moduleItem.slug}
              id={`module-${moduleItem.slug}`}
              className="scroll-mt-24"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                    {t('moduleLabel', { index: moduleIndex + 1 })}
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold text-slate-100">
                    {moduleItem.title}
                  </h2>
                </div>
                {!isGuest && !loading ? (
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    {moduleProgress?.percent ?? 0}%
                    <Ring percent={moduleProgress?.percent ?? 0} />
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">{moduleItem.description}</p>
              <ul className="mt-4 space-y-3">
                {moduleItem.rooms.map((room) => {
                  const roomProgress = progressByRoom.get(room.slug);
                  const percent = roomProgress?.percent ?? 0;
                  const completed = roomProgress?.completed ?? false;
                  const isNext = !isGuest && !loading && nextRoom?.slug === room.slug;
                  return (
                    <li key={room.slug}>
                      <Link
                        href={`/rooms/${room.slug}`}
                        className={cn(
                          'card-hover group block rounded-xl border bg-slate-900/40 p-4 transition-colors hover:border-emerald-500/40',
                          isNext
                            ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                            : 'border-slate-800',
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 font-medium text-slate-100">
                            {completed ? (
                              <CircleCheck
                                size={17}
                                aria-hidden="true"
                                className="shrink-0 text-emerald-400"
                              />
                            ) : null}
                            <span className="truncate">{room.title}</span>
                            {room.lab && (
                              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-400 uppercase">
                                lab
                              </span>
                            )}
                            {isNext ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300 uppercase">
                                {t('upNext')}
                                <ArrowRight size={11} aria-hidden="true" />
                              </span>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            {isDifficulty(room.difficulty) ? (
                              <DifficultyBadge
                                difficulty={room.difficulty}
                                className="px-2 text-[10px]"
                              />
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} aria-hidden="true" />
                              {room.estimatedMinutes}′
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{room.description}</p>
                        {!isGuest && !loading && (
                          <div className="mt-3 flex items-center gap-3">
                            <Bar percent={percent} />
                            <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-400">
                              {percent}%
                            </span>
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
