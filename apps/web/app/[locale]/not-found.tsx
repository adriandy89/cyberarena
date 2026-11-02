import { getTranslations } from 'next-intl/server';
import { ByteScene } from '../../components/byte/byte-scene';
import { Link } from '../../i18n/navigation';

export default async function NotFoundPage() {
  const t = await getTranslations('NotFoundPage');

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <ByteScene mood="confused" size="lg" layout="column" message={t('byte')} />
      <p className="font-mono text-5xl font-bold text-emerald-400">404</p>
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-md text-sm text-slate-400">{t('description')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-slate-500"
        >
          {t('back')}
        </Link>
        <Link
          href="/paths"
          className="btn-press rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          {t('paths')}
        </Link>
      </div>
    </div>
  );
}
