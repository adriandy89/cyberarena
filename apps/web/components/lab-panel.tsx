'use client';

import type { LabSessionView } from '@repo/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from '../i18n/navigation';
import { useLabSession } from '../lib/use-lab-session';
import { useByte } from './byte/byte-provider';
import {
  ExternalLink,
  FlaskConical,
  Hourglass,
  LoaderCircle,
  LogIn,
  Play,
  Plus,
  RotateCcw,
  ServerCrash,
  Square,
  Terminal,
  TriangleAlert,
  Users,
} from './icon';

export interface PanelLab {
  slug: string;
  /** Main lab of the room (false for extra labs used by some tasks). */
  main: boolean;
}

function CopyRow({ label, command }: { label: string; command: string }) {
  const t = useTranslations('LabPanel');
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable: the command remains selectable
    }
  }, [command]);
  return (
    <div>
      {label ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p> : null}
      <div className="mt-1 flex items-stretch gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-emerald-300">
          {command}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
        >
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </div>
  );
}

const BUTTON =
  'btn-press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const PRIMARY = `${BUTTON} bg-violet-500 text-white hover:bg-violet-400`;
const SECONDARY = `${BUTTON} border border-slate-700 text-slate-300 hover:border-violet-400/60 hover:text-violet-200`;

function Notice({ tone, icon, children }: { tone: 'info' | 'warn' | 'danger'; icon: ReactNode; children: ReactNode }) {
  const tones = {
    info: 'border-violet-500/30 bg-violet-500/10 text-violet-100',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  };
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${tones[tone]}`}>
      <span className="mt-px shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Manual commands (labs on demand disabled on this server). */
function ManualCommands({ slug }: { slug: string }) {
  const t = useTranslations('LabPanel');
  const base = `labs/${slug}`;
  return (
    <>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{t('intro')}</p>
      <div className="mt-4 space-y-3">
        <CopyRow label={t('upLabel')} command={`docker compose -f ${base}/compose.yaml --env-file ${base}/flags.env.example up -d`} />
        <CopyRow
          label={t('downLabel')}
          command={`docker compose -f ${base}/compose.yaml --env-file ${base}/flags.env.example down -v`}
        />
      </div>
    </>
  );
}

function Endpoints({ view }: { view: LabSessionView }) {
  const t = useTranslations('LabPanel');
  return (
    <div className="mt-3 space-y-3">
      {view.url ? (
        <a
          href={view.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          {t('open')} · {view.url}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
      {view.execCommand ? (
        <div>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Terminal size={13} aria-hidden="true" />
            {t('execHint')}
          </p>
          <div className="mt-1">
            <CopyRow label="" command={view.execCommand} />
          </div>
        </div>
      ) : null}
      {view.ports.length > 1 || view.ports.some((port) => port.protocol === 'udp') ? (
        <p className="text-xs text-slate-400">
          {t('ports')}:{' '}
          <span className="font-mono text-slate-300">
            {view.ports.map((port) => `${view.host}:${port.host}${port.protocol === 'udp' ? '/udp' : ''}`).join(' · ')}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Lab panel of a room (phases 007 and 011). With labs on demand enabled it
 * starts/stops the lab on the server and keeps it alive while the page is
 * open; otherwise it shows the manual docker compose commands.
 */
export function LabPanel({ roomSlug, labs }: { roomSlug: string; labs: PanelLab[] }) {
  const t = useTranslations('LabPanel');
  const [selected, setSelected] = useState(labs[0]?.slug ?? '');
  const tabs =
    labs.length > 1 ? (
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('chooseLab')}>
        {labs.map((candidate) => (
          <button
            key={candidate.slug}
            type="button"
            aria-pressed={candidate.slug === selected}
            onClick={() => setSelected(candidate.slug)}
            className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
              candidate.slug === selected
                ? 'bg-violet-500/25 text-violet-100'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {candidate.slug}
            {candidate.main ? '' : ` · ${t('extra')}`}
          </button>
        ))}
      </div>
    ) : null;
  // Keyed by lab: switching tabs starts from a clean session state.
  return (
    <LabPanelBody
      key={selected}
      slug={selected}
      roomSlug={roomSlug}
      roomLabs={labs}
      tabs={tabs}
      onSelect={setSelected}
    />
  );
}

function LabPanelBody({
  slug,
  roomSlug,
  roomLabs,
  tabs,
  onSelect,
}: {
  slug: string;
  roomSlug: string;
  roomLabs: PanelLab[];
  tabs: ReactNode;
  onSelect: (slug: string) => void;
}) {
  const t = useTranslations('LabPanel');
  const locale = useLocale();
  const { react } = useByte();
  const lab = useLabSession(slug);
  const { info, signedIn, view, busy, error, expired } = lab;
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  // Byte reactions on transitions.
  const previous = useRef<{ state?: string; expired: boolean; error?: string }>({ expired: false });
  useEffect(() => {
    const before = previous.current;
    if (view?.mine && view.state === 'running' && before.state === 'starting') react('labReady');
    if (expired && !before.expired) react('labExpired');
    if (error && error.code !== before.error && (error.code === 'LAB_RUNNER_DOWN' || error.code === 'LAB_UNAVAILABLE')) {
      react('labError');
    }
    previous.current = { state: view?.state, expired, error: error?.code };
  }, [view, expired, error, react]);

  const loginHref = `/login?next=${encodeURIComponent(`/rooms/${roomSlug}`)}`;
  let body: ReactNode;

  if (!info) {
    body = <div className="skeleton mt-3 h-9 rounded-lg" aria-hidden="true" />;
  } else if (!info.enabled) {
    body = <ManualCommands slug={slug} />;
  } else if (signedIn === false) {
    body = (
      <Notice tone="info" icon={<LogIn size={14} aria-hidden="true" />}>
        <p>{t('loginToStart')}</p>
        <Link href={loginHref} className={`${PRIMARY} mt-2`}>
          {t('login')}
        </Link>
      </Notice>
    );
  } else if (!view) {
    body = <div className="skeleton mt-3 h-9 rounded-lg" aria-hidden="true" />;
  } else if (!view.runnerUp) {
    body = (
      <Notice tone="danger" icon={<ServerCrash size={14} aria-hidden="true" />}>
        <p>{t('runnerDown')}</p>
        <button type="button" className={`${SECONDARY} mt-2`} onClick={() => void lab.refresh()}>
          <RotateCcw size={13} aria-hidden="true" />
          {t('retry')}
        </button>
      </Notice>
    );
  } else if (view.state === 'unavailable') {
    body = (
      <Notice tone="warn" icon={<TriangleAlert size={14} aria-hidden="true" />}>
        {t('unavailable')}
      </Notice>
    );
  } else if (view.mine) {
    const starting = view.state === 'starting' || busy === 'start' || busy === 'switch';
    const crashed = view.state === 'exited' || view.state === 'error' || view.state === 'stopped';
    body = (
      <>
        {starting ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-violet-100" role="status">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            {t('starting')} <span className="text-xs text-slate-400">{t('startingHint')}</span>
          </p>
        ) : crashed ? (
          <Notice tone="danger" icon={<TriangleAlert size={14} aria-hidden="true" />}>
            <p>{t('crashed')}</p>
            {view.lastError ? <p className="mt-1 truncate font-mono text-[11px] text-rose-200/80">{view.lastError}</p> : null}
            <button type="button" className={`${SECONDARY} mt-2`} disabled={busy !== null} onClick={() => void lab.start()}>
              <RotateCcw size={13} aria-hidden="true" />
              {t('restart')}
            </button>
          </Notice>
        ) : (
          <Endpoints view={view} />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {view.mine.canExtend ? (
            <button type="button" className={SECONDARY} disabled={busy !== null} onClick={() => void lab.extend()}>
              <Plus size={13} aria-hidden="true" />
              {t('extend')}
            </button>
          ) : null}
          <button type="button" className={SECONDARY} disabled={busy !== null} onClick={() => void lab.stop()}>
            {busy === 'stop' ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Square size={13} aria-hidden="true" />}
            {busy === 'stop' ? t('stopping') : t('stop')}
          </button>
          {view.users > 1 ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Users size={13} aria-hidden="true" />
              {t('users', { count: view.users })}
            </span>
          ) : null}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Hourglass size={13} aria-hidden="true" className="mt-px shrink-0 text-violet-300/80" />
          <span>
            {t('stopsAt', { time: time(view.mine.maxUntil) })} {t('keepOpen', { minutes: info.idleTimeoutMinutes })}
          </span>
        </p>
      </>
    );
  } else if (view.otherLab) {
    body = (
      <Notice tone="warn" icon={<FlaskConical size={14} aria-hidden="true" />}>
        <p>{t('otherLab', { slug: view.otherLab.slug })}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {view.otherLab.roomSlug && view.otherLab.roomSlug !== roomSlug ? (
            <Link href={`/rooms/${view.otherLab.roomSlug}`} className={SECONDARY}>
              {t('goToOther')}
            </Link>
          ) : null}
          {roomLabs.some((candidate) => candidate.slug === view.otherLab?.slug) ? (
            <button type="button" className={SECONDARY} onClick={() => onSelect(view.otherLab!.slug)}>
              {t('showOther')}
            </button>
          ) : null}
          <button type="button" className={PRIMARY} disabled={busy !== null} onClick={() => void lab.start(true)}>
            <Play size={13} aria-hidden="true" />
            {t('switchHere')}
          </button>
        </div>
      </Notice>
    );
  } else {
    body = (
      <>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{t('introOnDemand')}</p>
        {expired ? (
          <Notice tone="info" icon={<Hourglass size={14} aria-hidden="true" />}>
            {t('expired')}
          </Notice>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={PRIMARY} disabled={busy !== null} onClick={() => void lab.start()}>
            {busy ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
            {expired ? t('restart') : t('start')}
          </button>
          {view.users > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Users size={13} aria-hidden="true" />
              {t('users', { count: view.users })}
            </span>
          ) : null}
        </div>
      </>
    );
  }

  const errorNotice =
    error && info?.enabled && error.code !== 'LAB_OTHER_ACTIVE' ? (
      <Notice tone={error.code === 'LAB_CAPACITY' ? 'warn' : 'danger'} icon={<TriangleAlert size={14} aria-hidden="true" />}>
        {error.code === 'LAB_CAPACITY' ? (
          <p>
            {t('capacity')} {error.earliestFreeAt ? t('capacityAt', { time: time(error.earliestFreeAt) }) : null}
          </p>
        ) : error.code === 'LAB_RUNNER_DOWN' ? (
          <p>{t('runnerDown')}</p>
        ) : error.code === 'LAB_UNAVAILABLE' ? (
          <p>{t('unavailable')}</p>
        ) : (
          <p>{t('error')}</p>
        )}
      </Notice>
    ) : null;

  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5" data-testid="lab-panel" data-lab-state={view?.state ?? 'unknown'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-300">
          <FlaskConical size={16} aria-hidden="true" />
          {t('title')}
        </h2>
        {tabs}
      </div>
      {body}
      {errorNotice}
      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
        <TriangleAlert size={13} aria-hidden="true" className="mt-px shrink-0 text-amber-400/80" />
        {t('warning')}
      </p>
    </section>
  );
}
