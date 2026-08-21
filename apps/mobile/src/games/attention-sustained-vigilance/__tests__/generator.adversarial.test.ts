// Jest globals imported explicitly (repo has no @types/jest).
// Adversarial generator suite (campaign 011 W01): property sweeps over seeds ×
// difficulties, replay determinism, degenerate parameters, forced RNG-collision
// escape, and negative tests proving `validateStream` is not vacuous.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { Rng } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  VIGILANCE_DIFFICULTY_PARAMS,
  expectedTargetCount,
  targetLayoutFeasible,
  vigilanceParamsForLevel,
} from '../difficulty';
import {
  MAX_DIGIT_ATTEMPTS,
  MAX_LAYOUT_ATTEMPTS,
  fallbackTargetIndices,
  gapsRespected,
  generateStream,
  validateStream,
} from '../generator';
import { DIGIT_MAX, DIGIT_MIN } from '../types';
import type { VigilanceDifficultyParams, VigilanceTrial } from '../types';

const LEVELS = ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const;
type Level = (typeof LEVELS)[number];

/** Shipped tuning for a level (adaptive falls back to its own params). */
function paramsFor(level: Level): VigilanceDifficultyParams {
  return level === 'adaptive' ? ADAPTIVE_PARAMS : VIGILANCE_DIFFICULTY_PARAMS[level];
}

/** Consecutive-target spacing check straight from the packet invariant. */
function targetSpans(trials: readonly VigilanceTrial[]): number[] {
  const positions = trials.filter((t) => t.isTarget).map((t) => t.index);
  const spans: number[] = [];
  for (let i = 1; i < positions.length; i += 1) {
    spans.push(positions[i] - positions[i - 1]);
  }
  return spans;
}

describe('stream property sweep (seeds × difficulties)', () => {
  const SEEDS = 200;

  it('satisfies every invariant for all shipped levels across 200 seeds', () => {
    for (const level of LEVELS) {
      const params = paramsFor(level);
      expect(targetLayoutFeasible(params)).toBe(true);
      for (let seed = 0; seed < SEEDS; seed += 1) {
        const seedText = `sweep-${level}-${seed}`;
        const { trials, stopDigit } = generateStream(createRng(seedText), params);

        // Canonical validator agrees…
        const validation = validateStream(trials, params, stopDigit);
        expect(validation.ok).toBe(true);

        // …and each invariant holds independently (validator not taken on faith).
        expect(trials).toHaveLength(params.trials);
        expect(stopDigit).toBeGreaterThanOrEqual(DIGIT_MIN);
        expect(stopDigit).toBeLessThanOrEqual(DIGIT_MAX);
        const targets = trials.filter((t) => t.isTarget);
        expect(targets).toHaveLength(expectedTargetCount(params));
        for (const trial of trials) {
          expect(Number.isInteger(trial.digit)).toBe(true);
          expect(trial.digit).toBeGreaterThanOrEqual(DIGIT_MIN);
          expect(trial.digit).toBeLessThanOrEqual(DIGIT_MAX);
          // Stop-digit exclusivity, both directions.
          expect(trial.isTarget).toBe(trial.digit === stopDigit);
          expect(trial.index).toBeGreaterThanOrEqual(0);
        }
        // ≥ minTargetGap non-target trials BETWEEN consecutive targets.
        for (const span of targetSpans(trials)) {
          expect(span).toBeGreaterThan(params.minTargetGap);
        }
      }
    }
  });

  it('replays byte-identically from the same seed and differs across seeds', () => {
    for (const level of LEVELS) {
      const params = paramsFor(level);
      const baseline = generateStream(createRng(`replay-${level}`), params);
      expect(generateStream(createRng(`replay-${level}`), params)).toEqual(baseline);

      let differed = false;
      for (let seed = 0; seed < 20 && !differed; seed += 1) {
        const other = generateStream(createRng(`replay-${level}-${seed}`), params);
        if (JSON.stringify(other) !== JSON.stringify(baseline)) {
          differed = true;
        }
      }
      expect(differed).toBe(true);
    }
  });

  it('uses every digit fork independently: changing one digit fork salt cannot be detected', () => {
    // Fork-per-concern sanity: the stop-digit draw must not consume layout RNG,
    // i.e. layouts are identical regardless of how many digit draws happen.
    const params = paramsFor('normal');
    const direct = generateStream(createRng('fork-isolation'), params);
    // Re-generating with a fresh RNG that pre-burns unrelated forks:
    const burner = createRng('fork-isolation');
    for (let i = 0; i < 10; i += 1) {
      burner.fork(`unrelated:${i}`).next();
    }
    const burned = generateStream(burner, params);
    expect(burned).toEqual(direct);
  });
});

describe('degenerate / edge parameters', () => {
  it('handles a single-trial session (targetCount floored at 1)', () => {
    const params: VigilanceDifficultyParams = {
      trials: 1,
      stimulusOnMs: 500,
      isiMs: 100,
      responseWindowMs: 800,
      targetRarityPct: 1,
      minTargetGap: 0,
      rtTargetMs: 400,
      rtFailMs: 900,
    };
    for (let seed = 0; seed < 25; seed += 1) {
      const { trials, stopDigit } = generateStream(createRng(`one-${seed}`), params);
      expect(validateStream(trials, params, stopDigit).ok).toBe(true);
      expect(trials[0]?.isTarget).toBe(true);
      expect(trials[0]?.digit).toBe(stopDigit);
    }
  });

  it('rounds targetRarityPct deterministically (half-up) including round-up cases', () => {
    const base: VigilanceDifficultyParams = {
      trials: 10,
      stimulusOnMs: 500,
      isiMs: 100,
      responseWindowMs: 800,
      targetRarityPct: 15, // 10 × 0.15 = 1.5 → Math.round → 2
      minTargetGap: 2,
      rtTargetMs: 400,
      rtFailMs: 900,
    };
    expect(expectedTargetCount(base)).toBe(2);
    for (let seed = 0; seed < 25; seed += 1) {
      const { trials, stopDigit } = generateStream(createRng(`rare-${seed}`), base);
      expect(trials.filter((t) => t.isTarget)).toHaveLength(2);
      expect(validateStream(trials, base, stopDigit).ok).toBe(true);
    }
  });

  it('allows adjacent targets when minTargetGap is 0', () => {
    const params: VigilanceDifficultyParams = {
      trials: 8,
      stimulusOnMs: 500,
      isiMs: 100,
      responseWindowMs: 800,
      targetRarityPct: 50, // 4 targets over 8 trials
      minTargetGap: 0,
      rtTargetMs: 400,
      rtFailMs: 900,
    };
    for (let seed = 0; seed < 25; seed += 1) {
      const { trials, stopDigit } = generateStream(createRng(`adj-${seed}`), params);
      expect(validateStream(trials, params, stopDigit).ok).toBe(true);
    }
  });

  it('never throws for infeasible gap layouts (fallback guarantees shape)', () => {
    // 3 targets needing ≥4 gaps between them cannot fit 6 trials; generation
    // must still return a well-formed stream (count/exclusivity/range), with
    // the documented caveat that the gap itself may be unsatisfiable.
    const params: VigilanceDifficultyParams = {
      trials: 6,
      stimulusOnMs: 500,
      isiMs: 100,
      responseWindowMs: 800,
      targetRarityPct: 50,
      minTargetGap: 4,
      rtTargetMs: 400,
      rtFailMs: 900,
    };
    expect(targetLayoutFeasible(params)).toBe(false);
    for (let seed = 0; seed < 25; seed += 1) {
      const { trials, stopDigit } = generateStream(createRng(`infeasible-${seed}`), params);
      expect(trials).toHaveLength(6);
      expect(trials.filter((t) => t.isTarget)).toHaveLength(3);
      for (const trial of trials) {
        expect(trial.isTarget).toBe(trial.digit === stopDigit);
      }
    }
  });

  it('caps targetCount at trials when rarity exceeds 100% of the stream', () => {
    const params: VigilanceDifficultyParams = {
      trials: 3,
      stimulusOnMs: 500,
      isiMs: 100,
      responseWindowMs: 800,
      targetRarityPct: 100,
      minTargetGap: 0,
      rtTargetMs: 400,
      rtFailMs: 900,
    };
    const { trials, stopDigit } = generateStream(createRng('all-targets'), params);
    expect(trials.every((t) => t.isTarget && t.digit === stopDigit)).toBe(true);
    expect(validateStream(trials, params, stopDigit).ok).toBe(true);
  });
});

describe('forced RNG-collision escape (go digit re-draw exhaustion)', () => {
  /**
   * Wrap an RNG so every `digit:<i>:attempt:<n>` fork always draws the given
   * digit — forcing MAX_DIGIT_ATTEMPTS consecutive collisions with the stop
   * digit. Everything else (layouts, stop draw) delegates untouched, so the
   * wrapped run replays the same layout as the baseline run.
   */
  function rigged(base: Rng, forcedDigit: number | null): Rng {
    return {
      seed: base.seed,
      algorithmVersion: base.algorithmVersion,
      next: () => base.next(),
      nextInt: (maxExclusive) => base.nextInt(maxExclusive),
      nextIntRange: (minInclusive, maxExclusive) =>
        forcedDigit !== null ? forcedDigit : base.nextIntRange(minInclusive, maxExclusive),
      pick: (items) => base.pick(items),
      shuffle: (items) => base.shuffle(items),
      fork: (salt) => {
        const child = base.fork(salt);
        return typeof salt === 'string' && salt.startsWith('digit:')
          ? rigged(child, forcedDigit)
          : child;
      },
    };
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'stop digit %i: exhausted go draws fall back to the lowest legal alternative',
    (stopCandidate) => {
      const params = paramsFor('expert');
      const seed = `collision-${stopCandidate}`;

      // Learn the natural stop digit for this seed first…
      const natural = generateStream(rigged(createRng(seed), null), params);

      // …then force every go-trial draw to collide with it.
      const { trials, stopDigit } = generateStream(
        rigged(createRng(seed), natural.stopDigit),
        params,
      );
      expect(stopDigit).toBe(natural.stopDigit);
      expect(stopDigit).toBe(stopCandidate);

      const expectedEscape = stopDigit === DIGIT_MAX ? DIGIT_MIN : stopDigit + 1;
      for (const trial of trials) {
        if (!trial.isTarget) {
          expect(trial.digit).toBe(expectedEscape);
        } else {
          expect(trial.digit).toBe(stopDigit);
        }
      }
      // Exclusivity survives the escape hatch.
      expect(validateStream(trials, params, stopDigit).ok).toBe(true);
    },
  );

  it('documents the attempt budgets as exported constants', () => {
    expect(MAX_LAYOUT_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_DIGIT_ATTEMPTS).toBeGreaterThan(0);
  });
});

describe('validateStream negative tests (the validator is not vacuous)', () => {
  const params = paramsFor('normal');

  it('rejects an out-of-range digit', () => {
    const { trials, stopDigit } = generateStream(createRng('neg-1'), params);
    const broken: VigilanceTrial[] = trials.map((t, i) =>
      i === 0 ? { ...t, digit: 0 } : t,
    );
    expect(validateStream(broken, params, stopDigit).ok).toBe(false);
  });

  it('rejects an exclusivity violation in either direction', () => {
    const { trials, stopDigit } = generateStream(createRng('neg-2'), params);
    // Go trial showing the stop digit:
    const leak = trials.find((t) => !t.isTarget);
    if (leak !== undefined) {
      const broken = trials.map((t) => (t.index === leak.index ? { ...t, digit: stopDigit } : t));
      expect(validateStream(broken, params, stopDigit).ok).toBe(false);
    }
    // Target trial showing a different digit:
    const target = trials.find((t) => t.isTarget);
    if (target !== undefined) {
      const other = stopDigit === DIGIT_MAX ? DIGIT_MIN : stopDigit + 1;
      const broken = trials.map((t) => (t.index === target.index ? { ...t, digit: other } : t));
      expect(validateStream(broken, params, stopDigit).ok).toBe(false);
    }
  });

  it('rejects a wrong target count', () => {
    const { trials, stopDigit } = generateStream(createRng('neg-3'), params);
    const firstTarget = trials.findIndex((t) => t.isTarget);
    const demoted = trials.map((t, i) => (i === firstTarget ? { ...t, isTarget: false } : t));
    expect(validateStream(demoted, params, stopDigit).ok).toBe(false);
  });

  it('rejects a gap-violating target layout', () => {
    const tight: VigilanceDifficultyParams = { ...params, minTargetGap: params.trials - 1 };
    const { trials, stopDigit } = generateStream(createRng('neg-4'), params);
    // Same count, impossible spacing under the inflated gap.
    const verdict = validateStream(trials, tight, stopDigit);
    expect(verdict.ok).toBe(false);
  });
});

describe('fallbackTargetIndices', () => {
  it('is deterministic, in-range, unique, and gap-valid for every feasible param set', () => {
    for (const level of LEVELS) {
      const params = paramsFor(level);
      const count = expectedTargetCount(params);
      const a = fallbackTargetIndices(params.trials, count);
      const b = fallbackTargetIndices(params.trials, count);
      expect(a).toEqual(b);
      expect(new Set(a).size).toBe(count);
      expect(gapsRespected(a, params.minTargetGap)).toBe(true);
    }
  });

  it('degenerates safely for zero targets or single-trial streams', () => {
    expect(fallbackTargetIndices(5, 0)).toEqual([]);
    expect(fallbackTargetIndices(1, 1)).toEqual([0]);
  });
});

describe('per-level parameter sanity (shipped tuning)', () => {
  it('keeps the response window inside one slot for fixed levels', () => {
    // Window ≤ slot keeps resolution and advancement on the same cadence;
    // adaptive deliberately allows window > slot (relaxed) — covered by the
    // reducer suite's catch-up tests.
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = vigilanceParamsForLevel(level);
      expect(params.responseWindowMs).toBeLessThanOrEqual(params.stimulusOnMs + params.isiMs);
    }
  });

  it('orders difficulty monotonically (harder = faster + rarer + tighter)', () => {
    const order = ['easy', 'normal', 'hard', 'expert'] as const;
    for (let i = 1; i < order.length; i += 1) {
      const softer = vigilanceParamsForLevel(order[i - 1]);
      const harder = vigilanceParamsForLevel(order[i]);
      expect(harder.stimulusOnMs).toBeLessThan(softer.stimulusOnMs);
      expect(harder.isiMs).toBeLessThan(softer.isiMs);
      expect(harder.targetRarityPct).toBeLessThan(softer.targetRarityPct);
      expect(harder.rtFailMs).toBeLessThan(softer.rtFailMs);
    }
  });
});
