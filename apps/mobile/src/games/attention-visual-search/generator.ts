/**
 * Deterministic target generation for the Visual Search game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Round targets come from a
 * per-round RNG fork, so each round's draw is independent of every other
 * round's (and of how many re-draws a neighbour needed).
 *
 * Layout invariant: a round has exactly ONE target tile; every other tile is
 * an identical distractor. The target is drawn with `nextInt(gridSize)`, which
 * by construction guarantees a valid index distinct from all distractors.
 *
 * Near-duplicate avoidance: consecutive rounds whose odd tile sits on the
 * same index look identical, so a candidate equal to the previous round's
 * target is re-drawn with an incremented attempt salt until it differs (or
 * the budget is exhausted). Every step is deterministic — the same seed
 * always yields the same session.
 */
import { createRng } from '@/sdk';
import type { Rng } from '@/sdk';

import { gridSizeFor } from './difficulty';
import type { VisualSearchDifficultyParams } from './types';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_TARGET_ATTEMPTS = 12;

export interface GenerateRoundTargetInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly gridSize: number;
  /** Previous round's target index, or null for round 0. */
  readonly prevTargetIndex: number | null;
}

export function generateRoundTarget(input: GenerateRoundTargetInput): number {
  const { rng, roundIndex, gridSize, prevTargetIndex } = input;
  if (gridSize <= 0 || !Number.isInteger(gridSize)) {
    throw new RangeError(`generateRoundTarget: gridSize must be a positive integer, got ${gridSize}`);
  }

  for (let attempt = 0; attempt < MAX_TARGET_ATTEMPTS; attempt += 1) {
    const candidate = rng.fork(`round:${roundIndex}:attempt:${attempt}`).nextInt(gridSize);
    if (!isNearDuplicateTarget(candidate, prevTargetIndex)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: deterministically accept the last candidate.
  return rng.fork(`round:${roundIndex}:attempt:${MAX_TARGET_ATTEMPTS - 1}`).nextInt(gridSize);
}

/**
 * Distance between two round layouts: 0 when the odd tile sits on the same
 * index, 1 otherwise. `null` previous target (round 0) counts as distinct.
 */
export function targetDistance(a: number, b: number | null): number {
  return b === null || a !== b ? 1 : 0;
}

/** True when `a` is confusable with `b` (the same odd-tile position again). */
export function isNearDuplicateTarget(a: number, b: number | null): boolean {
  return b !== null && a === b;
}

/**
 * Layout validation helper: exactly one target (by construction the grid
 * holds the single target index and nothing else is special), target position
 * distinct from distractors means `0 <= targetIndex < gridSize`.
 */
export function isValidLayout(gridSize: number, targetIndex: number): boolean {
  return (
    Number.isInteger(gridSize) &&
    gridSize > 0 &&
    Number.isInteger(targetIndex) &&
    targetIndex >= 0 &&
    targetIndex < gridSize
  );
}

/**
 * The deterministic target sequence of a whole session — the "board/rounds"
 * that `(seed, difficulty)` reproduces, independent of how the player plays
 * (grid sizes are a pure function of round index). Used by tests and QA to
 * compute expected layouts ahead of time.
 */
export function generateSessionTargets(
  seed: string,
  params: VisualSearchDifficultyParams,
  rounds?: number,
): number[] {
  const count = rounds ?? params.rounds;
  const targets: number[] = [];
  let prev: number | null = null;
  for (let round = 0; round < count; round += 1) {
    const target = generateRoundTarget({
      rng: createRng(seed),
      roundIndex: round,
      gridSize: gridSizeFor(params, round),
      prevTargetIndex: prev,
    });
    targets.push(target);
    prev = target;
  }
  return targets;
}
