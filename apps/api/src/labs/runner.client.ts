/**
 * HTTP client of the lab-runner (apps/lab-runner, ADR-015). The runner
 * answers start/stop with 202 right away, so these calls are short.
 */

export interface RunnerLabView {
  slug: string;
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'exited' | 'error' | 'unavailable';
  deadline: number | null;
  startedAt: number | null;
  lastError: string | null;
  access: 'http' | 'exec';
  url: string | null;
  ports: Array<{ service: string; host: number; container: number; protocol: 'tcp' | 'udp' }>;
  execService: string | null;
  project: string;
}

/** The runner could not be reached (network, timeout, 5xx). */
export class RunnerUnavailableError extends Error {}

/** The runner refused the request (unknown lab, capacity, no flags...). */
export class RunnerRejectedError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

const LIST_CACHE_MS = 1500;

export class LabRunnerClient {
  private listCache: { at: number; labs: RunnerLabView[] } | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 3000,
  ) {}

  async health(): Promise<Record<string, unknown>> {
    return this.call('GET', '/healthz');
  }

  /** Status of every lab; cached briefly since every page poll asks for it. */
  async list(fresh = false): Promise<RunnerLabView[]> {
    if (!fresh && this.listCache && Date.now() - this.listCache.at < LIST_CACHE_MS) return this.listCache.labs;
    const { labs } = await this.call<{ labs: RunnerLabView[] }>('GET', '/labs');
    this.listCache = { at: Date.now(), labs };
    return labs;
  }

  async get(slug: string): Promise<RunnerLabView | null> {
    return (await this.list()).find((lab) => lab.slug === slug) ?? null;
  }

  async up(slug: string): Promise<RunnerLabView> {
    this.listCache = null;
    return this.call('POST', `/labs/${encodeURIComponent(slug)}/up`);
  }

  async down(slug: string): Promise<RunnerLabView> {
    this.listCache = null;
    return this.call('POST', `/labs/${encodeURIComponent(slug)}/down`);
  }

  async renew(slugs: string[], ttlSeconds: number): Promise<{ renewed: string[]; notRunning: string[] }> {
    return this.call('POST', '/renew', { slugs, ttlSeconds });
  }

  async downAll(): Promise<void> {
    this.listCache = null;
    await this.call('POST', '/down-all');
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new RunnerUnavailableError(`lab-runner unreachable: ${(error as Error).message}`);
    }
    if (response.status >= 500) throw new RunnerUnavailableError(`lab-runner error ${response.status}`);
    const json = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      throw new RunnerRejectedError(response.status, json.error ?? 'error', json.message ?? `lab-runner ${response.status}`);
    }
    return json as T;
  }
}
