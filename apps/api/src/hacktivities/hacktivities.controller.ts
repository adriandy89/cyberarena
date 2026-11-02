import { Controller, Get, Header, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { DIFFICULTY_IDS, ROOM_TYPES } from '@repo/shared';
import { RATE_LIMITS } from '../http/rate-limits';
import { HacktivitiesService, HACKTIVITIES_SORTS } from './hacktivities.service';

const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  difficulty: z.enum(DIFFICULTY_IDS as [string, ...string[]]).optional(),
  type: z.enum(ROOM_TYPES as [string, ...string[]]).optional(),
  tag: z.string().trim().max(64).optional(),
  lab: z.enum(['true', 'false']).optional(),
  sort: z.enum(HACKTIVITIES_SORTS).default('recommended'),
  take: z.coerce.number().int().min(1).max(50).default(24),
  skip: z.coerce.number().int().min(0).default(0),
});

/** Public hacktivities directory (search/filter/sort). */
@Throttle(RATE_LIMITS.publicRead)
@Controller('hacktivities')
export class HacktivitiesController {
  constructor(private readonly hacktivities: HacktivitiesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=30')
  list(@Query({ schema: listQuerySchema }) query: z.infer<typeof listQuerySchema>) {
    return this.hacktivities.list(query);
  }
}
