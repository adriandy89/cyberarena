/**
 * Security lint for lab compose files (phase 011, ADR-015).
 *
 * Pure: it receives the already-parsed YAML, so the runner needs no YAML
 * parser at runtime. Anything not explicitly allowed is an issue: unknown
 * service keys, host paths, ports outside 127.0.0.1, missing limits... A few
 * rules can be waived per lab in its `x-cyberarena.exceptions`, always with a
 * written reason.
 */
import type { LabAccess, LabManifestEntry, LabPort, LabVolume } from './manifest';

export const LINT_RULES = [
  'shape',
  'name',
  'meta',
  'top-level',
  'service-key',
  'image',
  'ports',
  'volumes',
  'cap-drop',
  'cap-add',
  'security-opt',
  'limits',
  'restart',
  'networks',
  'interpolation',
  'flags',
  'exception',
  'unique',
] as const;
export type LintRule = (typeof LINT_RULES)[number];

/** Rules a lab may waive with a reason; everything else is non-negotiable. */
export const WAIVABLE_RULES: readonly LintRule[] = ['cap-drop', 'cap-add', 'security-opt', 'limits'];

export interface LintIssue {
  slug: string;
  rule: LintRule;
  service?: string;
  message: string;
}

export interface LintResult {
  issues: LintIssue[];
  entry: LabManifestEntry | null;
}

const TOP_LEVEL_KEYS = new Set(['name', 'services', 'networks', 'volumes', 'x-cyberarena']);

const SERVICE_KEYS = new Set([
  'image',
  'command',
  'entrypoint',
  'environment',
  'ports',
  'expose',
  'volumes',
  'tmpfs',
  'cap_drop',
  'cap_add',
  'security_opt',
  'restart',
  'networks',
  'working_dir',
  'user',
  'stdin_open',
  'tty',
  'init',
  'read_only',
  'hostname',
  'labels',
  'depends_on',
  'healthcheck',
  'stop_grace_period',
  'mem_limit',
  'cpus',
  'pids_limit',
]);

const DANGEROUS_KEYS: Record<string, string> = {
  privileged: 'privileged containers can take over the host',
  network_mode: 'host networking breaks lab isolation',
  pid: 'sharing the host PID namespace breaks isolation',
  ipc: 'sharing the host IPC namespace breaks isolation',
  userns_mode: 'disabling user namespaces is not allowed',
  cgroup: 'host cgroup namespace is not allowed',
  devices: 'host devices are not allowed',
  volumes_from: 'volumes_from can import host mounts',
  build: 'labs use prebuilt images only',
  container_name: 'fixed container names are derived from the project name',
  sysctls: 'kernel tunables are not allowed',
};

export const ALLOWED_CAPS = new Set([
  'CHOWN',
  'SETUID',
  'SETGID',
  'DAC_OVERRIDE',
  'FOWNER',
  'NET_BIND_SERVICE',
]);

export const LIMIT_MAX = { memBytes: 512 * 1024 * 1024, cpus: 1, pids: 256 };

const NAMED_VOLUME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const PORT_SHORT = /^127\.0\.0\.1:(\d{1,5}):(\d{1,5})(?:\/(tcp|udp))?$/;
const LAB_URL = /^https?:\/\/127\.0\.0\.1:(\d{1,5})(?:\/.*)?$/;
const FLAG_VAR = /^FLAG_\d+$/;

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Keys of a KEY=VALUE env file (comments and blank lines ignored). */
export function envFileKeys(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim());
}

/** Variables compose would interpolate in a string ($VAR / ${VAR...}; $$ escapes). */
export function interpolatedVars(text: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$') continue;
    const next = text[i + 1];
    if (next === '$') {
      i++;
      continue;
    }
    const rest = text.slice(i + 1);
    const match = next === '{' ? /^\{([A-Za-z0-9_]*)/.exec(rest) : /^([A-Za-z_][A-Za-z0-9_]*)/.exec(rest);
    if (match) found.push(match[1] ?? '');
  }
  return found;
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (isObj(value)) Object.values(value).forEach((item) => collectStrings(item, out));
}

/** Parses compose memory sizes: 256m, 1g, 512mb, bytes. */
export function parseBytes(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const match = /^(\d+(?:\.\d+)?)\s*([kmg]?)b?$/i.exec(value.trim());
  if (!match) return null;
  const unit = (match[2] ?? '').toLowerCase();
  const factor = unit === 'g' ? 1024 ** 3 : unit === 'm' ? 1024 ** 2 : unit === 'k' ? 1024 : 1;
  return Math.round(Number(match[1]) * factor);
}

interface Exception {
  rule: LintRule;
  service?: string;
  used: boolean;
}

/**
 * Lints one lab. `flagVars` are the keys of its flags.env.example.
 * Returns the manifest entry whenever the structure is readable, even with
 * issues, so callers can report everything at once.
 */
export function lintLab(slug: string, doc: unknown, flagVars: readonly string[]): LintResult {
  const issues: LintIssue[] = [];
  const add = (rule: LintRule, message: string, service?: string) =>
    issues.push({ slug, rule, message, ...(service ? { service } : {}) });

  if (!isObj(doc) || !isObj(doc.services) || Object.keys(doc.services).length === 0) {
    add('shape', 'compose must be a mapping with at least one service');
    return { issues, entry: null };
  }

  for (const key of Object.keys(doc)) {
    if (!TOP_LEVEL_KEYS.has(key)) add('top-level', `top-level key "${key}" is not allowed`);
  }

  const project = typeof doc.name === 'string' ? doc.name : '';
  if (!/^lab-[a-z0-9-]+$/.test(project)) add('name', 'top-level `name:` must be "lab-<slug>"');

  // --- x-cyberarena metadata and exceptions ---------------------------------
  const meta = isObj(doc['x-cyberarena']) ? doc['x-cyberarena'] : null;
  const exceptions: Exception[] = [];
  let access: LabAccess = 'http';
  let metaUrl: string | null = null;
  if (!meta) {
    add('meta', 'missing `x-cyberarena:` block (access, url, exceptions)');
  } else {
    if (meta.access === 'http' || meta.access === 'exec') access = meta.access;
    else add('meta', '`x-cyberarena.access` must be "http" or "exec"');
    if (meta.url !== undefined) {
      if (typeof meta.url === 'string' && LAB_URL.test(meta.url)) metaUrl = meta.url;
      else add('meta', '`x-cyberarena.url` must be http(s)://127.0.0.1:<port>[/path]');
    }
    const rawExceptions = meta.exceptions ?? [];
    if (!Array.isArray(rawExceptions)) add('exception', '`exceptions` must be a list');
    else
      for (const raw of rawExceptions) {
        const rule = isObj(raw) ? raw.rule : undefined;
        const reason = isObj(raw) ? raw.reason : undefined;
        const service = isObj(raw) && typeof raw.service === 'string' ? raw.service : undefined;
        if (typeof rule !== 'string' || !WAIVABLE_RULES.includes(rule as LintRule)) {
          add('exception', `rule "${String(rule)}" cannot be waived (only ${WAIVABLE_RULES.join(', ')})`);
          continue;
        }
        if (typeof reason !== 'string' || reason.trim().length < 15) {
          add('exception', `exception for "${rule}" needs a reason (15+ characters)`);
          continue;
        }
        exceptions.push({ rule: rule as LintRule, service, used: false });
      }
  }

  // --- top-level volumes and networks ---------------------------------------
  const declaredVolumes = new Set<string>();
  if (doc.volumes !== undefined) {
    if (!isObj(doc.volumes)) add('volumes', 'top-level `volumes` must be a mapping');
    else
      for (const [key, value] of Object.entries(doc.volumes)) {
        declaredVolumes.add(key);
        if (value === null || (isObj(value) && Object.keys(value).length === 0)) continue;
        add('volumes', `volume "${key}" must be a plain local volume (no external/driver/driver_opts)`);
      }
  }
  const declaredNetworks = new Set<string>();
  if (!isObj(doc.networks)) add('networks', 'top-level `networks` must declare the lab network');
  else
    for (const [key, value] of Object.entries(doc.networks)) {
      declaredNetworks.add(key);
      const net = isObj(value) ? value : {};
      for (const prop of Object.keys(net)) {
        if (prop !== 'name' && prop !== 'internal') add('networks', `network "${key}": "${prop}" is not allowed`);
      }
      if (net.name !== undefined && !(typeof net.name === 'string' && net.name.startsWith('lab-'))) {
        add('networks', `network "${key}" name must start with "lab-"`);
      }
    }

  // --- interpolation: only FLAG_n from the env file --------------------------
  const strings: string[] = [];
  collectStrings(doc, strings);
  const usedVars = new Set(strings.flatMap(interpolatedVars));
  for (const name of usedVars) {
    if (!FLAG_VAR.test(name)) add('interpolation', `only \${FLAG_n} may be interpolated, found "${name}"`);
    else if (!flagVars.includes(name)) add('flags', `${name} is not defined in flags.env.example`);
  }

  // --- services --------------------------------------------------------------
  const ports: LabPort[] = [];
  const volumes: Record<string, LabVolume[]> = {};
  let execService: string | null = null;

  for (const [service, raw] of Object.entries(doc.services)) {
    if (!isObj(raw)) {
      add('shape', 'service must be a mapping', service);
      continue;
    }
    const svc = raw;
    for (const key of Object.keys(svc)) {
      if (SERVICE_KEYS.has(key) || key.startsWith('x-')) continue;
      add('service-key', `"${key}" is not allowed${DANGEROUS_KEYS[key] ? `: ${DANGEROUS_KEYS[key]}` : ''}`, service);
    }

    const image = svc.image;
    if (typeof image !== 'string' || !/:[^/:@]+$/.test(image.split('@')[0] ?? '') || image.endsWith(':latest')) {
      add('image', 'image must be pinned to an explicit tag (not latest)', service);
    }

    if (execService === null && (svc.tty === true || svc.stdin_open === true)) execService = service;

    // Ports: published on 127.0.0.1 only.
    const rawPorts = svc.ports ?? [];
    if (!Array.isArray(rawPorts)) add('ports', '`ports` must be a list', service);
    else
      for (const port of rawPorts) {
        if (typeof port === 'string') {
          const match = PORT_SHORT.exec(port);
          if (!match) {
            add('ports', `port "${port}" must be "127.0.0.1:<host>:<container>[/udp]"`, service);
            continue;
          }
          ports.push({
            service,
            host: Number(match[1]),
            container: Number(match[2]),
            protocol: match[3] === 'udp' ? 'udp' : 'tcp',
          });
        } else if (isObj(port) && port.host_ip === '127.0.0.1' && Number.isInteger(Number(port.published))) {
          ports.push({
            service,
            host: Number(port.published),
            container: Number(port.target),
            protocol: port.protocol === 'udp' ? 'udp' : 'tcp',
          });
        } else {
          add('ports', 'long-syntax ports need host_ip: 127.0.0.1 and a published port', service);
        }
      }

    // Volumes: relative read-only binds or declared named volumes.
    const list: LabVolume[] = [];
    const rawVolumes = svc.volumes ?? [];
    if (!Array.isArray(rawVolumes)) add('volumes', '`volumes` must be a list', service);
    else
      for (const volume of rawVolumes) {
        const parsed = parseVolume(volume);
        if ('error' in parsed) {
          add('volumes', parsed.error, service);
          continue;
        }
        if (parsed.type === 'bind' && !parsed.readOnly) {
          add('volumes', `bind "./${parsed.source}" must be read-only (:ro)`, service);
        }
        if (parsed.type === 'volume' && !declaredVolumes.has(parsed.source)) {
          add('volumes', `named volume "${parsed.source}" is not declared at top level`, service);
        }
        list.push(parsed);
      }
    volumes[service] = list;

    const capDrop = Array.isArray(svc.cap_drop) ? svc.cap_drop : [];
    if (!capDrop.includes('ALL')) add('cap-drop', 'cap_drop must include ALL', service);
    const capAdd = Array.isArray(svc.cap_add) ? svc.cap_add : [];
    for (const cap of capAdd) {
      if (typeof cap !== 'string' || !ALLOWED_CAPS.has(cap)) {
        add('cap-add', `capability "${String(cap)}" is outside the allowlist`, service);
      }
    }

    const securityOpt = Array.isArray(svc.security_opt) ? svc.security_opt : [];
    if (!securityOpt.includes('no-new-privileges:true')) {
      add('security-opt', 'security_opt must include no-new-privileges:true', service);
    }
    for (const opt of securityOpt) {
      if (opt !== 'no-new-privileges:true') add('security-opt', `security_opt "${String(opt)}" is not allowed`, service);
    }

    const mem = parseBytes(svc.mem_limit);
    const cpus = typeof svc.cpus === 'number' ? svc.cpus : Number(svc.cpus);
    const pids = svc.pids_limit;
    if (mem === null || mem <= 0 || mem > LIMIT_MAX.memBytes) {
      add('limits', 'mem_limit is required (max 512m)', service);
    }
    if (!Number.isFinite(cpus) || cpus <= 0 || cpus > LIMIT_MAX.cpus) add('limits', 'cpus is required (max 1)', service);
    if (typeof pids !== 'number' || pids <= 0 || pids > LIMIT_MAX.pids) {
      add('limits', 'pids_limit is required (max 256)', service);
    }

    if (svc.restart !== 'no') add('restart', 'restart must be "no" (quoted): labs never come back on their own', service);

    const svcNetworks = Array.isArray(svc.networks)
      ? svc.networks
      : isObj(svc.networks)
        ? Object.keys(svc.networks)
        : [];
    if (svcNetworks.length === 0) add('networks', 'service must join the lab network', service);
    for (const net of svcNetworks) {
      if (typeof net !== 'string' || !declaredNetworks.has(net)) {
        add('networks', `network "${String(net)}" is not declared at top level`, service);
      }
    }
  }

  // --- access-specific checks ---------------------------------------------------
  const tcpPorts = ports.filter((port) => port.protocol === 'tcp');
  if (access === 'http' && tcpPorts.length === 0) add('meta', 'http labs must publish at least one tcp port');
  if (access === 'exec' && execService === null) add('meta', 'exec labs need a service with tty/stdin_open');
  if (metaUrl) {
    const urlPort = Number(LAB_URL.exec(metaUrl)?.[1]);
    if (!tcpPorts.some((port) => port.host === urlPort)) add('meta', '`x-cyberarena.url` port is not published');
  }

  // --- apply exceptions ----------------------------------------------------------
  const remaining = issues.filter((issue) => {
    const exception = exceptions.find(
      (candidate) =>
        candidate.rule === issue.rule && (candidate.service === undefined || candidate.service === issue.service),
    );
    if (!exception) return true;
    exception.used = true;
    return false;
  });
  for (const exception of exceptions) {
    if (!exception.used) {
      remaining.push({
        slug,
        rule: 'exception',
        message: `exception for "${exception.rule}" is not needed any more: remove it`,
        ...(exception.service ? { service: exception.service } : {}),
      });
    }
  }

  const firstTcp = tcpPorts[0];
  const entry: LabManifestEntry = {
    slug,
    project,
    access,
    url: access === 'http' ? (metaUrl ?? (firstTcp ? `http://127.0.0.1:${firstTcp.host}` : null)) : null,
    ports,
    execService: access === 'exec' ? execService : null,
    services: Object.keys(doc.services),
    volumes,
    flagVars: [...usedVars].filter((name) => FLAG_VAR.test(name)).sort(),
  };
  return { issues: remaining, entry };
}

type ParsedVolume = LabVolume | { error: string };

function parseVolume(volume: unknown): ParsedVolume {
  if (typeof volume === 'string') {
    const [source = '', target = '', mode = ''] = volume.split(':');
    if (!target.startsWith('/')) return { error: `volume "${volume}" needs an absolute container path` };
    const readOnly = mode.split(',').includes('ro');
    if (source.startsWith('./')) return bind(source, target, readOnly, volume);
    if (NAMED_VOLUME.test(source)) return { type: 'volume', source, target, readOnly };
    return { error: `volume "${volume}": host paths are not allowed (only ./relative binds)` };
  }
  if (isObj(volume)) {
    const source = typeof volume.source === 'string' ? volume.source : '';
    const target = typeof volume.target === 'string' ? volume.target : '';
    const readOnly = volume.read_only === true;
    if (!target.startsWith('/')) return { error: 'long-syntax volume needs an absolute target' };
    if (volume.type === 'bind') return bind(source, target, readOnly, source);
    if (volume.type === 'volume' && NAMED_VOLUME.test(source)) return { type: 'volume', source, target, readOnly };
  }
  return { error: 'volume must be a ./relative bind or a declared named volume' };
}

function bind(source: string, target: string, readOnly: boolean, label: string): ParsedVolume {
  const relative = source.replace(/^\.\//, '');
  const segments = relative.split('/');
  if (!source.startsWith('./') || !relative || segments.some((segment) => segment === '..' || segment === '')) {
    return { error: `bind "${label}" must stay inside the lab folder` };
  }
  return { type: 'bind', source: relative, target, readOnly };
}

/** Cross-lab checks: unique project names and host ports. */
export function lintUnique(entries: readonly LabManifestEntry[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const projects = new Map<string, string>();
  const ports = new Map<string, string>();
  for (const entry of entries) {
    const owner = projects.get(entry.project);
    if (owner) issues.push({ slug: entry.slug, rule: 'unique', message: `project "${entry.project}" also used by ${owner}` });
    else projects.set(entry.project, entry.slug);
    for (const port of entry.ports) {
      const key = `${port.host}/${port.protocol}`;
      const portOwner = ports.get(key);
      if (portOwner && portOwner !== entry.slug) {
        issues.push({ slug: entry.slug, rule: 'unique', message: `host port ${key} also used by ${portOwner}` });
      } else ports.set(key, entry.slug);
    }
  }
  return issues;
}
