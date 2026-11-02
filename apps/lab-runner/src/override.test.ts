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
      'cyberarena-lab-assets',
    );
    expect(text).toContain('volumes: !override');
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

  it('is not needed when no service has binds', () => {
    expect(renderOverride({ ...base, volumes: { web: [] } }, 'assets')).toBeNull();
  });
});
