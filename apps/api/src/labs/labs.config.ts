import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { LabPolicy } from './lease-policy';

/** Labs on demand configuration (phase 011), validated once at boot. */
export interface LabsConfig {
  enabled: boolean;
  runnerUrl: string;
  runnerToken: string;
  policy: LabPolicy;
  sweepMs: number;
  /** Deadline the reaper gives the runner on each sweep. */
  renewTtlSeconds: number;
  /** Host students use for the labs when not 127.0.0.1 (LAN deployment, phase 013). */
  publicHost: string | null;
}

export const LABS_CONFIG = Symbol('LABS_CONFIG');

const minutes = (fallback: number, max: number) => z.coerce.number().int().min(1).max(max).default(fallback);

const envSchema = z.object({
  LABS_ENABLED: z.enum(['true', 'false']).default('false'),
  LAB_RUNNER_URL: z.string().url().default('http://127.0.0.1:4100'),
  LAB_RUNNER_TOKEN: z.string().optional(),
  LAB_RUNNER_TOKEN_FILE: z.string().optional(),
  LAB_IDLE_TIMEOUT_MIN: minutes(10, 120),
  LAB_SESSION_MAX_MIN: minutes(120, 24 * 60),
  LAB_SESSION_CAP_MIN: minutes(240, 24 * 60),
  LAB_EXTEND_MIN: minutes(60, 24 * 60),
  LAB_EXTEND_WINDOW_MIN: minutes(30, 24 * 60),
  LAB_MAX_RUNNING: z.coerce.number().int().min(1).max(50).default(3),
  LAB_SWEEP_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  LAB_RENEW_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(180),
  // Same rule as the lab-runner: it ends up in URLs shown to students.
  LAB_PUBLIC_HOST: z
    .string()
    .trim()
    .regex(/^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?)?$/)
    .default(''),
});

export function loadLabsConfig(env: NodeJS.ProcessEnv = process.env): LabsConfig {
  const parsed = envSchema.parse(env);
  const token = (
    parsed.LAB_RUNNER_TOKEN_FILE ? readFileSync(parsed.LAB_RUNNER_TOKEN_FILE, 'utf8') : (parsed.LAB_RUNNER_TOKEN ?? '')
  ).trim();
  const enabled = parsed.LABS_ENABLED === 'true';
  if (enabled && token.length < 32) {
    throw new Error('LABS_ENABLED=true needs LAB_RUNNER_TOKEN(_FILE) with 32+ characters');
  }
  if (parsed.LAB_SESSION_CAP_MIN < parsed.LAB_SESSION_MAX_MIN) {
    throw new Error('LAB_SESSION_CAP_MIN must be >= LAB_SESSION_MAX_MIN');
  }
  const ms = 60_000;
  return {
    enabled,
    runnerUrl: parsed.LAB_RUNNER_URL.replace(/\/$/, ''),
    runnerToken: token,
    policy: {
      idleTimeoutMs: parsed.LAB_IDLE_TIMEOUT_MIN * ms,
      sessionMaxMs: parsed.LAB_SESSION_MAX_MIN * ms,
      sessionCapMs: parsed.LAB_SESSION_CAP_MIN * ms,
      extendMs: parsed.LAB_EXTEND_MIN * ms,
      extendWindowMs: parsed.LAB_EXTEND_WINDOW_MIN * ms,
      maxRunning: parsed.LAB_MAX_RUNNING,
    },
    sweepMs: parsed.LAB_SWEEP_SECONDS * 1000,
    renewTtlSeconds: parsed.LAB_RENEW_TTL_SECONDS,
    publicHost: parsed.LAB_PUBLIC_HOST && parsed.LAB_PUBLIC_HOST !== '127.0.0.1' ? parsed.LAB_PUBLIC_HOST : null,
  };
}
