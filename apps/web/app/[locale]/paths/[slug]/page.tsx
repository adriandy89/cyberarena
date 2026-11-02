import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PathProgress, type PathTree } from '../../../../components/path-progress';
import { Breadcrumbs } from '../../../../components/shell/breadcrumbs';

export const dynamic = 'force-dynamic';

async function loadPath(slug: string): Promise<PathTree | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  try {
    const response = await fetch(`${apiUrl}/api/catalog/paths/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
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
  const { slug } = await params;
  const nav = await getTranslations('Nav');
  const path = await loadPath(slug);
  if (!path) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-6 py-10">
      <Breadcrumbs items={[{ label: nav('paths'), href: '/paths' }, { label: path.title }]} />
      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight">{path.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{path.description}</p>
      </header>
      <div className="mt-8">
        <PathProgress pathSlug={path.slug} tree={path} />
      </div>
    </div>
  );
}
