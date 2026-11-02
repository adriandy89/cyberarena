/** Minimum Docker versions for volume.subpath and `!override` (011 spike). */
export const MIN_ENGINE = '26.0.0';
export const MIN_COMPOSE = '2.24.4';

/** True when `version` (e.g. "29.9.2", "v2.29.1-desktop.1") is >= `minimum`. */
export function meetsMinimum(version: string, minimum: string): boolean {
  const parse = (value: string) => (value.replace(/^v/, '').split(/[-+]/)[0] ?? '').split('.').map(Number);
  const actual = parse(version);
  const required = parse(minimum);
  if (actual.some(Number.isNaN) || actual.length === 0) return false;
  for (let i = 0; i < required.length; i++) {
    const a = actual[i] ?? 0;
    const r = required[i] ?? 0;
    if (a !== r) return a > r;
  }
  return true;
}
