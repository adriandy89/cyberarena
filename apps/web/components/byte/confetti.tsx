'use client';

import { useMemo, type CSSProperties } from 'react';
import styles from './confetti.module.css';
import { usePrefersReducedMotion } from './use-reduced-motion';

const COLORS = ['#34d399', '#22d3ee', '#fbbf24', '#f472b6', '#a78bfa', '#f8fafc'];

/** Deterministic PRNG (mulberry32) so rendering stays pure for a given burst. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ConfettiProps {
  /** Change it to fire a new burst. */
  burst: number;
  pieces?: number;
  className?: string;
}

/**
 * Dependency-free CSS confetti burst from the container's center.
 * Renders nothing under reduced motion (ADR-014).
 */
export function Confetti({ burst, pieces = 26, className }: ConfettiProps) {
  const reduced = usePrefersReducedMotion();
  const items = useMemo(() => {
    const next = random(burst * 7919 + pieces);
    return Array.from({ length: pieces }, (_, index) => {
      const angle = next() * Math.PI * 2;
      const distance = 60 + next() * 110;
      return {
        id: index,
        style: {
          '--x': `${Math.cos(angle) * distance}px`,
          '--peak': `${Math.min(Math.sin(angle) * distance, 0) - 40 - next() * 50}px`,
          '--y': `${80 + next() * 120}px`,
          '--r': `${(next() - 0.5) * 900}deg`,
          '--delay': `${next() * 120}ms`,
          '--duration': `${900 + next() * 600}ms`,
          background: COLORS[index % COLORS.length],
          width: `${5 + next() * 5}px`,
          height: `${7 + next() * 7}px`,
          borderRadius: next() > 0.6 ? '9999px' : '2px',
        } as CSSProperties,
      };
    });
  }, [burst, pieces]);

  if (reduced || burst === 0) return null;

  return (
    <div aria-hidden="true" className={`${styles.layer} ${className ?? ''}`}>
      {items.map((item) => (
        <span key={`${burst}-${item.id}`} className={styles.piece} style={item.style} />
      ))}
    </div>
  );
}
