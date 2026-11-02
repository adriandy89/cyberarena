/**
 * Compose override the runner applies on top of a lab's compose file.
 *
 * - Assets (phase 011 spike): each `./path` bind becomes `type: volume` with
 *   `volume.subpath: <slug>/<path>`. `!override` replaces the whole list, so
 *   named volumes are written back too.
 * - LAN (phase 013): lab composes publish on 127.0.0.1 (enforced by the lint);
 *   with another bind address the ports are re-published on it.
 *
 * JSON strings are valid YAML scalars.
 */
import type { LabManifestEntry } from './manifest';

const ASSETS_KEY = 'cyberarena_lab_assets';
const LOOPBACK = '127.0.0.1';

export interface OverrideOptions {
  /** Shared assets volume (runner in a container); null = keep the binds. */
  assetsVolume: string | null;
  /** Host address to publish ports on (127.0.0.1 = as in the compose). */
  bindAddress: string;
}

export function renderOverride(entry: LabManifestEntry, options: OverrideOptions): string | null {
  const q = (value: string) => JSON.stringify(value);
  const rebind = options.bindAddress !== LOOPBACK;
  const lines: string[] = [];
  let usesAssets = false;

  for (const service of entry.services) {
    const volumes = entry.volumes[service] ?? [];
    const binds = options.assetsVolume !== null && volumes.some((volume) => volume.type === 'bind');
    const ports = rebind ? entry.ports.filter((port) => port.service === service) : [];
    if (!binds && ports.length === 0) continue;

    lines.push(`  ${q(service)}:`);
    if (binds) {
      usesAssets = true;
      lines.push('    volumes: !override');
      for (const volume of volumes) {
        lines.push(
          '      - type: volume',
          `        source: ${q(volume.type === 'bind' ? ASSETS_KEY : volume.source)}`,
          `        target: ${q(volume.target)}`,
          `        read_only: ${volume.readOnly}`,
        );
        if (volume.type === 'bind') {
          lines.push('        volume:', `          subpath: ${q(`${entry.slug}/${volume.source}`)}`);
        }
      }
    }
    if (ports.length > 0) {
      lines.push('    ports: !override');
      for (const port of ports) {
        lines.push(`      - ${q(`${options.bindAddress}:${port.host}:${port.container}/${port.protocol}`)}`);
      }
    }
  }

  if (lines.length === 0) return null;
  const out = ['services:', ...lines];
  if (usesAssets) {
    out.push('volumes:', `  ${ASSETS_KEY}:`, `    name: ${q(options.assetsVolume ?? '')}`, '    external: true');
  }
  out.push('');
  return out.join('\n');
}
