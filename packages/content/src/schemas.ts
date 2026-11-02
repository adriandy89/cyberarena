import { z } from 'zod';
import { DIFFICULTY_IDS, ROOM_TYPES } from '@repo/shared';

/** kebab-case slug used across the catalog. */
export const slugSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be kebab-case (a-z, 0-9, hyphens)');

/** Stable question id: `<room-slug>-t<NN>-q<NN>`. Changing it breaks progress. */
export const questionIdSchema = z
  .string()
  .regex(/^[a-z0-9-]+-t\d{2}-q\d{2}$/, 'must look like <room-slug>-t01-q01');

export const choiceOptionSchema = z.object({
  id: z.string().regex(/^[a-e]$/),
  label: z.string().min(1).max(120),
});

const questionBase = {
  id: questionIdSchema,
  prompt: z.string().min(5).max(400),
  hint: z.string().min(3).max(300).nullable().default(null),
};

export const questionSchema = z.discriminatedUnion('kind', [
  z.object({ ...questionBase, kind: z.literal('flag') }),
  z.object({ ...questionBase, kind: z.literal('text') }),
  z.object({
    ...questionBase,
    kind: z.literal('choice'),
    options: z.array(choiceOptionSchema).min(2).max(5),
  }),
]);

export const taskFrontmatterSchema = z.object({
  index: z.number().int().positive().max(99),
  title: z.string().min(3).max(120),
  questions: z.array(questionSchema).min(1).max(10),
});

export const roomFrontmatterSchema = z.object({
  slug: slugSchema,
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(400),
  difficulty: z.enum(DIFFICULTY_IDS as [string, ...string[]]),
  type: z.enum(ROOM_TYPES as [string, ...string[]]),
  estimatedMinutes: z.number().int().positive().max(600),
  tags: z.array(slugSchema).max(8).default([]),
  lab: slugSchema.nullable().default(null),
  // Browser/lab-facing URL of the lab (e.g. http://127.0.0.1:18080).
  labUrl: z.string().url().nullable().default(null),
  // Secondary labs some tasks use (phase 011): startable from the room as well.
  extraLabs: z.array(slugSchema).max(4).default([]),
});

export const pathJsonSchema = z.object({
  slug: slugSchema,
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(500),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  /** 1-based position in the learning roadmap (unique across paths). */
  order: z.number().int().positive(),
  modules: z.array(z.object({ slug: slugSchema })).min(1),
});

export const moduleJsonSchema = z.object({
  slug: slugSchema,
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(500),
  rooms: z.array(z.object({ slug: slugSchema })).min(1),
});

export type PathJson = z.infer<typeof pathJsonSchema>;
export type ModuleJson = z.infer<typeof moduleJsonSchema>;
export type RoomFrontmatter = z.infer<typeof roomFrontmatterSchema>;
export type TaskFrontmatter = z.infer<typeof taskFrontmatterSchema>;
export type Question = z.infer<typeof questionSchema>;

/** Compiled room with task bodies (what lands in catalog.json). */
export interface CompiledTask extends TaskFrontmatter {
  body: string;
}

export interface CompiledRoom extends RoomFrontmatter {
  tasks: CompiledTask[];
}

export interface CompiledModule {
  slug: string;
  title: string;
  description: string;
  rooms: CompiledRoom[];
}

export interface CompiledPath {
  slug: string;
  title: string;
  description: string;
  level: PathJson['level'];
  modules: CompiledModule[];
}

export interface Catalog {
  generatedAt: string;
  paths: CompiledPath[];
}
