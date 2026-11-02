import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import {
  moduleJsonSchema,
  pathJsonSchema,
  roomFrontmatterSchema,
  taskFrontmatterSchema,
  type Catalog,
  type CompiledModule,
  type CompiledPath,
  type CompiledRoom,
  type CompiledTask,
  type ModuleJson,
  type PathJson,
} from '../src/schemas';
import {
  answerWarnings,
  orderWarnings,
  validateCatalog,
  type ValidationIssue,
} from '../src/validate';
import { sortPathsByOrder } from '../src/catalog-order';
import {
  applyCatalogTranslation,
  applyRoomTranslation,
  translationGaps,
  type CatalogTranslation,
  type RoomTranslation,
} from '../src/translations';

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const PRIVATE = path.join(ROOT, 'private');
const TRANSLATIONS = path.join(ROOT, 'translations');
const DIST = path.join(ROOT, 'dist');
// Lab stacks live at the repo root (labs/<slug>/compose.yaml).
const LABS = path.resolve(ROOT, '../../labs');

// CLI flags:
//   --dry-run              validate everything, write nothing (safe for parallel checks)
//   --en-report[=a,b]      list missing EN items for every room (or only those slugs)
//   --allow-en-gaps        do not fail on missing EN items (default: fail — spec 107)
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const STRICT_EN = !ARGS.includes('--allow-en-gaps');
const EN_REPORT_ARG = ARGS.find((arg) => arg.startsWith('--en-report'));
const EN_REPORT: string[] | null = EN_REPORT_ARG
  ? (EN_REPORT_ARG.split('=')[1] ?? '').split(',').filter(Boolean)
  : null;

interface ParseError {
  file: string;
  message: string;
}

async function readJson<T>(file: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  const raw = await readFile(file, 'utf8');
  return schema.parse(JSON.parse(raw));
}

async function main(): Promise<void> {
  const parseErrors: ParseError[] = [];

  function fail<T>(file: string, error: unknown): T {
    parseErrors.push({
      file: path.relative(ROOT, file),
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined as unknown as T;
  }

  // --- paths & modules (JSON) ---
  const pathFiles = await fg('paths/*.json', { cwd: CONTENT, absolute: true });
  const moduleFiles = await fg('modules/*.json', { cwd: CONTENT, absolute: true });

  const paths: PathJson[] = [];
  for (const file of pathFiles) {
    try {
      paths.push(await readJson(file, pathJsonSchema));
    } catch (error) {
      fail(file, error);
    }
  }
  const modulesBySlug = new Map<string, ModuleJson>();
  for (const file of moduleFiles) {
    try {
      const parsed = await readJson(file, moduleJsonSchema);
      modulesBySlug.set(parsed.slug, parsed);
    } catch (error) {
      fail(file, error);
    }
  }

  // --- rooms (index.mdx + tasks/*.mdx) ---
  const roomIndexFiles = await fg('rooms/*/index.mdx', { cwd: CONTENT, absolute: true });
  const roomsBySlug = new Map<string, CompiledRoom>();
  for (const file of roomIndexFiles) {
    try {
      const parsed = matter(await readFile(file, 'utf8'));
      const frontmatter = roomFrontmatterSchema.parse(parsed.data);
      const taskFiles = (
        await fg('tasks/*.mdx', { cwd: path.dirname(file), absolute: true })
      ).sort();
      const tasks: CompiledTask[] = [];
      for (const taskFile of taskFiles) {
        try {
          const taskParsed = matter(await readFile(taskFile, 'utf8'));
          const taskFrontmatter = taskFrontmatterSchema.parse(taskParsed.data);
          tasks.push({ ...taskFrontmatter, body: taskParsed.content.trim() });
        } catch (error) {
          fail(taskFile, error);
        }
      }
      tasks.sort((a, b) => a.index - b.index);
      roomsBySlug.set(frontmatter.slug, { ...frontmatter, tasks });
    } catch (error) {
      fail(file, error);
    }
  }

  // --- private answers (yaml) ---
  const answerFiles = await fg('answers/*.yaml', { cwd: PRIVATE, absolute: true });
  // A value is one accepted answer or a list of them (spec 107); the first is canonical.
  const answers: Record<string, string[]> = {};
  for (const file of answerFiles) {
    const parsed = parseYaml(await readFile(file, 'utf8')) as Record<string, unknown>;
    for (const [questionId, answer] of Object.entries(parsed)) {
      const accepted = typeof answer === 'string' ? [answer] : answer;
      if (
        !Array.isArray(accepted) ||
        accepted.length === 0 ||
        !accepted.every((value) => typeof value === 'string' && value.trim() !== '')
      ) {
        parseErrors.push({
          file: path.relative(ROOT, file),
          message: `answer for '${questionId}' must be a string or a non-empty list of strings`,
        });
        continue;
      }
      answers[questionId] = accepted as string[];
    }
  }

  // --- assemble catalog (path -> modules -> rooms), in roadmap order ---
  const ordered = sortPathsByOrder(paths);
  for (const issue of ordered.issues) parseErrors.push({ file: 'paths/*.json', message: issue });
  const compiledPaths: CompiledPath[] = ordered.paths.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    level: p.level,
    modules: p.modules.map((moduleRef): CompiledModule => {
      const module = modulesBySlug.get(moduleRef.slug);
      if (!module) {
        parseErrors.push({
          file: `paths/${p.slug}.json`,
          message: `references missing module '${moduleRef.slug}'`,
        });
        return { slug: moduleRef.slug, title: '?', description: '?', rooms: [] };
      }
      return {
        slug: module.slug,
        title: module.title,
        description: module.description,
        rooms: module.rooms.map((roomRef): CompiledRoom => {
          const room = roomsBySlug.get(roomRef.slug);
          if (!room) {
            parseErrors.push({
              file: `modules/${module.slug}.json`,
              message: `references missing room '${roomRef.slug}'`,
            });
            return {
              slug: roomRef.slug,
              title: '?',
              description: '?',
              difficulty: 'info',
              type: 'walkthrough',
              estimatedMinutes: 1,
              tags: [],
              lab: null,
              labUrl: null,
              tasks: [],
            };
          }
          return room;
        }),
      };
    }),
  }));

  // orphan modules/rooms not referenced by any path are an error (silent content = debt)
  const referencedModules = new Set(compiledPaths.flatMap((p) => p.modules.map((m) => m.slug)));
  for (const slug of modulesBySlug.keys()) {
    if (!referencedModules.has(slug)) {
      parseErrors.push({
        file: `modules/${slug}.json`,
        message: 'module not referenced by any path',
      });
    }
  }
  const referencedRooms = new Set(
    compiledPaths.flatMap((p) => p.modules.flatMap((m) => m.rooms.map((r) => r.slug))),
  );
  for (const slug of roomsBySlug.keys()) {
    if (!referencedRooms.has(slug)) {
      parseErrors.push({ file: `rooms/${slug}`, message: 'room not referenced by any module' });
    }
  }

  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    paths: compiledPaths,
  };
  // The pruned monorepo inside the API Docker build has no labs/ folder: the
  // check runs locally and in CI, where it does.
  const labSlugs = existsSync(LABS)
    ? new Set(
        (await fg('*/compose.yaml', { cwd: LABS }))
          .map((file) => file.split('/')[0] ?? '')
          .filter((slug) => !slug.startsWith('_')),
      )
    : undefined;
  if (!labSlugs) console.warn('content build: labs/ not found, skipping the lab existence check');
  const issues: ValidationIssue[] = validateCatalog(catalog, answers, labSlugs);

  const allErrors = [
    ...parseErrors.map((e) => `[${e.file}] ${e.message}`),
    ...issues.map((i) => `[${i.source}] ${i.message}`),
  ];
  if (allErrors.length > 0) {
    console.error(`content build FAILED with ${allErrors.length} error(s):`);
    for (const error of allErrors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  // Ordering/answer problems are warnings: they never block a build, but stay visible.
  const warnings = [...orderWarnings(catalog), ...answerWarnings(catalog, answers)];
  if (warnings.length > 0) {
    console.warn(`content build: ${warnings.length} warning(s):`);
    for (const warning of warnings) console.warn(`  ! ${warning}`);
  }

  // --- EN coverage (spec 107): what each room still lacks in English ---
  const enTranslations = await loadTranslations('en');
  const gapsByRoom = new Map<string, string[]>();
  for (const room of compiledPaths.flatMap((p) => p.modules.flatMap((m) => m.rooms))) {
    const gaps = translationGaps(room, enTranslations[room.slug]);
    if (gaps.length > 0) gapsByRoom.set(room.slug, gaps);
  }
  const gapCount = [...gapsByRoom.values()].reduce((sum, gaps) => sum + gaps.length, 0);
  if (EN_REPORT) {
    for (const slug of EN_REPORT.length > 0 ? EN_REPORT : [...gapsByRoom.keys()]) {
      const gaps = gapsByRoom.get(slug);
      console.log(`  [en] ${slug}: ${gaps ? gaps.join(', ') : 'OK'}`);
    }
  }
  if (gapCount > 0) {
    const summary = `EN coverage: ${gapCount} missing item(s) in ${gapsByRoom.size} room(s)`;
    if (STRICT_EN) {
      console.error(`content build FAILED: ${summary} (see --en-report)`);
      process.exit(1);
    }
    console.warn(`content build: ${summary} (details: --en-report[=slug,...])`);
  }

  // --- EN catalog (merge translations) ---
  const catalogEn = JSON.parse(JSON.stringify(catalog)) as Catalog;
  // Paths and modules are translated from _catalog.json; a missing entry fails the build.
  const missingEn = applyCatalogTranslation(catalogEn, await loadCatalogTranslation('en'));
  if (missingEn.length > 0) {
    console.error(`content build FAILED: missing EN translation in translations/en/_catalog.json:`);
    for (const key of missingEn) console.error(`  - ${key}`);
    process.exit(1);
  }
  for (const pathData of catalogEn.paths) {
    for (const module of pathData.modules) {
      for (const room of module.rooms) {
        applyRoomTranslation(room, enTranslations[room.slug]);
      }
    }
  }

  if (DRY_RUN) {
    console.log('content check OK (dry run: nothing written to dist/)');
    return;
  }

  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');
  // answers.json is seed-only (gitignored, never imported by web code — ADR-010).
  await writeFile(path.join(DIST, 'answers.json'), JSON.stringify(answers, null, 2), 'utf8');
  await writeFile(path.join(DIST, 'catalog-en.json'), JSON.stringify(catalogEn, null, 2), 'utf8');

  const roomCount = referencedRooms.size;
  const questionCount = Object.keys(answers).length;
  const enCount = Object.keys(enTranslations).length;
  console.log(
    `content build OK: ${compiledPaths.length} path(s), ` +
      `${referencedModules.size} module(s), ${roomCount} room(s), ${questionCount} answer(s), ` +
      `${enCount} EN translation(s)`,
  );
}

async function loadTranslations(locale: string): Promise<Record<string, RoomTranslation>> {
  const translations: Record<string, RoomTranslation> = {};
  // Files starting with '_' are catalog-level (paths/modules), not rooms.
  const transFiles = await fg(`${locale}/[!_]*.json`, { cwd: TRANSLATIONS, absolute: true });
  for (const file of transFiles) {
    const slug = path.basename(file, '.json');
    try {
      translations[slug] = JSON.parse(await readFile(file, 'utf8')) as RoomTranslation;
    } catch {
      console.error(`[translations] FAILED: ${file} is invalid JSON`);
      process.exit(1);
    }
  }
  return translations;
}

async function loadCatalogTranslation(locale: string): Promise<CatalogTranslation> {
  const file = path.join(TRANSLATIONS, locale, '_catalog.json');
  try {
    return JSON.parse(await readFile(file, 'utf8')) as CatalogTranslation;
  } catch {
    console.error(`[translations] FAILED: ${path.relative(ROOT, file)} is missing or invalid JSON`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('content build crashed:', error);
  process.exit(1);
});
