/** docker compose argument builders and output parsers (pure). */
import type { LabManifestEntry } from './manifest';

export interface UpFiles {
  compose: string;
  override: string | null;
  envFile: string;
}

export function upArgs(entry: LabManifestEntry, files: UpFiles, waitSeconds: number): string[] {
  return [
    'compose',
    '-p',
    entry.project,
    '-f',
    files.compose,
    ...(files.override ? ['-f', files.override] : []),
    '--env-file',
    files.envFile,
    'up',
    '-d',
    '--wait',
    '--wait-timeout',
    String(waitSeconds),
    '--remove-orphans',
  ];
}

/** Down by project label: needs neither the compose file nor the flags. */
export function downArgs(entry: Pick<LabManifestEntry, 'project'>): string[] {
  return ['compose', '-p', entry.project, 'down', '-v', '--remove-orphans', '-t', '5'];
}

export const LS_ARGS = ['compose', 'ls', '--all', '--format', 'json'];

export type ProjectStatus = 'running' | 'exited';

/**
 * Parses `docker compose ls --all --format json`, keeping only the given
 * projects (the host may run unrelated compose projects). A project with any
 * exited/dead container counts as exited.
 */
export function parseComposeLs(stdout: string, projects: ReadonlySet<string>): Map<string, ProjectStatus> {
  const result = new Map<string, ProjectStatus>();
  const trimmed = stdout.trim();
  if (!trimmed) return result;
  const rows = JSON.parse(trimmed) as Array<{ Name?: unknown; Status?: unknown }>;
  for (const row of rows) {
    if (typeof row.Name !== 'string' || !projects.has(row.Name)) continue;
    const status = typeof row.Status === 'string' ? row.Status : '';
    result.set(row.Name, /exited|dead|restarting/.test(status) || !/running/.test(status) ? 'exited' : 'running');
  }
  return result;
}
