/**
 * `docs/GAME_SDK.md` module map is executable truth (Change 074 §6.1/§6.2).
 *
 * The document listed 13 modules while the SDK shipped 17, and omitted the four
 * a reader most needs to find: the version packing, the canonical math
 * helpers, the reducer exhaustiveness assertion, and the module-surface
 * contract. A module map is what tells the next author which helper already
 * exists, so a missing entry is a duplicated implementation waiting to happen.
 *
 * These cases assert the map against the filesystem, so adding a module without
 * documenting it fails here rather than being discovered by a later contributor
 * re-implementing it.
 */
import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// __dirname is apps/mobile/src/sdk/__tests__; the repository root is five levels up.
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const SDK_DIR = resolve(REPO_ROOT, 'apps', 'mobile', 'src', 'sdk');
const DOC = readFileSync(join(REPO_ROOT, 'docs', 'GAME_SDK.md'), 'utf8');

/** Every SDK module and sub-module path, relative to `src/sdk`, sorted. */
function shippedModules(): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, `${prefix}${entry}/`);
        continue;
      }
      if (!entry.endsWith('.ts')) continue;
      // A barrel is not a module a reader imports by path; and the type-only
      // `.d.ts` files are not a contract surface.
      if (entry === 'index.ts' || entry.endsWith('.d.ts')) continue;
      // Test files live beside the module in some directories.
      if (/\.(test|spec)\.ts$/.test(entry)) continue;
      out.push(`${prefix}${entry}`);
    }
  };
  walk(SDK_DIR, '');
  return out.sort();
}

/** The `| \`path.ts\` |` rows the module map declares. */
function documentedModules(): string[] {
  const rows = [...DOC.matchAll(/^\|\s*`([a-zA-Z0-9/_-]+\.ts)`\s*\|/gm)].map((m) => m[1]);
  return [...new Set(rows)].sort();
}

describe('the SDK module map matches what ships', () => {
  const shipped = shippedModules();
  const documented = documentedModules();

  it('finds the SDK directory it is asserting about', () => {
    // A relative-path mistake would make every case below pass for the wrong
    // reason, so the premise is asserted first.
    expect(existsSync(SDK_DIR)).toBe(true);
    expect(shipped.length).toBeGreaterThan(10);
  });

  it('documents every shipped module', () => {
    const missing = shipped.filter((m) => !documented.includes(m));
    expect({ shipped: shipped.length, missing }).toEqual({
      shipped: shipped.length,
      missing: [],
    });
  });

  it('documents no module that does not ship', () => {
    // A row for a removed module is worse than a missing one: it sends a
    // reader to a path that is not there.
    const extra = documented.filter((m) => !shipped.includes(m));
    expect(extra).toEqual([]);
  });

  it('names the four modules the map had omitted', () => {
    // Spelled out because these are the ones whose absence had real cost: the
    // version packing, the canonical math helpers, the exhaustiveness
    // assertion, and the module-surface contract.
    for (const required of [
      'version-pack.ts',
      'numeric.ts',
      'exhaustive.ts',
      'module-surface.ts',
      'perf.ts',
    ]) {
      expect(documented).toContain(required);
    }
  });

  it('states the real catalog size rather than a stale floor', () => {
    // The document claims 42 catalog games; a stale count here is how a reader
    // concludes a module is unused because its game "was removed".
    expect(DOC).toMatch(/42 catalog games/);
    expect(DOC).not.toMatch(/36 catalog games/);
  });

  it('describes the version-packing contract accurately', () => {
    // The old per-game comments claimed "the numeric major component" while the
    // code packed major/minor/patch, so the document must state the real rule
    // including the absent-version behaviour.
    expect(DOC).toMatch(/major\*1e6 \+ minor\*1e3 \+ patch|major\/minor\/patch/);
    expect(DOC).toMatch(/ABSENT|absent/i);
    expect(DOC).not.toMatch(/the numeric major component/);
  });
});
