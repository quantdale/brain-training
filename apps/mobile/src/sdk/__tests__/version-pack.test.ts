/**
 * Version packing contract (Change 074 §5).
 *
 * There were 42 per-game copies of this function in three different bodies, and
 * 29 of their doc comments described an algorithm the code did not implement.
 * Two tests here exist because of that:
 *
 * 1. the packing is pinned ONCE, so the per-game copies cannot drift apart
 *    silently again;
 * 2. a catalog guard asserts every per-game helper actually DELEGATES, because
 *    "the shared helper is correct" is worthless if the copies still compute
 *    their own answer.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ABSENT_VERSION_NUMBER, packVersion, unpackVersion } from '@/sdk/version-pack';
import { versionToNumber } from '@/games/speed-tap-rush/versions';

describe('packVersion', () => {
  it('packs major/minor/patch, not the major alone', () => {
    // The claim the old comments made and the code did not honour: 1.2.3 and
    // 1.0.0 must be distinguishable (constitution §21 requires it).
    expect(packVersion('1.0.0')).toBe(1_000_000);
    expect(packVersion('1.1.0')).toBe(1_001_000);
    expect(packVersion('1.2.3')).toBe(1_002_003);
    expect(packVersion('2.0.0')).toBe(2_000_000);
  });

  it('keeps the packing ORDER-PRESERVING across a major boundary', () => {
    // This is the property the integer column exists for: a numeric comparison
    // has to agree with semver precedence.
    const ascending = ['0.0.1', '0.0.2', '0.1.0', '0.2.0', '1.0.0', '1.0.1', '1.1.0', '1.2.0', '2.0.0'];
    const packed = ascending.map(packVersion);
    for (let i = 1; i < packed.length; i++) {
      expect(packed[i]).toBeGreaterThan(packed[i - 1]);
    }
  });

  it('is deterministic: the same input always yields the same persisted value', () => {
    // Provenance rows must be reproducible; a value that varied between writes
    // would make "same version" meaningless in a query.
    for (const version of ['0.0.1', '1.2.3', '3.4.5', '9.9.9']) {
      const first = packVersion(version);
      for (let i = 0; i < 5; i++) {
        expect(packVersion(version)).toBe(first);
      }
    }
  });

  it('ACCEPTS an absent version, which the SDK type and docs permit', () => {
    // This is the correction: the old helpers all threw on `null`, so the first
    // genuinely non-procedural game would have crashed in the session-persist
    // path. `GameDefinition.generatorVersion` is `string | null` and the db
    // column is `NOT NULL`, so an absent version needs a value, not an error.
    expect(packVersion(null)).toBe(ABSENT_VERSION_NUMBER);
    expect(packVersion(undefined)).toBe(ABSENT_VERSION_NUMBER);
    expect(packVersion('')).toBe(ABSENT_VERSION_NUMBER);
    // 0 sorts below every real version, so "no version" is found first by an
    // oldest-first query — the right order for the sentinel.
    expect(ABSENT_VERSION_NUMBER).toBeLessThan(packVersion('0.0.1'));
  });

  it('still throws for a string that is not a version', () => {
    // Silently defaulting would pack to a number indistinguishable from another
    // version, so a typo in game.json would look like a legitimate version bump.
    expect(() => packVersion('abc')).toThrow(/is not a version of the form/);
    // A `v` prefix is REJECTED, as it was before this change: every persisted
    // value was written by a strict parser, and accepting `v1.2.3` now would be
    // a silent behaviour change in a correctness fix. Tightening later is a
    // separate, deliberate decision.
    expect(() => packVersion('v1.2.3')).toThrow(/is not a version of the form/);
    // A non-numeric PART must be rejected rather than absorbed: `1.2.x` would
    // otherwise pack to `1.2.0`, indistinguishable from a real version.
    expect(() => packVersion('1.2.x')).toThrow(/is not a version of the form/);
  });

  it('accepts a semver prerelease/build suffix (campaign 011 finding #4)', () => {
    // `Number('0-beta')` is NaN, so `1.0.0-beta` used to pack to NaN and be
    // written straight into a `NOT NULL INTEGER` column. A suffix is tolerated;
    // only a non-numeric PART is rejected.
    expect(packVersion('1.0.0-beta')).toBe(1_000_000);
    expect(packVersion('2.1.0-rc.1')).toBe(2_001_000);
    expect(packVersion('1.2.3+build.7')).toBe(1_002_003);
  });

  it('clamps each component instead of letting it overflow into the next', () => {
    // An out-of-range component that overflowed would silently REORDER
    // versions, which is worse than a clamp.
    expect(packVersion('1.1000.0')).toBe(packVersion('1.999.0'));
  });

  it('treats a missing minor/patch as zero', () => {
    expect(packVersion('2')).toBe(2_000_000);
    expect(packVersion('2.1')).toBe(2_001_000);
  });

  it('round-trips through unpackVersion', () => {
    for (const version of ['0.0.1', '1.2.3', '4.5.6', '9.9.9']) {
      expect(unpackVersion(packVersion(version))).toBe(version);
    }
    expect(unpackVersion(ABSENT_VERSION_NUMBER)).toBeNull();
  });
});

describe('the per-game helper delegates to the shared definition', () => {
  it('produces the shared answer for a representative game', () => {
    expect(versionToNumber('1.2.3')).toBe(packVersion('1.2.3'));
    expect(versionToNumber(null)).toBe(ABSENT_VERSION_NUMBER);
  });

  it('every game module delegates and keeps no packing of its own', () => {
    const gamesDir = resolve(__dirname, '..', '..', 'games');
    const files = readdirSync(gamesDir)
      .map((id) => join(gamesDir, id, 'versions.ts'))
      .filter((file) => {
        try {
          return statSync(file).isFile();
        } catch {
          return false;
        }
      })
      .sort();

    const problems: string[] = [];
    for (const file of files) {
      const id = file.replace(/\\/g, '/').split('/').pop()!.replace('/versions.ts', '');
      const source = readFileSync(file, 'utf8');
      if (!source.includes('versionToNumber')) continue;
      if (!source.includes('return packVersion(version);')) {
        problems.push(`${id}: does not delegate to packVersion`);
      }
      if (/ma\s*\*\s*1000000|1_000_000\s*\+/.test(source)) {
        problems.push(`${id}: still packs a version itself`);
      }
      if (!source.includes("from '@/sdk/version-pack'")) {
        problems.push(`${id}: does not import the shared helper`);
      }
    }
    expect({ scanned: files.length, problems }).toEqual({ scanned: 42, problems: [] });
  });
});
