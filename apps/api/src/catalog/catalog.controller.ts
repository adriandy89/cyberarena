import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RATE_LIMITS } from '../http/rate-limits';
import { localizePathDetail, localizeSummaries, type EnCatalog } from './catalog-i18n';
import { CatalogService } from './catalog.service';
import { computeRoomContext } from './room-context';

// Resolve the content package dist across layouts (dev monorepo, prod image):
// - dev (cwd apps/api): ../../packages/content/dist
// - prod image (cwd /app, pruned monorepo): packages/content/dist
// - legacy root layout: ../../content/dist
const CONTENT_DIST_CANDIDATES = [
  resolve(process.cwd(), '../../packages/content/dist'),
  resolve(process.cwd(), 'packages/content/dist'),
  resolve(process.cwd(), '../../content/dist'),
];
const CONTENT_DIST =
  CONTENT_DIST_CANDIDATES.find((dir) => existsSync(join(dir, 'catalog-en.json'))) ?? null;

/** Public read-only catalog (answers are never exposed — ADR-010). */
@Throttle(RATE_LIMITS.publicRead)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list(@Query('locale') locale?: string) {
    const summaries = await this.catalog.listPaths();
    const en = locale === 'en' ? this.readEnCatalog() : null;
    return en ? localizeSummaries(summaries, en) : summaries;
  }

  @Get('paths/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  async getPath(@Param('slug') slug: string, @Query('locale') locale?: string) {
    const detail = await this.catalog.getPath(slug);
    const en = locale === 'en' ? this.readEnCatalog() : null;
    return en ? localizePathDetail(detail, en) : detail;
  }

  @Get('rooms/:slug/context')
  @Header('Cache-Control', 'public, max-age=60')
  async getRoomContext(@Param('slug') slug: string, @Query('locale') locale?: string) {
    if (locale === 'en') {
      const en = this.readEnCatalog();
      const context = en ? computeRoomContext(en.paths, slug) : null;
      if (context) return context;
    }
    return this.catalog.getRoomContext(slug);
  }

  @Get('rooms/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  async getRoom(@Param('slug') slug: string, @Query('locale') locale?: string) {
    if (locale === 'en') {
      const en = this.readEnCatalog();
      if (en) {
        for (const path of en.paths) {
          for (const module of path.modules) {
            const room = module.rooms.find((r: { slug: string }) => r.slug === slug);
            if (room) return room;
          }
        }
      }
    }
    return this.catalog.getRoom(slug);
  }

  private readEnCatalog(): EnCatalog | null {
    if (!CONTENT_DIST) return null;
    try {
      const filePath = join(CONTENT_DIST, 'catalog-en.json');
      if (!existsSync(filePath)) return null;
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }
}
