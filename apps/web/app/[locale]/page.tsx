import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HeroByte } from '../../components/hero-byte';
import {
  ArrowRight,
  BookOpen,
  Clock,
  FlaskConical,
  Layers,
  Route,
  Swords,
  Trophy,
  type LucideIcon,
} from '../../components/icon';
import { LevelBadge } from '../../components/level-badge';
import { Link } from '../../i18n/navigation';
import { fetchApiJson } from '../../lib/api-server';

interface CatalogPathSummary {
  slug: string;
  title: string;
  description: string;
  level: string;
  moduleCount: number;
  roomCount: number;
  estimatedMinutes: number;
}

// The roadmap comes from the catalog API, so it always matches the real paths.
export const dynamic = 'force-dynamic';

async function loadPaths(locale: string): Promise<CatalogPathSummary[]> {
  return (await fetchApiJson<CatalogPathSummary[]>('/api/catalog', locale)) ?? [];
}

const STEPS: Array<{ key: 'learn' | 'practice' | 'progress'; icon: LucideIcon }> = [
  { key: 'learn', icon: BookOpen },
  { key: 'practice', icon: FlaskConical },
  { key: 'progress', icon: Trophy },
];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('HomePage');
  const tPaths = await getTranslations('PathsPage');
  const paths = await loadPaths(locale);

  const totals = paths.reduce(
    (sum, path) => ({
      modules: sum.modules + path.moduleCount,
      rooms: sum.rooms + path.roomCount,
      minutes: sum.minutes + path.estimatedMinutes,
    }),
    { modules: 0, rooms: 0, minutes: 0 },
  );
  const stats = [
    { label: t('stats.paths'), value: paths.length, icon: Route },
    { label: t('stats.modules'), value: totals.modules, icon: Layers },
    { label: t('stats.rooms'), value: totals.rooms, icon: BookOpen },
    { label: t('stats.hours'), value: Math.round(totals.minutes / 60), icon: Clock },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* animated cyber backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="animate-drift absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="animate-drift absolute top-40 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl [animation-delay:-6s]" />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col px-6">
        <section className="grid items-center gap-10 py-14 md:grid-cols-[minmax(0,1fr)_auto] md:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex animate-fade-in items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
              {t('hero.badge')}
            </span>
            <h1 className="mt-5 animate-fade-in text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-4 animate-fade-in-delayed text-lg leading-relaxed text-slate-400">
              {t('hero.subtitle')}
            </p>
            <div className="mt-8 flex animate-fade-in-delayed flex-wrap gap-3">
              <Link
                href="/paths"
                className="btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400"
              >
                {t('hero.ctaPrimary')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/hacktivities"
                className="btn-press inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/50 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500"
              >
                <Swords size={16} aria-hidden="true" />
                {t('hero.ctaSecondary')}
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-500">{t('hero.disclaimer')}</p>
          </div>
          <div className="flex justify-center">
            <HeroByte message={t('hero.byte')} />
          </div>
        </section>

        {paths.length > 0 ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="reveal rounded-xl border border-slate-800 bg-slate-900/40 p-4"
              >
                <dt className="flex items-center gap-2 text-xs text-slate-500">
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-slate-100 tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <section className="mt-20">
          <h2 className="text-xl font-semibold tracking-tight">{t('how.title')}</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ key, icon: Icon }, index) => (
              <li
                key={key}
                className="reveal rounded-xl border border-slate-800 bg-slate-900/40 p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">
                  <span className="mr-2 font-mono text-emerald-400">{index + 1}.</span>
                  {t(`how.${key}.title`)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  {t(`how.${key}.description`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 pb-8">
          <h2 className="text-xl font-semibold tracking-tight">{t('roadmap.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('roadmap.subtitle', { count: paths.length })}
          </p>
          <ol className="relative mt-6 space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[1.4rem] before:w-px before:bg-linear-to-b before:from-emerald-500/50 before:to-slate-800">
            {paths.map((path, index) => (
              <li key={path.slug} className="reveal relative">
                <Link
                  href={`/paths/${path.slug}`}
                  className="card-hover group flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-emerald-500/40"
                >
                  <span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-slate-950 font-mono text-xs font-bold text-emerald-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{path.title}</h3>
                      <LevelBadge level={path.level} />
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{path.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {tPaths('modules', { count: path.moduleCount })} ·{' '}
                      {tPaths('rooms', { count: path.roomCount })} ·{' '}
                      {tPaths('hours', {
                        hours: Math.max(1, Math.round(path.estimatedMinutes / 60)),
                      })}
                    </p>
                  </div>
                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                    className="mt-1 hidden shrink-0 text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-emerald-400 sm:block"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
