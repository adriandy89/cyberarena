import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ByteScene } from '../../../components/byte/byte-scene';
import { ArrowRight, BookOpen, Clock, Layers } from '../../../components/icon';
import { LevelBadge } from '../../../components/level-badge';
import { Breadcrumbs } from '../../../components/shell/breadcrumbs';
import { Link } from '../../../i18n/navigation';

interface CatalogRoomLink {
  slug: string;
  title: string;
  difficulty: string;
  type: string;
  estimatedMinutes: number;
}

interface CatalogPathSummary {
  slug: string;
  title: string;
  description: string;
  level: string;
  moduleCount: number;
  roomCount: number;
  estimatedMinutes: number;
  rooms: CatalogRoomLink[];
}

const PREVIEW_ROOMS = 4;

// Catalog is served by the API; this page renders per request (cheap, and the
// catalog changes only on seed). API_URL is server-side only (ADR-008).
export const dynamic = 'force-dynamic';

async function loadPaths(locale: string): Promise<CatalogPathSummary[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const localeParam = locale === 'en' ? '?locale=en' : '';
  try {
    const response = await fetch(`${apiUrl}/api/catalog${localeParam}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    return (await response.json()) as CatalogPathSummary[];
  } catch {
    return [];
  }
}

export default async function PathsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('PathsPage');
  const nav = await getTranslations('Nav');
  const paths = await loadPaths(locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col px-6 py-10">
      <Breadcrumbs items={[{ label: nav('paths') }]} className="mb-4" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        {paths.length > 0 ? (
          <ByteScene mood="point" size="sm" message={t('byteHint')} className="sm:max-w-sm" />
        ) : null}
      </div>

      {paths.length === 0 ? (
        <ByteScene mood="sleep" message={t('empty')} className="mt-10" />
      ) : (
        <ol className="mt-8 space-y-4">
          {paths.map((path, index) => {
            const extra = path.rooms.length - PREVIEW_ROOMS;
            return (
              <li key={path.slug} className="reveal">
                <Link
                  href={`/paths/${path.slug}`}
                  className="card-hover group relative flex gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-emerald-500/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 font-mono text-sm font-bold text-emerald-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{path.title}</h2>
                      <LevelBadge level={path.level} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {path.description}
                    </p>
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers size={13} aria-hidden="true" />
                        {t('modules', { count: path.moduleCount })}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen size={13} aria-hidden="true" />
                        {t('rooms', { count: path.roomCount })}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} aria-hidden="true" />
                        {t('hours', { hours: Math.max(1, Math.round(path.estimatedMinutes / 60)) })}
                      </span>
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('preview')}>
                      {path.rooms.slice(0, PREVIEW_ROOMS).map((room) => (
                        <li
                          key={room.slug}
                          className="max-w-full truncate rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-300"
                        >
                          {room.title}
                        </li>
                      ))}
                      {extra > 0 ? (
                        <li className="rounded-full px-2 py-1 text-xs text-slate-500">
                          {t('moreRooms', { count: extra })}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                    className="mt-2 hidden shrink-0 text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-emerald-400 sm:block"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
