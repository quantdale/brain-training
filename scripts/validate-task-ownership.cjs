#!/usr/bin/env node
/**
 * Task-ownership validator (006R task 11.1 / 11.2).
 *
 * Validates `.agent/task-ownership.json` against governance rules:
 *  - no two parallel coder packets may claim overlapping write surfaces
 *    (unless a surface is explicitly shared);
 *  - coder write surfaces must not be orchestrator-only surfaces;
 *  - coder write surfaces must not be generated outputs.
 *
 * CommonJS so it runs under `node` directly AND is `require()`-able by jest
 * without --experimental-vm-modules.
 */
const fs = require('node:fs');
const path = require('node:path');

function dirname(p) {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

function isPrefix(prefix, full) {
  return full === prefix || full.startsWith(prefix + '/');
}

function globToRegExp(glob) {
  const re = glob
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  return new RegExp('^' + re + '$');
}

function globMatch(pattern, p) {
  return globToRegExp(pattern).test(p);
}

function normalize(glob) {
  const recursive = glob.endsWith('/**');
  const base = recursive ? glob.slice(0, -3) : dirname(glob);
  const hasWildcard = glob.includes('*');
  return { base, recursive, concrete: !hasWildcard, full: glob };
}

function globOverlap(a, b) {
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

function validateTaskOwnership(config) {
  const errors = [];
  const packets = config.parallelPackets || [];
  const orchestratorOnly = config.orchestratorOnlySurfaces || [];
  const generated = config.generatedFilePatterns || [];

  for (const packet of packets) {
    for (const surface of packet.coderWriteSurfaces || []) {
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

  for (let i = 0; i < packets.length; i++) {
    for (let j = i + 1; j < packets.length; j++) {
      const a = packets[i];
      const b = packets[j];
      const bShared = new Set(b.sharedSurfaces || []);
      const aShared = new Set(a.sharedSurfaces || []);
      for (const sa of a.coderWriteSurfaces || []) {
        for (const sb of b.coderWriteSurfaces || []) {
          if (!globOverlap(sa, sb)) continue;
          if (bShared.has(sa) || aShared.has(sb)) continue;
          errors.push(`Packets ${a.id} and ${b.id}: overlapping coder write surfaces '${sa}' and '${sb}'.`);
        }
      }
    }
  }

  const ids = new Set(packets.map((p) => p.id));
  for (const packet of packets) {
    for (const dep of packet.dependencies || []) {
      if (!ids.has(dep)) {
        errors.push(`Packet ${packet.id}: dependency '${dep}' is not a declared packet.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateTaskOwnership, globOverlap, globMatch, globToRegExp };

// CLI entrypoint.
if (require.main === module) {
  const configPath = process.argv[2] || path.resolve(process.cwd(), '.agent/task-ownership.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const result = validateTaskOwnership(config);
  if (!result.valid) {
    console.error('Task-ownership validation FAILED:');
    for (const e of result.errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log('Task-ownership validation passed.');
}
