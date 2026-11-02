'use client';

import { cn } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '../../i18n/navigation';
import { Maximize2, Minimize2, X } from '../icon';
import { Byte, type ByteMood } from './byte';
import { ByteBubble } from './byte-bubble';
import { useByteMode } from './byte-mode';
import { useByte } from './byte-provider';
import { Confetti } from './confetti';

const SLEEP_AFTER_MS = 90_000;
const GREETED_KEY = 'cyberarena:byte-greeted';

function isFormField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Floating Byte (bottom-right) that voices ByteProvider reactions.
 * Modes: full | mini | off (persisted). Moves out of the way on small screens
 * while a form field has focus, and dozes off after a while without activity.
 */
export function ByteCompanion() {
  const t = useTranslations('Byte.companion');
  const [mode, setMode] = useByteMode();
  const { reaction, react, dismiss } = useByte();
  const [asleep, setAsleep] = useState(false);
  const [formFocused, setFormFocused] = useState(false);

  // Doze after inactivity; any interaction wakes Byte up.
  useEffect(() => {
    let timer = window.setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
    const wake = () => {
      setAsleep(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
    };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, []);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => setFormFocused(isFormField(event.target));
    const onFocusOut = () => setFormFocused(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // Say hello once per browser session.
  useEffect(() => {
    if (mode !== 'full') return;
    let greeted = false;
    try {
      greeted = window.sessionStorage.getItem(GREETED_KEY) === '1';
      window.sessionStorage.setItem(GREETED_KEY, '1');
    } catch {
      // storage blocked: greet anyway
    }
    if (greeted) return;
    const timer = window.setTimeout(() => react('greeting'), 1200);
    return () => window.clearTimeout(timer);
  }, [mode, react]);

  // Persistent live region so reactions are announced even when the bubble remounts.
  const liveRegion = (
    <div role="status" aria-live="polite" className="sr-only">
      {reaction?.message ?? ''}
    </div>
  );

  if (mode === null || mode === 'off') return liveRegion;

  const mood: ByteMood = reaction?.mood ?? (asleep ? 'sleep' : 'idle');
  const full = mode === 'full';

  return (
    <>
      {liveRegion}
      <div
        data-testid="byte-companion"
        data-mood={mood}
        data-mode={mode}
        className={cn(
          'pointer-events-none fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 flex items-end gap-2 transition-[translate,opacity] duration-300 print:hidden sm:right-5',
          formFocused && 'max-sm:pointer-events-none max-sm:translate-x-[130%] max-sm:opacity-0',
        )}
      >
        {reaction ? (
          <ByteBubble
            key={reaction.id}
            text={reaction.message}
            tone={reaction.tone}
            tail="right"
            typing
            textHidden
            className={cn(
              'pointer-events-auto mb-6 pr-8',
              full
                ? 'max-w-[min(20rem,calc(100vw-8rem))]'
                : 'max-w-[min(16rem,calc(100vw-6rem))] text-xs',
            )}
          >
            {reaction.action ? (
              <Link
                href={reaction.action.href}
                onClick={dismiss}
                className="btn-press rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
              >
                {reaction.action.label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('dismiss')}
              className="absolute top-2 right-2 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </ByteBubble>
        ) : null}

        <div className="group pointer-events-auto relative flex flex-col items-center">
          <Confetti burst={reaction?.confetti ? reaction.id : 0} />
          <div className="mb-1 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
            <button
              type="button"
              onClick={() => setMode(full ? 'mini' : 'full')}
              aria-label={full ? t('minimize') : t('expand')}
              title={full ? t('minimize') : t('expand')}
              className="rounded-full border border-slate-700 bg-slate-900/90 p-1 text-slate-400 transition-colors hover:text-slate-100"
            >
              {full ? (
                <Minimize2 size={12} aria-hidden="true" />
              ) : (
                <Maximize2 size={12} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode('off')}
              aria-label={t('hide')}
              title={t('hide')}
              className="rounded-full border border-slate-700 bg-slate-900/90 p-1 text-slate-400 transition-colors hover:text-red-300"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => react('pageTip')}
            aria-label={t('talk')}
            title={t('label')}
            className={cn(
              'btn-press rounded-full transition-transform hover:-translate-y-0.5',
              !full && 'border border-slate-700 bg-slate-900/90 p-1.5 shadow-lg shadow-black/40',
            )}
          >
            <Byte
              mood={mood}
              size={full ? 'md' : 'xs'}
              direction={mood === 'point' ? 'left' : 'right'}
            />
          </button>
        </div>
      </div>
    </>
  );
}
