'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { authClient } from '../lib/auth-client';

/**
 * Security panel: enable/disable TOTP 2FA with QR code and backup codes.
 */
export function SecurityPanel() {
  const t = useTranslations('SecurityPanel');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/auth/two-factor/status', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setTwoFactorEnabled(Boolean(data?.enabled));
        }
      } catch {
        // panel stays hidden on failure
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function startSetup() {
    setError(null);
    setSuccess(null);
    setShowSetup(true);
    try {
      const res = await authClient.twoFactor.enable({
        password: undefined,
        method: 'totp',
      });
      if (res.data) {
        setQrCode((res.data as { totpURI?: string })?.totpURI || '');
        setSecret((res.data as { totpURI?: string })?.totpURI?.split('secret=')[1]?.split('&')[0] || '');
        setBackupCodes((res.data as { backupCodes?: string[] })?.backupCodes || []);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function verifyAndActivate() {
    setError(null);
    setSuccess(null);
    try {
      const res = await authClient.twoFactor.verifyTotp({
        code: verifyCode,
      });
      if (res.data) {
        setSuccess(t('enabled'));
        setTwoFactorEnabled(true);
        setShowSetup(false);
        setVerifyCode('');
      } else {
        setError(t('invalidCode'));
      }
    } catch {
      setError(t('invalidCode'));
    }
  }

  async function disable() {
    setError(null);
    setSuccess(null);
    try {
      await authClient.twoFactor.disable({
        password: undefined,
      });
      setTwoFactorEnabled(false);
      setSuccess(t('disabled'));
    } catch (e) {
      setError(String(e));
    }
  }

  if (loading) return null;

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {t('title')}
      </h2>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">{t('totpLabel')}</p>
          <p className="text-xs text-slate-500">{t('totpDescription')}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            twoFactorEnabled
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-slate-700/50 text-slate-400'
          }`}
        >
          {twoFactorEnabled ? t('active') : t('inactive')}
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-sm text-emerald-400">
          {success}
        </p>
      )}

      {showSetup && !twoFactorEnabled && (
        <div className="mt-4 space-y-4 rounded-lg border border-slate-700 bg-slate-950/50 p-4">
          <p className="text-sm font-medium text-slate-200">{t('scanQR')}</p>

          {qrCode && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-500">{t('orManual')}:</p>
              <code className="break-all rounded bg-slate-900 p-2 font-mono text-xs text-emerald-300">
                {secret}
              </code>
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder={t('codePlaceholder')}
              maxLength={6}
              className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:border-emerald-500/60"
            />
            <button
              type="button"
              onClick={() => void verifyAndActivate()}
              disabled={verifyCode.length !== 6}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {t('verify')}
            </button>
          </div>

          {backupCodes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400">{t('backupCodes')}</p>
              <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                {backupCodes.map((code) => (
                  <code key={code} className="rounded bg-slate-900 px-2 py-1 text-xs text-amber-300">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {!twoFactorEnabled && !showSetup && (
          <button
            type="button"
            onClick={() => void startSetup()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            {t('enable')}
          </button>
        )}
        {twoFactorEnabled && (
          <button
            type="button"
            onClick={() => void disable()}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
          >
            {t('disable')}
          </button>
        )}
        {showSetup && !twoFactorEnabled && (
          <button
            type="button"
            onClick={() => setShowSetup(false)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400"
          >
            {t('cancel')}
          </button>
        )}
      </div>
    </section>
  );
}
