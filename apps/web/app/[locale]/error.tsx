'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ByteScene } from '../../components/byte/byte-scene';
import { RotateCcw } from '../../components/icon';
import { Link } from '../../i18n/navigation';

/** Route error boundary: Byte glitches and offers a retry (spec 010 T010). */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('States');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <ByteScene
        mood="error"
        tone="danger"
        size="lg"
        layout="column"
        message={t('errorMessage')}
        live
      />
      <h1 className="text-2xl font-semibold">{t('errorTitle')}</h1>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-press inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t('retry')}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-slate-500"
        >
          {t('home')}
        </Link>
      </div>
      {error.digest ? (
        <p className="font-mono text-xs text-slate-600">ref: {error.digest}</p>
      ) : null}
    </div>
  );
}
