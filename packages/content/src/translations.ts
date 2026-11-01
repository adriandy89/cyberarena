/**
 * Translation merging for bilingual content.
 * ES is the canonical source; EN translations live in translations/en/<room-slug>.json
 * and override title/description/prompt/hint/body at build time.
 */

export interface RoomTranslation {
  title?: string;
  description?: string;
  tasks?: Record<string, {
    title?: string;
    body?: string;
    questions?: Record<string, {
      prompt?: string;
      hint?: string | null;
    }>;
  }>;
}

export interface ContentTranslations {
  [locale: string]: Record<string, RoomTranslation>; // [locale][roomSlug]
}

/**
 * Merges an ES CompiledRoom with EN translations.
 * Commands and flags are NEVER translated (they must stay identical).
 */
export function applyRoomTranslation(
  room: { title: string; description: string; tasks: Array<{ index: number; title: string; body: string; questions: Array<{ id: string; prompt: string; hint: string | null }> }> },
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
