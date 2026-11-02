/**
 * Where a room sits inside its learning path (spec 010 T011): breadcrumbs,
 * "room n of N" and previous/next navigation across module boundaries.
 * Pure so it works on both the DB tree and the EN catalog JSON.
 */

export interface ContextTreeRoom {
  slug: string;
  title: string;
  difficulty: string;
}

export interface ContextTreeModule {
  slug: string;
  title: string;
  rooms: ContextTreeRoom[];
}

export interface ContextTreePath {
  slug: string;
  title: string;
  level: string;
  modules: ContextTreeModule[];
}

export interface RoomContextLink {
  slug: string;
  title: string;
  difficulty: string;
}

export interface RoomContext {
  path: { slug: string; title: string; level: string };
  /** 1-based module position inside the path. */
  module: { slug: string; title: string; index: number; total: number };
  /** 1-based room position inside the whole path. */
  position: { index: number; total: number };
  prev: RoomContextLink | null;
  next: RoomContextLink | null;
  /** Following path, only when this is the last room of its path. */
  nextPath: { slug: string; title: string } | null;
}

function link(room: ContextTreeRoom): RoomContextLink {
  return { slug: room.slug, title: room.title, difficulty: room.difficulty };
}

/** `paths` must already be in display order; returns null for unknown rooms. */
export function computeRoomContext(paths: ContextTreePath[], slug: string): RoomContext | null {
  for (const [pathIndex, path] of paths.entries()) {
    const flat = path.modules.flatMap((module) => module.rooms);
    const position = flat.findIndex((room) => room.slug === slug);
    if (position === -1) continue;

    const moduleIndex = path.modules.findIndex((module) =>
      module.rooms.some((room) => room.slug === slug),
    );
    const module = path.modules[moduleIndex]!;
    const prev = flat[position - 1];
    const next = flat[position + 1];
    const followingPath = paths[pathIndex + 1];

    return {
      path: { slug: path.slug, title: path.title, level: path.level },
      module: {
        slug: module.slug,
        title: module.title,
        index: moduleIndex + 1,
        total: path.modules.length,
      },
      position: { index: position + 1, total: flat.length },
      prev: prev ? link(prev) : null,
      next: next ? link(next) : null,
      nextPath:
        !next && followingPath ? { slug: followingPath.slug, title: followingPath.title } : null,
    };
  }
  return null;
}
