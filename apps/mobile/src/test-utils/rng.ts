/**
 * Seeded-RNG helpers for deterministic test fixtures.
 *
 * Thin, test-oriented additions on top of the SDK stream (`createRng`). For
 * production generation always use the SDK RNG directly (constitution §10:
 * generators never use `Math.random()`); these helpers exist so TEST code can
 * draw deterministic samples without reaching for unseeded randomness.
 */
import { createRng } from '@/sdk';
import type { Rng } from '@/sdk';

function assertCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}

/**
 * Draw `count` distinct integers in [0, maxExclusive) using `rng`.
 * Deterministic for a given rng state; throws when the request is impossible.
 */
export function drawUniqueInts(
  rng: Rng,
  count: number,
  maxExclusive: number,
): number[] {
  assertCount('count', count);
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(
      `maxExclusive must be a positive integer, got ${maxExclusive}`,
    );
  }
  if (count > maxExclusive) {
    throw new RangeError(
      `cannot draw ${count} unique ints below ${maxExclusive}`,
    );
  }
  const pool = Array.from({ length: maxExclusive }, (_, i) => i);
  return rng.shuffle(pool).slice(0, count);
}

/**
 * First `count` floats of a fresh seeded stream. Useful for determinism and
 * distribution probes: two calls with the same seed always return identical
 * arrays, independent of any other rng consumption elsewhere in a test.
 */
export function seededFloats(seed: string | number, count: number): number[] {
  assertCount('count', count);
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
}
