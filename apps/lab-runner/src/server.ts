/**
 * Internal HTTP API of the lab-runner (phase 011, ADR-015). Only the API can
 * reach it (internal Docker network) and every call needs the bearer token.
 *
 *   GET  /healthz                 liveness + docker/compose versions + loop age
 *   GET  /labs                    status of every manifest lab
 *   POST /labs/:slug/up           start (202, async, idempotent)
 *   POST /labs/:slug/down         stop (202)
 *   POST /renew {slugs, ttlSeconds}
 *   POST /down-all
 */
import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { LabManifestEntry } from './manifest';
import { RunnerError, type LabRunner, type LabStatus } from './runner';

export interface ServerDeps {
  runner: LabRunner;
  token: string;
  /** Extra data for /healthz (versions, loop age...). */
  health: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  log: (event: string, data?: Record<string, unknown>) => void;
}

/** What the API needs about a lab: its status plus how to reach it. */
export type LabView = LabStatus & Pick<LabManifestEntry, 'access' | 'url' | 'ports' | 'execService' | 'project'>;

const MAX_BODY = 16 * 1024;
const MAX_TTL_SECONDS = 15 * 60;

function tokenMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header?.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(json);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new RangeError('body too large');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function view(runner: LabRunner, slug: string): LabView {
  const entry = runner.manifestEntries().find((candidate) => candidate.slug === slug)!;
  const { access, url, ports, execService, project } = entry;
  return { ...runner.get(slug), access, url, ports, execService, project };
}

export function createRunnerServer({ runner, token, health, log }: ServerDeps): Server {
  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://runner');
      const method = req.method ?? 'GET';
      if (!tokenMatches(req.headers.authorization, token)) {
        log('http.unauthorized', { method, path: url.pathname });
        return send(res, 401, { error: 'unauthorized' });
      }
      try {
        if (method === 'GET' && url.pathname === '/healthz') {
          return send(res, 200, { ok: true, running: runner.runningCount(), ...(await health()) });
        }
        if (method === 'GET' && url.pathname === '/labs') {
          return send(res, 200, { labs: runner.manifestEntries().map((entry) => view(runner, entry.slug)) });
        }
        const lab = /^\/labs\/([^/]+)\/(up|down)$/.exec(url.pathname);
        if (method === 'POST' && lab) {
          const [, slug = '', action] = lab;
          if (action === 'up') {
            runner.up(slug);
            return send(res, 202, view(runner, slug));
          }
          runner.get(slug); // validates the slug before going async
          void runner.down(slug, 'api');
          return send(res, 202, view(runner, slug));
        }
        if (method === 'POST' && url.pathname === '/renew') {
          const body = (await readJson(req)) as { slugs?: unknown; ttlSeconds?: unknown };
          const slugs = Array.isArray(body.slugs) ? body.slugs.filter((slug): slug is string => typeof slug === 'string') : [];
          const ttl = Number(body.ttlSeconds);
          if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL_SECONDS || slugs.length > 200) {
            return send(res, 400, { error: 'invalid renew request' });
          }
          return send(res, 200, runner.renew(slugs, ttl));
        }
        if (method === 'POST' && url.pathname === '/down-all') {
          log('labs.down_all');
          void runner.downAll('api');
          return send(res, 202, { ok: true });
        }
        return send(res, 404, { error: 'not found' });
      } catch (error) {
        if (error instanceof RunnerError) {
          const status = error.code === 'unknown_lab' ? 404 : error.code === 'capacity' ? 409 : 422;
          return send(res, status, { error: error.code, message: error.message });
        }
        if (error instanceof SyntaxError) return send(res, 400, { error: 'invalid json' });
        if (error instanceof RangeError) return send(res, 413, { error: 'body too large' });
        log('http.error', { error: (error as Error).message });
        return send(res, 500, { error: 'internal' });
      }
    })();
  });
}
