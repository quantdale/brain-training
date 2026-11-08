/**
 * Deterministic sequence generation for the Sequence Memory game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Round sequences come from a
 * per-position RNG fork, so the sequence for a given ordinal is independent
 * of how earlier forks were consumed.
 *
 * Two invariants (both validated by `isValidSequence` and enforced by
 * construction):
 *
 * 1. Adjacent-duplicate suppression — a tile never flashes twice in a row,
 *    because two consecutive identical flashes are perceptually ambiguous
 *    (the player cannot tell whether they saw one flash or two). Repeats at
 *    non-adjacent positions ARE allowed, so long sequences on a small pad
 *    (e.g. 8 taps on 4 tiles) are reachable and their repeats are intended.
 * 2. Session-wide repeat avoidance (constitution section 10) — a sequence
 *    already served this session (`avoid`) is never served again while an
 *    unserved sequence of that length and pad exists. When the bounded random
 *    draws miss, a small space (the 2-length Easy pad has 12 sequences) is
 *    enumerated so the remaining fresh one is still found; once the space is
 *    spent the least recently served sequence is replayed.
 * 3. Near-duplicate avoidance between consecutive rounds — a round that is
 *    confusable with the previous one (Hamming-style distance below
 *    `MIN_SEQUENCE_HAMMING_DISTANCE`) is re-drawn with an incremented attempt
 *    salt until the budget is exhausted, then the last candidate is accepted.
 *
 * Every step is deterministic — the same seed always yields the same session.
 */
import type { Rng } from '@/sdk';

/** Minimum distance between a round's sequence and the previous round's. */
export const MIN_SEQUENCE_HAMMING_DISTANCE = 2;

/** Upper bound on whole-sequence re-draws before the last candidate is accepted. */
export const MAX_SEQUENCE_ATTEMPTS = 12;

/** Upper bound on per-position re-draws to dodge an adjacent duplicate. */
export const MAX_ADJACENT_ATTEMPTS = 16;

export interface GenerateSequenceInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly sequenceIndex: number;
  readonly length: number;
  readonly tileCount: number;
  /** Previous round's sequence, or null for round 0. */
  readonly prevSequence: readonly number[] | null;
  /** `sequenceKey`s served this session, oldest first. */
  readonly avoid?: readonly string[];
}

/** Largest sequence space the exhaustive fallback will enumerate. */
export const MAX_ENUMERATED_SEQUENCES = 20_000;

/** Identity used to keep one session from serving the same sequence twice. */
export function sequenceKey(sequence: readonly number[]): string {
  return sequence.join(',');
}

/**
 * Every adjacent-duplicate-free sequence, in lexicographic order, or null when
 * the space is too large to enumerate cheaply.
 */
function enumerateSequences(length: number, tileCount: number): number[][] | null {
  if (tileCount * Math.pow(tileCount - 1, length - 1) > MAX_ENUMERATED_SEQUENCES) {
    return null;
  }
  let all: number[][] = [[]];
  for (let pos = 0; pos < length; pos += 1) {
    const next: number[][] = [];
    for (const prefix of all) {
      for (let tile = 0; tile < tileCount; tile += 1) {
        if (pos === 0 || tile !== prefix[pos - 1]) {
          next.push([...prefix, tile]);
        }
      }
    }
    all = next;
  }
  return all;
}

/**
 * Fallback once the random draws missed: a seeded pick among the unserved
 * sequences (preferring ones not confusable with the previous round), or, when
 * all are served, the least recently served one. Null when the space is too
 * large to enumerate.
 */
function fallbackSequence(
  rng: Rng,
  length: number,
  tileCount: number,
  prevSequence: readonly number[] | null,
  avoid: readonly string[],
): number[] | null {
  const all = enumerateSequences(length, tileCount);
  if (all === null) {
    return null;
  }
  const fresh = all.filter((seq) => !avoid.includes(sequenceKey(seq)));
  if (fresh.length > 0) {
    const distinct = fresh.filter((seq) => !isNearDuplicate(seq, prevSequence));
    const choices = distinct.length > 0 ? distinct : fresh;
    return choices[rng.nextInt(choices.length)];
  }
  const byRecency = all.sort(
    (a, b) => avoid.lastIndexOf(sequenceKey(a)) - avoid.lastIndexOf(sequenceKey(b)),
  );
  return byRecency.find((seq) => !isNearDuplicate(seq, prevSequence)) ?? byRecency[0];
}

/**
 * Draw one tile position. Re-draws (with an attempt salt) while the candidate
 * equals the previous drawn tile, so adjacent duplicates are suppressed;
 * deterministic under the injected rng. `prevTile` is null at position 0.
 */
function drawTile(rng: Rng, pos: number, prevTile: number | null, tileCount: number): number {
  for (let attempt = 0; attempt < MAX_ADJACENT_ATTEMPTS; attempt += 1) {
    const candidate = rng.fork(`pos:${pos}:adjacent:${attempt}`).nextInt(tileCount);
    if (candidate !== prevTile) {
      return candidate;
    }
  }
  // Adversarial fallback (astronomically unlikely with tileCount >= 2):
  // accept the last draw even if it repeats the previous tile.
  return rng.fork(`pos:${pos}:adjacent:${MAX_ADJACENT_ATTEMPTS - 1}`).nextInt(tileCount);
}

/** Draw a full candidate sequence of the requested length. */
function drawSequence(rng: Rng, sequenceIndex: number, length: number, tileCount: number): number[] {
  const candidateRng = rng.fork(`seq:${sequenceIndex}`);
  const sequence: number[] = [];
  for (let pos = 0; pos < length; pos += 1) {
    sequence.push(drawTile(candidateRng, pos, pos === 0 ? null : sequence[pos - 1], tileCount));
  }
  return sequence;
}

export function generateSequence(input: GenerateSequenceInput): number[] {
  const { rng, sequenceIndex, length, tileCount, prevSequence, avoid = [] } = input;
  const served = new Set(avoid);

  for (let attempt = 0; attempt < MAX_SEQUENCE_ATTEMPTS; attempt += 1) {
    const candidate = drawSequence(rng.fork(`round:${sequenceIndex}:attempt:${attempt}`), sequenceIndex, length, tileCount);
    if (!isNearDuplicate(candidate, prevSequence) && !served.has(sequenceKey(candidate))) {
      return candidate;
    }
  }

  if (avoid.length > 0) {
    const fallback = fallbackSequence(
      rng.fork(`round:${sequenceIndex}:fallback`),
      length,
      tileCount,
      prevSequence,
      avoid,
    );
    if (fallback !== null) {
      return fallback;
    }
  }

  // Extremely unlikely fallback: deterministically accept the last candidate.
  return drawSequence(
    rng.fork(`round:${sequenceIndex}:attempt:${MAX_SEQUENCE_ATTEMPTS - 1}`),
    sequenceIndex,
    length,
    tileCount,
  );
}

/**
 * Hamming-style distance between two sequences: absolute length difference
 * plus the number of positions where the tiles differ. `null` previous
 * sequence (round 0) counts as infinitely far.
 */
export function sequenceDistance(
  a: readonly number[],
  b: readonly number[] | null,
): number {
  if (b === null) {
    return Number.POSITIVE_INFINITY;
  }
  let distance = Math.abs(a.length - b.length);
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) {
      distance += 1;
    }
  }
  return distance;
}

/** True when `a` is confusable with `b` (too similar to the previous round). */
export function isNearDuplicate(
  a: readonly number[],
  b: readonly number[] | null,
): boolean {
  if (b === null || b.length < 2) {
    return false;
  }
  return sequenceDistance(a, b) < MIN_SEQUENCE_HAMMING_DISTANCE;
}

/**
 * Generator validity check: exact length, integer tile ids within the pad,
 * and no adjacent duplicates (repeats at distance >= 2 are legal). Used by
 * tests to validate every generated session.
 */
export function isValidSequence(
  sequence: readonly number[],
  tileCount: number,
  length: number,
): boolean {
  if (sequence.length !== length || length <= 0) {
    return false;
  }
  for (let i = 0; i < sequence.length; i += 1) {
    const tile = sequence[i];
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileCount) {
      return false;
    }
    if (i > 0 && tile === sequence[i - 1]) {
      return false;
    }
  }
  return true;
}
