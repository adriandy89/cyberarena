'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

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
}

type QuestionState = { status: 'idle' } | { status: 'wrong' } | { status: 'correct'; xp: number };

export function RoomPlayer({ roomSlug, tasks }: { roomSlug: string; tasks: PlayerTask[] }) {
  const t = useTranslations('RoomPlayer');
  const [current, setCurrent] = useState(0);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Record<string, QuestionState>>({});
  const [hintsOpen, setHintsOpen] = useState<Set<string>>(new Set());
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [roomCompleted, setRoomCompleted] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(
    tasks.reduce((sum, task) => sum + task.questions.length, 0),
  );

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/rooms/${roomSlug}/progress`, {
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = (await response.json()) as { solvedQuestionIds: string[]; roomCompleted: boolean };
        setSolved(new Set(data.solvedQuestionIds));
        setRoomCompleted(data.roomCompleted);
      } catch {
        // progress is optional for viewing; submissions will surface errors
      }
    })();
  }, [roomSlug]);

  const submit = useCallback(
    async (questionId: string, answer: string) => {
      if (!answer.trim() || solved.has(questionId)) return;
      try {
        const response = await fetch(`/api/rooms/${roomSlug}/answers`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, answer }),
        });
        if (response.status === 401) {
          setStates((prev) => ({ ...prev, [questionId]: { status: 'wrong' } }));
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as SubmitResult;
        if (data.correct) {
          setSolved((prev) => new Set(prev).add(questionId));
          setStates((prev) => ({ ...prev, [questionId]: { status: 'correct', xp: data.xpAwarded } }));
          if (data.roomCompleted) setRoomCompleted(true);
        } else {
          setStates((prev) => ({ ...prev, [questionId]: { status: 'wrong' } }));
        }
      } catch {
        // network error: keep idle so the student can retry
      }
    },
    [roomSlug, solved],
  );

  const task = tasks[current]!;
  const solvedCount = solved.size;

  return (
    <div className="space-y-6">
      {/* progress header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap gap-2">
          {tasks.map((item, i) => {
            const taskSolved = item.questions.every((q) => solved.has(q.id));
            const isCurrent = i === current;
            return (
              <button
                key={item.index}
                type="button"
                onClick={() => setCurrent(i)}
                aria-current={isCurrent}
                className={`h-8 w-8 rounded-full border text-xs font-bold transition-colors ${
                  taskSolved
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                    : isCurrent
                      ? 'border-slate-400 bg-slate-800 text-slate-100'
                      : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
                }`}
              >
                {item.index}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-slate-400">
          {t('progress', { solved: solvedCount, total: totalQuestions })}
        </span>
      </div>

      {roomCompleted && (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400">
          🎉 {t('roomCompleted')}
        </p>
      )}

      {/* task */}
      <article className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <header className="mb-4 border-b border-slate-800 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {t('taskOf', { index: task.index, total: tasks.length })}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">{task.title}</h2>
        </header>
        {task.body}
      </article>

      {/* questions */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {t('answerQuestions')}
        </h3>
        <ul className="mt-4 space-y-6">
          {task.questions.map((question, i) => {
            const state = states[question.id];
            const isSolved = solved.has(question.id);
            return (
              <li key={question.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm font-medium text-slate-200">
                  <span className="mr-2 text-slate-500">{i + 1}.</span>
                  {question.prompt}
                </p>

                {question.hint && !isSolved && (
                  <div className="mt-2">
                    {hintsOpen.has(question.id) ? (
                      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
                        💡 {question.hint}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setHintsOpen((prev) => new Set(prev).add(question.id))}
                        className="text-xs text-amber-400/80 underline underline-offset-2 hover:text-amber-300"
                      >
                        {t('showHint')}
                      </button>
                    )}
                  </div>
                )}

                {isSolved ? (
                  <p className="mt-3 text-sm font-semibold text-emerald-400">
                    ✓ {t('solved')}
                    {state?.status === 'correct' && state.xp > 0 ? (
                      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs">
                        +{state.xp} XP
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <form
                    className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit(question.id, inputs[question.id] ?? '');
                    }}
                  >
                    {question.kind === 'choice' && question.options ? (
                      <div className="flex-1 space-y-2">
                        {question.options.map((option) => (
                          <label
                            key={option.id}
                            className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors has-checked:border-emerald-500/50 has-checked:bg-emerald-500/10"
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={option.id}
                              checked={inputs[question.id] === option.id}
                              onChange={() => setInputs((prev) => ({ ...prev, [question.id]: option.id }))}
                              className="mt-1 accent-emerald-500"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                        <button
                          type="submit"
                          disabled={!inputs[question.id]}
                          className="self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
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
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/60"
                          autoComplete="off"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
                          disabled={!(inputs[question.id] ?? '').trim()}
                        >
                          {t('submit')}
                        </button>
                      </>
                    )}
                  </form>
                )}

                {state?.status === 'wrong' && !isSolved && (
                  <p className="mt-2 text-sm text-red-400">{t('wrongAnswer')}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-30"
        >
          ← {t('previous')}
        </button>
        <button
          type="button"
          onClick={() => setCurrent((c) => Math.min(tasks.length - 1, c + 1))}
          disabled={current === tasks.length - 1}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-30"
        >
          {t('next')} →
        </button>
      </div>
    </div>
  );
}
