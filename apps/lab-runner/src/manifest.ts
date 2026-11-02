/**
 * The lab manifest: everything the runner knows about the labs, generated at
 * build time from labs/<slug>/compose.yaml (scripts/build-manifest.ts). The
 * runner only ever acts on slugs listed here (ADR-015).
 */

export type LabAccess = 'http' | 'exec';

export interface LabVolume {
  type: 'bind' | 'volume';
  /** Bind: path relative to the lab folder (no "./"). Volume: compose volume key. */
  source: string;
  target: string;
  readOnly: boolean;
}

export interface LabPort {
  service: string;
  host: number;
  container: number;
  protocol: 'tcp' | 'udp';
}

export interface LabManifestEntry {
  slug: string;
  /** Compose project name (top-level `name:`), e.g. lab-dns-exfil. */
  project: string;
  access: LabAccess;
  /** Main URL for http labs (from x-cyberarena.url or the first tcp port). */
  url: string | null;
  ports: LabPort[];
  /** Service to `docker exec` into for exec labs (the first one with a TTY). */
  execService: string | null;
  services: string[];
  /** Full volume list per service; the runner rewrites the binds. */
  volumes: Record<string, LabVolume[]>;
  /** FLAG_n variables the compose needs from its env file. */
  flagVars: string[];
}

export interface LabManifest {
  generatedAt: string;
  labs: LabManifestEntry[];
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Container name compose gives to replica 1 of a service. */
export function containerName(entry: Pick<LabManifestEntry, 'project'>, service: string): string {
  return `${entry.project}-${service}-1`;
}
