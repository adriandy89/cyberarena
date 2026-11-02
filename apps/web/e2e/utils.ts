import { request, expect, type APIRequestContext, type BrowserContextOptions } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
// Same default as playwright.config.ts; the session cookie must match its host.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
// Against the production stack (https://localhost): Caddy's internal CA and the
// __Secure- session cookie (phase 012).
const HTTPS = BASE_URL.startsWith('https:');

/** Options for contexts created by hand (browser.newContext ignores `use`). */
export const TLS_OPTIONS = { ignoreHTTPSErrors: HTTPS };

/** POST that waits out better-auth's rate limit (prod: 3 sign-ins / 10 s / IP). */
async function postWithRetry(ctx: APIRequestContext, url: string, data: unknown) {
  for (let attempt = 0; ; attempt++) {
    const response = await ctx.post(url, { data });
    if (response.status() !== 429 || attempt >= 5) return response;
    const wait = Number(response.headers()['x-retry-after'] ?? 10);
    await new Promise((resolve) => setTimeout(resolve, (Number.isFinite(wait) ? wait : 10) * 1000 + 500));
  }
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

/** Unique-per-run user (email timestamp) so progress starts clean every time. */
export function makeTestUser(): TestUser {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    email: `e2e-${stamp}@cyberarena.test`,
    password: `E2ePass-${stamp}`,
    name: `E2E ${stamp}`,
  };
}

/** Registers + signs in via API and returns the session cookie header. */
export async function apiLogin(user: TestUser): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_URL, ignoreHTTPSErrors: HTTPS });
  try {
    const signup = await postWithRetry(ctx, '/api/auth/sign-up/email', {
      name: user.name,
      email: user.email,
      password: user.password,
    });
    expect(signup.ok(), `sign-up failed: ${await signup.text()}`).toBeTruthy();
  } finally {
    await ctx.dispose();
  }

  const ctx2 = await request.newContext({ baseURL: API_URL, ignoreHTTPSErrors: HTTPS });
  try {
    const signin = await postWithRetry(ctx2, '/api/auth/sign-in/email', {
      email: user.email,
      password: user.password,
    });
    expect(signin.ok(), 'sign-in failed').toBeTruthy();
    const setCookie = signin.headers()['set-cookie'];
    const token = (setCookie ?? '')
      .split(';')[0]!;
    return token;
  } finally {
    await ctx2.dispose();
  }
}

/**
 * Browser context options carrying the session cookie (same-origin via rewrite).
 * The cookie is scoped to the host of E2E_BASE_URL: pages that set their own
 * cookies (NEXT_LOCALE on /en) would otherwise drop the extra Cookie header.
 */
export function sessionCookieOptions(cookieHeader: string): BrowserContextOptions {
  const [name, value] = cookieHeader.split('=');
  return {
    ...TLS_OPTIONS,
    extraHTTPHeaders: { Cookie: cookieHeader },
    storageState: {
      cookies: [
        {
          name: name!,
          value: value ?? '',
          domain: new URL(BASE_URL).hostname,
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: HTTPS,
          sameSite: 'Lax' as const,
        },
      ],
      origins: [],
    },
  };
}

export type { APIRequestContext };
