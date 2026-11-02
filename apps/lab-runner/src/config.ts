import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Runtime configuration, read once from the environment (no defaults for secrets). */
export interface RunnerConfig {
  host: string;
  port: number;
  token: string;
  /** Folder holding labs/<slug>/compose.yaml (baked into the image). */
  labsDir: string;
  /** Read-only folder with <slug>.env flag files; labs without one are unavailable. */
  flagsDir: string;
  /** volume: copy lab files into a named volume (runner in a container); bind: use the binds as-is. */
  assetsMode: 'volume' | 'bind';
  assetsVolume: string;
  /** Where the runner itself sees the assets volume. */
  assetsMount: string;
  manifestPath: string;
  /**
   * Host address lab ports are published on. Lab composes always say
   * 127.0.0.1; a LAN deployment sets its LAN IP here (phase 013).
   */
  labBindAddress: string;
  /** Host students use to reach the labs (shown in lab URLs). */
  labPublicHost: string;
  maxRunning: number;
  maxConcurrentOps: number;
  /** Deadline given to a lab nobody has renewed yet (adopted or just started). */
  unleasedGraceSeconds: number;
  loopSeconds: number;
  opTimeoutSeconds: number;
  dryRun: boolean;
}

const positiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
};

function readToken(): string {
  const file = process.env.LAB_RUNNER_TOKEN_FILE;
  const token = (file ? readFileSync(file, 'utf8') : (process.env.LAB_RUNNER_TOKEN ?? '')).trim();
  if (token.length < 32) throw new Error('LAB_RUNNER_TOKEN(_FILE) must hold a secret of 32+ characters');
  return token;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const HOSTNAME = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;

/** LAB_BIND_ADDRESS / LAB_PUBLIC_HOST, validated (they end up in compose files and URLs). */
export function labNetwork(env: NodeJS.ProcessEnv = process.env): {
  labBindAddress: string;
  labPublicHost: string;
} {
  const labBindAddress = env.LAB_BIND_ADDRESS?.trim() || '127.0.0.1';
  if (!IPV4.test(labBindAddress)) throw new Error('LAB_BIND_ADDRESS must be an IPv4 address');
  const fallback = labBindAddress === '0.0.0.0' ? '127.0.0.1' : labBindAddress;
  const labPublicHost = env.LAB_PUBLIC_HOST?.trim() || fallback;
  if (!HOSTNAME.test(labPublicHost)) throw new Error('LAB_PUBLIC_HOST must be a host name or IP');
  return { labBindAddress, labPublicHost };
}

export function loadConfig(): RunnerConfig {
  const assetsMode = process.env.LAB_ASSETS === 'bind' ? 'bind' : 'volume';
  return {
    host: process.env.LAB_RUNNER_HOST ?? '0.0.0.0',
    port: positiveInt('LAB_RUNNER_PORT', 4100),
    token: readToken(),
    labsDir: resolve(process.env.LABS_DIR ?? join(__dirname, '../../../labs')),
    flagsDir: resolve(process.env.LAB_FLAGS_DIR ?? '/run/lab-flags'),
    assetsMode,
    assetsVolume: process.env.LAB_ASSETS_VOLUME ?? 'cyberarena-lab-assets',
    assetsMount: process.env.LAB_ASSETS_MOUNT ?? '/assets',
    manifestPath: process.env.LAB_MANIFEST ?? join(__dirname, 'manifest.json'),
    ...labNetwork(),
    maxRunning: positiveInt('LAB_MAX_RUNNING', 3),
    maxConcurrentOps: positiveInt('LAB_MAX_OPS', 2),
    unleasedGraceSeconds: positiveInt('LAB_UNLEASED_GRACE_SECONDS', 300),
    loopSeconds: positiveInt('LAB_LOOP_SECONDS', 30),
    opTimeoutSeconds: positiveInt('LAB_OP_TIMEOUT_SECONDS', 180),
    dryRun: process.env.LAB_RUNNER_DRY_RUN === '1',
  };
}
