import { request, expect, type APIRequestContext, type BrowserContextOptions } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

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
  const ctx = await request.newContext({ baseURL: API_URL });
  try {
    const signup = await ctx.post('/api/auth/sign-up/email', {
      data: { name: user.name, email: user.email, password: user.password },
    });
    expect(signup.ok(), `sign-up failed: ${await signup.text()}`).toBeTruthy();
  } finally {
    await ctx.dispose();
  }

  const ctx2 = await request.newContext({ baseURL: API_URL });
  try {
    const signin = await ctx2.post('/api/auth/sign-in/email', {
      data: { email: user.email, password: user.password },
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

/** Browser context options carrying the session cookie (same-origin via rewrite). */
export function sessionCookieOptions(cookieHeader: string): BrowserContextOptions {
  const [name, value] = cookieHeader.split('=');
  return {
    extraHTTPHeaders: { Cookie: cookieHeader },
    storageState: {
      cookies: [
        {
          name: name!,
          value: value ?? '',
          domain: '127.0.0.1',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      origins: [],
    },
  };
}

export type { APIRequestContext };
