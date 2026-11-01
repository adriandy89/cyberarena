import { Controller, Get, Header, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/** Public read-only catalog (answers are never exposed — ADR-010). */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  list() {
    return this.catalog.listPaths();
  }

  @Get('paths/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  getPath(@Param('slug') slug: string) {
    return this.catalog.getPath(slug);
  }

  @Get('rooms/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  getRoom(@Param('slug') slug: string) {
    return this.catalog.getRoom(slug);
  }
}
