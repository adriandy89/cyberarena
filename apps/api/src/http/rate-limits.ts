import type { ThrottlerOptions } from '@nestjs/throttler';

type RouteLimit = Record<'default', Pick<ThrottlerOptions, 'limit' | 'ttl'>>;

/**
 * Per-route overrides of the global limit (120 requests / minute / IP,
 * constitution §1.5). Keyed on the real client IP thanks to `trust proxy`.
 */
export const RATE_LIMITS = {
  /** Public catalog reads: every page view triggers several server-side fetches. */
  publicRead: { default: { limit: 600, ttl: 60_000 } },
  /** Answer submissions: slows down flag/answer guessing. */
  answers: { default: { limit: 30, ttl: 60_000 } },
  /** Lab status: polled every 3 s while a lab starts, every 30 s after. */
  labStatus: { default: { limit: 240, ttl: 60_000 } },
  /** Lab heartbeats: one a minute per open room page, plus focus/visibility. */
  labHeartbeat: { default: { limit: 60, ttl: 60_000 } },
  /** Start, stop, extend: deliberate clicks. */
  labAction: { default: { limit: 20, ttl: 60_000 } },
} satisfies Record<string, RouteLimit>;
