/** Locales that may prefix an app path (mirrors apps/web/i18n/routing.ts). */
const LOCALE_PREFIX = /^\/(es|en)(?=\/|$)/;

/**
 * Validates a post-login `?next=` target (spec 010 T013). Only same-site,
 * locale-less app paths are accepted, which rules out open redirects such as
 * `//evil.com`, `/\evil.com`, `https://evil.com` or `javascript:` URLs.
 * Returns null when the value must be ignored.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  // Must be a single-slash absolute path: no scheme, no protocol-relative, no backslash tricks.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // No control characters (CR/LF/NUL…): checked by code point, not a control-char regex.
  if ([...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)) {
    return null;
  }
  if (value.length > 512) return null;

  // Parse against a dummy origin: anything resolving elsewhere is rejected.
  let url: URL;
  try {
    url = new URL(value, 'https://cyberarena.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'https://cyberarena.invalid') return null;

  const pathname = url.pathname.replace(LOCALE_PREFIX, '') || '/';
  if (pathname === '/login') return null; // avoid bouncing back to the form
  return `${pathname}${url.search}${url.hash}`;
}
