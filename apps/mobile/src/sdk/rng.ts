/**
 * Deterministic seeded RNG (constitution §10: "Generators use explicit seeds,
 * difficulty parameters, and versions"; GAME_SDK.md generator rule).
 *
 * Algorithm: xmur3 string hash → mulberry32 (both pure 32-bit integer math,
 * specified by ECMA-262 — `Math.imul` and `>>>` — so results are identical
 * across Hermes, V8, and JavaScriptCore).
 *
 * Reproducibility rule: a given `(RNG_ALGORITHM_VERSION, seed)` always yields
 * the same sequence. Games must record `(gameVersion, generatorVersion, seed,
 * difficulty)` with their results so any generated challenge can be
 * reconstructed later. Never use `Math.random()` inside generators.
 */
import { RNG_ALGORITHM_VERSION } from './version';

/** Deterministic seeded RNG stream. */
export interface Rng {
  /** Canonical seed string (numbers are stringified, so `42` and `'42'` are identical). */
  readonly seed: string;
  /** Algorithm version that produced this stream; see `RNG_ALGORITHM_VERSION`. */
  readonly algorithmVersion: string;
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Next integer in [minInclusive, maxExclusive). */
  nextIntRange(minInclusive: number, maxExclusive: number): number;
  /** Uniformly pick one item. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle of a copy; the input array is never mutated. */
  shuffle<T>(items: readonly T[]): T[];
  /**
   * Derive an independent child stream from a salt. Deterministic: the same
   * salt on the same parent always yields the same child sequence, and
   * different salts yield different child sequences. Use forks for
   * sub-generators (round layout, distractor selection, ...) so changing one
   * generator's seed source does not reshuffle the others.
   */
  fork(salt: string | number): Rng;
}

/** Canonical string form of a seed; numbers are stringified. */
export function normalizeSeed(seed: string | number): string {
  return String(seed);
}

/**
 * xmur3: fast 32-bit string hash with good avalanche. Deterministic across
 * engines because it only uses `Math.imul` and bitwise ops.
 */
function hashSeedToUint32(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: 32-bit-state PRNG producing floats in [0, 1). */
function mulberry32(state: number): () => number {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}

/** Create a deterministic RNG stream from a string or number seed. */
export function createRng(seed: string | number): Rng {
  const canonical = normalizeSeed(seed);
  const next = mulberry32(hashSeedToUint32(canonical));

  const rng: Rng = {
    seed: canonical,
    algorithmVersion: RNG_ALGORITHM_VERSION,
    next: () => next(),
    nextInt: (maxExclusive: number) => {
      assertInt(maxExclusive, 'maxExclusive');
      return Math.floor(next() * maxExclusive);
    },
    nextIntRange: (minInclusive: number, maxExclusive: number) => {
      assertInt(maxExclusive - minInclusive, 'maxExclusive - minInclusive');
      return minInclusive + rng.nextInt(maxExclusive - minInclusive);
    },
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) {
        throw new RangeError('pick() called with an empty array');
      }
      return items[rng.nextInt(items.length)];
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = items.slice();
      // Fisher–Yates, bounded by `items.length - 1` so `pick`-style indexes stay in range.
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = rng.nextInt(i + 1);
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
    fork: (salt: string | number) => createRng(`${canonical}::fork::${normalizeSeed(salt)}`),
  };

  return rng;
}
