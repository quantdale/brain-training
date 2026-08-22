/**
 * Deterministic puzzle generation for the Equation Builder game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * Every puzzle has at least one valid solution (verified by a brute-force
 * solver during generation; reject and re-draw if no solution found).
 *
 * Near-duplicate avoidance: consecutive puzzles have different targets.
 */
import type { Rng } from '@/sdk';

import { canSolve as sharedCanSolve, getAchievableTargets } from './evaluator';
import type { MathEquationBuilderDifficultyParams, Operator } from './types';

/* -------------------------------------------------------------------------- */
/*  Content-pack: curated puzzle templates                                     */
/* -------------------------------------------------------------------------- */

/** A pre-verified puzzle template: numbers (range 2–20, 3–5 count) + target. */
export interface PuzzleTemplate {
  readonly numbers: readonly number[];
  readonly target: number;
}

/**
 * Curated puzzle templates guaranteed solvable by the brute-force solver
 * (`evaluateAllResults`).  The generator picks from these when compatible
 * with the active difficulty params, supplementing procedural generation
 * with hand-crafted variety.
 *
 * Invariants maintained by construction:
 * - all targets achievable via some parenthesisation of the numbers
 * - numbers in [2, 20], count in [3, 5], all distinct within a set
 * - no duplicate targets across the bank
 *
 * Pool layout follows the per-level `numbersCount`: 3-number sets serve easy
 * (+/− only — the only operator mix that can draw them), 4-number sets serve
 * normal/hard, and the 5-number pool serves expert (which previously had NO
 * curated content at all). Every template is machine-verified reachable under
 * the operator mix of a level that can draw it (enforced by
 * `__tests__/generator.reachability.test.ts`): a template that fails the
 * length/range/solvability filter of EVERY level is dead content and must not
 * be shipped (campaign 012 removed nine such entries).
 */
export const PUZZLE_TEMPLATES: readonly PuzzleTemplate[] = [
  // 3-number sets (easy compatible: +/− only)
  { numbers: [3, 5, 7], target: 15 },   // 3 + 5 + 7
  { numbers: [4, 6, 2], target: 12 },   // 4 + 6 + 2
  { numbers: [5, 8, 3], target: 16 },   // 5 + 8 + 3
  { numbers: [7, 4, 2], target: 13 },   // 7 + 4 + 2
  { numbers: [9, 3, 5], target: 17 },   // 9 + 3 + 5
  { numbers: [6, 2, 3], target: 11 },   // 6 + 2 + 3
  { numbers: [8, 19, 4], target: 23 },  // 8 + (19 − 4)
  { numbers: [12, 5, 3], target: 20 },  // 12 + 5 + 3
  { numbers: [14, 6, 2], target: 22 },  // 14 + 6 + 2
  { numbers: [11, 4, 3], target: 18 },  // 11 + 4 + 3
  { numbers: [15, 2, 3], target: 14 },  // 15 + 2 − 3
  { numbers: [20, 7, 3], target: 24 },  // 20 + 7 − 3
  { numbers: [16, 9, 4], target: 21 },  // 16 + 9 − 4
  { numbers: [13, 8, 2], target: 19 },  // 13 + 8 − 2
  // 4-number sets (normal / hard / expert compatible)
  { numbers: [3, 4, 2, 5], target: 30 },  // 3 × (4 − 2) × 5
  { numbers: [5, 3, 2, 4], target: 40 },  // (5 + 3 + 2) × 4
  { numbers: [6, 2, 3, 4], target: 28 },  // (6 − 2) × (3 + 4)
  { numbers: [8, 2, 3, 5], target: 48 },  // (8 − 2) × (3 + 5)
  { numbers: [7, 3, 2, 4], target: 32 },  // (7 + 3 − 2) × 4
  { numbers: [4, 7, 2, 3], target: 34 },  // (4 × 7) + (2 × 3)
  { numbers: [10, 2, 6, 3], target: 36 }, // (10 + 2) × (6 − 3)
  { numbers: [16, 8, 5, 2], target: 42 }, // ((16 − 8) × 5) + 2
  { numbers: [11, 2, 6, 4], target: 46 }, // (11 × 2) + (6 × 4)
  { numbers: [9, 5, 7, 3], target: 56 },  // (9 + 5) × (7 − 3)
  { numbers: [12, 3, 5, 2], target: 63 }, // (12 − 3) × (5 + 2)
  { numbers: [13, 4, 2, 6], target: 72 }, // (13 − 4) × (6 + 2)
  { numbers: [8, 5, 2, 7], target: 77 },  // ((8 + 7) × 5) + 2
  { numbers: [9, 4, 8, 3], target: 55 },  // (9 − 4) × (8 + 3)
  { numbers: [9, 4, 6, 3], target: 87 },  // (9 × (4 + 6)) − 3
  { numbers: [14, 5, 2, 3], target: 95 }, // (14 + 5) × (3 + 2)
  { numbers: [6, 7, 2, 5], target: 91 },  // (6 + 7) × (5 + 2)
  // 4-number multiplication sets re-tiered from dead 3-number templates
  // (campaign 012). The originals required ×, but every tier that draws
  // 3-number sets runs a +/− operator mix, so they were unreachable at every
  // level ([10,3,4]→26 also failed easy's target range via ×; [8,4,5]→9 sat
  // below easy's targetMin and was replaced in the easy pool instead). Each
  // conversion keeps the original operands and adds one distinct number; all
  // are verified reachable at normal AND hard, and NOT solvable with +/−
  // alone, so multiplication stays the crux.
  { numbers: [10, 3, 4, 2], target: 26 }, // (10 + 3) × (4 − 2)
  { numbers: [8, 7, 3, 2], target: 50 },  // 8 + (7 × (3 × 2))
  { numbers: [6, 5, 4, 3], target: 47 },  // ((6 + 5) × 4) + 3
  { numbers: [9, 4, 2, 3], target: 37 },  // (9 × 4) − (2 − 3)
  { numbers: [7, 6, 3, 2], target: 43 },  // 7 + (6 × (3 × 2))
  { numbers: [10, 5, 2, 3], target: 49 }, // (10 × 5) + (2 − 3)
  { numbers: [8, 6, 4, 2], target: 44 },  // 8 + (6 × (4 + 2))
  { numbers: [13, 2, 5, 4], target: 31 }, // 13 + (2 × (5 + 4))
  // 5-number sets (expert compatible — the curated expert pool)
  { numbers: [2, 3, 4, 5, 6], target: 60 },    // ((2 × 3) × (4 + 5)) + 6
  { numbers: [3, 4, 5, 6, 7], target: 102 },   // (7 × (4 + 5 + 6)) − 3
  { numbers: [2, 5, 7, 9, 11], target: 114 },  // ((11 + 9) × 5) + (7 × 2)
  { numbers: [4, 6, 8, 10, 12], target: 126 }, // ((12 + 8) × 6) + (10 − 4)
  { numbers: [2, 4, 6, 8, 10], target: 200 },  // (2 + 4 + 6 + 8) × 10
  { numbers: [3, 5, 6, 9, 12], target: 105 },  // (12 × 9) − ((6 − 5) × 3)
  { numbers: [4, 5, 7, 11, 13], target: 135 }, // (13 × 11) − ((7 − 5) × 4)
  { numbers: [6, 7, 8, 9, 10], target: 81 },   // (10 × 9) − (8 + 7 − 6)
  { numbers: [19, 11, 7, 3, 2], target: 186 }, // (19 × 11) − ((7 × 3) + 2)
  { numbers: [5, 6, 7, 8, 9], target: 118 },   // ((9 + 8) × 7) − (6 − 5)
];

export interface GeneratePuzzleInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly params: MathEquationBuilderDifficultyParams;
  /** Previous round's target, or null for round 0. */
  readonly prevTarget: number | null;
}

export interface GeneratedPuzzle {
  readonly target: number;
  readonly numbers: readonly number[];
  readonly operators: readonly Operator[];
}

/** Maximum attempts to generate a valid puzzle before giving up. */
export const MAX_PUZZLE_ATTEMPTS = 50;

/**
 * Apply a single operator to two operands.
 * Returns null for invalid operations (division by zero, non-integer division).
 */
export function applyOperator(
  left: number,
  op: Operator,
  right: number,
): number | null {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      if (right === 0) return null;
      if (left % right !== 0) return null;
      return left / right;
    default:
      return null;
  }
}

/**
 * Evaluate all possible results from combining numbers with operators.
 * `operators` is the SET of allowed operators (may include +, -, ×, ÷);
 * the function tries all possible assignments of these operators to positions,
 * plus all parenthesizations (implicit via recursive splitting).
 */
export function evaluateAllResults(
  numbers: readonly number[],
  operators: readonly Operator[],
): Set<number> {
  return getAchievableTargets(numbers, operators);
}

/**
 * Check whether a set of numbers can produce the target with the given operators.
 */
export function canSolve(
  target: number,
  numbers: readonly number[],
  operators: readonly Operator[],
): boolean {
  return sharedCanSolve(target, numbers, operators);
}

/**
 * Generate a puzzle (target, numbers) pair that is guaranteed to have at least
 * one valid solution.
 *
 * Deterministic: same seed always yields the same puzzle for the same params.
 */
export function generatePuzzle(input: GeneratePuzzleInput): GeneratedPuzzle {
  const { rng, roundIndex, params, prevTarget } = input;
  const { numbersCount, targetMin, targetMax, operators } = params;

  // ---- Content-pack: try curated templates first ----
  const compatibleTemplates = PUZZLE_TEMPLATES.filter(
    (t) =>
      t.numbers.length === numbersCount &&
      t.target >= targetMin &&
      t.target <= targetMax &&
      // Verify solvability under the active difficulty's allowed operators
      sharedCanSolve(t.target, t.numbers, operators),
  );

  if (compatibleTemplates.length > 0) {
    const fork = rng.fork(`templates:round:${roundIndex}`);
    const shuffled = fork.shuffle([...compatibleTemplates]);
    for (const template of shuffled) {
      // Near-duplicate avoidance: skip template if its target matches prevTarget.
      if (prevTarget === null || template.target !== prevTarget) {
        return { target: template.target, numbers: template.numbers, operators };
      }
    }
    // All compatible templates share prevTarget – use the first anyway.
    return {
      target: shuffled[0].target,
      numbers: shuffled[0].numbers,
      operators,
    };
  }

  // ---- Procedural fallback (original algorithm) ----
  for (let attempt = 0; attempt < MAX_PUZZLE_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);

    // Generate candidate numbers (2–20, distinct).
    const candidateNumbers: number[] = [];
    const usedNums = new Set<number>();
    for (let i = 0; i < numbersCount; i += 1) {
      let num: number;
      let numAttempts = 0;
      do {
        num = fork.nextIntRange(2, 21);
        numAttempts += 1;
      } while (usedNums.has(num) && numAttempts < 50);
      usedNums.add(num);
      candidateNumbers.push(num);
    }

    // Generate all possible targets from these numbers.
    const allResults = evaluateAllResults(candidateNumbers, operators);

    // Filter to targets in range.
    const validTargets = Array.from(allResults).filter(
      (t) => t >= targetMin && t <= targetMax && Number.isInteger(t),
    );

    if (validTargets.length === 0) continue;

    // Pick a target, avoiding the previous round's target.
    const shuffledTargets = fork.shuffle(validTargets);
    let target = shuffledTargets[0];
    // Near-duplicate avoidance: pick a different target if possible.
    if (prevTarget !== null && shuffledTargets.length > 1) {
      const different = shuffledTargets.find((t) => t !== prevTarget);
      if (different !== undefined) target = different;
    }

    return { target, numbers: candidateNumbers, operators };
  }

  // Fallback: construct a guaranteed-solvable puzzle deterministically.
  // The filler approach would emit an unproven puzzle for numbersCount > 2
  // (spec: fallback MUST be subjected to the same final invariant checks).
  // Instead, reuse the same solvable-search loop but widen the attempt
  // budget — or throw if we truly cannot produce a valid puzzle.
  const fallbackNumbers: number[] = [];
  const fallbackUsed = new Set<number>();
  for (let i = 0; i < numbersCount; i += 1) {
    let n: number;
    let nAttempts = 0;
    do {
      n = rng.nextIntRange(2, 21);
      nAttempts += 1;
    } while (fallbackUsed.has(n) && nAttempts < 100);
    fallbackUsed.add(n);
    fallbackNumbers.push(n);
  }
  const fallbackResults = evaluateAllResults(fallbackNumbers, operators);
  const fallbackTargets = Array.from(fallbackResults).filter(
    (t) => t >= targetMin && t <= targetMax && Number.isInteger(t),
  );
  if (fallbackTargets.length > 0) {
    const target =
      prevTarget !== null && fallbackTargets.length > 1
        ? (fallbackTargets.find((t) => t !== prevTarget) ?? fallbackTargets[0])
        : fallbackTargets[0];
    if (sharedCanSolve(target, fallbackNumbers, operators)) {
      return { target, numbers: fallbackNumbers, operators };
    }
  }
  throw new Error(
    `generatePuzzle: fallback failed to produce a solvable puzzle after ${MAX_PUZZLE_ATTEMPTS} attempts (params=${JSON.stringify(params)})`,
  );
}
