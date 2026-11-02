'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '../../../i18n/navigation';

interface RoomCard {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  estimatedMinutes: number;
  tags: string[];
  lab: string | null;
  completions: number;
  pathSlug: string;
  pathTitle: string;
}

interface Facets {
  tags: string[];
  difficulties: string[];
  types: string[];
}

interface ListResponse {
  total: number;
  rooms: RoomCard[];
  facets: Facets;
}

type Sort = 'popular' | 'newest' | 'az' | 'za' | 'time';

const PAGE_SIZE = 24;

const DIFFICULTY_CLASSES: Record<string, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  easy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  hard: 'border-orange-600/30 bg-orange-600/10 text-orange-500',
  insane: 'border-red-500/30 bg-red-500/10 text-red-400',
};

export default function HacktivitiesPage() {
  const t = useTranslations('HacktivitiesPage');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [tag, setTag] = useState<string>('');
  const [labOnly, setLabOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('popular');
  const [data, setData] = useState<ListResponse | null>(null);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput.trim());
      setSkip(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (currentSkip: number, append: boolean) => {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          sort,
          take: String(PAGE_SIZE),
          skip: String(currentSkip),
        });
        if (query) params.set('q', query);
        if (difficulty) params.set('difficulty', difficulty);
        if (type) params.set('type', type);
        if (tag) params.set('tag', tag);
        if (labOnly) params.set('lab', 'true');
        const response = await fetch(`/api/hacktivities?${params.toString()}`, {
          credentials: 'include',
        });
        if (id !== requestId.current) return;
        if (response.ok) {
          const fresh = (await response.json()) as ListResponse;
          setData((previous) =>
            append && previous ? { ...fresh, rooms: [...previous.rooms, ...fresh.rooms] } : fresh,
          );
        }
      } catch {
        if (id === requestId.current)
          setData(
            (previous) =>
              previous ?? {
                total: 0,
                rooms: [],
                facets: { tags: [], difficulties: [], types: [] },
              },
          );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [query, difficulty, type, tag, labOnly, sort],
  );

  useEffect(() => {
    // Intentional fetch-on-mount widget; a data layer lands in a later phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0, false);
  }, [load]);

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
      active
        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      {/* search + sort */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/60"
        />
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as Sort);
            setSkip(0);
          }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-300"
          aria-label={t('sortLabel')}
        >
          {(['popular', 'newest', 'az', 'za', 'time'] as const).map((option) => (
            <option key={option} value={option}>
              {t(`sort.${option}`)}
            </option>
          ))}
        </select>
      </div>

      {/* filter pills */}
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('filters.difficulty')}
          </span>
          {(data?.facets.difficulties ?? []).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setDifficulty(difficulty === option ? '' : option);
                setSkip(0);
              }}
              className={pill(difficulty === option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('filters.type')}
          </span>
          {(data?.facets.types ?? []).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setType(type === option ? '' : option);
                setSkip(0);
              }}
              className={pill(type === option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('filters.tag')}
          </span>
          {(data?.facets.tags ?? []).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setTag(tag === option ? '' : option);
                setSkip(0);
              }}
              className={pill(tag === option)}
            >
              #{option}
            </button>
          ))}
          <label className="ml-2 flex cursor-pointer items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            <input
              type="checkbox"
              checked={labOnly}
              onChange={(event) => {
                setLabOnly(event.target.checked);
                setSkip(0);
              }}
              className="accent-violet-500"
            />
            🧪 {t('filters.labOnly')}
          </label>
        </div>
      </div>

      {/* results */}
      {data && <p className="mt-6 text-xs text-slate-500">{t('results', { count: data.total })}</p>}
      <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(data?.rooms ?? []).map((room) => (
          <li key={room.slug}>
            <Link
              href={`/rooms/${room.slug}`}
              className="card-hover animate-fade-in flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-emerald-500/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DIFFICULTY_CLASSES[room.difficulty] ?? DIFFICULTY_CLASSES.info}`}
                >
                  {room.difficulty}
                </span>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {room.type}
                </span>
                {room.lab && (
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                    lab
                  </span>
                )}
              </div>
              <h2 className="mt-3 font-semibold text-slate-100">{room.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-400">
                {room.description}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>⏱ {room.estimatedMinutes}′</span>
                <span>👥 {room.completions}</span>
                <span className="truncate">🗺 {room.pathTitle}</span>
              </p>
              {room.tags.length > 0 && (
                <p className="mt-2 truncate text-[11px] text-slate-600">
                  {room.tags.map((item) => `#${item}`).join(' ')}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {data && data.rooms.length === 0 && !loading && (
        <p className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          {t('empty')}
        </p>
      )}

      {data && skip + data.rooms.length < data.total && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            const next = skip + PAGE_SIZE;
            setSkip(next);
            void load(next, true);
          }}
          className="mx-auto mt-8 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-50"
        >
          {loading ? '…' : t('loadMore')}
        </button>
      )}
    </div>
  );
}
