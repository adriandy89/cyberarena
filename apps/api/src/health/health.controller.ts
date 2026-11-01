import { Controller, Get } from '@nestjs/common';
import { type HealthService, type HealthResponse } from './health.service';

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
