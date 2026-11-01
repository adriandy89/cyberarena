import { describe, expect, it } from 'vitest';
import { hashAnswer } from './answers';

describe('hashAnswer', () => {
  it('is stable and case/whitespace-insensitive (matches isCorrectAnswer rule)', () => {
    expect(hashAnswer('FLAG{Bienvenido_A_CyberArena}')).toBe(hashAnswer('  flag{bienvenido_a_cyberarena} '));
    expect(hashAnswer('Regla  de Compromiso')).toBe(hashAnswer('regla de compromiso'));
  });

  it('produces a sha256 hex digest', () => {
    expect(hashAnswer('x')).toMatch(/^[a-f0-9]{64}$/);
  });
});
