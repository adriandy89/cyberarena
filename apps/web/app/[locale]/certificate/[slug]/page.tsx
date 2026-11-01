'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MeResponse {
  name: string;
}

interface CertificateItem {
  pathSlug: string;
  pathTitle: string;
  completedAt: string;
  xpInPath: number;
}

/** Printable path certificate: use the browser print dialog to export as PDF. */
export default function CertificatePage() {
  const t = useTranslations('CertificatePage');
  const params = useParams<{ locale: string; slug: string }>();
  const slug = params?.slug;
  const [name, setName] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<CertificateItem | null | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      try {
        const [meRes, certsRes] = await Promise.all([
          fetch('/api/users/me', { credentials: 'include' }),
          fetch('/api/me/certificates', { credentials: 'include' }),
        ]);
        if (meRes.ok) setName(((await meRes.json()) as MeResponse).name);
        if (certsRes.ok) {
          const list = (await certsRes.json()) as CertificateItem[];
          setCertificate(list.find((item) => item.pathSlug === slug) ?? null);
        } else {
          setCertificate(null);
        }
      } catch {
        setCertificate(null);
      }
    })();
  }, [slug]);

  if (certificate === undefined || name === null) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">…</div>;
  }

  if (certificate === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-xl font-semibold">{t('notFound')}</p>
        <p className="max-w-md text-sm text-slate-400">{t('notFoundHint')}</p>
      </div>
    );
  }

  const completedAt = new Date(certificate.completedAt).toLocaleDateString();

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <button
        type="button"
        onClick={() => window.print()}
        className="mb-8 self-end rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 print:hidden"
      >
        🖨 {t('print')}
      </button>

      <article className="w-full max-w-2xl rounded-2xl border-4 border-double border-emerald-500/60 bg-white p-10 text-center text-slate-900 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-700">
          CyberArena
        </p>
        <h1 className="mt-6 text-3xl font-black tracking-tight">{t('title')}</h1>
        <p className="mt-8 text-sm uppercase tracking-widest text-slate-500">{t('awardedTo')}</p>
        <p className="mt-2 text-2xl font-bold">{name}</p>
        <p className="mt-8 text-sm uppercase tracking-widest text-slate-500">{t('forCompleting')}</p>
        <p className="mt-2 text-xl font-semibold text-emerald-800">{certificate.pathTitle}</p>
        <div className="mt-10 flex items-center justify-center gap-10 text-sm text-slate-600">
          <span>
            {t('date')}: <strong>{completedAt}</strong>
          </span>
          <span>
            XP: <strong>{certificate.xpInPath}</strong>
          </span>
        </div>
        <p className="mt-10 text-[10px] text-slate-400">
          {t('footnote', { slug: certificate.pathSlug })}
        </p>
      </article>
    </div>
  );
}
