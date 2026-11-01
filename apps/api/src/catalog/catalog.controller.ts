import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CatalogService } from './catalog.service';

// Resolve content/dist relative to the monorepo root (works in dev and container)
const CONTENT_DIST = resolve(process.cwd(), '../../content/dist');

/** Public read-only catalog (answers are never exposed — ADR-010). */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list(@Query('locale') locale?: string) {
    if (locale === 'en') {
      const en = this.readEnCatalog();
      if (en) return en.paths;
    }
    return this.catalog.listPaths();
  }

  @Get('paths/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  async getPath(@Param('slug') slug: string, @Query('locale') locale?: string) {
    if (locale === 'en') {
      const en = this.readEnCatalog();
      const path = en?.paths.find(p => p.slug === slug);
      if (path) return path;
    }
    return this.catalog.getPath(slug);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readEnCatalog(): { paths: any[] } | null {
    try {
      const filePath = join(CONTENT_DIST, 'catalog-en.json');
      if (!existsSync(filePath)) return null;
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }
}
