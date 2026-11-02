/**
 * Lab lifecycle with deadlines (phase 011, ADR-015).
 *
 * Every running lab has a deadline that only the API can push forward
 * (`renew`). The loop (`tick`) stops whatever is past its deadline and adopts
 * lab projects it finds running without one (manual starts, runner restarts)
 * with a short grace. So labs stop even if the API or the database are down.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncAssets } from './assets';
import { downArgs, LS_ARGS, parseComposeLs, upArgs } from './compose';
import type { RunnerConfig } from './config';
import { SLUG_PATTERN, type LabManifest, type LabManifestEntry } from './manifest';
import { KeyedMutex, Semaphore } from './mutex';
import { renderOverride } from './override';

export type LabState = 'stopped' | 'starting' | 'running' | 'stopping' | 'exited' | 'error' | 'unavailable';

export interface LabStatus {
  slug: string;
  state: LabState;
  /** Epoch ms after which the runner stops the lab unless renewed. */
  deadline: number | null;
  startedAt: number | null;
  lastError: string | null;
}

/** Runs `docker <args>`; rejects with an Error whose message carries stderr. */
export type Exec = (args: string[], timeoutMs: number) => Promise<{ stdout: string; stderr: string }>;

export type Logger = (event: string, data?: Record<string, unknown>) => void;

export class RunnerError extends Error {
  constructor(
    readonly code: 'unknown_lab' | 'unavailable' | 'capacity',
    message: string,
  ) {
    super(message);
  }
}

export type RunnerSettings = Pick<
  RunnerConfig,
  | 'labsDir'
  | 'flagsDir'
  | 'assetsMode'
  | 'assetsVolume'
  | 'assetsMount'
  | 'maxRunning'
  | 'maxConcurrentOps'
  | 'unleasedGraceSeconds'
  | 'opTimeoutSeconds'
>;

const ACTIVE: readonly LabState[] = ['starting', 'running'];
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(-500);

export class LabRunner {
  private readonly labs = new Map<string, LabManifestEntry>();
  private readonly status = new Map<string, LabStatus>();
  private readonly mutex = new KeyedMutex();
  private readonly ops: Semaphore;
  private readonly projects: ReadonlySet<string>;
  /** Epoch ms of the last completed loop (watchdog input). */
  lastLoopAt = 0;

  constructor(
    manifest: LabManifest,
    private readonly settings: RunnerSettings,
    private readonly exec: Exec,
    private readonly log: Logger = () => undefined,
    private readonly now: () => number = Date.now,
  ) {
    for (const entry of manifest.labs) this.labs.set(entry.slug, entry);
    this.projects = new Set(manifest.labs.map((entry) => entry.project));
    this.ops = new Semaphore(settings.maxConcurrentOps);
  }

  manifestEntries(): LabManifestEntry[] {
    return [...this.labs.values()];
  }

  get(slug: string): LabStatus {
    this.entry(slug);
    const known = this.status.get(slug);
    if (known && known.state !== 'stopped') return { ...known };
    return {
      slug,
      state: this.hasFlags(slug) ? 'stopped' : 'unavailable',
      deadline: null,
      startedAt: null,
      lastError: known?.lastError ?? null,
    };
  }

  list(): LabStatus[] {
    return this.manifestEntries().map((entry) => this.get(entry.slug));
  }

  runningCount(): number {
    return [...this.status.values()].filter((status) => ACTIVE.includes(status.state)).length;
  }

  /** Starts a lab in the background (idempotent). Resolves with the new status. */
  up(slug: string): LabStatus {
    const entry = this.entry(slug);
    if (!this.hasFlags(slug)) throw new RunnerError('unavailable', `no flags file for ${slug}`);
    const current = this.get(slug);
    if (ACTIVE.includes(current.state)) return current;
    if (this.runningCount() >= this.settings.maxRunning) {
      throw new RunnerError('capacity', `${this.settings.maxRunning} labs are already running`);
    }
    const now = this.now();
    this.set(slug, {
      state: 'starting',
      startedAt: now,
      deadline: Math.max(current.deadline ?? 0, now + this.settings.unleasedGraceSeconds * 1000),
      lastError: null,
    });
    this.log('lab.starting', { slug });
    void this.mutex.run(slug, () => this.ops.run(() => this.doUp(entry)));
    return this.get(slug);
  }

  /** Stops a lab (idempotent: also cleans leftovers of a stopped one). */
  async down(slug: string, reason: string): Promise<void> {
    const entry = this.entry(slug);
    if (this.status.get(slug)?.state !== 'stopped') this.set(slug, { state: 'stopping' });
    this.log('lab.stopping', { slug, reason });
    await this.mutex.run(slug, () =>
      this.ops.run(async () => {
        try {
          await this.exec(downArgs(entry), this.settings.opTimeoutSeconds * 1000);
          this.set(slug, { state: 'stopped', deadline: null, startedAt: null });
          this.log('lab.stopped', { slug, reason });
        } catch (error) {
          this.set(slug, { state: 'error', lastError: errorText(error) });
          this.log('lab.down_failed', { slug, error: errorText(error) });
        }
      }),
    );
  }

  async downAll(reason: string): Promise<void> {
    await this.refresh().catch(() => undefined);
    const targets = [...this.status.values()].filter((status) => status.state !== 'stopped');
    await Promise.all(targets.map((status) => this.down(status.slug, reason)));
  }

  /** Pushes deadlines forward (never back). Reports which labs are not running. */
  renew(slugs: readonly string[], ttlSeconds: number): { renewed: string[]; notRunning: string[] } {
    const renewed: string[] = [];
    const notRunning: string[] = [];
    const until = this.now() + ttlSeconds * 1000;
    for (const slug of slugs) {
      const status = this.labs.has(slug) ? this.status.get(slug) : undefined;
      if (status && ['starting', 'running', 'exited'].includes(status.state)) {
        status.deadline = Math.max(status.deadline ?? 0, until);
        renewed.push(slug);
      } else {
        notRunning.push(slug);
      }
    }
    return { renewed, notRunning };
  }

  /** Reconciles the in-memory state with the projects Docker actually has. */
  async refresh(): Promise<void> {
    const { stdout } = await this.exec(LS_ARGS, 30_000);
    const actual = parseComposeLs(stdout, this.projects);
    const now = this.now();
    for (const entry of this.labs.values()) {
      const status = this.status.get(entry.slug);
      if (status?.state === 'starting' || status?.state === 'stopping') continue;
      const found = actual.get(entry.project);
      if (!found) {
        if (status && (status.state === 'running' || status.state === 'exited')) {
          this.set(entry.slug, { state: 'stopped', deadline: null, startedAt: null });
          this.log('lab.vanished', { slug: entry.slug });
        }
        continue;
      }
      if (!status || status.state === 'stopped' || status.state === 'error') {
        this.set(entry.slug, {
          state: found,
          startedAt: null,
          deadline: now + this.settings.unleasedGraceSeconds * 1000,
        });
        this.log('lab.adopted', { slug: entry.slug, state: found });
      } else if (status.state !== found) {
        this.set(entry.slug, { state: found });
        if (found === 'exited') this.log('lab.exited', { slug: entry.slug });
      }
    }
  }

  /** One loop: reconcile, then stop every lab past its deadline. */
  async tick(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.log('loop.refresh_failed', { error: errorText(error) });
    }
    const now = this.now();
    for (const status of this.status.values()) {
      if (status.deadline !== null && status.deadline <= now && ['running', 'exited'].includes(status.state)) {
        this.log('lab.deadline', { slug: status.slug });
        void this.down(status.slug, 'deadline');
      }
    }
    this.lastLoopAt = now;
  }

  private async doUp(entry: LabManifestEntry): Promise<void> {
    const { slug } = entry;
    if (this.status.get(slug)?.state !== 'starting') return; // stopped while queued
    try {
      let override: string | null = null;
      if (this.settings.assetsMode === 'volume') {
        await syncAssets(this.settings.labsDir, this.settings.assetsMount, slug);
        const text = renderOverride(entry, this.settings.assetsVolume);
        if (text) {
          const dir = join(tmpdir(), 'cyberarena-lab-runner');
          await mkdir(dir, { recursive: true });
          override = join(dir, `${slug}.override.yaml`);
          await writeFile(override, text);
        }
      }
      const files = { compose: join(this.settings.labsDir, slug, 'compose.yaml'), override, envFile: this.envFile(slug) };
      const waitSeconds = Math.max(30, this.settings.opTimeoutSeconds - 30);
      await this.exec(upArgs(entry, files, waitSeconds), this.settings.opTimeoutSeconds * 1000);
      if (this.status.get(slug)?.state === 'starting') this.set(slug, { state: 'running' });
      this.log('lab.running', { slug });
    } catch (error) {
      this.set(slug, { state: 'error', lastError: errorText(error) });
      this.log('lab.start_failed', { slug, error: errorText(error) });
      await this.exec(downArgs(entry), this.settings.opTimeoutSeconds * 1000).catch(() => undefined);
    }
  }

  private entry(slug: string): LabManifestEntry {
    const entry = SLUG_PATTERN.test(slug) ? this.labs.get(slug) : undefined;
    if (!entry) throw new RunnerError('unknown_lab', `unknown lab "${slug}"`);
    return entry;
  }

  private envFile(slug: string): string {
    return join(this.settings.flagsDir, `${slug}.env`);
  }

  private hasFlags(slug: string): boolean {
    return existsSync(this.envFile(slug));
  }

  private set(slug: string, patch: Partial<Omit<LabStatus, 'slug'>>): void {
    const previous = this.status.get(slug) ?? { slug, state: 'stopped', deadline: null, startedAt: null, lastError: null };
    this.status.set(slug, { ...previous, ...patch, slug });
  }
}
