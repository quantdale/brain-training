/**
 * Task-ownership validator (006R task 11.1 / 11.2).
 *
 * Validates a machine-readable task-ownership config (`.agent/task-ownership.json`)
 * against the governance rules:
 *  - no two parallel coder packets may claim overlapping write surfaces
 *    (unless a surface is explicitly shared);
 *  - coder write surfaces must not include orchestrator-only surfaces;
 *  - coder write surfaces must not be generated outputs (e.g. `*.generated.ts`).
 *
 * Pure and dependency-free so it can run in CI and under jest.
 */

export interface TaskOwnershipConfig {
  orchestratorOnlySurfaces?: string[];
  generatedFilePatterns?: string[];
  parallelPackets: Array<{
    id: string;
    coderWriteSurfaces: string[];
    sharedSurfaces?: string[];
    dependencies?: string[];
  }>;
}

export interface OwnershipResult {
  valid: boolean;
  errors: string[];
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function isPrefix(prefix: string, full: string): boolean {
  return full === prefix || full.startsWith(prefix + '/');
}

/** Convert a glob (supporting `*` and `**`) to an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  const re = glob
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  return new RegExp('^' + re + '$');
}

/** Whether `pattern` (a glob) matches the concrete `path`. */
export function globMatch(pattern: string, path: string): boolean {
  return globToRegExp(pattern).test(path);
}

interface Norm {
  base: string;
  recursive: boolean;
  concrete: boolean;
  full: string;
}

function normalize(glob: string): Norm {
  const recursive = glob.endsWith('/**');
  const base = recursive ? glob.slice(0, -3) : dirname(glob);
  const hasWildcard = glob.includes('*');
  return { base, recursive, concrete: !hasWildcard, full: glob };
}

/** Whether two write-surface globs could match a common concrete path. */
export function globOverlap(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.base === nb.base) {
    if (na.recursive || nb.recursive) return true;
    return na.concrete && nb.concrete && na.full === nb.full;
  }
  if (isPrefix(na.base, nb.base)) return nb.recursive;
  if (isPrefix(nb.base, na.base)) return na.recursive;
  return false;
}

export function validateTaskOwnership(config: TaskOwnershipConfig): OwnershipResult {
  const errors: string[] = [];
  const packets = config.parallelPackets ?? [];
  const orchestratorOnly = config.orchestratorOnlySurfaces ?? [];
  const generated = config.generatedFilePatterns ?? [];

  // Rule 2 + 3: no coder surface may be orchestrator-only or a generated file.
  for (const packet of packets) {
    for (const surface of packet.coderWriteSurfaces) {
      for (const pattern of orchestratorOnly) {
        if (globMatch(pattern, surface)) {
          errors.push(
            `Packet ${packet.id}: coder write surface '${surface}' is orchestrator-only (matches '${pattern}').`,
          );
        }
      }
      for (const pattern of generated) {
        if (globMatch(pattern, surface)) {
          errors.push(
            `Packet ${packet.id}: coder write surface '${surface}' is a generated file (matches '${pattern}').`,
          );
        }
      }
    }
  }

  // Rule 1: no overlapping coder write surfaces across distinct packets.
  for (let i = 0; i < packets.length; i++) {
    for (let j = i + 1; j < packets.length; j++) {
      const a = packets[i];
      const b = packets[j];
      const bShared = new Set(b.sharedSurfaces ?? []);
      const aShared = new Set(a.sharedSurfaces ?? []);
      for (const sa of a.coderWriteSurfaces) {
        for (const sb of b.coderWriteSurfaces) {
          if (!globOverlap(sa, sb)) continue;
          // A surface that is shared by the other packet is not exclusively owned.
          if (bShared.has(sa) || aShared.has(sb)) continue;
          errors.push(
            `Packets ${a.id} and ${b.id}: overlapping coder write surfaces '${sa}' and '${sb}'.`,
          );
        }
      }
    }
  }

  // Rule: dependencies must reference declared packets.
  const ids = new Set(packets.map((p) => p.id));
  for (const packet of packets) {
    for (const dep of packet.dependencies ?? []) {
      if (!ids.has(dep)) {
        errors.push(`Packet ${packet.id}: dependency '${dep}' is not a declared packet.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
