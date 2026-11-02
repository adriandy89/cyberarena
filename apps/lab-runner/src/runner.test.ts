import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabManifest, LabManifestEntry, LabVolume } from './manifest';
import { LabRunner, RunnerError, type Exec, type RunnerSettings } from './runner';

function entry(slug: string, volumes: LabVolume[] = []): LabManifestEntry {
  return {
    slug,
    project: `lab-${slug}`,
    access: 'http',
    url: 'http://127.0.0.1:18081',
    ports: [],
    execService: null,
    services: ['web'],
    volumes: { web: volumes },
    flagVars: ['FLAG_1'],
  };
}

const MANIFEST: LabManifest = {
  generatedAt: '2026-11-02T00:00:00.000Z',
  labs: [
    entry('alpha', [{ type: 'bind', source: 'site', target: '/site', readOnly: true }]),
    entry('beta'),
    entry('gamma'),
    entry('noflags'),
  ],
};

/** Records docker calls and plays the daemon's part for `compose ls`. */
class FakeDocker {
  calls: string[][] = [];
  projects = new Map<string, 'running' | 'exited'>();
  failUp = false;

  exec: Exec = async (args) => {
    this.calls.push(args);
    if (args.includes('ls')) {
      const rows = [...this.projects].map(([Name, state]) => ({ Name, Status: `${state}(1)` }));
      return { stdout: JSON.stringify(rows), stderr: '' };
    }
    const project = args[args.indexOf('-p') + 1] ?? '';
    if (args.includes('up')) {
      if (this.failUp) throw new Error('docker compose up failed: pull access denied');
      this.projects.set(project, 'running');
    }
    if (args.includes('down')) this.projects.delete(project);
    return { stdout: '', stderr: '' };
  };

  count(verb: 'up' | 'down', project: string): number {
    return this.calls.filter((args) => args.includes(verb) && args.includes(project)).length;
  }
}

let docker: FakeDocker;
let now: number;
let settings: RunnerSettings;

async function makeRunner(overrides: Partial<RunnerSettings> = {}): Promise<LabRunner> {
  return new LabRunner(MANIFEST, { ...settings, ...overrides }, docker.exec, () => undefined, () => now);
}

const waitFor = (runner: LabRunner, slug: string, state: string) =>
  vi.waitFor(() => expect(runner.get(slug).state).toBe(state), { timeout: 2000, interval: 5 });

beforeEach(async () => {
  docker = new FakeDocker();
  now = 1_000_000;
  const root = await mkdtemp(join(tmpdir(), 'lab-runner-test-'));
  const labsDir = join(root, 'labs');
  const flagsDir = join(root, 'flags');
  for (const lab of MANIFEST.labs) {
    await mkdir(join(labsDir, lab.slug, 'site'), { recursive: true });
    await writeFile(join(labsDir, lab.slug, 'compose.yaml'), 'name: x\n');
    await writeFile(join(labsDir, lab.slug, 'site', 'index.html'), '<h1>lab</h1>');
    await writeFile(join(labsDir, lab.slug, 'flags.env.example'), 'FLAG_1=FLAG{x}\n');
  }
  await mkdir(flagsDir, { recursive: true });
  for (const slug of ['alpha', 'beta', 'gamma']) await writeFile(join(flagsDir, `${slug}.env`), 'FLAG_1=FLAG{x}\n');
  settings = {
    labsDir,
    flagsDir,
    assetsMode: 'volume',
    assetsVolume: 'test-assets',
    assetsMount: join(root, 'assets'),
    labBindAddress: '127.0.0.1',
    maxRunning: 3,
    maxConcurrentOps: 2,
    unleasedGraceSeconds: 300,
    opTimeoutSeconds: 120,
  };
});

describe('LabRunner.up', () => {
  it('starts a lab in the background with the assets override and the flags file', async () => {
    const runner = await makeRunner();
    expect(runner.up('alpha').state).toBe('starting');
    await waitFor(runner, 'alpha', 'running');

    const up = docker.calls.find((args) => args.includes('up'))!;
    expect(up.slice(0, 3)).toEqual(['compose', '-p', 'lab-alpha']);
    expect(up).toContain(join(settings.labsDir, 'alpha', 'compose.yaml'));
    expect(up.find((arg) => arg.endsWith('alpha.override.yaml'))).toBeTruthy();
    expect(up[up.indexOf('--env-file') + 1]).toBe(join(settings.flagsDir, 'alpha.env'));
    // Lab files are in the assets volume, its env files are not.
    expect(existsSync(join(settings.assetsMount, 'alpha', 'site', 'index.html'))).toBe(true);
    expect(existsSync(join(settings.assetsMount, 'alpha', 'flags.env.example'))).toBe(false);
  });

  it('uses the binds as-is in bind mode (runner on the host)', async () => {
    const runner = await makeRunner({ assetsMode: 'bind' });
    runner.up('alpha');
    await waitFor(runner, 'alpha', 'running');
    const up = docker.calls.find((args) => args.includes('up'))!;
    expect(up.filter((arg) => arg === '-f')).toHaveLength(1);
  });

  it('is idempotent while starting or running', async () => {
    const runner = await makeRunner();
    runner.up('beta');
    runner.up('beta');
    await waitFor(runner, 'beta', 'running');
    runner.up('beta');
    expect(docker.count('up', 'lab-beta')).toBe(1);
  });

  it('refuses unknown slugs, path tricks and labs without flags', async () => {
    const runner = await makeRunner();
    expect(() => runner.up('../etc')).toThrow(RunnerError);
    expect(() => runner.up('nope')).toThrow(/unknown lab/);
    expect(runner.get('noflags').state).toBe('unavailable');
    try {
      runner.up('noflags');
    } catch (error) {
      expect((error as RunnerError).code).toBe('unavailable');
    }
  });

  it('enforces the running cap', async () => {
    const runner = await makeRunner({ maxRunning: 2 });
    runner.up('alpha');
    runner.up('beta');
    expect(() => runner.up('gamma')).toThrow(expect.objectContaining({ code: 'capacity' }));
  });

  it('records a failed start and cleans up the half-created project', async () => {
    docker.failUp = true;
    const runner = await makeRunner();
    runner.up('beta');
    await waitFor(runner, 'beta', 'error');
    expect(runner.get('beta').lastError).toMatch(/pull access denied/);
    expect(docker.count('down', 'lab-beta')).toBe(1);
  });
});

describe('deadlines', () => {
  it('stops a lab nobody renews once its grace period ends', async () => {
    const runner = await makeRunner();
    runner.up('beta');
    await waitFor(runner, 'beta', 'running');
    now += 299_000;
    await runner.tick();
    expect(runner.get('beta').state).toBe('running');
    now += 2_000;
    await runner.tick();
    await waitFor(runner, 'beta', 'stopped');
    expect(docker.projects.has('lab-beta')).toBe(false);
  });

  it('keeps a renewed lab alive; renew never shortens a deadline', async () => {
    const runner = await makeRunner();
    runner.up('beta');
    await waitFor(runner, 'beta', 'running');
    now += 200_000;
    expect(runner.renew(['beta', 'gamma', 'nope'], 180)).toEqual({ renewed: ['beta'], notRunning: ['gamma', 'nope'] });
    const deadline = runner.get('beta').deadline!;
    expect(deadline).toBe(now + 180_000);
    runner.renew(['beta'], 10);
    expect(runner.get('beta').deadline).toBe(deadline);
    now += 150_000; // past the initial grace, within the renewal
    await runner.tick();
    expect(runner.get('beta').state).toBe('running');
  });

  it('adopts lab projects started outside the runner and stops them after the grace', async () => {
    docker.projects.set('lab-gamma', 'running');
    docker.projects.set('someone-elses-stack', 'running');
    const runner = await makeRunner();
    await runner.tick();
    expect(runner.get('gamma')).toMatchObject({ state: 'running', deadline: now + 300_000 });
    now += 301_000;
    await runner.tick();
    await waitFor(runner, 'gamma', 'stopped');
    // Projects outside the manifest are never touched.
    expect(docker.projects.has('someone-elses-stack')).toBe(true);
    expect(docker.calls.some((args) => args.includes('someone-elses-stack'))).toBe(false);
  });

  it('tracks labs that crash or vanish', async () => {
    const runner = await makeRunner();
    runner.up('alpha');
    await waitFor(runner, 'alpha', 'running');
    docker.projects.set('lab-alpha', 'exited');
    await runner.tick();
    expect(runner.get('alpha').state).toBe('exited');
    docker.projects.delete('lab-alpha');
    await runner.tick();
    expect(runner.get('alpha').state).toBe('stopped');
  });

  it('downAll stops every lab, including adopted ones', async () => {
    const runner = await makeRunner();
    runner.up('alpha');
    await waitFor(runner, 'alpha', 'running');
    docker.projects.set('lab-gamma', 'running');
    await runner.downAll('admin');
    expect(runner.list().filter((status) => status.state !== 'stopped' && status.state !== 'unavailable')).toEqual([]);
    expect(docker.projects.size).toBe(0);
  });

  it('records when the loop last completed (watchdog input)', async () => {
    const runner = await makeRunner();
    await runner.tick();
    expect(runner.lastLoopAt).toBe(now);
  });
});
