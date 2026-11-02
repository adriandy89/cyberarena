/**
 * Lints every labs/<slug>/compose.yaml and writes dist/manifest.json.
 * Any lint issue fails the build (phase 011, ADR-015). Folders starting with
 * "_" (the template) are linted but never published in the manifest.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { envFileKeys, lintLab, lintUnique, type LintIssue } from '../src/lint';
import { SLUG_PATTERN, type LabManifest, type LabManifestEntry } from '../src/manifest';

export const LABS_DIR = resolve(__dirname, '../../../labs');

export function loadLabs(labsDir = LABS_DIR): { entries: LabManifestEntry[]; issues: LintIssue[] } {
  const entries: LabManifestEntry[] = [];
  const issues: LintIssue[] = [];
  const slugs = readdirSync(labsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && existsSync(join(labsDir, dirent.name, 'compose.yaml')))
    .map((dirent) => dirent.name)
    .sort();

  for (const slug of slugs) {
    const isTemplate = slug.startsWith('_');
    if (!isTemplate && !SLUG_PATTERN.test(slug)) {
      issues.push({ slug, rule: 'name', message: 'lab folder must be a kebab-case slug' });
      continue;
    }
    const dir = join(labsDir, slug);
    let doc: unknown;
    try {
      doc = parse(readFileSync(join(dir, 'compose.yaml'), 'utf8'));
    } catch (error) {
      issues.push({ slug, rule: 'shape', message: `invalid YAML: ${(error as Error).message}` });
      continue;
    }
    const flagsFile = join(dir, 'flags.env.example');
    const flagVars = existsSync(flagsFile) ? envFileKeys(readFileSync(flagsFile, 'utf8')) : [];
    const result = lintLab(slug, doc, flagVars);
    issues.push(...result.issues);
    if (result.entry && !isTemplate) entries.push(result.entry);
  }
  issues.push(...lintUnique(entries));
  return { entries, issues };
}

function main(): void {
  const { entries, issues } = loadLabs();
  if (issues.length > 0) {
    console.error(`lab lint: ${issues.length} issue(s)`);
    for (const issue of issues) {
      console.error(`  ✗ ${issue.slug}${issue.service ? `/${issue.service}` : ''} [${issue.rule}] ${issue.message}`);
    }
    process.exit(1);
  }
  const manifest: LabManifest = { generatedAt: new Date().toISOString(), labs: entries };
  const outDir = resolve(__dirname, '../dist');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`lab manifest OK: ${entries.length} lab(s)`);
}

if (require.main === module) main();
