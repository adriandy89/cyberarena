import { describe, expect, it } from 'vitest';
import { safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it('accepts internal app paths', () => {
    expect(safeNextPath('/rooms/linux-fundamentos-1')).toBe('/rooms/linux-fundamentos-1');
    expect(safeNextPath('/paths/cyber-security-101?x=1#m2')).toBe(
      '/paths/cyber-security-101?x=1#m2',
    );
    expect(safeNextPath('/')).toBe('/');
  });

  it('strips a leading locale so the i18n router can re-add the current one', () => {
    expect(safeNextPath('/es/rooms/a')).toBe('/rooms/a');
    expect(safeNextPath('/en')).toBe('/');
    expect(safeNextPath('/english-room')).toBe('/english-room');
  });

  it.each([
    null,
    undefined,
    '',
    'rooms/a',
    '//evil.com',
    '//evil.com/rooms',
    '/\\evil.com',
    '\\\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/rooms/a\nLocation: x',
  ])('rejects unsafe target %s', (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it('keeps percent-encoded characters encoded (still same-origin)', () => {
    expect(safeNextPath('/%0d%0aSet-Cookie:x')).toBe('/%0d%0aSet-Cookie:x');
  });

  it('never sends the user back to the login form', () => {
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath('/es/login')).toBeNull();
  });
});
