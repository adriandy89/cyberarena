import { describe, expect, it } from 'vitest';
import { downArgs, parseComposeLs, upArgs } from './compose';
import type { LabManifestEntry } from './manifest';

const entry = { slug: 'dns-exfiltration', project: 'lab-dns-exfil' } as LabManifestEntry;

describe('compose args', () => {
  it('builds up with project, files, env file and a bounded wait', () => {
    expect(upArgs(entry, { compose: '/labs/x/compose.yaml', override: '/tmp/x.yaml', envFile: '/flags/x.env' }, 90)).toEqual([
      'compose', '-p', 'lab-dns-exfil', '-f', '/labs/x/compose.yaml', '-f', '/tmp/x.yaml',
      '--env-file', '/flags/x.env', 'up', '-d', '--wait', '--wait-timeout', '90', '--remove-orphans',
    ]);
    expect(upArgs(entry, { compose: '/c.yaml', override: null, envFile: '/f.env' }, 30)).not.toContain('/tmp/x.yaml');
  });

  it('stops by project name, removing volumes', () => {
    expect(downArgs(entry)).toEqual(['compose', '-p', 'lab-dns-exfil', 'down', '-v', '--remove-orphans', '-t', '5']);
  });
});

describe('parseComposeLs', () => {
  const stdout = JSON.stringify([
    { Name: 'lab-a', Status: 'running(1)' },
    { Name: 'lab-b', Status: 'exited(1), running(2)' },
    { Name: 'lab-c', Status: 'created(1)' },
    { Name: 'portainer', Status: 'running(1)' },
  ]);

  it('keeps only manifest projects and flags partial failures as exited', () => {
    const result = parseComposeLs(stdout, new Set(['lab-a', 'lab-b', 'lab-c']));
    expect([...result]).toEqual([
      ['lab-a', 'running'],
      ['lab-b', 'exited'],
      ['lab-c', 'exited'],
    ]);
  });

  it('handles an empty listing', () => {
    expect(parseComposeLs('', new Set(['lab-a'])).size).toBe(0);
    expect(parseComposeLs('[]', new Set(['lab-a'])).size).toBe(0);
  });
});
