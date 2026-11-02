import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LabEventType, Role } from '@repo/database';
import type { AdminLabsOverview, LabState } from '@repo/shared';
import type { AuthUser } from '../auth/auth-module-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionGuard } from '../auth/session.guard';
import { RATE_LIMITS } from '../http/rate-limits';
import { PrismaService } from '../prisma/prisma.service';
import { LabsReaper } from './labs.reaper';
import { labError, LabsService } from './labs.service';
import { LabRunnerClient, type RunnerLabView } from './runner.client';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Labs overview and kill switches for admins (phase 011). */
@Controller('admin/labs')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminLabsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly labs: LabsService,
    private readonly reaper: LabsReaper,
    private readonly runner: LabRunnerClient,
  ) {}

  @Get()
  async overview(): Promise<AdminLabsOverview> {
    const [health, leases, events] = await Promise.all([
      this.reaper.snapshot(),
      this.prisma.labLease.findMany({ orderBy: { startedAt: 'asc' } }),
      this.prisma.labEvent.findMany({ orderBy: { at: 'desc' }, take: 50 }),
    ]);
    const runnerLabs: RunnerLabView[] = health.runner === 'up' ? await this.runner.list(true).catch(() => []) : [];
    const userIds = [...new Set([...leases.map((lease) => lease.userId), ...events.flatMap((event) => event.userId ?? [])])];
    const users = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })).map(
        (user) => [user.id, user],
      ),
    );

    const slugs = new Set([
      ...leases.map((lease) => lease.labSlug),
      ...runnerLabs.filter((lab) => lab.state !== 'stopped' && lab.state !== 'unavailable').map((lab) => lab.slug),
    ]);
    const labs = await Promise.all(
      [...slugs].sort().map(async (slug) => ({
        slug,
        roomSlug: await this.labs.roomFor(slug),
        state: (runnerLabs.find((lab) => lab.slug === slug)?.state ?? (health.runner === 'up' ? 'stopped' : 'error')) as LabState,
        users: leases
          .filter((lease) => lease.labSlug === slug)
          .map((lease) => ({
            userId: lease.userId,
            name: users.get(lease.userId)?.name ?? null,
            email: users.get(lease.userId)?.email ?? null,
            startedAt: lease.startedAt.toISOString(),
            lastSeenAt: lease.lastSeenAt.toISOString(),
            maxUntil: lease.maxUntil.toISOString(),
          })),
      })),
    );
    const last = this.reaper.lastSweep;
    return {
      info: this.labs.info(),
      health,
      lastSweep: last && {
        at: last.at,
        ok: last.ok,
        expired: last.expired,
        stopped: last.stopped,
        renewed: last.renewed,
        notRunning: last.notRunning,
        ...(last.error ? { error: last.error } : {}),
      },
      labs,
      events: events.map((event) => {
        const user = event.userId ? users.get(event.userId) : undefined;
        return {
          at: event.at.toISOString(),
          labSlug: event.labSlug,
          type: event.type,
          user: user ? { name: user.name, email: user.email } : null,
          detail: event.detail,
        };
      }),
    };
  }

  /** Ends every lease on the lab and stops it. */
  @Post(':slug/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(RATE_LIMITS.labAction)
  async stop(@Param('slug') slug: string, @CurrentUser() admin: AuthUser): Promise<void> {
    if (!SLUG.test(slug)) throw labError(HttpStatus.NOT_FOUND, 'LAB_UNKNOWN', 'Unknown lab');
    await this.prisma.$transaction(async (tx) => {
      await this.labs.lock(tx);
      const { count } = await tx.labLease.deleteMany({ where: { labSlug: slug } });
      await this.labs.event(tx, slug, admin.id, LabEventType.ADMIN_STOP, { leases: count });
      await this.labs.runnerCall(() => this.runner.down(slug));
    });
  }

  /** Kill switch: ends every lease and stops every lab. */
  @Post('stop-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(RATE_LIMITS.labAction)
  async stopAll(@CurrentUser() admin: AuthUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.labs.lock(tx);
      const { count } = await tx.labLease.deleteMany({});
      await this.labs.event(tx, '*', admin.id, LabEventType.STOP_ALL, { leases: count });
      await this.labs.runnerCall(() => this.runner.downAll());
    });
  }
}
