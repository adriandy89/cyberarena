import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_TRUST_PROXY, trustProxySetting } from './trust-proxy';

describe('trustProxySetting', () => {
  it('defaults to loopback and private networks', () => {
    expect(trustProxySetting(undefined)).toBe(DEFAULT_TRUST_PROXY);
    expect(trustProxySetting('  ')).toBe(DEFAULT_TRUST_PROXY);
  });

  it('accepts booleans and custom values', () => {
    expect(trustProxySetting('false')).toBe(false);
    expect(trustProxySetting('true')).toBe(true);
    expect(trustProxySetting('10.0.0.1')).toBe('10.0.0.1');
  });
});

// The request below comes from 127.0.0.1, i.e. from a trusted proxy hop.
describe('req.ip with the default setting', () => {
  let baseUrl = '';
  let close: () => void = () => undefined;

  beforeAll(async () => {
    const app = express();
    app.set('trust proxy', trustProxySetting(undefined));
    app.get('/ip', (req, res) => {
      res.json({ ip: req.ip });
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });

  afterAll(() => close());

  const ipFor = async (forwardedFor?: string): Promise<string> => {
    const response = await fetch(`${baseUrl}/ip`, {
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    });
    return ((await response.json()) as { ip: string }).ip;
  };

  it('uses the client address set by the proxy', async () => {
    expect(await ipFor('203.0.113.7')).toBe('203.0.113.7');
  });

  it('takes the right-most untrusted hop, so a forged left entry is ignored', async () => {
    expect(await ipFor('198.51.100.1, 203.0.113.7')).toBe('203.0.113.7');
  });

  it('skips private hops (web container) to reach the client', async () => {
    expect(await ipFor('203.0.113.7, 172.18.0.5')).toBe('203.0.113.7');
  });

  it('falls back to the socket address without the header', async () => {
    expect(await ipFor()).toMatch(/127\.0\.0\.1$/);
  });
});
