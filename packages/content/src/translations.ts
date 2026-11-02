/**
 * Translation merging for bilingual content.
 * ES is the canonical source; EN translations live in translations/en/<room-slug>.json
 * and override title/description/prompt/hint/body at build time.
 */

export interface RoomTranslation {
  title?: string;
  description?: string;
  tasks?: Record<
    string,
    {
      title?: string;
      body?: string;
      questions?: Record<
        string,
        {
          prompt?: string;
          hint?: string | null;
        }
      >;
    }
  >;
}

export interface ContentTranslations {
  [locale: string]: Record<string, RoomTranslation>; // [locale][roomSlug]
}

/**
 * Merges an ES CompiledRoom with EN translations.
 * Commands and flags are NEVER translated (they must stay identical).
 */
export function applyRoomTranslation(
  room: {
    title: string;
    description: string;
    tasks: Array<{
      index: number;
      title: string;
      body: string;
      questions: Array<{ id: string; prompt: string; hint: string | null }>;
    }>;
  },
  translation: RoomTranslation | undefined,
): void {
  if (!translation) return;
  if (translation.title) room.title = translation.title;
  if (translation.description) room.description = translation.description;

  for (const task of room.tasks) {
    const taskKey = String(task.index);
    const taskT = translation.tasks?.[taskKey];
    if (!taskT) continue;
    if (taskT.title) task.title = taskT.title;
    if (taskT.body) task.body = taskT.body;
    for (const question of task.questions) {
      const qT = taskT.questions?.[question.id];
      if (!qT) continue;
      if (qT.prompt) question.prompt = qT.prompt;
      if (qT.hint !== undefined) question.hint = qT.hint;
    }
  }
}

/** Title + description pair for a translated path or module. */
export interface TextTranslation {
  title: string;
  description: string;
}

/**
 * EN texts for paths and modules (translations/<locale>/_catalog.json).
 * Rooms keep their own per-room files.
 */
export interface CatalogTranslation {
  paths: Record<string, TextTranslation>;
  modules: Record<string, TextTranslation>;
}

interface TranslatableCatalog {
  paths: Array<{
    slug: string;
    title: string;
    description: string;
    modules: Array<{ slug: string; title: string; description: string }>;
  }>;
}

/**
 * Applies path/module translations in place and returns the keys that have
 * no translation (`path:<slug>` / `module:<slug>`) so the build can fail.
 */
export function applyCatalogTranslation(
  catalog: TranslatableCatalog,
  translation: CatalogTranslation,
): string[] {
  const missing: string[] = [];
  for (const path of catalog.paths) {
    const pathT = translation.paths[path.slug];
    if (pathT) {
      path.title = pathT.title;
      path.description = pathT.description;
    } else {
      missing.push(`path:${path.slug}`);
    }
    for (const module of path.modules) {
      const moduleT = translation.modules[module.slug];
      if (moduleT) {
        module.title = moduleT.title;
        module.description = moduleT.description;
      } else {
        missing.push(`module:${module.slug}`);
      }
    }
  }
  return missing;
}
