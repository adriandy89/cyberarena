import { describe, expect, it } from 'vitest';
import { Role } from '@repo/database';
import { resolveBootstrapRole } from './auth';

describe('resolveBootstrapRole', () => {
  it('makes the very first user ADMIN', () => {
    expect(resolveBootstrapRole(0)).toBe(Role.ADMIN);
  });

  it('makes every subsequent user STUDENT', () => {
    expect(resolveBootstrapRole(1)).toBe(Role.STUDENT);
    expect(resolveBootstrapRole(500)).toBe(Role.STUDENT);
  });
});
