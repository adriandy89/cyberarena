'use client';

import type { LabErrorBody, LabSessionView, LabsInfo } from '@repo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from './auth-client';

const POLL_TRANSITION_MS = 3_000;
const POLL_STEADY_MS = 30_000;
const HEARTBEAT_MS = 60_000;
/** Focus/visibility heartbeats are spaced at least this much. */
const HEARTBEAT_MIN_GAP_MS = 15_000;

export type LabAction = 'start' | 'switch' | 'stop' | 'extend';

export interface LabSession {
  info: LabsInfo | null;
  /** null while unknown (session loading). */
  signedIn: boolean | null;
  view: LabSessionView | null;
  busy: LabAction | null;
  error: LabErrorBody | null;
  /** The user's lease ended without them stopping it (idle or max). */
  expired: boolean;
  start: (switchLab?: boolean) => Promise<void>;
  stop: () => Promise<void>;
  extend: () => Promise<void>;
  refresh: () => Promise<void>;
}

async function readError(response: Response): Promise<LabErrorBody> {
  const body = (await response.json().catch(() => null)) as Partial<LabErrorBody> | null;
  if (body?.code) return body as LabErrorBody;
  return { code: response.status === 401 ? 'LAB_NOT_LEASED' : 'LAB_RUNNER_DOWN', message: `HTTP ${response.status}` };
}

/**
 * Labs on demand from a room page (phase 011): status polling, heartbeats
 * while the page is open (hidden tabs too: the student attacks from a
 * terminal), and start/stop/extend. Never stops the lab on unload: if the
 * page goes away, heartbeats stop and the API reaper ends the lease.
 * Mount it with `key={slug}` so state resets when the lab changes.
 */
export function useLabSession(slug: string): LabSession {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = isPending ? null : Boolean(session?.user);
  const [info, setInfo] = useState<LabsInfo | null>(null);
  const [view, setView] = useState<LabSessionView | null>(null);
  const [busy, setBusy] = useState<LabAction | null>(null);
  const [error, setError] = useState<LabErrorBody | null>(null);
  const [expired, setExpired] = useState(false);
  const hadLease = useRef(false);
  const stopping = useRef(false);
  const lastBeat = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/labs', { credentials: 'include' })
      .then((response) => (response.ok ? (response.json() as Promise<LabsInfo>) : null))
      .then((data) => {
        if (!cancelled) setInfo(data ?? { enabled: false, maxRunning: 0, idleTimeoutMinutes: 0 });
      })
      .catch(() => {
        if (!cancelled) setInfo({ enabled: false, maxRunning: 0, idleTimeoutMinutes: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback((next: LabSessionView) => {
    if (next.mine) {
      hadLease.current = true;
      setExpired(false);
    } else if (hadLease.current && !stopping.current && next.otherLab === null) {
      setExpired(true);
      hadLease.current = false;
    } else {
      hadLease.current = false;
    }
    setView(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/labs/${encodeURIComponent(slug)}`, { credentials: 'include' });
      if (response.ok) apply((await response.json()) as LabSessionView);
      else setError(await readError(response));
    } catch {
      setError({ code: 'LAB_RUNNER_DOWN', message: 'network' });
    }
  }, [slug, apply]);

  const enabled = info?.enabled === true;

  // Status polling: fast while something changes, slow otherwise.
  const state = view?.state;
  const mine = Boolean(view?.mine);
  useEffect(() => {
    if (!enabled || !signedIn) return;
    // Data fetch on mount / state change (same pattern as the dashboard pages).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const transitional = state === 'starting' || state === 'stopping' || busy !== null;
    if (!transitional && !mine && state !== 'running') return;
    const timer = setInterval(() => void refresh(), transitional ? POLL_TRANSITION_MS : POLL_STEADY_MS);
    return () => clearInterval(timer);
  }, [enabled, signedIn, refresh, state, mine, busy]);

  // Heartbeats while this page holds the lease.
  useEffect(() => {
    if (!enabled || !mine) return;
    const beat = async () => {
      lastBeat.current = Date.now();
      try {
        const response = await fetch(`/api/labs/${encodeURIComponent(slug)}/heartbeat`, {
          method: 'POST',
          credentials: 'include',
        });
        const body = response.ok ? ((await response.json()) as { active: boolean }) : null;
        if (body && !body.active) void refresh();
      } catch {
        // transient: the next beat or poll will tell
      }
    };
    const onWake = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastBeat.current > HEARTBEAT_MIN_GAP_MS) void beat();
    };
    const timer = setInterval(() => void beat(), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [enabled, mine, slug, refresh]);

  const act = useCallback(
    async (action: LabAction) => {
      setBusy(action);
      setError(null);
      stopping.current = action === 'stop';
      const path = action === 'switch' ? 'start' : action;
      try {
        const response = await fetch(`/api/labs/${encodeURIComponent(slug)}/${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: action === 'start' || action === 'switch' ? JSON.stringify({ switch: action === 'switch' }) : undefined,
        });
        if (response.ok) apply((await response.json()) as LabSessionView);
        else setError(await readError(response));
      } catch {
        setError({ code: 'LAB_RUNNER_DOWN', message: 'network' });
      } finally {
        stopping.current = false;
        setBusy(null);
      }
    },
    [slug, apply],
  );

  return {
    info,
    signedIn,
    view,
    busy,
    error,
    expired,
    start: (switchLab = false) => act(switchLab ? 'switch' : 'start'),
    stop: () => act('stop'),
    extend: () => act('extend'),
    refresh,
  };
}
