import { describe, expect, it } from 'vitest';
import { labNetwork } from './config';

describe('labNetwork (phase 013)', () => {
  it('defaults to loopback, as in the lab composes', () => {
    expect(labNetwork({})).toEqual({ labBindAddress: '127.0.0.1', labPublicHost: '127.0.0.1' });
  });

  it('shows the LAN address unless another public host is given', () => {
    expect(labNetwork({ LAB_BIND_ADDRESS: '192.168.1.20' })).toEqual({
      labBindAddress: '192.168.1.20',
      labPublicHost: '192.168.1.20',
    });
    expect(labNetwork({ LAB_BIND_ADDRESS: '0.0.0.0', LAB_PUBLIC_HOST: 'minipc.lan' })).toEqual({
      labBindAddress: '0.0.0.0',
      labPublicHost: 'minipc.lan',
    });
    // 0.0.0.0 is not a place to browse to.
    expect(labNetwork({ LAB_BIND_ADDRESS: '0.0.0.0' }).labPublicHost).toBe('127.0.0.1');
  });

  it('rejects values that would break compose files or URLs', () => {
    expect(() => labNetwork({ LAB_BIND_ADDRESS: 'minipc' })).toThrow(/IPv4/);
    expect(() => labNetwork({ LAB_BIND_ADDRESS: '192.168.1.300' })).toThrow(/IPv4/);
    expect(() => labNetwork({ LAB_PUBLIC_HOST: 'evil.com/?x=' })).toThrow(/host name/);
  });
});
