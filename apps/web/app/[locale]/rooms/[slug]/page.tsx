import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isDifficulty, type Difficulty } from '@repo/shared';
import { DifficultyBadge } from '@repo/ui';
import { Clock, Tag } from '../../../../components/icon';
import { LabPanel } from '../../../../components/lab-panel';
import { Markdown } from '../../../../components/markdown';
import { RoomPager, type RoomContext } from '../../../../components/room-pager';
import {
  RoomPlayer,
  type PlayerQuestion,
  type PlayerTask,
} from '../../../../components/room-player';
import { Breadcrumbs } from '../../../../components/shell/breadcrumbs';

interface ApiRoom {
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  estimatedMinutes: number;
  tags: string[];
  lab: string | null;
  labUrl: string | null;
  tasks: Array<{
    id: string;
    index: number;
    title: string;
    body: string;
    questions: Array<{
      id: string;
      prompt: string;
      hint: string | null;
      kind: string;
      options: Array<{ id: string; label: string }> | null;
      index: number;
    }>;
  }>;
}

export const dynamic = 'force-dynamic';

async function fetchJson<T>(path: string, locale: string): Promise<T | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const localeParam = locale === 'en' ? '?locale=en' : '';
  try {
    const response = await fetch(`${apiUrl}${path}${localeParam}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations('RoomPage');
  const nav = await getTranslations('Nav');
  const encoded = encodeURIComponent(slug);
  // The context (path, module, prev/next) is optional: the room still renders without it.
  const [room, context] = await Promise.all([
    fetchJson<ApiRoom>(`/api/catalog/rooms/${encoded}`, locale),
    fetchJson<RoomContext>(`/api/catalog/rooms/${encoded}/context`, locale),
  ]);
  if (!room) {
    notFound();
  }

  const difficulty: Difficulty = isDifficulty(room.difficulty) ? room.difficulty : 'info';
  const tasks: PlayerTask[] = room.tasks.map((task) => ({
    index: task.index,
    title: task.title,
    body: <Markdown>{task.body}</Markdown>,
    questions: task.questions.map<PlayerQuestion>((question) => ({
      id: question.id,
      prompt: question.prompt,
      hint: question.hint,
      kind: question.kind === 'flag' || question.kind === 'choice' ? question.kind : 'text',
      options: Array.isArray(question.options) ? question.options : null,
    })),
  }));

  const next = context?.next
    ? { href: `/rooms/${context.next.slug}`, title: context.next.title, kind: 'room' as const }
    : context?.nextPath
      ? {
          href: `/paths/${context.nextPath.slug}`,
          title: context.nextPath.title,
          kind: 'path' as const,
        }
      : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-6 py-10">
      <Breadcrumbs
        items={[
          { label: nav('paths'), href: '/paths' },
          ...(context ? [{ label: context.path.title, href: `/paths/${context.path.slug}` }] : []),
          { label: room.title },
        ]}
      />

      <header className="mt-4">
        {context ? (
          <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            {t('moduleLine', { index: context.module.index, title: context.module.title })}
            <span className="text-slate-500">
              {' · '}
              {t('position', { index: context.position.index, total: context.position.total })}
            </span>
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{room.title}</h1>
          <DifficultyBadge difficulty={difficulty} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{room.description}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} aria-hidden="true" />
            {t('estimated', { minutes: room.estimatedMinutes })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Tag size={13} aria-hidden="true" />
            {room.tags.join(' · ') || '—'}
          </span>
        </p>
      </header>

      <div className="mt-8 space-y-6">
        {room.lab && <LabPanel labSlug={room.lab} labUrl={room.labUrl} />}
        <RoomPlayer roomSlug={room.slug} tasks={tasks} next={next} />
      </div>

      {context ? (
        <div className="mt-10">
          <RoomPager context={context} />
        </div>
      ) : null}
    </div>
  );
}
