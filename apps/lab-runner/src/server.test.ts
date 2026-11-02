import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dryRunExec } from './exec';
import type { LabManifest, LabManifestEntry } from './manifest';
import { LabRunner } from './runner';
import { createRunnerServer } from './server';
import { meetsMinimum } from './versions';

const TOKEN = 'x'.repeat(40);

const lab = (slug: string): LabManifestEntry => ({
  slug,
  project: `lab-${slug}`,
  access: 'http',
  url: 'http://127.0.0.1:18081',
  ports: [{ service: 'web', host: 18081, container: 8080, protocol: 'tcp' }],
  execService: null,
  services: ['web'],
  volumes: { web: [] },
  flagVars: [],
});
const MANIFEST: LabManifest = { generatedAt: '', labs: [lab('one'), lab('two'), lab('noflags')] };

let server: Server;
let base = '';

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'lab-runner-http-'));
  await mkdir(join(root, 'flags'), { recursive: true });
  await writeFile(join(root, 'flags', 'one.env'), 'FLAG_1=x\n');
  await writeFile(join(root, 'flags', 'two.env'), 'FLAG_1=x\n');
  const runner = new LabRunner(
    MANIFEST,
    {
      labsDir: join(root, 'labs'),
      flagsDir: join(root, 'flags'),
      assetsMode: 'bind',
      assetsVolume: 'v',
      assetsMount: join(root, 'assets'),
      labBindAddress: '127.0.0.1',
      maxRunning: 1,
      maxConcurrentOps: 2,
      unleasedGraceSeconds: 300,
      opTimeoutSeconds: 60,
    },
    dryRunExec(MANIFEST, 1),
  );
  server = createRunnerServer({ runner, token: TOKEN, health: () => ({ mode: 'test' }), log: () => undefined });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  server.close();
});

const call = (method: string, path: string, body?: unknown, token = TOKEN) =>
  fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });

describe('runner HTTP API', () => {
  it('rejects requests without the exact token', async () => {
    expect((await fetch(`${base}/labs`)).status).toBe(401);
    expect((await call('GET', '/labs', undefined, 'y'.repeat(40))).status).toBe(401);
    expect((await call('GET', '/labs', undefined, TOKEN.slice(1))).status).toBe(401);
  });

  it('reports health and every lab with how to reach it', async () => {
    expect(await (await call('GET', '/healthz')).json()).toMatchObject({ ok: true, running: 0, mode: 'test' });
    const { labs } = (await (await call('GET', '/labs')).json()) as { labs: Array<Record<string, unknown>> };
    expect(labs.map((entry) => [entry.slug, entry.state])).toEqual([
      ['one', 'stopped'],
      ['two', 'stopped'],
      ['noflags', 'unavailable'],
    ]);
    expect(labs[0]).toMatchObject({ access: 'http', url: 'http://127.0.0.1:18081', project: 'lab-one' });
  });

  it('starts asynchronously and maps errors to status codes', async () => {
    const up = await call('POST', '/labs/one/up');
    expect(up.status).toBe(202);
    expect(await up.json()).toMatchObject({ slug: 'one', state: 'starting' });
    expect((await call('POST', '/labs/two/up')).status).toBe(409); // maxRunning 1
    expect((await call('POST', '/labs/noflags/up')).status).toBe(422);
    expect((await call('POST', '/labs/nope/up')).status).toBe(404);
    expect((await call('POST', '/labs/..%2Fetc/up')).status).toBe(404);
    expect((await call('POST', '/labs/one/down')).status).toBe(202);
    expect((await call('GET', '/elsewhere')).status).toBe(404);
  });

  it('validates renew requests', async () => {
    await call('POST', '/labs/one/up');
    const ok = await call('POST', '/renew', { slugs: ['one', 'two'], ttlSeconds: 180 });
    expect(await ok.json()).toEqual({ renewed: ['one'], notRunning: ['two'] });
    expect((await call('POST', '/renew', { slugs: ['one'], ttlSeconds: 99_999 })).status).toBe(400);
    expect((await call('POST', '/renew', '{not json')).status).toBe(400);
    expect((await call('POST', '/renew', { slugs: ['a'.repeat(20_000)], ttlSeconds: 1 })).status).toBe(413);
  });

  it('accepts down-all', async () => {
    expect((await call('POST', '/down-all')).status).toBe(202);
  });
});

describe('meetsMinimum', () => {
  it('compares docker/compose versions', () => {
    expect(meetsMinimum('29.9.2', '26.0.0')).toBe(true);
    expect(meetsMinimum('25.0.5', '26.0.0')).toBe(false);
    expect(meetsMinimum('v2.29.1-desktop.1', '2.24.4')).toBe(true);
    expect(meetsMinimum('2.24.3', '2.24.4')).toBe(false);
    expect(meetsMinimum('5.6.1', '2.24.4')).toBe(true);
    expect(meetsMinimum('garbage', '2.24.4')).toBe(false);
  });
});

describe('lab URLs for a LAN deployment (phase 013)', () => {
  it('rewrite the manifest host (always 127.0.0.1) to the public host', async () => {
    const lanServer = createRunnerServer({
      runner: new LabRunner(
        MANIFEST,
        {
          labsDir: '/labs',
          flagsDir: '/flags',
          assetsMode: 'bind',
          assetsVolume: 'v',
          assetsMount: '/assets',
          labBindAddress: '192.168.1.20',
          maxRunning: 1,
          maxConcurrentOps: 1,
          unleasedGraceSeconds: 300,
          opTimeoutSeconds: 60,
        },
        dryRunExec(MANIFEST, 1),
      ),
      token: TOKEN,
      health: () => ({}),
      log: () => undefined,
      publicHost: '192.168.1.20',
    });
    lanServer.listen(0, '127.0.0.1');
    await once(lanServer, 'listening');
    const port = (lanServer.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/labs`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const { labs } = (await response.json()) as { labs: Array<{ url: string | null }> };
    expect(labs[0]?.url).toBe('http://192.168.1.20:18081');
    lanServer.close();
  });
});
