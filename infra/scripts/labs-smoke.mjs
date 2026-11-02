#!/usr/bin/env node
// Smoke test of every lab through the lab-runner (phases 011/012): start it with
// the runner CLI (same rules as the API), check it answers from the host, stop it.
//
// Usage (from the repo root):
//   node infra/scripts/labs-smoke.mjs [--runner <container>] [slug ...]
// Default runner container: cyberarena-prod-lab-runner-1 (dev: cyberarena-dev-lab-runner-1).
// Labs run one at a time, so the runner's capacity is never the bottleneck.
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const runnerAt = argv.indexOf('--runner');
const runner = runnerAt >= 0 ? argv[runnerAt + 1] : 'cyberarena-prod-lab-runner-1';
const only = argv.filter((arg, index) => arg !== '--runner' && index !== runnerAt + 1);

const docker = (args, timeout = 60_000) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
const cli = (...args) => docker(['exec', runner, 'node', 'dist/cli.js', ...args], 200_000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Docker Desktop accepts TCP before the app listens: probe with real HTTP requests. */
async function httpStatus(url) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      return (await fetch(url, { signal: AbortSignal.timeout(3000) })).status;
    } catch {
      await sleep(1000);
    }
  }
  return null;
}

const manifest = JSON.parse(docker(['exec', runner, 'cat', '/app/dist/manifest.json']));
const labs = manifest.labs.filter((lab) => only.length === 0 || only.includes(lab.slug));
let failed = 0;

for (const lab of labs) {
  const started = Date.now();
  const notes = [];
  let ok = true;
  try {
    cli('up', lab.slug, '--wait');
    if (lab.access === 'http') {
      const status = await httpStatus(lab.url);
      if (status === null) {
        ok = false;
        notes.push(`no HTTP answer at ${lab.url}`);
      } else notes.push(`HTTP ${status}`);
    } else {
      docker(['exec', `${lab.project}-${lab.execService}-1`, 'true']);
      notes.push(`exec ${lab.project}-${lab.execService}-1`);
    }
  } catch (error) {
    ok = false;
    notes.push(String(error.stderr || error.stdout || error.message).trim().split('\n').slice(-1)[0]);
  } finally {
    try {
      cli('down', lab.slug);
    } catch {
      notes.push('down failed');
    }
  }
  if (!ok) failed++;
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${lab.slug.padEnd(22)} ${String(seconds).padStart(3)}s  ${notes.join(', ')}`);
}

console.log(`\n${labs.length - failed}/${labs.length} labs OK (runner ${runner})`);
process.exit(failed ? 1 : 0);
