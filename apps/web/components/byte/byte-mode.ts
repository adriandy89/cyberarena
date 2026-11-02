'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** How present the floating companion is (spec 010 §3.9). */
export type ByteMode = 'full' | 'mini' | 'off';

const STORAGE_KEY = 'cyberarena:byte-mode';
const CHANGE_EVENT = 'cyberarena:byte-mode-change';

// Fallback when storage is unavailable (private mode, blocked site data).
let memoryMode: ByteMode | null = null;

function isMode(value: unknown): value is ByteMode {
  return value === 'full' || value === 'mini' || value === 'off';
}

function readMode(): ByteMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isMode(stored)) return stored;
  } catch {
    // storage blocked: fall through to memory/default
  }
  if (memoryMode) return memoryMode;
  return window.matchMedia('(max-width: 639px)').matches ? 'mini' : 'full';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Persisted companion mode. Returns `null` during SSR/hydration so callers
 * render nothing until the browser preference is known.
 */
export function useByteMode(): [ByteMode | null, (mode: ByteMode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, () => null);
  const setMode = useCallback((next: ByteMode) => {
    memoryMode = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // keep the in-memory value only
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [mode, setMode];
}
