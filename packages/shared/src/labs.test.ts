import { describe, expect, it } from 'vitest';
import { withLabHost } from './labs';

describe('withLabHost (phase 013)', () => {
  it('points lab addresses at the LAN host', () => {
    expect(withLabHost("curl 'http://127.0.0.1:18096/api/user/1?expand'", '192.168.1.20')).toBe(
      "curl 'http://192.168.1.20:18096/api/user/1?expand'",
    );
    expect(withLabHost('nc 127.0.0.1:18108 y nmap 127.0.0.1:28021', 'minipc.lan')).toBe(
      'nc minipc.lan:18108 y nmap minipc.lan:28021',
    );
  });

  it('leaves other loopback mentions and non-lab ports alone', () => {
    const text = 'localhost 127.0.0.1, http://127.0.0.1:3000 y http://127.0.0.1:180810';
    expect(withLabHost(text, '192.168.1.20')).toBe(text);
  });

  it('is a no-op without a public host', () => {
    expect(withLabHost('http://127.0.0.1:18081', null)).toBe('http://127.0.0.1:18081');
  });
});
