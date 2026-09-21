// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { canonicalClamp01, canonicalSeedToNumber } from '../index';

/**
 * Contract pins for the single-sourced numeric helpers.
 *
 * These outputs are contractual: `canonicalSeedToNumber` feeds the persisted
 * `sessions.seed` column (changing a pinned value would silently break replay
 * of stored sessions), and `canonicalClamp01` defines how malformed normalized
 * scores degrade before XP/rating arithmetic. The per-game re-exports
 * (`seedToNumber` / `clamp01`) are additionally exercised by the game test
 * suites that still import them from game modules.
 */
describe('canonicalSeedToNumber', () => {
  it('keeps pure-numeric seeds verbatim up to MAX_SAFE_INTEGER', () => {
    expect(canonicalSeedToNumber('42')).toBe(42);
    expect(canonicalSeedToNumber('0')).toBe(0);
    expect(canonicalSeedToNumber('4294967295')).toBe(4294967295);
    expect(canonicalSeedToNumber(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('hashes non-numeric seeds with FNV-1a (32-bit unsigned)', () => {
    expect(canonicalSeedToNumber('abc')).toBe(440920331);
    expect(canonicalSeedToNumber('my-seed')).toBe(1631973627);
    expect(canonicalSeedToNumber('')).toBe(0x811c9dc5);
  });

  it('hashes unsafe-integer numeric strings and signed strings', () => {
    expect(canonicalSeedToNumber('9007199254740992')).toBe(2914093886);
    expect(canonicalSeedToNumber('-1')).toBe(348981803);
  });

  it('is deterministic and distinguishes distinct seeds', () => {
    expect(canonicalSeedToNumber('my-seed')).toBe(canonicalSeedToNumber('my-seed'));
    expect(canonicalSeedToNumber('my-seed')).not.toBe(canonicalSeedToNumber('my-seed-2'));
  });
});

describe('canonicalClamp01', () => {
  it('clamps finite values into [0, 1]', () => {
    expect(canonicalClamp01(-1)).toBe(0);
    expect(canonicalClamp01(0)).toBe(0);
    expect(canonicalClamp01(0.5)).toBe(0.5);
    expect(canonicalClamp01(1)).toBe(1);
    expect(canonicalClamp01(2)).toBe(1);
  });

  it('collapses non-finite values to 0 (safe worst-case)', () => {
    expect(canonicalClamp01(Number.NaN)).toBe(0);
    expect(canonicalClamp01(Number.POSITIVE_INFINITY)).toBe(0);
    expect(canonicalClamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
