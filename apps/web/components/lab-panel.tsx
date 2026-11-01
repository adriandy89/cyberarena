'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState, type ReactNode } from 'react';

function CopyRow({ label, command }: { label: string; command: string }) {
  const t = useTranslations('LabPanel');
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable: the command remains selectable
    }
  }, [command]);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-stretch gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-emerald-300">
          {command}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
        >
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </div>
  );
}

/**
 * Lab deployment panel for rooms with a docker lab (phase 007):
 * exact up/down commands and the lab URL; the student runs them locally.
 */
export function LabPanel({ labSlug, labUrl }: { labSlug: string; labUrl: string | null }) {
  const t = useTranslations('LabPanel');
  const base = `labs/${labSlug}`;
  let urlLink: ReactNode = null;
  if (labUrl) {
    urlLink = (
      <a
        href={labUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
      >
        {labUrl} ↗
      </a>
    );
  }
  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-300">
          🧪 {t('title')}
        </h2>
        {urlLink}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{t('intro')}</p>
      <div className="mt-4 space-y-3">
        <CopyRow label={t('upLabel')} command={`docker compose -f ${base}/compose.yaml --env-file ${base}/flags.env up -d`} />
        <CopyRow label={t('downLabel')} command={`docker compose -f ${base}/compose.yaml --env-file ${base}/flags.env down -v`} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">⚠️ {t('warning')}</p>
    </section>
  );
}
