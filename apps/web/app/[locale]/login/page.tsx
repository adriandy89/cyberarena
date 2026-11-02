'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';

type Mode = 'signin' | 'signup';

function mapError(code: string | undefined, fallback: string, t: (key: string) => string): string {
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return t('errors.invalidCredentials');
    case 'USER_ALREADY_EXISTS':
    case 'USER_EXISTS':
      return t('errors.userExists');
    case 'PASSWORD_TOO_SHORT':
      return t('errors.passwordTooShort');
    case 'INVALID_EMAIL':
      return t('errors.invalidEmail');
    default:
      return fallback || t('errors.generic');
  }
}

export default function LoginPage() {
  const t = useTranslations('LoginPage');
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(mapError(result.error.code, result.error.message ?? '', t));
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/60';

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === 'signin' ? t('signInTitle') : t('signUpTitle')}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {mode === 'signup' && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {t('name')}
            </span>
            <input
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              autoComplete="name"
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t('email')}
          </span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t('password')}
          </span>
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {submitting ? t('submitting') : mode === 'signin' ? t('signIn') : t('signUp')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
        }}
        className="mt-6 text-sm text-slate-400 transition-colors hover:text-slate-200"
      >
        {mode === 'signin' ? t('switchToSignUp') : t('switchToSignIn')}
      </button>
    </div>
  );
}
