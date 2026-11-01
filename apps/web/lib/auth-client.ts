import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Absolute URL always: better-auth validates baseURL with `new URL(...)` and
// rejects relative paths. In the browser, requests stay same-origin through the
// /api rewrite (dev) or the reverse proxy (prod) — ADR-008. During SSR/prerender
// a dummy host is used; no requests are made while server-rendering.
const baseURL =
  typeof window === 'undefined'
    ? 'http://ssr.invalid/api/auth'
    : `${window.location.origin}/api/auth`;

/**
 * Browser auth client. inferAdditionalFields mirrors the server's
 * user.additionalFields (apps/api/src/auth/auth.ts) so the session user is
 * fully typed here.
 */
export const authClient = createAuthClient({
  baseURL,
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: 'string', input: false },
      },
    }),
  ],
});

export type Session = typeof authClient.$Infer.Session;
export type SessionUser = typeof authClient.$Infer.Session.user;
