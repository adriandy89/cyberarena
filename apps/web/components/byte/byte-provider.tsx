'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from '../../i18n/navigation';
import type { ByteMood } from './byte';
import type { BubbleTone } from './byte-bubble';

/** Things Byte reacts to (spec 010 §3.9). Keys match the `Byte.events` messages. */
export type ByteEvent =
  | 'answerCorrect'
  | 'answerWrong'
  | 'answerWrongRepeated'
  | 'hintOpened'
  | 'roomCompleted'
  | 'levelUp'
  | 'authRequired'
  | 'networkError'
  | 'pageTip'
  | 'greeting';

interface EventSpec {
  mood: ByteMood;
  tone: BubbleTone;
  /** Higher interrupts lower; important ones (>= 3) resume after an interruption. */
  priority: number;
  /** null = stays until dismissed. */
  sticky?: boolean;
  confetti?: boolean;
}

const EVENT_SPECS: Record<ByteEvent, EventSpec> = {
  pageTip: { mood: 'hint', tone: 'default', priority: 0 },
  greeting: { mood: 'wave', tone: 'default', priority: 0 },
  hintOpened: { mood: 'think', tone: 'warn', priority: 1 },
  answerCorrect: { mood: 'happy', tone: 'success', priority: 2 },
  answerWrong: { mood: 'sad', tone: 'danger', priority: 2 },
  answerWrongRepeated: { mood: 'hint', tone: 'warn', priority: 3 },
  networkError: { mood: 'error', tone: 'danger', priority: 3 },
  roomCompleted: { mood: 'celebrate', tone: 'success', priority: 4, confetti: true },
  authRequired: { mood: 'point', tone: 'info', priority: 4, sticky: true },
  levelUp: { mood: 'celebrate', tone: 'success', priority: 5, confetti: true },
};

export interface ByteAction {
  label: string;
  href: string;
}

export interface ByteReaction {
  id: number;
  event: ByteEvent;
  mood: ByteMood;
  tone: BubbleTone;
  message: string;
  priority: number;
  /** null = sticky. */
  durationMs: number | null;
  confetti: boolean;
  action?: ByteAction;
}

export interface ReactOptions {
  vars?: Record<string, string | number>;
  action?: ByteAction;
}

interface ByteContextValue {
  reaction: ByteReaction | null;
  react: (event: ByteEvent, options?: ReactOptions) => void;
  dismiss: () => void;
}

const ByteContext = createContext<ByteContextValue | null>(null);

const NOOP: ByteContextValue = { reaction: null, react: () => undefined, dismiss: () => undefined };

/** Access Byte from any client component; a no-op outside the provider. */
export function useByte(): ByteContextValue {
  return useContext(ByteContext) ?? NOOP;
}

const MAX_QUEUE = 3;

/** Maps a locale-less pathname to its `Byte.pageTips` key. */
export function pageKeyFor(pathname: string): string {
  const [first = '', second] = pathname.split('/').filter(Boolean);
  if (first === '') return 'home';
  if (first === 'paths') return second ? 'path' : 'paths';
  if (first === 'rooms') return 'room';
  return first;
}

function greetingKey(hour: number): string {
  if (hour >= 6 && hour < 13) return 'morning';
  if (hour >= 13 && hour < 20) return 'afternoon';
  if (hour >= 20) return 'evening';
  return 'night';
}

function fill(template: string, vars: ReactOptions['vars']): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function ByteProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('Byte');
  const pathname = usePathname();
  const [reaction, setReaction] = useState<ByteReaction | null>(null);
  // Refs are the source of truth so react() never mutates inside a state updater.
  const currentRef = useRef<ByteReaction | null>(null);
  const queueRef = useRef<ByteReaction[]>([]);
  const idRef = useRef(0);
  const lastPickRef = useRef(new Map<string, number>());

  const commit = useCallback((next: ByteReaction | null) => {
    currentRef.current = next;
    setReaction(next);
  }, []);

  /** Random variant from a message list, never repeating the previous pick. */
  const pick = useCallback(
    (key: string): string => {
      const raw: unknown = t.has(key) ? t.raw(key) : null;
      const list = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string')
        : [];
      if (list.length === 0) return '';
      const last = lastPickRef.current.get(key);
      let index = Math.floor(Math.random() * list.length);
      if (list.length > 1 && index === last) index = (index + 1) % list.length;
      lastPickRef.current.set(key, index);
      return list[index]!;
    },
    [t],
  );

  const messageFor = useCallback(
    (event: ByteEvent, vars: ReactOptions['vars']): string => {
      if (event === 'greeting') return pick(`greetings.${greetingKey(new Date().getHours())}`);
      if (event === 'pageTip') {
        const pageKey = `pageTips.${pageKeyFor(pathname)}`;
        const usePageTip = t.has(pageKey) && Math.random() < 0.6;
        return pick(usePageTip ? pageKey : 'tips');
      }
      return fill(pick(`events.${event}`), vars);
    },
    [pathname, pick, t],
  );

  const react = useCallback(
    (event: ByteEvent, options?: ReactOptions) => {
      const spec = EVENT_SPECS[event];
      const message = messageFor(event, options?.vars);
      if (!message) return;
      idRef.current += 1;
      const next: ByteReaction = {
        id: idRef.current,
        event,
        mood: spec.mood,
        tone: spec.tone,
        message,
        priority: spec.priority,
        durationMs: spec.sticky ? null : Math.max(3500, 1600 + message.length * 45),
        confetti: Boolean(spec.confetti),
        action: options?.action,
      };
      const current = currentRef.current;
      if (!current || next.priority >= current.priority) {
        // An interrupted important message comes back afterwards.
        if (current && current.priority >= 3 && current.event !== event) {
          queueRef.current.unshift(current);
        }
        commit(next);
        return;
      }
      queueRef.current = [...queueRef.current, next]
        .sort((a, b) => b.priority - a.priority)
        .slice(0, MAX_QUEUE);
    },
    [commit, messageFor],
  );

  const dismiss = useCallback(() => {
    commit(queueRef.current.shift() ?? null);
  }, [commit]);

  // Auto-advance: when the visible reaction expires, show the next queued one.
  useEffect(() => {
    if (!reaction || reaction.durationMs === null) return;
    const timer = window.setTimeout(() => {
      commit(queueRef.current.shift() ?? null);
    }, reaction.durationMs);
    return () => window.clearTimeout(timer);
  }, [reaction, commit]);

  // Page changes drop stale page-specific chatter (but keep important messages).
  useEffect(() => {
    queueRef.current = queueRef.current.filter((item) => item.priority >= 3);
  }, [pathname]);

  const value = useMemo(() => ({ reaction, react, dismiss }), [reaction, react, dismiss]);
  return <ByteContext.Provider value={value}>{children}</ByteContext.Provider>;
}
