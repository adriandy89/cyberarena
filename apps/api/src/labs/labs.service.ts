import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { LabEventType } from '@repo/database';
import type { LabErrorBody, LabErrorCode, LabLeaseView, LabSessionView, LabsInfo } from '@repo/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LABS_CONFIG, type LabsConfig } from './labs.config';
import {
  canExtend,
  capUntil,
  earliestFreeSlot,
  expiryReason,
  extendedUntil,
  hasCapacity,
  idleDeadline,
  newLeaseTimes,
  type LeaseLike,
} from './lease-policy';
import { LabRunnerClient, RunnerRejectedError, RunnerUnavailableError, type RunnerLabView } from './runner.client';

/** Serialises lease changes and the runner calls that follow them (all API instances). */
export const LAB_LOCK_KEY = 711_011;

/** The subset of the Prisma client used inside lab transactions. */
export type LabTx = Pick<PrismaService, 'labLease' | 'labEvent' | '$queryRaw'>;

interface Lease extends LeaseLike {
  userId: string;
}

export function labError(
  status: HttpStatus,
  code: LabErrorCode,
  message: string,
  extra: Omit<LabErrorBody, 'code' | 'message'> = {},
): HttpException {
  return new HttpException({ code, message, ...extra } satisfies LabErrorBody, status);
}

const ROOMS_CACHE_MS = 60_000;

/**
 * Labs on demand (phase 011): leases in Postgres, lifecycle in the lab-runner.
 * Every lease change and the runner call it implies happen under one
 * Postgres advisory lock, so "A stops while B starts the same lab" cannot
 * interleave (the runner then applies the calls in order, per lab).
 */
@Injectable()
export class LabsService {
  private readonly logger = new Logger(LabsService.name);
  private roomsCache: { at: number; byLab: Map<string, string> } | null = null;
  /** Replaceable in tests. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LABS_CONFIG) private readonly config: LabsConfig,
    private readonly runner: LabRunnerClient,
  ) {}

  private now(): Date {
    return this.clock();
  }

  info(): LabsInfo {
    return {
      enabled: this.config.enabled,
      maxRunning: this.config.policy.maxRunning,
      idleTimeoutMinutes: Math.round(this.config.policy.idleTimeoutMs / 60_000),
    };
  }

  async status(slug: string, userId: string): Promise<LabSessionView> {
    this.assertEnabled();
    await this.assertKnownLab(slug);
    const now = this.now();
    const leases = await this.liveLeases(this.prisma, now);
    const mine = leases.find((lease) => lease.userId === userId) ?? null;
    let runnerLab: RunnerLabView | null = null;
    let runnerUp = true;
    try {
      runnerLab = await this.runner.get(slug);
    } catch (error) {
      if (!(error instanceof RunnerUnavailableError)) throw error;
      runnerUp = false;
    }
    const otherLab =
      mine && mine.labSlug !== slug ? { slug: mine.labSlug, roomSlug: await this.roomFor(mine.labSlug) } : null;
    const myLease = mine && mine.labSlug === slug ? this.leaseView(mine, now) : null;
    return {
      slug,
      state: !runnerUp ? 'error' : (runnerLab?.state ?? 'unavailable'),
      runnerUp,
      access: runnerLab?.access ?? null,
      url: runnerLab?.access === 'http' ? runnerLab.url : null,
      execCommand:
        runnerLab?.access === 'exec' && runnerLab.execService
          ? `docker exec -it ${runnerLab.project}-${runnerLab.execService}-1 sh`
          : null,
      ports: (runnerLab?.ports ?? []).map(({ host, protocol }) => ({ host, protocol })),
      users: leases.filter((lease) => lease.labSlug === slug).length,
      mine: myLease,
      otherLab,
      lastError: runnerUp ? (runnerLab?.lastError ?? null) : 'lab-runner unreachable',
    };
  }

  /** Leases the lab for the user and makes sure it runs. `switchLab` ends a lease on another lab. */
  async start(slug: string, userId: string, switchLab = false): Promise<LabSessionView> {
    this.assertEnabled();
    await this.assertKnownLab(slug);
    const now = this.now();
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const leases = await this.liveLeases(tx, now);
      const mine = leases.find((lease) => lease.userId === userId);
      if (mine && mine.labSlug !== slug) {
        if (!switchLab) {
          throw labError(HttpStatus.CONFLICT, 'LAB_OTHER_ACTIVE', 'You already have another lab running', {
            otherLab: { slug: mine.labSlug, roomSlug: await this.roomFor(mine.labSlug) },
          });
        }
        await tx.labLease.delete({ where: { userId } });
        await this.event(tx, mine.labSlug, userId, LabEventType.SWITCH, { to: slug });
        if (!leases.some((lease) => lease.labSlug === mine.labSlug && lease.userId !== userId)) {
          await this.runnerCall(() => this.runner.down(mine.labSlug));
        }
      }
      const others = leases.filter((lease) => lease.userId !== userId);
      if (!hasCapacity(new Set(others.map((lease) => lease.labSlug)), slug, this.config.policy)) {
        const free = earliestFreeSlot(others, this.config.policy);
        throw labError(HttpStatus.CONFLICT, 'LAB_CAPACITY', 'All lab slots are in use', {
          earliestFreeAt: free?.toISOString() ?? null,
        });
      }
      if (mine?.labSlug === slug) {
        await tx.labLease.update({ where: { userId }, data: { lastSeenAt: now } });
      } else {
        // upsert: an expired lease of this user may still be in the table.
        const times = newLeaseTimes(now, this.config.policy);
        await tx.labLease.upsert({
          where: { userId },
          create: { userId, labSlug: slug, ...times },
          update: { labSlug: slug, ...times },
        });
        await this.event(tx, slug, userId, LabEventType.START);
      }
      await this.runnerCall(() => this.runner.up(slug));
      await this.runnerCall(() => this.runner.renew([slug], this.config.renewTtlSeconds));
    });
    return this.status(slug, userId);
  }

  /** The room page is still open. Returns false when there is no lease any more. */
  async heartbeat(slug: string, userId: string): Promise<{ active: boolean }> {
    this.assertEnabled();
    const now = this.now();
    const lease = await this.prisma.labLease.findUnique({ where: { userId } });
    if (!lease || lease.labSlug !== slug || expiryReason(lease, now, this.config.policy)) return { active: false };
    await this.prisma.labLease.update({ where: { userId }, data: { lastSeenAt: now } });
    return { active: true };
  }

  /** Answering a question of a room whose lab you hold counts as activity. */
  async touchForRoom(userId: string, roomSlug: string): Promise<void> {
    if (!this.config.enabled) return;
    const lease = await this.prisma.labLease.findUnique({ where: { userId } });
    if (!lease || (await this.roomFor(lease.labSlug)) !== roomSlug) return;
    if (expiryReason(lease, this.now(), this.config.policy)) return;
    await this.prisma.labLease.update({ where: { userId }, data: { lastSeenAt: this.now() } });
  }

  async extend(slug: string, userId: string): Promise<LabSessionView> {
    this.assertEnabled();
    const now = this.now();
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const lease = await tx.labLease.findUnique({ where: { userId } });
      if (!lease || lease.labSlug !== slug || expiryReason(lease, now, this.config.policy)) {
        throw labError(HttpStatus.CONFLICT, 'LAB_NOT_LEASED', 'You do not have this lab running');
      }
      if (!canExtend(lease, now, this.config.policy)) {
        throw labError(HttpStatus.CONFLICT, 'LAB_CANNOT_EXTEND', 'This session cannot be extended now');
      }
      const maxUntil = extendedUntil(lease, this.config.policy);
      await tx.labLease.update({ where: { userId }, data: { maxUntil, lastSeenAt: now } });
      await this.event(tx, slug, userId, LabEventType.EXTEND, { maxUntil: maxUntil.toISOString() });
    });
    return this.status(slug, userId);
  }

  /** Ends the user's lease; the lab stops if nobody else holds it. */
  async stop(slug: string, userId: string): Promise<LabSessionView> {
    this.assertEnabled();
    const now = this.now();
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const lease = await tx.labLease.findUnique({ where: { userId } });
      if (!lease || lease.labSlug !== slug) return;
      await tx.labLease.delete({ where: { userId } });
      await this.event(tx, slug, userId, LabEventType.STOP);
      const others = (await this.liveLeases(tx, now)).filter((other) => other.labSlug === slug);
      if (others.length === 0) await this.runnerCall(() => this.runner.down(slug));
    });
    return this.status(slug, userId);
  }

  // --- helpers ---------------------------------------------------------------

  private assertEnabled(): void {
    if (!this.config.enabled) throw labError(HttpStatus.SERVICE_UNAVAILABLE, 'LAB_DISABLED', 'Labs on demand are disabled');
  }

  private async assertKnownLab(slug: string): Promise<void> {
    if ((await this.roomFor(slug)) === null) throw labError(HttpStatus.NOT_FOUND, 'LAB_UNKNOWN', 'Unknown lab');
  }

  /** Room that offers a lab (as main or extra lab); null when no room does. */
  async roomFor(slug: string): Promise<string | null> {
    if (!this.roomsCache || Date.now() - this.roomsCache.at > ROOMS_CACHE_MS) {
      const rooms = await this.prisma.room.findMany({
        where: { OR: [{ lab: { not: null } }, { extraLabs: { isEmpty: false } }] },
        select: { slug: true, lab: true, extraLabs: true },
        orderBy: { order: 'asc' },
      });
      const byLab = new Map<string, string>();
      for (const room of rooms) {
        for (const lab of [room.lab, ...room.extraLabs]) {
          if (lab && !byLab.has(lab)) byLab.set(lab, room.slug);
        }
      }
      this.roomsCache = { at: Date.now(), byLab };
    }
    return this.roomsCache.byLab.get(slug) ?? null;
  }

  async liveLeases(tx: Pick<LabTx, 'labLease'>, now: Date): Promise<Lease[]> {
    const leases = await tx.labLease.findMany();
    return leases.filter((lease) => !expiryReason(lease, now, this.config.policy));
  }

  async lock(tx: Pick<LabTx, '$queryRaw'>): Promise<void> {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${LAB_LOCK_KEY})`;
  }

  async event(
    tx: Pick<LabTx, 'labEvent'>,
    labSlug: string,
    userId: string | null,
    type: LabEventType,
    detail?: Record<string, string | number | null>,
  ): Promise<void> {
    await tx.labEvent.create({ data: { labSlug, userId, type, ...(detail ? { detail } : {}) } });
  }

  /** Runner errors become API errors (and roll back the surrounding transaction). */
  async runnerCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof RunnerUnavailableError) {
        this.logger.warn(error.message);
        throw labError(HttpStatus.SERVICE_UNAVAILABLE, 'LAB_RUNNER_DOWN', 'The lab service is not responding');
      }
      if (error instanceof RunnerRejectedError) {
        if (error.code === 'capacity') {
          throw labError(HttpStatus.CONFLICT, 'LAB_CAPACITY', 'All lab slots are in use', { earliestFreeAt: null });
        }
        if (error.code === 'unavailable') {
          throw labError(HttpStatus.UNPROCESSABLE_ENTITY, 'LAB_UNAVAILABLE', 'This lab is not available on this server');
        }
        throw labError(HttpStatus.NOT_FOUND, 'LAB_UNKNOWN', 'Unknown lab');
      }
      throw error;
    }
  }

  private leaseView(lease: Lease, now: Date): LabLeaseView {
    return {
      startedAt: lease.startedAt.toISOString(),
      maxUntil: lease.maxUntil.toISOString(),
      idleDeadline: idleDeadline(lease, this.config.policy).toISOString(),
      capUntil: capUntil(lease, this.config.policy).toISOString(),
      canExtend: canExtend(lease, now, this.config.policy),
    };
  }
}
