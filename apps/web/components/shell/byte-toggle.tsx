'use client';

import { useTranslations } from 'next-intl';
import { Bot } from '../icon';
import { useByteMode } from '../byte/byte-mode';

/** Footer switch to bring Byte back after hiding it (or hide it). */
export function ByteToggle() {
  const t = useTranslations('Byte.companion');
  const [mode, setMode] = useByteMode();
  if (mode === null) return null;
  const hidden = mode === 'off';
  return (
    <button
      type="button"
      onClick={() => setMode(hidden ? 'full' : 'off')}
      aria-pressed={!hidden}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
    >
      <Bot size={14} aria-hidden="true" />
      {hidden ? t('show') : t('hide')}
    </button>
  );
}
