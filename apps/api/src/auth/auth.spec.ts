import { describe, expect, it } from 'vitest';
import { createAuth } from './auth';
import type { PrismaClient } from '@repo/database';

describe('createAuth', () => {
  it('builds an instance where registration defaults role to STUDENT (never ADMIN)', () => {
    const auth = createAuth({
      prisma: {} as PrismaClient,
      sendEmail: async () => {},
    });
    const roleField = auth.options.user?.additionalFields?.role;
    expect(roleField).toBeDefined();
    expect(roleField?.defaultValue).toBe('STUDENT');
    expect(roleField?.input).toBe(false);
  });
});
