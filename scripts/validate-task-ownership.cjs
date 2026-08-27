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
  // If one is a concrete file and the other is a recursive directory, check
  // if the file is actually under the directory via globMatch, not just base prefix.
  if (na.concrete && nb.recursive) return globMatch(b, a);
  if (nb.concrete && na.recursive) return globMatch(a, b);
  if (na.base === nb.base) {
    if (na.recursive || nb.recursive) return true;
    return na.concrete && nb.concrete && na.full === nb.full;
  }
  if (isPrefix(na.base, nb.base)) return nb.recursive;
  if (isPrefix(nb.base, na.base)) return na.recursive;
  return false;
}

// Additional intersection check: a broad coder surface like `apps/mobile/src/**`
// overlaps a generated/orchestrator pattern like `**/*.generated.ts` even though
// literal glob strings differ. Detect by testing whether a synthetic concrete
// path that matches the protected pattern would also be matched by the coder surface,
// and vice-versa.
function overlapsViaExample(coderSurface, protectedPattern) {
  const candidates = [];
  if (protectedPattern.includes('*.generated')) {
    candidates.push('apps/mobile/src/registry/registry.generated.ts', 'apps/mobile/src/foo.generated.ts', 'apps/mobile/src/games/x/foo.generated.ts');
  } else if (!protectedPattern.includes('*')) {
    candidates.push(protectedPattern);
  } else {
    let syn = protectedPattern.replace(/\*\*/g, 'apps/mobile/src').replace(/\*/g, 'foo');
    candidates.push(syn);
    if (protectedPattern.startsWith('**/')) {
      candidates.push('apps/mobile/src/' + protectedPattern.slice(3).replace(/\*/g, 'foo'));
    }
  }
  for (const cand of candidates) {
    if (globMatch(coderSurface, cand)) return true;
  }
  return false;
}

function validateTaskOwnership(config) {
  const errors = [];
  const packets = config.parallelPackets || [];
  const orchestratorOnly = config.orchestratorOnlySurfaces || [];
  const generated = config.generatedFilePatterns || [];

  // 015: change binding — must equal governance and active OpenSpec. Resolve repo root by walking up from cwd to find .agent/GOVERNANCE.json (jest runs with cwd apps/mobile).
  try {
    const fs2 = require('node:fs');
    const path2 = require('node:path');
    function findRepoRoot(start) {
      let cur = path2.resolve(start);
      for (let i = 0; i < 6; i++) {
        if (fs2.existsSync(path2.join(cur, '.agent/GOVERNANCE.json'))) return cur;
        const parent = path2.dirname(cur);
        if (parent === cur) break;
        cur = parent;
      }
      return path2.resolve(process.cwd());
    }
    const repoRoot = findRepoRoot(process.cwd());
    const gov = JSON.parse(fs2.readFileSync(path2.join(repoRoot, '.agent/GOVERNANCE.json'), 'utf8'));
    if (config.change !== gov.activeCampaign) {
      errors.push(`Ownership change '${config.change}' does not match GOVERNANCE.activeCampaign '${gov.activeCampaign}'.`);
    }
    const changePath = path2.join(repoRoot, 'openspec', 'changes', gov.activeCampaign, 'change.json');
    if (fs2.existsSync(changePath)) {
      const meta = JSON.parse(fs2.readFileSync(changePath, 'utf8'));
      if (config.change !== meta.id) {
        errors.push(`Ownership change '${config.change}' does not match active OpenSpec change id '${meta.id}'.`);
      }
      if (meta.status !== 'ACTIVE') {
        errors.push(`Active OpenSpec change status is '${meta.status}', expected 'ACTIVE' for ownership validation.`);
      }
    }
  } catch (e) {
    // If governance or change.json cannot be read, surface the underlying error
    // but do not hide other ownership errors.
    errors.push(`Failed to validate change binding: ${e.message}`);
  }

  // 015: unique packet IDs
  const seenIds = new Set();
  for (const packet of packets) {
    if (seenIds.has(packet.id)) {
      errors.push(`Duplicate packet id '${packet.id}'.`);
    }
    seenIds.add(packet.id);
  }

  // 015: per-packet validation field
  for (const packet of packets) {
    if (!packet.validation || typeof packet.validation !== 'string' || packet.validation.trim() === '') {
      errors.push(`Packet ${packet.id}: missing or empty 'validation' field (cheap completion validation required).`);
    }
  }

  for (const packet of packets) {
    for (const surface of packet.coderWriteSurfaces || []) {
      for (const pattern of orchestratorOnly) {
        if (globOverlap(pattern, surface) || globMatch(pattern, surface) || overlapsViaExample(surface, pattern)) {
          errors.push(
            `Packet ${packet.id}: coder write surface '${surface}' overlaps orchestrator-only surface '${pattern}' (intersection semantics).`,
          );
        }
      }
      for (const pattern of generated) {
        if (globOverlap(pattern, surface) || globMatch(pattern, surface) || overlapsViaExample(surface, pattern)) {
          errors.push(
            `Packet ${packet.id}: coder write surface '${surface}' overlaps generated file pattern '${pattern}' (intersection semantics).`,
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

  for (const p of packets) {
    // Use a fresh DFS per packet to detect any cycle reachable from it
    const cycleStack = new Set();
    const recStack = new Set();
    function dfs(curr) {
      if (recStack.has(curr)) return true;
      if (cycleStack.has(curr)) return false;
      cycleStack.add(curr);
      recStack.add(curr);
      const cur = packets.find((x) => x.id === curr);
      if (cur) {
        for (const d of cur.dependencies || []) {
          if (dfs(d)) return true;
        }
      }
      recStack.delete(curr);
      return false;
    }
    if (dfs(p.id)) {
      errors.push(`Packet ${p.id}: dependency graph contains a cycle.`);
      break;
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
