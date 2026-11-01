'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '../i18n/navigation';

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
        className={`h-full rounded-full transition-all ${percent === 100 ? 'bg-emerald-400' : 'bg-emerald-500/70'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Renders the path tree merged with the signed-in user's derived progress
 * (/api/progress/paths/:slug). Guests see the empty state with a login CTA.
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

  const header: ReactNode = isGuest ? (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
      {t('guestTeaser')}{' '}
      <Link href="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
        {t('guestCta')}
      </Link>
    </div>
  ) : (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-300">{t('overallProgress')}</span>
        <span
          className={`font-bold ${progress?.percent === 100 ? 'text-emerald-400' : 'text-slate-200'}`}
        >
          {progress?.percent ?? 0}%
        </span>
      </div>
      <div className="mt-2">
        <Bar percent={progress?.percent ?? 0} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {header}

      {tree.modules.map((moduleItem) => {
        const moduleProgress = progress?.modules.find((candidate) => candidate.slug === moduleItem.slug);
        return (
          <section key={moduleItem.slug}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100">{moduleItem.title}</h2>
              {!isGuest && (
                <span className="text-xs font-semibold text-slate-400">
                  {moduleProgress?.percent ?? 0}%
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">{moduleItem.description}</p>
            <ul className="mt-4 space-y-3">
              {moduleItem.rooms.map((room) => {
                const roomProgress = progressByRoom.get(room.slug);
                const percent = roomProgress?.percent ?? 0;
                const completed = roomProgress?.completed ?? false;
                return (
                  <li key={room.slug}>
                    <Link
                      href={`/rooms/${room.slug}`}
                      className="block rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-emerald-500/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-100">
                          {completed && <span className="mr-2 text-emerald-400">✓</span>}
                          {room.title}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {room.difficulty} · {room.estimatedMinutes}′
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{room.description}</p>
                      {!isGuest && (
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
  );
}
