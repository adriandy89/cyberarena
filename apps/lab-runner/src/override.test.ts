import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { LabManifestEntry } from './manifest';
import { renderOverride } from './override';

const base: Omit<LabManifestEntry, 'volumes'> = {
  slug: 'pcap-analysis',
  project: 'lab-pcap-analysis',
  access: 'http',
  url: null,
  ports: [],
  execService: null,
  services: ['web'],
  flagVars: [],
};

describe('renderOverride', () => {
  it('serves binds from the assets volume by subpath and keeps named volumes', () => {
    const text = renderOverride(
      {
        ...base,
        volumes: {
          web: [
            { type: 'bind', source: 'site', target: '/site', readOnly: true },
            { type: 'volume', source: 'captures', target: '/captures', readOnly: false },
          ],
        },
      },
      { assetsVolume: 'cyberarena-lab-assets', bindAddress: '127.0.0.1' },
    );
    expect(text).toContain('volumes: !override');
    expect(text).not.toContain('ports:');
    // The `!override` tag is compose syntax; strip it to inspect the structure.
    expect(parse(text!.replace(' !override', ''))).toEqual({
      services: {
        web: {
          volumes: [
            {
              type: 'volume',
              source: 'cyberarena_lab_assets',
              target: '/site',
              read_only: true,
              volume: { subpath: 'pcap-analysis/site' },
            },
            { type: 'volume', source: 'captures', target: '/captures', read_only: false },
          ],
        },
      },
      volumes: { cyberarena_lab_assets: { name: 'cyberarena-lab-assets', external: true } },
    });
  });

  it('is not needed without binds or a LAN bind address', () => {
    expect(renderOverride({ ...base, volumes: { web: [] } }, { assetsVolume: 'assets', bindAddress: '127.0.0.1' })).toBeNull();
    // Bind mode (runner on the host) keeps the binds as they are.
    const withBind = { ...base, volumes: { web: [{ type: 'bind' as const, source: 'site', target: '/site', readOnly: true }] } };
    expect(renderOverride(withBind, { assetsVolume: null, bindAddress: '127.0.0.1' })).toBeNull();
  });

  it('re-publishes the ports on the LAN address (phase 013)', () => {
    const lab = {
      ...base,
      services: ['web', 'dns'],
      volumes: { web: [], dns: [] },
      ports: [
        { service: 'web', host: 18112, container: 8080, protocol: 'tcp' as const },
        { service: 'dns', host: 18153, container: 53, protocol: 'udp' as const },
      ],
    };
    const text = renderOverride(lab, { assetsVolume: null, bindAddress: '192.168.1.20' });
    expect(text).toContain('ports: !override');
    expect(parse(text!.replaceAll(' !override', ''))).toEqual({
      services: {
        web: { ports: ['192.168.1.20:18112:8080/tcp'] },
        dns: { ports: ['192.168.1.20:18153:53/udp'] },
      },
    });
  });
});
