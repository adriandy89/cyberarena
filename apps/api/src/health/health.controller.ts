import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService, type HealthResponse } from './health.service';

// Container healthchecks and the status page poll these: never rate-limited.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Readiness: full check including the database connection. */
  @Get()
  async check(): Promise<HealthResponse> {
    return this.health.check();
  }

  /** Liveness: process is up, no dependencies checked. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
