import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/navigation';

export default async function NotFoundPage() {
  const t = await getTranslations('NotFoundPage');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-bold text-emerald-400">404</p>
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-md text-sm text-slate-400">{t('description')}</p>
      <Link
        href="/"
        className="mt-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-slate-500"
      >
        {t('back')}
      </Link>
    </div>
  );
}
