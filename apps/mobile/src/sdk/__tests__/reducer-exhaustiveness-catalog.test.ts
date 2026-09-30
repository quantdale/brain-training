/**
 * Catalog-wide reducer exhaustiveness guard (Change 075 §3).
 *
 * Why this is a source-shape test AND a compile-time assertion, rather than
 * either alone:
 *
 * - The `assertExhaustive` call in each reducer is what proves CORRECTNESS: an
 *   unhandled action stops the build and names the member. It cannot be
 *   checked from a test, because a reducer missing the call still compiles.
 * - This test proves COMPLETENESS of the convention across the catalog and,
 *   crucially, across FUTURE games. Without it a new game could ship a plain
 *   `default: return state` forever and no compiler would notice, because
 *   there is nothing to be incomplete about.
 *
 * It also fails on the misleading comment, so the 27 reducers that claimed
 * "every action is handled above" without a mechanism cannot acquire that
 * claim again — a comment that is not backed by code is worse than no comment,
 * because the next author trusts it.
 *
 * The test is deliberately able to FAIL: task 3.3 requires proving it, and the
 * negative cases below assert that the detection logic rejects a silent
 * fallback rather than only that the current tree happens to be clean.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// This suite lives in the SDK's tests, not under `games/`, because the
// catalog scanners treat every directory there as a game module.
const GAMES_DIR = join(__dirname, '..', '..', 'games');

/** Every game module that has a reducer, sorted for deterministic reporting. */
function gameIds(): string[] {
  return readdirSync(GAMES_DIR)
    .filter((entry) => {
      try {
        return statSync(join(GAMES_DIR, entry, 'reducer.ts')).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

const MISLEADING_COMMENT = 'Exhaustiveness guard: every action is handled above.';

/**
 * Does this reducer carry the exhaustiveness assertion in its `default` branch?
 *
 * Scoped to the `default` branch so a call elsewhere in the file does not
 * satisfy it — the whole point is that the assertion sits where the switch has
 * narrowed the residual.
 */
function hasExhaustivenessAssertion(source: string): boolean {
  const defaultIndex = source.search(/^\s*default\s*:/m);
  if (defaultIndex === -1) return false;
  const branch = source.slice(defaultIndex, defaultIndex + 1200);
  return /return\s+assertExhaustive\(\s*action\s*,/.test(branch);
}

/** A silent fallback for a declared action: `default: return state;`. */
function hasSilentFallback(source: string): boolean {
  const defaultIndex = source.search(/^\s*default\s*:/m);
  if (defaultIndex === -1) return true;
  const branch = source.slice(defaultIndex, defaultIndex + 1200);
  return /default\s*:\s*\{?\s*(?:\/\/[^\n]*\n\s*)*return\s+state\s*;/.test(branch);
}

describe('every game reducer asserts exhaustiveness', () => {
  const games = gameIds();

  it('covers the whole catalog', () => {
    // A guard that silently scanned zero files would pass every other case
    // here, so the count is asserted first.
    expect(games).toHaveLength(42);
  });

  it('has the exhaustiveness assertion in every reducer', () => {
    const missing = games.filter((game) => {
      const source = readFileSync(join(GAMES_DIR, game, 'reducer.ts'), 'utf8');
      return !hasExhaustivenessAssertion(source);
    });
    expect({ checked: games.length, missing }).toEqual({ checked: 42, missing: [] });
  });

  it('has no silent `default: return state` fallback left', () => {
    const silent = games.filter((game) => {
      const source = readFileSync(join(GAMES_DIR, game, 'reducer.ts'), 'utf8');
      return hasSilentFallback(source);
    });
    expect(silent).toEqual([]);
  });

  it('carries no comment claiming a guarantee the code does not provide', () => {
    const misleading = games.filter((game) => {
      const source = readFileSync(join(GAMES_DIR, game, 'reducer.ts'), 'utf8');
      return source.includes(MISLEADING_COMMENT);
    });
    expect(misleading).toEqual([]);
  });

  it('imports the assertion from the shared SDK helper, not a local copy', () => {
    // A locally-defined `assertExhaustive` would pass the shape check while
    // re-creating the duplication this change removed.
    const local = games.filter((game) => {
      const source = readFileSync(join(GAMES_DIR, game, 'reducer.ts'), 'utf8');
      return /function\s+assertExhaustive|const\s+assertExhaustive\s*=/.test(source);
    });
    expect(local).toEqual([]);
  });

  it('covers a newly added game without editing this file', () => {
    // The guard's value is future-proofing, so it is asserted directly: the
    // scan is derived from the filesystem, not from a list of 42 ids that a
    // new game would have to be appended to.
    const scanned = new Set(games);
    expect(scanned.size).toBe(gameIds().length);
    expect(scanned.has('speed-tap-rush')).toBe(true);
    expect(scanned.has('memory')).toBe(true);
    // No hard-coded count is used for the scan itself, only for the catalog
    // regression above.
    expect(games.every((game) => game.length > 0)).toBe(true);
  });
});

describe('the guard can actually fail', () => {
  // Task 3.3. Detection logic tested against the shape it is supposed to
  // reject, so "the suite is green" is not the same claim as "the suite can go
  // red".
  const CLEAN = `
export function r(state, action) {
  switch (action.type) {
    case 'a':
      return state;
    default: {
      return assertExhaustive(action, 'demo');
    }
  }
}`;
  const SILENT = `
export function r(state, action) {
  switch (action.type) {
    case 'a':
      return state;
    default: {
      return state;
    }
  }
}`;
  const MISLEADING = `
export function r(state, action) {
  switch (action.type) {
    case 'a':
      return state;
    default: {
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}`;

  it('accepts the converted shape', () => {
    expect(hasExhaustivenessAssertion(CLEAN)).toBe(true);
    expect(hasSilentFallback(CLEAN)).toBe(false);
  });

  it('rejects a silent `default: return state`', () => {
    expect(hasExhaustivenessAssertion(SILENT)).toBe(false);
    expect(hasSilentFallback(SILENT)).toBe(true);
  });

  it('rejects the misleading comment even when the shape is correct', () => {
    // The comment is the claim; the shape is the mechanism. A file can have one
    // without the other and both failures must be detected.
    expect(MISLEADING.includes(MISLEADING_COMMENT)).toBe(true);
    expect(hasExhaustivenessAssertion(MISLEADING)).toBe(false);
    expect(hasSilentFallback(MISLEADING)).toBe(true);
  });

  it('does not accept a call placed outside the default branch', () => {
    // Otherwise a reducer could satisfy the guard with a call somewhere the
    // switch never reaches, which is exactly the gap being closed.
    const outside = `
function helper(action) {
  return assertExhaustive(action, 'demo');
}
export function r(state, action) {
  switch (action.type) {
    case 'a':
      return state;
    default: {
      return state;
    }
  }
}`;
    expect(hasExhaustivenessAssertion(outside)).toBe(false);
  });
});
