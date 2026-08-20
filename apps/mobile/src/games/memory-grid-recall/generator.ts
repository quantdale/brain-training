/**
 * Deterministic target-cell generation for the Grid Recall game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round's target set is a
 * distinct subset of `targetCount` cells drawn from a per-round RNG fork, so
 * rounds are independent and the draw never resequences another round.
 *
 * Near-duplicate avoidance: two rounds whose target sets overlap almost
 * entirely are confusable (the player can coast on memory of the previous
 * layout). A candidate is re-drawn with an incremented attempt salt until the
 * Jaccard-style set distance from the previous round is at least
 * `MIN_TARGET_SET_DISTANCE` (or the budget is exhausted). Every step is
 * deterministic — the same seed always yields the same session.
 */
import type { Rng } from "@/sdk";

/** Minimum distance (cells that must differ) between a round's set and the previous round's. */
export const MIN_TARGET_SET_DISTANCE = 2;

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_TARGET_ATTEMPTS = 12;

export interface GenerateTargetsInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly gridSize: number;
  readonly targetCount: number;
  /** Previous round's target set, or null for round 0. */
  readonly prevTargets: readonly number[] | null;
}

/** Pick `count` distinct cells from the grid for the given round. */
export function generateTargetCells(input: GenerateTargetsInput): number[] {
  const { rng, roundIndex, gridSize, targetCount, prevTargets } = input;
  if (gridSize <= 0 || !Number.isInteger(gridSize)) {
    throw new RangeError(
      `generateTargetCells: gridSize must be a positive integer, got ${gridSize}`,
    );
  }
  if (
    targetCount <= 0 ||
    targetCount > gridSize ||
    !Number.isInteger(targetCount)
  ) {
    throw new RangeError(
      `generateTargetCells: targetCount must be in [1, gridSize], got ${targetCount} for gridSize ${gridSize}`,
    );
  }
  const allCells: number[] = Array.from({ length: gridSize }, (_, i) => i);

  for (let attempt = 0; attempt < MAX_TARGET_ATTEMPTS; attempt += 1) {
    const candidate = rng
      .fork(`round:${roundIndex}:attempt:${attempt}`)
      .shuffle(allCells)
      .slice(0, targetCount)
      .sort((a, b) => a - b);
    if (!isNearDuplicateSet(candidate, prevTargets)) {
      return candidate;
    }
  }

  return rng
    .fork(`round:${roundIndex}:attempt:${MAX_TARGET_ATTEMPTS - 1}`)
    .shuffle(allCells)
    .slice(0, targetCount)
    .sort((a, b) => a - b);
}

/**
 * Set distance between a candidate and a previous set: the number of cells
 * that differ (symmetric difference size). `null` previous set (round 0)
 * counts as infinitely far.
 */
export function targetSetDistance(
  candidate: readonly number[],
  prev: readonly number[] | null,
): number {
  if (prev === null) {
    return Number.POSITIVE_INFINITY;
  }
  const prevSet = new Set(prev);
  let diff = 0;
  const candidateSet = new Set(candidate);
  for (const cell of candidateSet) {
    if (!prevSet.has(cell)) {
      diff += 1;
    }
  }
  for (const cell of prevSet) {
    if (!candidateSet.has(cell)) {
      diff += 1;
    }
  }
  return diff;
}

/** True when `candidate` is confusable with `prev` (too similar to the previous round). */
export function isNearDuplicateSet(
  candidate: readonly number[],
  prev: readonly number[] | null,
): boolean {
  if (prev === null || prev.length < 2) {
    return false;
  }
  return targetSetDistance(candidate, prev) < MIN_TARGET_SET_DISTANCE;
}
