import { describe, expect, it } from 'vitest';
import { envFileKeys, interpolatedVars, lintLab, lintUnique, parseBytes, type LintRule } from './lint';

type Fields = Record<string, unknown>;
interface TestDoc extends Fields {
  name: string;
  'x-cyberarena': Fields & { exceptions?: unknown[] };
  services: { web: Fields & { environment: Record<string, string> } };
}

/** A compose that passes every rule (baseline web lab). */
function validLab(): TestDoc {
  return {
    name: 'lab-demo',
    'x-cyberarena': { access: 'http' },
    services: {
      web: {
        image: 'python:3.12-alpine',
        command: 'sh -c "python /site/app.py"',
        volumes: ['./site:/site:ro'],
        environment: { FLAG_1: '${FLAG_1:?set FLAG_1}' },
        ports: ['127.0.0.1:18081:8080'],
        cap_drop: ['ALL'],
        cap_add: ['CHOWN', 'SETUID', 'SETGID'],
        security_opt: ['no-new-privileges:true'],
        mem_limit: '256m',
        cpus: 0.5,
        pids_limit: 128,
        restart: 'no',
        networks: ['lab'],
      },
    },
    networks: { lab: { name: 'lab-demo' } },
  };
}

const rulesOf = (doc: unknown, flags = ['FLAG_1']): LintRule[] =>
  lintLab('demo', doc, flags).issues.map((issue) => issue.rule);

describe('lintLab', () => {
  it('accepts a hardened lab and builds its manifest entry', () => {
    const { issues, entry } = lintLab('demo', validLab(), ['FLAG_1']);
    expect(issues).toEqual([]);
    expect(entry).toMatchObject({
      slug: 'demo',
      project: 'lab-demo',
      access: 'http',
      url: 'http://127.0.0.1:18081',
      ports: [{ service: 'web', host: 18081, container: 8080, protocol: 'tcp' }],
      volumes: { web: [{ type: 'bind', source: 'site', target: '/site', readOnly: true }] },
      flagVars: ['FLAG_1'],
      execService: null,
    });
  });

  it('requires the x-cyberarena block and a lab- project name', () => {
    const { 'x-cyberarena': _meta, ...doc } = validLab();
    doc.name = 'demo';
    expect(rulesOf(doc)).toEqual(expect.arrayContaining(['meta', 'name']));
  });

  it.each([
    ['privileged', true],
    ['network_mode', 'host'],
    ['pid', 'host'],
    ['devices', ['/dev/kmsg']],
    ['build', '.'],
    ['container_name', 'fixed'],
  ])('rejects the dangerous service key %s', (key, value) => {
    const doc = validLab();
    doc.services.web[key] = value;
    expect(rulesOf(doc)).toContain('service-key');
  });

  it('rejects ports published outside 127.0.0.1', () => {
    for (const port of ['18081:8080', '0.0.0.0:18081:8080', '8080']) {
      const doc = validLab();
      doc.services.web.ports = [port];
      expect(rulesOf(doc)).toContain('ports');
    }
  });

  it('accepts udp ports and long syntax on 127.0.0.1', () => {
    const doc = validLab();
    doc.services.web.ports = [
      '127.0.0.1:18081:8080',
      '127.0.0.1:18153:53/udp',
      { target: 9000, published: 18082, host_ip: '127.0.0.1' },
    ];
    const { issues, entry } = lintLab('demo', doc, ['FLAG_1']);
    expect(issues).toEqual([]);
    expect(entry?.ports.map((port) => `${port.host}/${port.protocol}`)).toEqual(['18081/tcp', '18153/udp', '18082/tcp']);
  });

  it.each([
    '/var/run/docker.sock:/var/run/docker.sock',
    '/etc:/host-etc:ro',
    '../secrets:/s:ro',
    './site/../..:/up:ro',
    '~/.ssh:/ssh:ro',
  ])('rejects host paths and escapes: %s', (volume) => {
    const doc = validLab();
    doc.services.web.volumes = [volume];
    expect(rulesOf(doc)).toContain('volumes');
  });

  it('requires binds to be read-only and named volumes to be declared', () => {
    const doc = validLab();
    doc.services.web.volumes = ['./site:/site', 'data:/data'];
    const messages = lintLab('demo', doc, ['FLAG_1']).issues.map((issue) => issue.message);
    expect(messages.some((message) => message.includes('read-only'))).toBe(true);
    expect(messages.some((message) => message.includes('not declared'))).toBe(true);
  });

  it('rejects external or driver-backed volumes (host mounts in disguise)', () => {
    const doc = validLab();
    doc.services.web.volumes = ['data:/data'];
    doc.volumes = { data: { driver_opts: { type: 'none', o: 'bind', device: '/' } } };
    expect(rulesOf(doc)).toContain('volumes');
  });

  it('enforces cap_drop ALL, the capability allowlist and no-new-privileges', () => {
    const doc = validLab();
    doc.services.web.cap_drop = [];
    doc.services.web.cap_add = ['SYS_ADMIN'];
    doc.services.web.security_opt = ['seccomp:unconfined'];
    expect(rulesOf(doc)).toEqual(expect.arrayContaining(['cap-drop', 'cap-add', 'security-opt']));
  });

  it('requires resource limits within the maxima', () => {
    const doc = validLab();
    delete doc.services.web.mem_limit;
    doc.services.web.cpus = 4;
    doc.services.web.pids_limit = 10_000;
    expect(rulesOf(doc).filter((rule) => rule === 'limits')).toHaveLength(3);
  });

  it('requires restart "no" and pinned images', () => {
    const doc = validLab();
    doc.services.web.restart = 'unless-stopped';
    doc.services.web.image = 'nginxdemos/hello:latest';
    expect(rulesOf(doc)).toEqual(expect.arrayContaining(['restart', 'image']));
    doc.services.web.image = 'alpine';
    expect(rulesOf(doc)).toContain('image');
  });

  it('only allows FLAG_n interpolation, defined in flags.env.example', () => {
    const doc = validLab();
    doc.services.web.environment.HOME_DIR = '${HOME}';
    doc.services.web.environment.FLAG_2 = '${FLAG_2:?x}';
    expect(rulesOf(doc)).toEqual(expect.arrayContaining(['interpolation', 'flags']));
  });

  it('validates the access mode', () => {
    const doc = validLab();
    doc['x-cyberarena'] = { access: 'exec' };
    expect(rulesOf(doc)).toContain('meta');
    doc.services.web.tty = true;
    const { issues, entry } = lintLab('demo', doc, ['FLAG_1']);
    expect(issues).toEqual([]);
    expect(entry).toMatchObject({ access: 'exec', execService: 'web', url: null });
  });

  it('checks that x-cyberarena.url points to a published port', () => {
    const doc = validLab();
    doc['x-cyberarena'] = { access: 'http', url: 'http://127.0.0.1:9999/' };
    expect(rulesOf(doc)).toContain('meta');
    doc['x-cyberarena'] = { access: 'http', url: 'http://127.0.0.1:18081/login' };
    expect(lintLab('demo', doc, ['FLAG_1']).entry?.url).toBe('http://127.0.0.1:18081/login');
  });

  describe('exceptions', () => {
    it('waive a rule with a reason, optionally per service', () => {
      const doc = validLab();
      doc.services.web.security_opt = [];
      doc['x-cyberarena'].exceptions = [
        { rule: 'security-opt', service: 'web', reason: 'sudo/SUID vectors need privilege escalation' },
      ];
      expect(rulesOf(doc)).toEqual([]);
    });

    it('cannot waive non-negotiable rules', () => {
      const doc = validLab();
      doc.services.web.ports = ['0.0.0.0:18081:8080'];
      doc['x-cyberarena'].exceptions = [{ rule: 'ports', reason: 'I really want this to be public' }];
      expect(rulesOf(doc)).toEqual(expect.arrayContaining(['ports', 'exception']));
    });

    it('need a real reason', () => {
      const doc = validLab();
      doc.services.web.security_opt = [];
      doc['x-cyberarena'].exceptions = [{ rule: 'security-opt', reason: 'because' }];
      expect(rulesOf(doc)).toEqual(expect.arrayContaining(['security-opt', 'exception']));
    });

    it('are flagged when no longer needed', () => {
      const doc = validLab();
      doc['x-cyberarena'].exceptions = [{ rule: 'cap-add', reason: 'used to need NET_ADMIN for the scan' }];
      expect(rulesOf(doc)).toEqual(['exception']);
    });
  });
});

describe('lintUnique', () => {
  it('flags duplicated projects and host ports', () => {
    const a = lintLab('a', validLab(), ['FLAG_1']).entry!;
    const b = lintLab('b', validLab(), ['FLAG_1']).entry!;
    const issues = lintUnique([a, b]);
    expect(issues.map((issue) => `${issue.slug}: ${issue.message}`)).toEqual([
      'b: project "lab-demo" also used by a',
      'b: host port 18081/tcp also used by a',
    ]);
  });
});

describe('helpers', () => {
  it('interpolatedVars understands $$ escapes and ${VAR:?msg}', () => {
    expect(interpolatedVars('${FLAG_1:?set it} $HOME $$NOT ${FLAG_2-x}')).toEqual(['FLAG_1', 'HOME', 'FLAG_2']);
  });

  it('envFileKeys skips comments and blanks', () => {
    expect(envFileKeys('# flags\nFLAG_1=FLAG{a}\n\nFLAG_2 = FLAG{b}\r\n')).toEqual(['FLAG_1', 'FLAG_2']);
  });

  it('parseBytes reads compose sizes', () => {
    expect(parseBytes('256m')).toBe(256 * 1024 * 1024);
    expect(parseBytes('1g')).toBe(1024 ** 3);
    expect(parseBytes('512mb')).toBe(512 * 1024 * 1024);
    expect(parseBytes('lots')).toBeNull();
  });
});
