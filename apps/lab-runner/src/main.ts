/**
 * lab-runner entry point (phase 011, ADR-015).
 *
 * Boot: check Docker versions, adopt whatever lab is already running (it gets
 * a short grace), then loop every LAB_LOOP_SECONDS. A watchdog exits the
 * process if the loop stalls, so `restart: always` brings it back. On SIGTERM
 * (a deliberate stop) every lab is stopped: nothing outlives the runner.
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from './config';
import { dockerExec, dryRunExec } from './exec';
import type { LabManifest } from './manifest';
import { LabRunner } from './runner';
import { createRunnerServer } from './server';
import { meetsMinimum, MIN_COMPOSE, MIN_ENGINE } from './versions';

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));

async function main(): Promise<void> {
  const config = loadConfig();
  const manifest = JSON.parse(readFileSync(config.manifestPath, 'utf8')) as LabManifest;
  const exec = config.dryRun ? dryRunExec(manifest) : dockerExec;

  const versions: Record<string, string> = {
    mode: config.dryRun ? 'dry-run' : config.assetsMode,
    bind: config.labBindAddress,
    publicHost: config.labPublicHost,
  };
  if (!config.dryRun) {
    versions.engine = (await exec(['version', '--format', '{{.Server.Version}}'], 15_000)).stdout.trim();
    versions.compose = (await exec(['compose', 'version', '--short'], 15_000)).stdout.trim();
    if (!meetsMinimum(versions.engine, MIN_ENGINE) || !meetsMinimum(versions.compose, MIN_COMPOSE)) {
      log('runner.unsupported_docker', { ...versions, minEngine: MIN_ENGINE, minCompose: MIN_COMPOSE });
      process.exit(1);
    }
  }

  const runner = new LabRunner(manifest, config, exec, log);
  await runner.tick(); // boot sweep: adopt leftovers with a grace period
  const loop = setInterval(() => void runner.tick(), config.loopSeconds * 1000);

  const stallMs = Math.max(120_000, config.loopSeconds * 4000);
  setInterval(() => {
    if (Date.now() - runner.lastLoopAt > stallMs) {
      log('runner.watchdog_stalled', { lastLoopAt: new Date(runner.lastLoopAt).toISOString() });
      process.exit(1);
    }
  }, 15_000).unref();

  const server = createRunnerServer({
    runner,
    token: config.token,
    log,
    publicHost: config.labPublicHost,
    health: () => ({
      ...versions,
      labs: manifest.labs.length,
      maxRunning: config.maxRunning,
      lastLoopAt: new Date(runner.lastLoopAt).toISOString(),
    }),
  });
  server.listen(config.port, config.host, () =>
    log('runner.listening', { host: config.host, port: config.port, labs: manifest.labs.length, ...versions }),
  );

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log('runner.shutdown', { signal });
    clearInterval(loop);
    server.close();
    const timeout = setTimeout(() => process.exit(0), 45_000);
    void runner.downAll('runner-shutdown').finally(() => {
      clearTimeout(timeout);
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  log('runner.fatal', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
