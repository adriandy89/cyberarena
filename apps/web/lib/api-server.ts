import { headers } from 'next/headers';

/**
 * GET a JSON resource from the API in a Server Component.
 *
 * Server Components call the API directly (API_URL), not through the /api
 * rewrite, so the API would see every visitor as the web server. Forwarding
 * the visitor's X-Forwarded-For (set by Caddy) keeps its per-IP rate limit
 * per visitor (phase 011). Returns null on any error so pages can degrade.
 */
export async function fetchApiJson<T>(path: string, locale?: string): Promise<T | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const localeParam = locale === 'en' ? '?locale=en' : '';
  const forwardedFor = (await headers()).get('x-forwarded-for');
  try {
    const response = await fetch(`${apiUrl}${path}${localeParam}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
