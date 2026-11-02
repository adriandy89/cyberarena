import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LABS_HEALTH } from '../labs/labs.reaper';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = { $queryRaw: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it('reports ok with db up when the query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    const result = await service.check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeTruthy();
  });

  it('reports degraded with db down when the query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const result = await service.check();
    expect(result.status).toBe('degraded');
    expect(result.db).toBe('down');
  });
});

describe('HealthService with labs on demand', () => {
  const labs = (overrides: Record<string, unknown>) => ({
    snapshot: vi.fn().mockResolvedValue({
      enabled: true,
      runner: 'up',
      running: 1,
      lastSweepAt: new Date().toISOString(),
      sweepOk: true,
      stale: false,
      ...overrides,
    }),
  });

  async function serviceWith(provider: ReturnType<typeof labs>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]) } },
        { provide: LABS_HEALTH, useValue: provider },
      ],
    }).compile();
    return moduleRef.get(HealthService);
  }

  it('includes the labs block and stays ok when the runner and the sweep are fine', async () => {
    const result = await (await serviceWith(labs({}))).check();
    expect(result).toMatchObject({ status: 'ok', labs: { runner: 'up', running: 1 } });
  });

  it.each([{ runner: 'down' }, { stale: true }, { sweepOk: false }])('is degraded when %o', async (overrides) => {
    expect((await (await serviceWith(labs(overrides))).check()).status).toBe('degraded');
  });

  it('ignores labs when they are disabled', async () => {
    const result = await (await serviceWith(labs({ enabled: false, runner: 'disabled', stale: false }))).check();
    expect(result.status).toBe('ok');
  });
});
