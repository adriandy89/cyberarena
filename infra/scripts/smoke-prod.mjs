#!/usr/bin/env node
// Smoke test of the production stack (phase 012). From the repo root:
//   node infra/scripts/smoke-prod.mjs [--base https://localhost] [--no-crawl]
// TLS is verified for real against Caddy's internal CA (exported from the proxy
// container), not disabled. The admin password is read from the secrets file
// and never printed.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const BASE = option('--base', 'https://localhost').replace(/\/$/, '');
const PROXY = option('--proxy', 'cyberarena-proxy-caddy-1');

// Re-run with Caddy's root certificate trusted (Node reads it only at startup).
if (BASE.startsWith('https://localhost') && !process.env.NODE_EXTRA_CA_CERTS) {
  const cert = join(tmpdir(), 'cyberarena-caddy-root.crt');
  execFileSync('docker', ['cp', `${PROXY}:/data/caddy/pki/authorities/local/root.crt`, cert]);
  const run = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_EXTRA_CA_CERTS: cert },
  });
  process.exit(run.status ?? 1);
}

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML or empty
  }
  return { status: response.status, headers: response.headers, text, json };
}

function envValue(file, key) {
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : null;
}

try {
  // TLS + health.
  const live = await get('/api/health/live');
  check('TLS with Caddy internal CA + /api/health/live', live.status === 200);
  const health = await get('/api/health');
  check(
    '/api/health: ok, db up, labs runner up',
    health.json?.status === 'ok' && health.json?.db === 'up' && health.json?.labs?.runner === 'up',
    JSON.stringify(health.json),
  );
  const security = await get('/es');
  check(
    'security headers on pages',
    security.headers.get('x-content-type-options') === 'nosniff' && security.headers.get('x-frame-options') === 'DENY',
  );

  // Pages and catalog.
  for (const path of ['/', '/es', '/en', '/es/paths', '/en/hacktivities', '/es/status']) {
    const page = await get(path);
    check(`GET ${path}`, page.status === 200 || (path === '/' && [307, 308].includes(page.status)), String(page.status));
  }
  const es = (await get('/api/catalog')).json ?? [];
  const en = (await get('/api/catalog?locale=en')).json ?? [];
  const rooms = es.reduce((sum, path) => sum + path.roomCount, 0);
  check('catalog: 4 paths, 59 rooms', es.length === 4 && rooms === 59, `${es.length} paths, ${rooms} rooms`);
  const esDesc = es.find((path) => path.slug === 'cyber-security-101')?.description;
  const enDesc = en.find((path) => path.slug === 'cyber-security-101')?.description;
  check('catalog EN is really English', Boolean(enDesc) && enDesc !== esDesc, enDesc?.slice(0, 60));
  const hack = await get('/api/hacktivities?take=50');
  check('hacktivities', hack.status === 200 && (hack.json?.total ?? 0) >= 59, `total=${hack.json?.total}`);
  const labs = await get('/api/labs');
  check('labs on demand enabled', labs.json?.enabled === true, JSON.stringify(labs.json));

  // Admin login (bootstrap admin) and an admin-only endpoint.
  const email = envValue('infra/stacks/prod/.env', 'BOOTSTRAP_ADMIN_EMAIL') ?? 'admin@cyberarena.local';
  const password = readFileSync('infra/stacks/prod/secrets/bootstrap_admin_password', 'utf8').replace(/[\r\n]/g, '');
  const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0];
  check('admin sign-in (secure cookie)', signIn.status === 200 && cookie.startsWith('__Secure-'), cookie.split('=')[0]);
  const me = await get('/api/users/me', { headers: { Cookie: cookie } });
  check('admin role', me.json?.role === 'ADMIN');
  const adminLabs = await get('/api/admin/labs', { headers: { Cookie: cookie } });
  check('admin labs overview', adminLabs.status === 200 && adminLabs.json?.health?.runner === 'up');
  const pdf = await get('/api/me/certificates/cyber-security-101/pdf', { headers: { Cookie: cookie } });
  check('certificate PDF endpoint alive (path not completed → 404)', pdf.status === 404, String(pdf.status));

  // Every room page, ES and EN, through the web (SSR → API with the client IP).
  if (!flag('--no-crawl')) {
    const slugs = [];
    for (let skip = 0; skip < 200; skip += 50) {
      const batch = (await get(`/api/hacktivities?take=50&skip=${skip}`)).json?.rooms ?? [];
      slugs.push(...batch.map((item) => item.slug));
      if (batch.length < 50) break;
    }
    let bad = [];
    for (const slug of slugs) {
      for (const locale of ['es', 'en']) {
        const page = await get(`/${locale}/rooms/${slug}`);
        if (page.status !== 200) bad.push(`${locale}/${slug}:${page.status}`);
        await sleep(250);
      }
    }
    check(`room pages ES+EN (${slugs.length * 2})`, slugs.length === 59 && bad.length === 0, bad.slice(0, 5).join(' '));
  }
} catch (error) {
  check('smoke run', false, error instanceof Error ? `${error.message} ${error.cause?.code ?? ''}` : String(error));
}

console.log(failures === 0 ? '\nsmoke OK' : `\nsmoke FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
