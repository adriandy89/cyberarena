import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BookOpen, Clock, Layers } from '../../../../components/icon';
import { LevelBadge } from '../../../../components/level-badge';
import { PathProgress, type PathTree } from '../../../../components/path-progress';
import { Breadcrumbs } from '../../../../components/shell/breadcrumbs';

export const dynamic = 'force-dynamic';

async function loadPath(slug: string, locale: string): Promise<PathTree | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const localeParam = locale === 'en' ? '?locale=en' : '';
  try {
    const response = await fetch(
      `${apiUrl}/api/catalog/paths/${encodeURIComponent(slug)}${localeParam}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    return (await response.json()) as PathTree;
  } catch {
    return null;
  }
}

export default async function PathDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const nav = await getTranslations('Nav');
  const t = await getTranslations('PathsPage');
  const path = await loadPath(slug, locale);
  if (!path) {
    notFound();
  }

  const rooms = path.modules.flatMap((module) => module.rooms);
  const minutes = rooms.reduce((total, room) => total + room.estimatedMinutes, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col px-6 py-10">
      <Breadcrumbs items={[{ label: nav('paths'), href: '/paths' }, { label: path.title }]} />
      <header className="mt-4 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{path.title}</h1>
          <LevelBadge level={path.level} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{path.description}</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Layers size={13} aria-hidden="true" />
            {t('modules', { count: path.modules.length })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BookOpen size={13} aria-hidden="true" />
            {t('rooms', { count: rooms.length })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} aria-hidden="true" />
            {t('hours', { hours: Math.max(1, Math.round(minutes / 60)) })}
          </span>
        </p>
      </header>
      <div className="mt-8">
        <PathProgress pathSlug={path.slug} tree={path} />
      </div>
    </div>
  );
}
