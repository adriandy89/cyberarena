'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/**
 * Level names are stable identifiers in @repo/shared (NEOPHYTE, APPRENTICE…);
 * this returns their translated label, falling back to the identifier.
 */
export function useLevelName(): (name: string) => string {
  const t = useTranslations('Levels');
  return useCallback((name: string) => (t.has(name) ? t(name) : name), [t]);
}
