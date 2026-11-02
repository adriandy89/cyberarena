import { execFile } from 'node:child_process';
import type { LabManifest } from './manifest';
import type { Exec } from './runner';

/** Real docker CLI: execFile, never a shell; stderr travels in the error message. */
export const dockerExec: Exec = (args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile('docker', args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`docker ${args.slice(0, 4).join(' ')} failed: ${stderr || error.message}`));
      else resolve({ stdout, stderr });
    });
  });

/**
 * LAB_RUNNER_DRY_RUN=1: same states and timings without Docker (E2E and CI).
 * `up` takes `startDelayMs`; every project then reports as running.
 */
export function dryRunExec(manifest: LabManifest, startDelayMs = 1500): Exec {
  const running = new Set<string>();
  const projectOf = (args: string[]) => args[args.indexOf('-p') + 1] ?? '';
  return async (args) => {
    if (args.includes('ls')) {
      const rows = manifest.labs
        .filter((entry) => running.has(entry.project))
        .map((entry) => ({ Name: entry.project, Status: 'running(1)', ConfigFiles: 'dry-run' }));
      return { stdout: JSON.stringify(rows), stderr: '' };
    }
    if (args.includes('up')) {
      await new Promise((resolve) => setTimeout(resolve, startDelayMs));
      running.add(projectOf(args));
    } else if (args.includes('down')) {
      running.delete(projectOf(args));
    }
    return { stdout: '', stderr: '' };
  };
}
