import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '../auth/auth-module-types';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminLabsController } from './admin-labs.controller';
import { loadLabsConfig, type LabsConfig } from './labs.config';
import { LabsReaper } from './labs.reaper';
import { LabsService } from './labs.service';
import { RunnerRejectedError, RunnerUnavailableError, type LabRunnerClient, type RunnerLabView } from './runner.client';

interface LeaseRow {
  userId: string;
  labSlug: string;
  startedAt: Date;
  lastSeenAt: Date;
  maxUntil: Date;
}

/** In-memory Prisma for the tables the labs service touches; transactions roll back on error. */
class FakePrisma {
  leases = new Map<string, LeaseRow>();
  events: Array<{ labSlug: string; userId: string | null; type: string; detail?: unknown; at: Date }> = [];
  users = [
    { id: 'ana', name: 'Ana', email: 'ana@test' },
    { id: 'bob', name: 'Bob', email: 'bob@test' },
  ];
  rooms = [
    { slug: 'sqli-basico', lab: 'sqli-basico', extraLabs: ['sqli-blind'] },
    { slug: 'privesc-linux', lab: 'privesc-linux-1', extraLabs: [] },
    { slug: 'xss-reflejado', lab: 'xss-reflejado', extraLabs: [] },
    { slug: 'ssrf-basico', lab: 'ssrf-basico', extraLabs: [] },
  ];

  labLease = {
    findMany: async () => [...this.leases.values()].map((row) => ({ ...row })),
    findUnique: async ({ where }: { where: { userId: string } }) => {
      const row = this.leases.get(where.userId);
      return row ? { ...row } : null;
    },
    update: async ({ where, data }: { where: { userId: string }; data: Partial<LeaseRow> }) => {
      const row = this.leases.get(where.userId);
      if (!row) throw new Error('not found');
      Object.assign(row, data);
      return { ...row };
    },
    upsert: async ({ where, create, update }: { where: { userId: string }; create: LeaseRow; update: Partial<LeaseRow> }) => {
      const row = this.leases.get(where.userId);
      if (row) Object.assign(row, update);
      else this.leases.set(where.userId, { ...create });
      return { ...this.leases.get(where.userId)! };
    },
    delete: async ({ where }: { where: { userId: string } }) => {
      this.leases.delete(where.userId);
      return {};
    },
    deleteMany: async ({ where = {} }: { where?: { labSlug?: string } }) => {
      let count = 0;
      for (const [userId, row] of this.leases) {
        if (where.labSlug === undefined || row.labSlug === where.labSlug) {
          this.leases.delete(userId);
          count++;
        }
      }
      return { count };
    },
  };

  labEvent = {
    create: async ({ data }: { data: { labSlug: string; userId: string | null; type: string; detail?: unknown } }) => {
      const event = { ...data, at: this.clock() };
      this.events.push(event);
      return event;
    },
    findMany: async () => [...this.events].reverse().map((event) => ({ ...event, detail: event.detail ?? null })),
    deleteMany: async ({ where }: { where: { at: { lt: Date } } }) => {
      const before = this.events.length;
      this.events = this.events.filter((event) => event.at >= where.at.lt);
      return { count: before - this.events.length };
    },
  };

  user = {
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      this.users.filter((user) => where.id.in.includes(user.id)),
  };

  clock: () => Date = () => new Date();

  room = { findMany: async () => this.rooms };

  $queryRaw = async () => [{ locked: 1 }];

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    const leases = new Map([...this.leases].map(([key, row]) => [key, { ...row }]));
    const events = [...this.events];
    try {
      return await fn(this);
    } catch (error) {
      this.leases = leases;
      this.events = events;
      throw error;
    }
  }
}

class FakeRunner {
  calls: string[] = [];
  state = new Map<string, RunnerLabView['state']>();
  failWith: Error | null = null;

  private view(slug: string): RunnerLabView {
    const exec = slug === 'privesc-linux-1';
    return {
      slug,
      state: this.state.get(slug) ?? 'stopped',
      deadline: null,
      startedAt: null,
      lastError: null,
      access: exec ? 'exec' : 'http',
      url: exec ? null : 'http://127.0.0.1:18081',
      ports: exec ? [] : [{ service: 'web', host: 18081, container: 8080, protocol: 'tcp' }],
      execService: exec ? 'shell' : null,
      project: `lab-${slug}`,
    };
  }

  async get(slug: string) {
    if (this.failWith) throw this.failWith;
    return this.view(slug);
  }
  async up(slug: string) {
    this.calls.push(`up ${slug}`);
    if (this.failWith) throw this.failWith;
    this.state.set(slug, 'starting');
    return this.view(slug);
  }
  async down(slug: string) {
    this.calls.push(`down ${slug}`);
    if (this.failWith) throw this.failWith;
    this.state.set(slug, 'stopped');
    return this.view(slug);
  }
  async renew(slugs: string[], ttl: number) {
    this.calls.push(`renew ${slugs.join(',')} ${ttl}`);
    if (this.failWith) throw this.failWith;
    return { renewed: slugs, notRunning: [] };
  }
  async health() {
    if (this.failWith) throw this.failWith;
    return { ok: true, running: [...this.state.values()].filter((state) => state !== 'stopped').length };
  }
  async list() {
    return [...this.state.keys()].map((slug) => this.view(slug));
  }
  async downAll() {
    this.calls.push('down-all');
    this.state.clear();
  }
}

const MIN = 60_000;
const TOKEN = 't'.repeat(40);
let prisma: FakePrisma;
let runner: FakeRunner;
let config: LabsConfig;
let now: Date;

function makeService(overrides: Partial<LabsConfig> = {}): LabsService {
  const service = new LabsService(
    prisma as unknown as PrismaService,
    { ...config, ...overrides },
    runner as unknown as LabRunnerClient,
  );
  service.clock = () => now;
  return service;
}

async function codeOf(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected an error');
}

beforeEach(() => {
  prisma = new FakePrisma();
  prisma.clock = () => now;
  runner = new FakeRunner();
  config = loadLabsConfig({ LABS_ENABLED: 'true', LAB_RUNNER_TOKEN: TOKEN });
  now = new Date('2026-11-02T10:00:00Z');
});

describe('LabsService.start', () => {
  it('leases the lab, starts it and renews its deadline', async () => {
    const view = await makeService().start('sqli-basico', 'ana');
    expect(prisma.leases.get('ana')).toMatchObject({ labSlug: 'sqli-basico', maxUntil: new Date(now.getTime() + 120 * MIN) });
    expect(prisma.events.map((event) => event.type)).toEqual(['START']);
    expect(runner.calls).toEqual(['up sqli-basico', 'renew sqli-basico 180']);
    expect(view).toMatchObject({ state: 'starting', users: 1, url: 'http://127.0.0.1:18081', otherLab: null });
    expect(view.mine).toMatchObject({ canExtend: false, idleDeadline: new Date(now.getTime() + 10 * MIN).toISOString() });
  });

  it('is idempotent for the same lab (no second START, heartbeat refreshed)', async () => {
    const service = makeService();
    await service.start('sqli-basico', 'ana');
    now = new Date(now.getTime() + 5 * MIN);
    await service.start('sqli-basico', 'ana');
    expect(prisma.events.filter((event) => event.type === 'START')).toHaveLength(1);
    expect(prisma.leases.get('ana')?.lastSeenAt).toEqual(now);
  });

  it('allows extra labs of a room and refuses labs no room offers', async () => {
    const service = makeService();
    await expect(service.start('sqli-blind', 'ana')).resolves.toMatchObject({ slug: 'sqli-blind' });
    expect(await codeOf(service.start('not-a-lab', 'bob'))).toMatchObject({ status: 404, body: { code: 'LAB_UNKNOWN' } });
  });

  it('refuses a second lab unless the user switches', async () => {
    const service = makeService();
    await service.start('sqli-basico', 'ana');
    expect(await codeOf(service.start('xss-reflejado', 'ana'))).toMatchObject({
      status: 409,
      body: { code: 'LAB_OTHER_ACTIVE', otherLab: { slug: 'sqli-basico', roomSlug: 'sqli-basico' } },
    });
    await service.start('xss-reflejado', 'ana', true);
    expect(prisma.leases.get('ana')?.labSlug).toBe('xss-reflejado');
    expect(prisma.events.map((event) => event.type)).toEqual(['START', 'SWITCH', 'START']);
    expect(runner.calls).toContain('down sqli-basico');
  });

  it('shares a lab: stopping only ends the caller lease until the last one leaves', async () => {
    const service = makeService();
    await service.start('sqli-basico', 'ana');
    const joined = await service.start('sqli-basico', 'bob');
    expect(joined.users).toBe(2);
    await service.stop('sqli-basico', 'ana');
    expect(runner.calls).not.toContain('down sqli-basico');
    await service.stop('sqli-basico', 'bob');
    expect(runner.calls).toContain('down sqli-basico');
    expect(prisma.events.filter((event) => event.type === 'STOP')).toHaveLength(2);
  });

  it('caps the number of labs with leases and says when a slot frees up', async () => {
    const service = makeService();
    await service.start('sqli-basico', 'u1');
    await service.start('xss-reflejado', 'u2');
    await service.start('ssrf-basico', 'u3');
    const full = await codeOf(service.start('privesc-linux-1', 'u4'));
    expect(full).toMatchObject({ status: 409, body: { code: 'LAB_CAPACITY' } });
    expect(full.body.earliestFreeAt).toBe(new Date(now.getTime() + 10 * MIN).toISOString());
    // Joining a lab that is already up does not need a new slot.
    await expect(service.start('ssrf-basico', 'u4')).resolves.toMatchObject({ users: 2 });
  });

  it('ignores expired leases for capacity and replaces the caller expired lease', async () => {
    const service = makeService();
    await service.start('sqli-basico', 'ana');
    now = new Date(now.getTime() + 11 * MIN); // ana stopped sending heartbeats
    await service.start('xss-reflejado', 'ana');
    expect(prisma.leases.get('ana')).toMatchObject({ labSlug: 'xss-reflejado', startedAt: now });
  });

  it('rolls back the lease when the runner is down or refuses', async () => {
    runner.failWith = new RunnerUnavailableError('connect ECONNREFUSED');
    expect(await codeOf(makeService().start('sqli-basico', 'ana'))).toMatchObject({
      status: 503,
      body: { code: 'LAB_RUNNER_DOWN' },
    });
    expect(prisma.leases.size).toBe(0);
    expect(prisma.events).toEqual([]);
    runner.failWith = new RunnerRejectedError(422, 'unavailable', 'no flags file');
    expect(await codeOf(makeService().start('sqli-basico', 'ana'))).toMatchObject({
      status: 422,
      body: { code: 'LAB_UNAVAILABLE' },
    });
  });

  it('is off when LABS_ENABLED is false', async () => {
    expect(await codeOf(makeService({ enabled: false }).start('sqli-basico', 'ana'))).toMatchObject({
      status: 503,
      body: { code: 'LAB_DISABLED' },
    });
  });
});

describe('heartbeat, extend and status', () => {
  it('heartbeats keep the lease; an expired or foreign lease reports inactive', async () => {
    const service = makeService();
    await service.start('sqli-basico', 'ana');
    now = new Date(now.getTime() + 9 * MIN);
    expect(await service.heartbeat('sqli-basico', 'ana')).toEqual({ active: true });
    expect(prisma.leases.get('ana')?.lastSeenAt).toEqual(now);
    expect(await service.heartbeat('xss-reflejado', 'ana')).toEqual({ active: false });
    now = new Date(now.getTime() + 11 * MIN);
    expect(await service.heartbeat('sqli-basico', 'ana')).toEqual({ active: false });
  });

  it('extends only in the last 30 minutes', async () => {
    const service = makeService();
    await service.start('sqli-basico', 'ana');
    expect(await codeOf(service.extend('sqli-basico', 'ana'))).toMatchObject({ body: { code: 'LAB_CANNOT_EXTEND' } });
    now = new Date(now.getTime() + 95 * MIN);
    prisma.leases.get('ana')!.lastSeenAt = new Date(now.getTime() - MIN); // heartbeats kept coming
    const view = await service.extend('sqli-basico', 'ana');
    expect(view.mine?.maxUntil).toBe(new Date(Date.parse('2026-11-02T10:00:00Z') + 180 * MIN).toISOString());
    expect(prisma.events.at(-1)?.type).toBe('EXTEND');
  });

  it('shows the exec command for terminal labs and the other lab the user holds', async () => {
    const service = makeService();
    await service.start('privesc-linux-1', 'ana');
    const own = await service.status('privesc-linux-1', 'ana');
    expect(own).toMatchObject({ access: 'exec', execCommand: 'docker exec -it lab-privesc-linux-1-shell-1 sh', url: null });
    const other = await service.status('sqli-basico', 'ana');
    expect(other).toMatchObject({ mine: null, otherLab: { slug: 'privesc-linux-1', roomSlug: 'privesc-linux' } });
  });

  it('reports the runner as down instead of failing the page', async () => {
    runner.failWith = new RunnerUnavailableError('timeout');
    expect(await makeService().status('sqli-basico', 'ana')).toMatchObject({ runnerUp: false, state: 'error' });
  });

  it('counts answers in the lab room as activity', async () => {
    const service = makeService();
    await service.start('sqli-blind', 'ana');
    now = new Date(now.getTime() + 8 * MIN);
    await service.touchForRoom('ana', 'xss-reflejado');
    expect(prisma.leases.get('ana')?.lastSeenAt).not.toEqual(now);
    await service.touchForRoom('ana', 'sqli-basico');
    expect(prisma.leases.get('ana')?.lastSeenAt).toEqual(now);
  });
});

describe('loadLabsConfig', () => {
  it('defaults to disabled with the agreed policy', () => {
    const defaults = loadLabsConfig({});
    expect(defaults.enabled).toBe(false);
    expect(defaults.policy).toEqual({
      idleTimeoutMs: 10 * MIN,
      sessionMaxMs: 120 * MIN,
      sessionCapMs: 240 * MIN,
      extendMs: 60 * MIN,
      extendWindowMs: 30 * MIN,
      maxRunning: 3,
    });
  });

  it('refuses to enable labs without a strong token or with an inverted cap', () => {
    expect(() => loadLabsConfig({ LABS_ENABLED: 'true', LAB_RUNNER_TOKEN: 'short' })).toThrow(/32\+/);
    expect(() =>
      loadLabsConfig({ LAB_SESSION_MAX_MIN: '300', LAB_SESSION_CAP_MIN: '240' }),
    ).toThrow(/CAP/);
  });
});

describe('LabsReaper', () => {
  function makeReaper(overrides: Partial<LabsConfig> = {}) {
    const service = makeService(overrides);
    const reaper = new LabsReaper(
      prisma as unknown as PrismaService,
      { ...config, ...overrides },
      runner as unknown as LabRunnerClient,
      service,
    );
    reaper.clock = () => now;
    return { service, reaper };
  }

  it('expires idle and overdue leases, stops labs nobody holds and renews the rest', async () => {
    const { service, reaper } = makeReaper();
    await service.start('sqli-basico', 'ana');
    await service.start('xss-reflejado', 'bob');
    await service.start('xss-reflejado', 'cid');
    now = new Date(now.getTime() + 8 * MIN);
    await service.heartbeat('xss-reflejado', 'cid'); // only cid keeps its page open
    now = new Date(now.getTime() + 3 * MIN);
    runner.calls = [];
    const result = await reaper.sweep();
    expect(result).toMatchObject({ ok: true, runnerUp: true, expired: 2, stopped: ['sqli-basico'], renewed: 1 });
    expect([...prisma.leases.keys()]).toEqual(['cid']);
    expect(prisma.events.filter((event) => event.type === 'EXPIRE_IDLE').map((event) => event.userId).sort()).toEqual(['ana', 'bob']);
    expect(runner.calls).toEqual(['down sqli-basico', 'renew xss-reflejado 180']);
  });

  it('expires a lease at maxUntil even with heartbeats', async () => {
    const { service, reaper } = makeReaper();
    await service.start('sqli-basico', 'ana');
    now = new Date(now.getTime() + 120 * MIN);
    prisma.leases.get('ana')!.lastSeenAt = now;
    await reaper.sweep();
    expect(prisma.events.at(-1)).toMatchObject({ type: 'EXPIRE_MAX', userId: 'ana' });
  });

  it('keeps expiring leases when the runner is down (the runner deadline stops the lab)', async () => {
    const { service, reaper } = makeReaper();
    await service.start('sqli-basico', 'ana');
    now = new Date(now.getTime() + 11 * MIN);
    runner.failWith = new RunnerUnavailableError('down');
    const result = await reaper.sweep();
    expect(result).toMatchObject({ ok: true, runnerUp: false, expired: 1, stopped: [] });
    expect(prisma.leases.size).toBe(0);
  });

  it('prunes audit events older than 30 days', async () => {
    const { service, reaper } = makeReaper();
    await service.start('sqli-basico', 'ana');
    await service.stop('sqli-basico', 'ana');
    now = new Date(now.getTime() + 31 * 24 * 60 * MIN);
    await reaper.sweep();
    expect(prisma.events).toEqual([]);
  });

  it('reports its health: stale before the first sweep, runner state, disabled', async () => {
    const { reaper } = makeReaper();
    expect(await reaper.snapshot()).toMatchObject({ enabled: true, runner: 'up', stale: true, lastSweepAt: null });
    await reaper.sweep();
    expect(await reaper.snapshot()).toMatchObject({ stale: false, sweepOk: true });
    now = new Date(now.getTime() + 4 * MIN);
    expect((await reaper.snapshot()).stale).toBe(true);
    runner.failWith = new RunnerUnavailableError('down');
    expect((await reaper.snapshot()).runner).toBe('down');
    expect(await makeReaper({ enabled: false }).reaper.snapshot()).toMatchObject({ enabled: false, runner: 'disabled' });
  });
});

describe('AdminLabsController', () => {
  function makeAdmin() {
    const service = makeService();
    const reaper = new LabsReaper(prisma as unknown as PrismaService, config, runner as unknown as LabRunnerClient, service);
    reaper.clock = () => now;
    const controller = new AdminLabsController(
      prisma as unknown as PrismaService,
      service,
      reaper,
      runner as unknown as LabRunnerClient,
    );
    return { service, controller };
  }
  const admin = { id: 'root' } as AuthUser;

  it('lists labs in use with their users and the latest events', async () => {
    const { service, controller } = makeAdmin();
    await service.start('sqli-basico', 'ana');
    await service.start('sqli-basico', 'bob');
    const overview = await controller.overview();
    expect(overview.labs).toEqual([
      expect.objectContaining({
        slug: 'sqli-basico',
        roomSlug: 'sqli-basico',
        state: 'starting',
        users: [expect.objectContaining({ email: 'ana@test' }), expect.objectContaining({ email: 'bob@test' })],
      }),
    ]);
    expect(overview.events[0]).toMatchObject({ type: 'START', user: { email: 'bob@test' } });
  });

  it('stops one lab or everything, ending the leases', async () => {
    const { service, controller } = makeAdmin();
    await service.start('sqli-basico', 'ana');
    await service.start('xss-reflejado', 'bob');
    await controller.stop('sqli-basico', admin);
    expect([...prisma.leases.keys()]).toEqual(['bob']);
    expect(runner.calls).toContain('down sqli-basico');
    await controller.stopAll(admin);
    expect(prisma.leases.size).toBe(0);
    expect(runner.calls).toContain('down-all');
    expect(prisma.events.map((event) => event.type).slice(-2)).toEqual(['ADMIN_STOP', 'STOP_ALL']);
  });
});
