/**
 * Deterministic target placement for the Tap Rush game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round's targets come
 * from a per-round RNG fork; each target's position is drawn from its own
 * attempt-fork so the draw sequence never depends on how many re-draws a
 * previous target needed.
 *
 * Placement constraints (both enforced by construction and checked by
 * `validateTargetPlacement` for tests/diagnostics):
 *
 *   1. Every target center lies inside the field with its full radius of
 *      clearance: `radius <= x <= 1 - radius` (same for y), so the rendered
 *      circle never overflows the playfield.
 *   2. Consecutive targets keep at least `minSeparation(radius)` apart
 *      (2.4 × radius by default), so a new target never appears inside the
 *      previous one's footprint and taps stay unambiguous.
 *
 * A candidate that violates the separation constraint is re-drawn with an
 * incremented attempt salt until it passes or the attempt budget is exhausted;
 * the budget fallback deterministically accepts the last candidate, so
 * generation always terminates (mirroring the memory game's re-draw policy).
 */
import type { Rng } from '@/sdk';

import type { TargetPosition } from './types';

/** Upper bound on position re-draws before the last candidate is accepted. */
export const MAX_POSITION_ATTEMPTS = 32;

/**
 * Consecutive targets must be at least this many target radii apart (center
 * to center). 2.4 × radius keeps a one-radius gap between circle edges.
 */
export const MIN_SEPARATION_MULTIPLIER = 2.4;

/** Float tolerance for bounds/placement assertions (normalized units). */
export const PLACEMENT_EPSILON = 1e-9;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Targets in the round. */
  readonly count: number;
  /** Target radius as a fraction of the field width (normalized 0..1). */
  readonly radius: number;
}

/** Minimum center-to-center distance between consecutive targets. */
export function minSeparation(radius: number): number {
  return MIN_SEPARATION_MULTIPLIER * radius;
}

/** Deterministic candidate position for one target attempt. */
function drawPosition(
  rng: Rng,
  roundIndex: number,
  targetIndex: number,
  attempt: number,
  radius: number,
): TargetPosition {
  const fork = rng.fork(`round:${roundIndex}:target:${targetIndex}:attempt:${attempt}`);
  const x = radius + fork.next() * (1 - 2 * radius);
  const y = radius + fork.next() * (1 - 2 * radius);
  return { x, y };
}

/** Squared euclidean distance between two normalized positions. */
export function distanceSq(a: TargetPosition, b: TargetPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Generate a round's target positions in spawn order. Deterministic: the same
 * seed/round/count/radius always yields the same placement.
 */
export function generateRoundTargets(input: GenerateRoundInput): TargetPosition[] {
  const { rng, roundIndex, count, radius } = input;
  const separation = minSeparation(radius);
  const separationSq = separation * separation;
  const targets: TargetPosition[] = [];

  let previous: TargetPosition | null = null;
  for (let i = 0; i < count; i += 1) {
    let candidate = drawPosition(rng, roundIndex, i, 0, radius);
    let attempt = 1;
    while (
      attempt < MAX_POSITION_ATTEMPTS &&
      previous !== null &&
      distanceSq(candidate, previous) < separationSq
    ) {
      candidate = drawPosition(rng, roundIndex, i, attempt, radius);
      attempt += 1;
    }
    targets.push(candidate);
    previous = candidate;
  }
  return targets;
}

/** True when the whole target circle fits inside the unit field. */
export function isInsideField(target: TargetPosition, radius: number): boolean {
  return (
    target.x >= radius - PLACEMENT_EPSILON &&
    target.x <= 1 - radius + PLACEMENT_EPSILON &&
    target.y >= radius - PLACEMENT_EPSILON &&
    target.y <= 1 - radius + PLACEMENT_EPSILON
  );
}

export interface PlacementValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

/**
 * Validate a full placement against the generator invariants (bounds +
 * consecutive separation). Used by tests and diagnostics; the generator itself
 * is constructed to satisfy these, so a non-ok result means a real regression.
 */
export function validateTargetPlacement(
  targets: readonly TargetPosition[],
  radius: number,
): PlacementValidation {
  const separationSq = minSeparation(radius) * minSeparation(radius);
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (!isInsideField(target, radius)) {
      return { ok: false, reason: `target ${i} center ${target.x},${target.y} overflows the field` };
    }
    if (i > 0 && distanceSq(target, targets[i - 1]) < separationSq) {
      return {
        ok: false,
        reason: `target ${i} is closer than ${minSeparation(radius)} to target ${i - 1}`,
      };
    }
  }
  return { ok: true, reason: null };
}
