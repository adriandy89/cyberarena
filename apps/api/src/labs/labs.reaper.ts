import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { LabEventType } from '@repo/database';
import { PrismaService } from '../prisma/prisma.service';
import { LABS_CONFIG, type LabsConfig } from './labs.config';
import { LabsService } from './labs.service';
import { expiryReason } from './lease-policy';
import { LabRunnerClient } from './runner.client';

export interface SweepResult {
  at: string;
  ok: boolean;
  runnerUp: boolean;
  /** Leases deleted in this sweep (idle or past maxUntil). */
  expired: number;
  /** Labs stopped because their last lease expired. */
  stopped: string[];
  /** Labs with leases whose runner deadline was pushed forward. */
  renewed: number;
  /** Leased labs the runner is not running (crashed, failed to start...). */
  notRunning: string[];
  error?: string;
}

/** Labs part of /api/health (phase 011: periodic review of the system). */
export interface LabsHealth {
  enabled: boolean;
  runner: 'up' | 'down' | 'disabled';
  running: number | null;
  lastSweepAt: string | null;
  sweepOk: boolean | null;
  /** The sweep has not run for 3 intervals (min 3 min): something is stuck. */
  stale: boolean;
}

export const LABS_HEALTH = Symbol('LABS_HEALTH');
export interface LabsHealthProvider {
  snapshot(): Promise<LabsHealth>;
}

const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Every LAB_SWEEP_SECONDS: deletes expired leases, stops the labs that lost
 * their last lease and renews the runner deadline of the rest. It never stops
 * a lab that has a lease, and never "cleans up" labs on its own: anything the
 * API stops renewing dies by its runner deadline (ADR-015).
 */
@Injectable()
export class LabsReaper implements OnApplicationBootstrap, OnApplicationShutdown, LabsHealthProvider {
  private readonly logger = new Logger(LabsReaper.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping: Promise<SweepResult> | null = null;
  lastSweep: SweepResult | null = null;
  /** Replaceable in tests. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LABS_CONFIG) private readonly config: LabsConfig,
    private readonly runner: LabRunnerClient,
    private readonly labs: LabsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.enabled) return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), this.config.sweepMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass; concurrent calls share the running one. */
  sweep(): Promise<SweepResult> {
    this.sweeping ??= this.doSweep().finally(() => {
      this.sweeping = null;
    });
    return this.sweeping;
  }

  async snapshot(): Promise<LabsHealth> {
    if (!this.config.enabled) {
      return { enabled: false, runner: 'disabled', running: null, lastSweepAt: null, sweepOk: null, stale: false };
    }
    let runner: LabsHealth['runner'] = 'up';
    let running: number | null = null;
    try {
      const health = await this.runner.health();
      running = typeof health.running === 'number' ? health.running : null;
    } catch {
      runner = 'down';
    }
    const last = this.lastSweep;
    const staleAfter = Math.max(3 * 60_000, 3 * this.config.sweepMs);
    return {
      enabled: true,
      runner,
      running,
      lastSweepAt: last?.at ?? null,
      sweepOk: last ? last.ok : null,
      stale: !last || this.clock().getTime() - Date.parse(last.at) > staleAfter,
    };
  }

  private async doSweep(): Promise<SweepResult> {
    const now = this.clock();
    const result: SweepResult = { at: now.toISOString(), ok: true, runnerUp: true, expired: 0, stopped: [], renewed: 0, notRunning: [] };
    try {
      const leased = await this.prisma.$transaction(async (tx) => {
        await this.labs.lock(tx);
        const leases = await tx.labLease.findMany();
        const live = new Set<string>();
        const lost = new Set<string>();
        for (const lease of leases) {
          const reason = expiryReason(lease, now, this.config.policy);
          if (!reason) {
            live.add(lease.labSlug);
            continue;
          }
          await tx.labLease.delete({ where: { userId: lease.userId } });
          await this.labs.event(
            tx,
            lease.labSlug,
            lease.userId,
            reason === 'idle' ? LabEventType.EXPIRE_IDLE : LabEventType.EXPIRE_MAX,
          );
          lost.add(lease.labSlug);
          result.expired++;
        }
        // Stop what nobody holds any more, still under the lock (ordered with starts).
        for (const slug of lost) {
          if (live.has(slug)) continue;
          try {
            await this.runner.down(slug);
            result.stopped.push(slug);
          } catch (error) {
            result.runnerUp = false;
            this.logger.warn(`could not stop ${slug}: ${(error as Error).message} (its runner deadline will)`);
          }
        }
        return [...live];
      });

      if (leased.length > 0) {
        try {
          const renewal = await this.runner.renew(leased, this.config.renewTtlSeconds);
          result.renewed = renewal.renewed.length;
          result.notRunning = renewal.notRunning;
        } catch (error) {
          result.runnerUp = false;
          this.logger.warn(`lab-runner unreachable during sweep: ${(error as Error).message}`);
        }
      } else {
        await this.runner.health().catch(() => {
          result.runnerUp = false;
        });
      }

      await this.prisma.labEvent.deleteMany({ where: { at: { lt: new Date(now.getTime() - EVENT_RETENTION_MS) } } });

      if (result.expired > 0 || result.stopped.length > 0) {
        this.logger.log(`sweep: ${result.expired} lease(s) expired, stopped [${result.stopped.join(', ')}]`);
      }
      if (result.notRunning.length > 0) {
        this.logger.warn(`sweep: leased but not running [${result.notRunning.join(', ')}]`);
      }
    } catch (error) {
      result.ok = false;
      result.error = (error as Error).message;
      this.logger.error(`lab sweep failed: ${result.error}`);
    }
    this.lastSweep = result;
    return result;
  }
}
