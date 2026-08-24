/**
 * Deterministic trial generation for the Speed Color Match game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * Invariants:
 * - Same seed → same trial sequence (deterministic).
 * - Congruent trials: swatchColor === labelColor.
 * - Incongruent trials: swatchColor !== labelColor.
 * - No more than 3 consecutive incongruent trials.
 * - Color palette: 6 distinct hues.
 */
import type { Rng } from '@/sdk';

import { COLOR_PALETTE, type ColorName, type Trial } from './types';

/** Maximum consecutive incongruent trials allowed. */
export const MAX_CONSECUTIVE_INCONGRUENT = 3;

export interface GenerateTrialsInput {
  readonly rng: Rng;
  readonly totalTrials: number;
  /** Number of trials that should be incongruent (clamped to valid range). */
  readonly incongruentCount: number;
}

/**
 * Generate the full trial sequence for a session.
 * Returns an array of `Trial` objects with the specified incongruent count,
 * respecting the no-more-than-3 consecutive incongruent invariant.
 */
export function generateTrials(input: GenerateTrialsInput): Trial[] {
  const { rng, totalTrials, incongruentCount } = input;

  // Clamp incongruent count to [0, totalTrials].
  const targetIncongruent = Math.min(totalTrials, Math.max(0, incongruentCount));

  // Generate the incongruent/congruent pattern first, then assign colors.
  const pattern = generateIncongruentPattern(rng, totalTrials, targetIncongruent);

  const trials: Trial[] = [];
  for (let i = 0; i < totalTrials; i += 1) {
    const isIncongruent = pattern[i];

    // Generate the swatch color.
    const swatchColor = rng.fork(`trial:${i}:swatch`).pick(COLOR_PALETTE);

    // Generate the label color.
    let labelColor: ColorName;
    if (isIncongruent) {
      // Pick a different color than the swatch.
      const differentColors = COLOR_PALETTE.filter((c) => c !== swatchColor);
      labelColor = rng.fork(`trial:${i}:label`).pick(differentColors);
    } else {
      // Congruent: same as swatch.
      labelColor = swatchColor;
    }

    trials.push({ swatchColor, labelColor });
  }

  return trials;
}

/**
 * Generate a boolean pattern indicating which trials are incongruent.
 * Ensures the exact target count (as close as possible) and no more than
 * MAX_CONSECUTIVE_INCONGRUENT consecutive true values.
 */
function generateIncongruentPattern(
  rng: Rng,
  totalTrials: number,
  targetIncongruent: number,
): boolean[] {
  // Start with all congruent, then shuffle in incongruents.
  const pattern = new Array<boolean>(totalTrials).fill(false);

  if (targetIncongruent === 0) {
    return pattern;
  }

  // Use rejection sampling: place incongruents, check the streak constraint.
  const indices = Array.from({ length: totalTrials }, (_, i) => i);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const shuffled = rng.fork(`pattern:attempt:${attempt}`).shuffle([...indices]);
    const candidate = new Array<boolean>(totalTrials).fill(false);
    for (let j = 0; j < targetIncongruent && j < shuffled.length; j += 1) {
      candidate[shuffled[j]] = true;
    }
    if (satisfiesStreakConstraint(candidate)) {
      return candidate;
    }
  }

  // Fallback: distribute evenly (guaranteed to satisfy constraint).
  return distributeEvenly(rng, totalTrials, targetIncongruent);
}

/**
 * Evenly distribute incongruent trials to guarantee no more than
 * MAX_CONSECUTIVE_INCONGRUENT consecutive.
 *
 * Pattern: place up to MAX_CONSECUTIVE_INCONGRUENT incongruent, then 1 congruent,
 * repeating. With a random offset for variety.
 *
 * For 10 trials, MAX=3: III C III C II = 8 incongruent.
 * Maximum possible = totalTrials - ceil(totalTrials / (MAX+1)) + 1
 * For 10, MAX=3: 10 - ceil(10/4) + 1 = 10 - 3 + 1 = 8.
 */
function distributeEvenly(
  _rng: Rng,
  totalTrials: number,
  targetIncongruent: number,
): boolean[] {
  const pattern = new Array<boolean>(totalTrials).fill(false);
  if (targetIncongruent === 0) return pattern;

  // Fill greedily: place incongruents in blocks of MAX, separated by 1 congruent.
  let placed = 0;
  let i = 0;

  while (placed < targetIncongruent && i < totalTrials) {
    // Place up to MAX_CONSECUTIVE_INCONGRUENT incongruent trials.
    const block = Math.min(MAX_CONSECUTIVE_INCONGRUENT, targetIncongruent - placed);
    for (let j = 0; j < block && i < totalTrials; j += 1) {
      pattern[i] = true;
      placed += 1;
      i += 1;
    }
    // Skip one congruent position (if more trials remain and more to place).
    if (placed < targetIncongruent && i < totalTrials) {
      i += 1; // congruent gap
    }
  }

  return pattern;
}

/** Check that no more than MAX_CONSECUTIVE_INCONGRUENT consecutive true values. */
export function satisfiesStreakConstraint(pattern: readonly boolean[]): boolean {
  let streak = 0;
  for (const v of pattern) {
    if (v) {
      streak += 1;
      if (streak > MAX_CONSECUTIVE_INCONGRUENT) {
        return false;
      }
    } else {
      streak = 0;
    }
  }
  return true;
}
