/**
 * Labs on demand (phase 011): the contract between the API and the web.
 */

export const LAB_STATES = [
  'disabled',
  'stopped',
  'starting',
  'running',
  'stopping',
  'exited',
  'error',
  'unavailable',
] as const;
export type LabState = (typeof LAB_STATES)[number];

export const LAB_ERROR_CODES = [
  'LAB_DISABLED',
  'LAB_UNKNOWN',
  'LAB_OTHER_ACTIVE',
  'LAB_CAPACITY',
  'LAB_RUNNER_DOWN',
  'LAB_UNAVAILABLE',
  'LAB_NOT_LEASED',
  'LAB_CANNOT_EXTEND',
] as const;
export type LabErrorCode = (typeof LAB_ERROR_CODES)[number];

/** Error body of the labs endpoints (409/404/503...). */
export interface LabErrorBody {
  code: LabErrorCode;
  message: string;
  /** LAB_OTHER_ACTIVE: the lab the user already has, and the room it belongs to. */
  otherLab?: { slug: string; roomSlug: string | null };
  /** LAB_CAPACITY: when the first lab slot is expected to free up (ISO). */
  earliestFreeAt?: string | null;
}

export interface LabLeaseView {
  startedAt: string;
  maxUntil: string;
  /** When the lease ends without heartbeats (page closed). */
  idleDeadline: string;
  /** Hard ceiling after every extension. */
  capUntil: string;
  canExtend: boolean;
}

export interface LabSessionView {
  slug: string;
  state: LabState;
  runnerUp: boolean;
  access: 'http' | 'exec' | null;
  url: string | null;
  /** For exec labs: the command to get a shell. */
  execCommand: string | null;
  ports: Array<{ host: number; protocol: 'tcp' | 'udp' }>;
  /** Address the ports are reachable on (127.0.0.1, or the LAN host). */
  host: string;
  /** People with an active lease on this lab (including the caller). */
  users: number;
  mine: LabLeaseView | null;
  /** The caller's lease on a different lab, if any. */
  otherLab: { slug: string; roomSlug: string | null } | null;
  lastError: string | null;
}

/** GET /api/labs: public switch for the web (guests included). */
export interface LabsInfo {
  enabled: boolean;
  maxRunning: number;
  idleTimeoutMinutes: number;
  /** Host students use for the labs when it is not 127.0.0.1 (LAN deployment, phase 013). */
  publicHost: string | null;
}

/** Lab ports live in 18000-18999 and 28000-28999 (see labs/). */
const LAB_ADDRESS = /127\.0\.0\.1(?=:[12]8\d{3}(?!\d))/g;

/**
 * Points lab addresses in content (`curl http://127.0.0.1:18081/...`) at the
 * host students actually reach (phase 013). Other 127.0.0.1 mentions stay.
 */
export function withLabHost(text: string, host: string | null): string {
  return host ? text.replace(LAB_ADDRESS, host) : text;
}

/** GET /api/admin/labs: what an admin sees about labs (phase 011). */
export interface AdminLabsOverview {
  info: LabsInfo;
  health: {
    enabled: boolean;
    runner: 'up' | 'down' | 'disabled';
    running: number | null;
    lastSweepAt: string | null;
    sweepOk: boolean | null;
    stale: boolean;
  };
  lastSweep: {
    at: string;
    ok: boolean;
    expired: number;
    stopped: string[];
    renewed: number;
    notRunning: string[];
    error?: string;
  } | null;
  labs: Array<{
    slug: string;
    roomSlug: string | null;
    state: LabState;
    users: Array<{ userId: string; name: string | null; email: string | null; startedAt: string; lastSeenAt: string; maxUntil: string }>;
  }>;
  events: Array<{ at: string; labSlug: string; type: string; user: { name: string; email: string } | null; detail: unknown }>;
}
