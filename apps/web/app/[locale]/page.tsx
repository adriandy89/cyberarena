import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '../../components/language-switcher';
import { UserMenu } from '../../components/user-menu';
import { Link } from '../../i18n/navigation';

interface PathCard {
  slug: string;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

const LEVEL_CLASSES: Record<PathCard['level'], string> = {
  beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  intermediate: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  advanced: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('HomePage');
  const paths = t.raw('paths') as PathCard[];

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">
          Cyber<span className="text-emerald-400">Arena</span>
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/status"
            className="hidden text-sm text-slate-400 transition-colors hover:text-slate-200 sm:block"
          >
            {t('nav.status')}
          </Link>
          <UserMenu />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <section className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {t('hero.badge')}
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">{t('hero.subtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950">
              {t('hero.ctaPrimary')}
            </span>
            <Link
              href="/status"
              className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500">{t('hero.disclaimer')}</p>
        </section>

        <section className="mt-20">
          <h2 className="text-xl font-semibold tracking-tight">{t('roadmap.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('roadmap.subtitle')}</p>
          <ol className="mt-6 space-y-3">
            {paths.map((path, index) => (
              <li
                key={path.slug}
                className="flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-bold text-slate-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{path.title}</h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEVEL_CLASSES[path.level]}`}
                    >
                      {t(`levels.${path.level}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{path.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-slate-900 pt-6 text-xs text-slate-600">
        {t('footer')}
      </footer>
    </div>
  );
}
