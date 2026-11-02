import { Inject, Injectable, Optional } from '@nestjs/common';
import { LABS_HEALTH, type LabsHealth, type LabsHealthProvider } from '../labs/labs.reaper';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  latencyMs: number;
  timestamp: string;
  /** Labs on demand (phase 011): runner reachability and the periodic sweep. */
  labs?: LabsHealth;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(LABS_HEALTH) private readonly labs?: LabsHealthProvider,
  ) {}

  async check(): Promise<HealthResponse> {
    const startedAt = Date.now();
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    const labs = this.labs ? await this.labs.snapshot() : undefined;
    const labsDegraded = !!labs?.enabled && (labs.runner === 'down' || labs.stale || labs.sweepOk === false);
    return {
      status: db === 'up' && !labsDegraded ? 'ok' : 'degraded',
      db,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      ...(labs ? { labs } : {}),
    };
  }
}
