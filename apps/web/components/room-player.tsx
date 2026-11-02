'use client';

import { cn } from '@repo/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from '../i18n/navigation';
import { Byte } from './byte/byte';
import { useByte } from './byte/byte-provider';
import { Confetti } from './byte/confetti';
import { usePrefersReducedMotion } from './byte/use-reduced-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Lightbulb, LogIn, WifiOff } from './icon';

export interface PlayerQuestion {
  id: string;
  prompt: string;
  hint: string | null;
  kind: 'flag' | 'text' | 'choice';
  options: Array<{ id: string; label: string }> | null;
}

export interface PlayerTask {
  index: number;
  title: string;
  body: ReactNode; // server-rendered markdown (ADR-011)
  questions: PlayerQuestion[];
}

interface SubmitResult {
  correct: boolean;
  alreadySolved: boolean;
  xpAwarded: number;
  roomCompleted: boolean;
  /** Present when XP was awarded (spec 010 T016). */
  level?: { before: number; after: number; name: string };
}

type QuestionState =
  | { status: 'idle' }
  | { status: 'wrong'; attempt: number }
  | { status: 'auth' }
  | { status: 'error' }
  | { status: 'correct'; xp: number };

/** Where to go after finishing the room: the next room, or the next path at the end. */
export interface PlayerNext {
  href: string;
  title: string;
  kind: 'room' | 'path';
}

/** Wrong attempts on one question before Byte suggests the hint. */
const HINT_NUDGE_AFTER = 3;

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Animated "+N XP" counter (instant under reduced motion). */
function XpGain({ xp }: { xp: number }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? xp : 0);

  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / 600);
      setShown(Math.round(xp * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [xp, reduced]);

  return (
    <span className="ml-2 inline-block animate-bounce-xp rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs tabular-nums">
      +{reduced ? xp : shown} XP
    </span>
  );
}

export function RoomPlayer({
  roomSlug,
  tasks,
  next = null,
}: {
  roomSlug: string;
  tasks: PlayerTask[];
  next?: PlayerNext | null;
}) {
  const t = useTranslations('RoomPlayer');
  const tByte = useTranslations('Byte.companion');
  const { react } = useByte();
  const reduced = usePrefersReducedMotion();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const loginHref = `/login?next=${encodeURIComponent(`/rooms/${roomSlug}`)}`;

  const [current, setCurrent] = useState(() => {
    // Deep link: ?task=N (1-based).
    const requested = Number(searchParams.get('task'));
    return Number.isInteger(requested) && requested >= 1 && requested <= tasks.length
      ? requested - 1
      : 0;
  });
  const [guest, setGuest] = useState(false);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Record<string, QuestionState>>({});
  const [hintsOpen, setHintsOpen] = useState<Set<string>>(new Set());
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [roomCompleted, setRoomCompleted] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const wrongCounts = useRef(new Map<string, number>());
  const totalQuestions = tasks.reduce((sum, task) => sum + task.questions.length, 0);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/rooms/${roomSlug}/progress`, {
          credentials: 'include',
        });
        if (response.status === 401) {
          setGuest(true);
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as {
          solvedQuestionIds: string[];
          roomCompleted: boolean;
        };
        setSolved(new Set(data.solvedQuestionIds));
        setRoomCompleted(data.roomCompleted);
      } catch {
        // progress is optional for viewing; submissions will surface errors
      }
    })();
  }, [roomSlug]);

  const goTo = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(tasks.length - 1, index));
      setCurrent(target);
      // Shallow URL update (no server round-trip) so the task is linkable.
      window.history.replaceState(null, '', `?task=${target + 1}`);
      rootRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    },
    [tasks.length, reduced],
  );

  // ← / → move between tasks, unless the student is typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      if (event.key === 'ArrowLeft' && current > 0) goTo(current - 1);
      if (event.key === 'ArrowRight' && current < tasks.length - 1) goTo(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo, tasks.length]);

  const openHint = useCallback(
    (questionId: string) => {
      setHintsOpen((prev) => new Set(prev).add(questionId));
      react('hintOpened');
    },
    [react],
  );

  const submit = useCallback(
    async (question: PlayerQuestion, answer: string) => {
      const questionId = question.id;
      if (!answer.trim() || solved.has(questionId) || pending.has(questionId)) return;
      setPending((prev) => new Set(prev).add(questionId));
      try {
        const response = await fetch(`/api/rooms/${roomSlug}/answers`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, answer }),
        });
        if (response.status === 401) {
          // Not a wrong answer: the student just needs a session (spec 010 T013).
          setGuest(true);
          setStates((prev) => ({ ...prev, [questionId]: { status: 'auth' } }));
          react('authRequired', { action: { label: tByte('login'), href: loginHref } });
          return;
        }
        if (!response.ok) {
          setStates((prev) => ({ ...prev, [questionId]: { status: 'error' } }));
          react('networkError');
          return;
        }
        const data = (await response.json()) as SubmitResult;
        if (data.correct) {
          setSolved((prev) => new Set(prev).add(questionId));
          setStates((prev) => ({
            ...prev,
            [questionId]: { status: 'correct', xp: data.xpAwarded },
          }));
          const leveledUp = data.level && data.level.after > data.level.before;
          if (leveledUp) {
            react('levelUp', { vars: { level: data.level!.after, name: data.level!.name } });
          }
          if (data.roomCompleted) {
            setRoomCompleted(true);
            setCelebrate((count) => count + 1);
            react(
              'roomCompleted',
              next ? { action: { label: next.title, href: next.href } } : undefined,
            );
          } else if (!leveledUp) {
            react('answerCorrect');
          }
        } else {
          const attempts = (wrongCounts.current.get(questionId) ?? 0) + 1;
          wrongCounts.current.set(questionId, attempts);
          setStates((prev) => ({ ...prev, [questionId]: { status: 'wrong', attempt: attempts } }));
          const nudge = attempts >= HINT_NUDGE_AFTER && question.hint && !hintsOpen.has(questionId);
          react(nudge ? 'answerWrongRepeated' : 'answerWrong');
        }
      } catch {
        // network failure: the attempt is not counted, the student can retry
        setStates((prev) => ({ ...prev, [questionId]: { status: 'error' } }));
        react('networkError');
      } finally {
        setPending((prev) => {
          const copy = new Set(prev);
          copy.delete(questionId);
          return copy;
        });
      }
    },
    [roomSlug, solved, pending, hintsOpen, react, tByte, loginHref, next],
  );

  const task = tasks[current]!;
  const solvedCount = solved.size;
  const percent = totalQuestions === 0 ? 0 : Math.round((solvedCount / totalQuestions) * 100);

  return (
    <div ref={rootRef} className="scroll-mt-24 space-y-6">
      {/* progress header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('tasksLabel')}>
            {tasks.map((item, i) => {
              const taskSolved = item.questions.every((q) => solved.has(q.id));
              const isCurrent = i === current;
              return (
                <button
                  key={item.index}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={t('taskOf', { index: item.index, total: tasks.length })}
                  className={cn(
                    'h-8 w-8 rounded-full border text-xs font-bold transition-all',
                    taskSolved
                      ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                      : isCurrent
                        ? 'border-slate-400 bg-slate-800 text-slate-100'
                        : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300',
                    isCurrent && 'scale-110 ring-2 ring-emerald-500/30',
                  )}
                >
                  {item.index}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            {t('progress', { solved: solvedCount, total: totalQuestions })}
          </span>
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
          aria-hidden="true"
        >
          <div
            className="progress-smooth h-full rounded-full bg-emerald-500/80"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {guest && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-cyan-100">
          <Byte mood="point" size="xs" />
          <p className="flex-1">{t('guestBanner')}</p>
          <Link
            href={loginHref}
            className="btn-press inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/10"
          >
            <LogIn size={14} aria-hidden="true" />
            {tByte('login')}
          </Link>
        </div>
      )}

      {roomCompleted && (
        <div className="relative flex animate-pop flex-col gap-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 sm:flex-row sm:items-center">
          <Confetti burst={celebrate} />
          <Byte mood="celebrate" size="sm" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">{t('roomCompleted')}</p>
            {next ? (
              <p className="mt-1 text-xs text-slate-400">
                {next.kind === 'room' ? t('continueWithRoom') : t('continueWithPath')}
              </p>
            ) : null}
          </div>
          {next ? (
            <Link
              href={next.href}
              className="btn-press inline-flex items-center gap-2 self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 sm:self-auto"
            >
              <span className="max-w-[16rem] truncate">{next.title}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      )}

      {/* task (keyed so each task enters with an animation) */}
      <article
        key={`task-${task.index}`}
        className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/40 p-6"
      >
        <header className="mb-4 border-b border-slate-800 pb-3">
          <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            {t('taskOf', { index: task.index, total: tasks.length })}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">{task.title}</h2>
        </header>
        {task.body}
      </article>

      {/* questions */}
      <section
        key={`questions-${task.index}`}
        className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900/40 p-6"
      >
        <h3 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">
          {t('answerQuestions')}
        </h3>
        <ul className="mt-4 space-y-6">
          {task.questions.map((question, i) => {
            const state = states[question.id];
            const isSolved = solved.has(question.id);
            const isPending = pending.has(question.id);
            const wrong = state?.status === 'wrong' && !isSolved;
            return (
              <li
                key={question.id}
                className={cn(
                  'rounded-lg border bg-slate-950/60 p-4 transition-colors',
                  isSolved ? 'border-emerald-500/30' : 'border-slate-800',
                )}
              >
                <p className="text-sm font-medium text-slate-200">
                  <span className="mr-2 text-slate-500">{i + 1}.</span>
                  {question.prompt}
                </p>

                {question.hint && !isSolved && (
                  <div className="mt-2">
                    {hintsOpen.has(question.id) ? (
                      <p className="flex animate-fade-in gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
                        <Lightbulb size={14} aria-hidden="true" className="mt-px shrink-0" />
                        <span>{question.hint}</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openHint(question.id)}
                        className="text-xs text-amber-400/80 underline underline-offset-2 hover:text-amber-300"
                      >
                        {t('showHint')}
                      </button>
                    )}
                  </div>
                )}

                {isSolved ? (
                  <p className="mt-3 animate-pop text-sm font-semibold text-emerald-400">
                    ✓ {t('solved')}
                    {state?.status === 'correct' && state.xp > 0 ? <XpGain xp={state.xp} /> : null}
                  </p>
                ) : (
                  <form
                    // re-mount on each wrong attempt so the shake animation replays
                    key={wrong ? `wrong-${state.attempt}` : 'form'}
                    className={cn(
                      'mt-3 flex flex-col gap-2 sm:flex-row sm:items-start',
                      wrong && 'animate-shake',
                    )}
                    aria-busy={isPending}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit(question, inputs[question.id] ?? '');
                    }}
                  >
                    {question.kind === 'choice' && question.options ? (
                      <div className="flex-1 space-y-2">
                        {question.options.map((option) => (
                          <label
                            key={option.id}
                            className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-600 has-checked:border-emerald-500/50 has-checked:bg-emerald-500/10"
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={option.id}
                              checked={inputs[question.id] === option.id}
                              onChange={() =>
                                setInputs((prev) => ({ ...prev, [question.id]: option.id }))
                              }
                              className="mt-1 accent-emerald-500"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                        <button
                          type="submit"
                          disabled={!inputs[question.id] || isPending}
                          className="btn-press self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
                        >
                          {t('submit')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          value={inputs[question.id] ?? ''}
                          onChange={(event) =>
                            setInputs((prev) => ({ ...prev, [question.id]: event.target.value }))
                          }
                          placeholder={question.kind === 'flag' ? 'FLAG{...}' : t('yourAnswer')}
                          aria-label={question.prompt}
                          aria-invalid={wrong || undefined}
                          className={cn(
                            'flex-1 rounded-lg border bg-slate-900 px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/60',
                            wrong ? 'border-red-500/50' : 'border-slate-700',
                          )}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="submit"
                          className="btn-press rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
                          disabled={!(inputs[question.id] ?? '').trim() || isPending}
                        >
                          {t('submit')}
                        </button>
                      </>
                    )}
                  </form>
                )}

                {/* inline feedback, announced politely */}
                <div aria-live="polite" className="empty:hidden">
                  {state?.status === 'auth' && !isSolved && (
                    <p className="mt-2 text-sm text-cyan-300">
                      {t('authRequired')}{' '}
                      <Link href={loginHref} className="font-semibold underline underline-offset-2">
                        {tByte('login')}
                      </Link>
                    </p>
                  )}
                  {state?.status === 'error' && !isSolved && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-orange-300">
                      <WifiOff size={14} aria-hidden="true" />
                      {t('networkError')}
                    </p>
                  )}
                  {wrong && <p className="mt-2 text-sm text-red-400">{t('wrongAnswer')}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* task navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="btn-press inline-flex items-center gap-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-30"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {t('previous')}
        </button>
        <span className="hidden text-xs text-slate-600 sm:inline">{t('keysHint')}</span>
        <button
          type="button"
          onClick={() => goTo(current + 1)}
          disabled={current === tasks.length - 1}
          className="btn-press inline-flex items-center gap-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-30"
        >
          {t('next')}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
