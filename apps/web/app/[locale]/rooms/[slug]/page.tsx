import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isDifficulty, type Difficulty } from '@repo/shared';
import { DifficultyBadge } from '@repo/ui';
import { LabPanel } from '../../../../components/lab-panel';
import { Markdown } from '../../../../components/markdown';
import { RoomPlayer, type PlayerQuestion, type PlayerTask } from '../../../../components/room-player';
import { Link } from '../../../../i18n/navigation';

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

async function loadRoom(slug: string, locale: string): Promise<ApiRoom | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const localeParam = locale === 'en' ? '?locale=en' : '';
  try {
    const response = await fetch(`${apiUrl}/api/catalog/rooms/${encodeURIComponent(slug)}${localeParam}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as ApiRoom;
  } catch {
    return null;
  }
}

export default async function RoomPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const t = await getTranslations('RoomPage');
  const room = await loadRoom(slug, locale);
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-6 py-10">
      <Link
        href="/paths"
        className="self-start text-sm text-slate-400 transition-colors hover:text-slate-200"
      >
        ← {t('backToPaths')}
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{room.title}</h1>
          <DifficultyBadge difficulty={difficulty} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{room.description}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>⏱ {t('estimated', { minutes: room.estimatedMinutes })}</span>
          <span>🏷 {room.tags.join(' · ') || '—'}</span>
        </p>
      </header>

      <div className="mt-8 space-y-6">
        {room.lab && <LabPanel labSlug={room.lab} labUrl={room.labUrl} />}
        <RoomPlayer roomSlug={room.slug} tasks={tasks} />
      </div>
    </div>
  );
}
