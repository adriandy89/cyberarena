import type {
  CatalogPathDetail,
  CatalogPathSummary,
  CatalogRoomLink,
  CatalogRoomSummary,
} from './catalog.service';

/** Subset of packages/content/dist/catalog-en.json used to translate texts. */
export interface EnCatalog {
  paths: Array<{
    slug: string;
    title: string;
    description: string;
    level: string;
    modules: Array<{
      slug: string;
      title: string;
      description: string;
      rooms: Array<{ slug: string; title: string; description: string; difficulty: string }>;
    }>;
  }>;
}

interface Texts {
  title: string;
  description: string;
}

function index(en: EnCatalog) {
  const paths = new Map<string, Texts>();
  const modules = new Map<string, Texts>();
  const rooms = new Map<string, Texts>();
  for (const path of en.paths) {
    paths.set(path.slug, path);
    for (const module of path.modules) {
      modules.set(module.slug, module);
      for (const room of module.rooms) rooms.set(room.slug, room);
    }
  }
  return { paths, modules, rooms };
}

function withTexts<T extends Texts>(item: T, texts: Texts | undefined): T {
  return texts ? { ...item, title: texts.title, description: texts.description } : item;
}

function withTitle<T extends { title: string }>(item: T, texts: Texts | undefined): T {
  return texts ? { ...item, title: texts.title } : item;
}

/**
 * EN overlay for the catalog (spec 010 T901): shape and order always come
 * from the DB; only human texts are swapped for their EN translation.
 */
export function localizeSummaries(
  summaries: CatalogPathSummary[],
  en: EnCatalog,
): CatalogPathSummary[] {
  const lookup = index(en);
  return summaries.map((path) => ({
    ...withTexts(path, lookup.paths.get(path.slug)),
    rooms: path.rooms.map((room: CatalogRoomLink) => withTitle(room, lookup.rooms.get(room.slug))),
  }));
}

export function localizePathDetail(detail: CatalogPathDetail, en: EnCatalog): CatalogPathDetail {
  const lookup = index(en);
  return {
    ...withTexts(detail, lookup.paths.get(detail.slug)),
    modules: detail.modules.map((module) => ({
      ...withTexts(module, lookup.modules.get(module.slug)),
      rooms: module.rooms.map((room: CatalogRoomSummary) =>
        withTexts(room, lookup.rooms.get(room.slug)),
      ),
    })),
  };
}
