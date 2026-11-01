import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Relative same-origin path in the browser (Next's /api rewrite proxies to
// the NestJS API, ADR-008). Outside the browser (SSR/prerender) URL resolution
// requires an absolute base, so a dummy one is used; no requests are made
// during server rendering.
const baseURL =
  typeof window === 'undefined' ? 'http://ssr.invalid/api/auth' : '/api/auth';

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
