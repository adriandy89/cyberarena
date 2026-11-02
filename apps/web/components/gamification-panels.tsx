'use client';

import { useTranslations } from 'next-intl';
import type { CertificateItem } from '@repo/shared';
import { useEffect, useState } from 'react';
import { Link } from '../i18n/navigation';
import { Award, Flame, GraduationCap, Lock } from './icon';

interface StreakInfo {
  current: number;
  best: number;
  solvedToday: number;
  required: number;
  qualifiedToday: boolean;
}

interface BadgesResponse {
  awarded: Array<{ id: string; awardedAt: string }>;
  definitions: Array<{ id: string; earned: boolean }>;
}

interface SkillItem {
  tag: string;
  solved: number;
  total: number;
  percent: number;
}

/** Dashboard side panels: streak, badges, skills and certificates. */
export function GamificationPanels() {
  const t = useTranslations('Gamification');
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [badges, setBadges] = useState<BadgesResponse | null>(null);
  const [skills, setSkills] = useState<SkillItem[] | null>(null);
  const [certificates, setCertificates] = useState<CertificateItem[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [streakRes, badgesRes, skillsRes, certificatesRes] = await Promise.all([
          fetch('/api/me/streak', { credentials: 'include' }),
          fetch('/api/me/badges', { credentials: 'include' }),
          fetch('/api/me/skills', { credentials: 'include' }),
          fetch('/api/me/certificates', { credentials: 'include' }),
        ]);
        if (streakRes.ok) setStreak((await streakRes.json()) as StreakInfo);
        if (badgesRes.ok) setBadges((await badgesRes.json()) as BadgesResponse);
        if (skillsRes.ok) setSkills((await skillsRes.json()) as SkillItem[]);
        if (certificatesRes.ok)
          setCertificates((await certificatesRes.json()) as CertificateItem[]);
      } catch {
        // panels simply stay hidden on failure
      }
    })();
  }, []);

  function badgeName(id: string): string {
    if (id.startsWith('path-complete:')) {
      return t('badges.pathComplete', { slug: id.slice('path-complete:'.length) });
    }
    return t(`badges.${id}.name`);
  }

  return (
    <>
      {streak && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t('streakCard')}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 text-lg font-bold ${streak.current > 0 ? 'text-orange-400' : 'text-slate-500'}`}
            >
              <Flame size={18} aria-hidden="true" />
              {streak.current}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {streak.qualifiedToday
              ? t('streakDone', { required: streak.required })
              : t('streakTodo', { solved: streak.solvedToday, required: streak.required })}
          </p>
          <p className="mt-1 text-xs text-slate-600">{t('streakBest', { best: streak.best })}</p>
        </section>
      )}

      {badges && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('badgesCard', { earned: badges.awarded.length, total: badges.definitions.length })}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {badges.definitions.map((badge) => (
              <li
                key={badge.id}
                title={badgeName(badge.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold ${
                  badge.earned
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-600'
                }`}
              >
                {badge.earned ? (
                  <Award size={14} aria-hidden="true" className="shrink-0" />
                ) : (
                  <Lock size={14} aria-hidden="true" className="shrink-0" />
                )}
                <span className="truncate">{badgeName(badge.id)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {skills && skills.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('skillsCard')}
          </h2>
          <ul className="mt-4 space-y-3">
            {skills.map((skill) => (
              <li key={skill.tag}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">{skill.tag}</span>
                  <span className="text-slate-500">
                    {skill.solved}/{skill.total} · {skill.percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${skill.percent === 100 ? 'bg-emerald-400' : 'bg-sky-500/70'}`}
                    style={{ width: `${skill.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {certificates && certificates.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {t('certificatesCard')}
          </h2>
          <ul className="mt-4 space-y-2">
            {certificates.map((certificate) => (
              <li key={certificate.pathSlug}>
                <Link
                  href={`/certificate/${certificate.pathSlug}`}
                  className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm transition-colors hover:border-amber-400/60"
                >
                  <span className="inline-flex items-center gap-2 font-medium text-amber-200">
                    <GraduationCap size={16} aria-hidden="true" />
                    {certificate.pathTitle}
                  </span>
                  <span className="text-xs text-amber-300/80">{certificate.xpInPath} XP</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
