/**
 * Compose override that serves a lab's bind mounts from the shared assets
 * volume (phase 011 spike): each `./path` bind becomes `type: volume` with
 * `volume.subpath: <slug>/<path>`. `!override` replaces the whole list, so
 * named volumes are written back too. JSON strings are valid YAML scalars.
 */
import type { LabManifestEntry } from './manifest';

const ASSETS_KEY = 'cyberarena_lab_assets';

export function renderOverride(entry: LabManifestEntry, assetsVolume: string): string | null {
  const services = Object.entries(entry.volumes).filter(([, list]) => list.some((volume) => volume.type === 'bind'));
  if (services.length === 0) return null;

  const q = (value: string) => JSON.stringify(value);
  const lines = ['services:'];
  for (const [service, list] of services) {
    lines.push(`  ${q(service)}:`, '    volumes: !override');
    for (const volume of list) {
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
  lines.push('volumes:', `  ${ASSETS_KEY}:`, `    name: ${q(assetsVolume)}`, '    external: true', '');
  return lines.join('\n');
}
