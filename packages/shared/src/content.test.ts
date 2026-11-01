import { describe, expect, it } from 'vitest';
import { isCorrectAnswer, isFlag, normalizeAnswer } from './content';

describe('isFlag', () => {
  it('accepts FLAG{snake_case} format', () => {
    expect(isFlag('FLAG{found_the_flag}')).toBe(true);
    expect(isFlag('  FLAG{Found_It_123}  ')).toBe(true);
  });

  it('rejects malformed flags', () => {
    expect(isFlag('flag{lowercase_braces}')).toBe(false);
    expect(isFlag('FLAG{has spaces}')).toBe(false);
    expect(isFlag('FLAG{no-closing')).toBe(false);
    expect(isFlag('THM{other_platform}')).toBe(false);
    expect(isFlag('')).toBe(false);
  });
});

describe('normalizeAnswer', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeAnswer('  nmap   -sV   ')).toBe('nmap -sV');
    expect(normalizeAnswer('\tfoo\n')).toBe('foo');
  });
});

describe('isCorrectAnswer', () => {
  it('compares case-insensitively after normalization (student-friendly)', () => {
    expect(isCorrectAnswer('flag{great_job}', 'FLAG{GREAT_JOB}')).toBe(true);
    expect(isCorrectAnswer(' FLAG{ok} ', 'FLAG{ok}')).toBe(true);
    expect(isCorrectAnswer('nmap  -sV', 'Nmap -sV')).toBe(true);
    expect(isCorrectAnswer('Regla De Compromiso', 'regla de compromiso')).toBe(true);
    expect(isCorrectAnswer('FLAG{nope}', 'FLAG{other}')).toBe(false);
  });

  it('rejects empty submissions', () => {
    expect(isCorrectAnswer('', 'FLAG{x}')).toBe(false);
    expect(isCorrectAnswer('   ', 'FLAG{x}')).toBe(false);
  });
});
