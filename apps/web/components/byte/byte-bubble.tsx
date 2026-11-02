'use client';

import { cn } from '@repo/ui';
import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from './use-reduced-motion';

export type BubbleTone = 'default' | 'success' | 'danger' | 'warn' | 'info';

const TONE_CLASSES: Record<BubbleTone, string> = {
  default: 'border-slate-700 text-slate-200',
  success: 'border-emerald-500/50 text-emerald-100',
  danger: 'border-red-500/50 text-red-100',
  warn: 'border-amber-500/50 text-amber-100',
  info: 'border-cyan-500/40 text-cyan-100',
};

const TAIL_CLASSES = {
  left: '-left-1.5 top-5 border-b border-l',
  right: '-right-1.5 top-5 border-r border-t',
  bottom: '-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r',
} as const;

export interface ByteBubbleProps {
  text: string;
  tone?: BubbleTone;
  /** Side of the bubble that points at Byte. */
  tail?: keyof typeof TAIL_CLASSES;
  /** Typewriter effect (skipped under reduced motion). */
  typing?: boolean;
  /** Announce the text politely to assistive tech. */
  live?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Speech bubble for Byte. `children` renders below the text (e.g. actions). */
export function ByteBubble({
  text,
  tone = 'default',
  tail = 'left',
  typing = false,
  live = false,
  className,
  children,
}: ByteBubbleProps) {
  return (
    <div
      className={cn(
        'relative animate-pop rounded-2xl border bg-slate-900/95 px-4 py-3 text-sm leading-relaxed shadow-lg shadow-black/30 backdrop-blur',
        TONE_CLASSES[tone],
        className,
      )}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
    >
      <span
        aria-hidden="true"
        className={cn('absolute h-3 w-3 rotate-45 bg-slate-900', TONE_CLASSES[tone], TAIL_CLASSES[tail])}
      />
      {typing ? <TypedText key={text} text={text} /> : <span>{text}</span>}
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

/** Reveals text progressively in ~1s; screen readers get the full text at once. */
function TypedText({ text }: { text: string }) {
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const step = Math.max(1, Math.ceil(text.length / 55));
    const timer = window.setInterval(() => {
      setCount((current) => {
        const next = current + step;
        if (next >= text.length) window.clearInterval(timer);
        return Math.min(next, text.length);
      });
    }, 18);
    return () => window.clearInterval(timer);
  }, [text, reduced]);

  if (reduced) return <span>{text}</span>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        {count < text.length ? <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-emerald-400/70 align-middle" /> : null}
      </span>
    </>
  );
}
