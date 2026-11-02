/**
 * Which reverse proxies Express trusts for X-Forwarded-For (phase 011).
 *
 * Behind Caddy (and the web container's server-side fetches) every request
 * reaches the API from a private Docker address; without trusting those hops
 * `req.ip` is the proxy's address and the per-IP rate limit is shared by all
 * visitors. Caddy overwrites X-Forwarded-For with the real client address, so
 * trusting private ranges does not let clients spoof it in production.
 *
 * Override with TRUST_PROXY (any Express "trust proxy" value, or "false").
 */
export const DEFAULT_TRUST_PROXY = 'loopback, linklocal, uniquelocal';

export function trustProxySetting(value = process.env.TRUST_PROXY): string | boolean {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_TRUST_PROXY;
  if (trimmed === 'false') return false;
  if (trimmed === 'true') return true;
  return trimmed;
}
