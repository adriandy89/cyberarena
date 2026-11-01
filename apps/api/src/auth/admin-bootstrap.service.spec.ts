import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@repo/database';
import { AdminBootstrapService } from './admin-bootstrap.service';
import type { AuthInstance } from './auth';

function makeService(overrides: {
  count?: number[];
  signUpEmail?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const count = vi.fn();
  (overrides.count ?? [0]).forEach((value) => count.mockReturnValueOnce(value));
  const update = overrides.update ?? vi.fn().mockResolvedValue({});
  const prisma = { user: { count, update } } as unknown as import('../prisma/prisma.service').PrismaService;
  const signUpEmail = overrides.signUpEmail ?? vi.fn().mockResolvedValue({ user: { id: 'u1' } });
  const auth = { api: { signUpEmail } } as unknown as AuthInstance;
  const service = new AdminBootstrapService(prisma, auth);
  vi.spyOn(service['logger'], 'error').mockImplementation(() => {});
  return { service, count, update, signUpEmail };
}

describe('AdminBootstrapService.bootstrap', () => {
  beforeEach(() => {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  });

  it('creates the admin when the users table is empty', async () => {
    const { service, signUpEmail, update } = makeService({ count: [0, 1, 1] });
    await service.bootstrap();
    expect(signUpEmail).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: Role.ADMIN, emailVerified: true },
    });
  });

  it('skips when users already exist (never runs after the first boot)', async () => {
    const { service, signUpEmail } = makeService({ count: [2] });
    await service.bootstrap();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('swallows USER_ALREADY_EXISTS (concurrent boots race on the unique email)', async () => {
    const { service } = makeService({
      count: [0],
      signUpEmail: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 'USER_ALREADY_EXISTS' })),
    });
    await expect(service.bootstrap()).resolves.toBeUndefined();
  });

  it('propagates unexpected errors so onModuleInit logs them', async () => {
    const { service } = makeService({
      count: [0],
      signUpEmail: vi.fn().mockRejectedValue(new Error('db down')),
    });
    await expect(service.bootstrap()).rejects.toThrow('db down');
  });

  it('uses the env password when valid and a generated 20-char one otherwise', async () => {
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'supersecret1';
    const a = makeService({ count: [0] });
    await a.service.bootstrap();
    expect(a.signUpEmail.mock.calls[0]![0].body.password).toBe('supersecret1');

    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const b = makeService({ count: [0] });
    await b.service.bootstrap();
    expect(b.signUpEmail.mock.calls[0]![0].body.password).toMatch(/^.{20}$/);
  });
});

describe('AdminBootstrapService.verifyAdminExists', () => {
  it('flags (error log) when users exist but no admin does', async () => {
    const { service } = makeService({ count: [3, 0] });
    await service.verifyAdminExists();
    expect(service['logger'].error).toHaveBeenCalled();
  });

  it('stays silent when an admin exists', async () => {
    const { service } = makeService({ count: [3, 1] });
    await service.verifyAdminExists();
    expect(service['logger'].error).not.toHaveBeenCalled();
  });
});
