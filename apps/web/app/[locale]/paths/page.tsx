import { getTranslations, setRequestLocale } from 'next-intl/server';
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
  level: 'beginner' | 'intermediate' | 'advanced';
  moduleCount: number;
  roomCount: number;
  estimatedMinutes: number;
  rooms: CatalogRoomLink[];
}

const LEVEL_CLASSES: Record<CatalogPathSummary['level'], string> = {
  beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  intermediate: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  advanced: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// Catalog is served by the API; this page renders per request (cheap, and the
// catalog changes only on seed). API_URL is server-side only (ADR-008).
export const dynamic = 'force-dynamic';

async function loadPaths(): Promise<CatalogPathSummary[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  try {
    const response = await fetch(`${apiUrl}/api/catalog`, {
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
  const paths = await loadPaths();

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      {paths.length === 0 ? (
        <p className="mt-10 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          {t('empty')}
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {paths.map((path) => (
            <li
              key={path.slug}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-slate-600"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{path.title}</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEVEL_CLASSES[path.level] ?? LEVEL_CLASSES.beginner}`}
                >
                  {t(`levels.${path.level}`)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{path.description}</p>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  {t('modules', { count: path.moduleCount })} · {t('rooms', { count: path.roomCount })}
                </span>
                <span>
                  ≈ {Math.round(path.estimatedMinutes / 60)}h · {t('type.walkthrough')}+
                </span>
              </p>
              {path.rooms.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {path.rooms.map((room) => (
                    <li key={room.slug}>
                      <Link
                        href={`/rooms/${room.slug}`}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm transition-colors hover:border-emerald-500/40"
                      >
                        <span className="font-medium text-slate-200">{room.title}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-500">
                          {room.difficulty} · {room.estimatedMinutes}′
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="mt-10 self-start text-sm text-slate-400 transition-colors hover:text-slate-200"
      >
        ← {t('back')}
      </Link>
    </div>
  );
}
