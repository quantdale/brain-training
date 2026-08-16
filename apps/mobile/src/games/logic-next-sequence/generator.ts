/**
 * Deterministic puzzle generation + solver/validator for the Next in Sequence
 * game.
 *
 * A session's seed is recorded with its result, so the whole session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round's puzzle comes
 * from an RNG fork (`round:<i>:attempt:<a>`), exactly like Memory's rounds.
 *
 * Solver contract — this is the first-class validation deliverable:
 *
 *   `solveSequence(visible)` reconstructs the canonical pattern from the
 *   visible terms by trying the recipe families in a fixed priority order
 *   (arithmetic → geometric → squares → cubes → fibonacci → alternating →
 *   increments) and returns the continuation of the FIRST family that exactly
 *   reproduces every visible term. The generator emits a puzzle only when the
 *   solver identifies the intended family and the intended continuation, so
 *   every shipped puzzle is provably solvable and unambiguous under the
 *   documented priority.
 *
 * Distractors are not random noise: each is a near-miss continuation derived
 * from the SAME family's parameters (wrong step, wrong ratio, wrong summand,
 * off-by-one base, ...), filtered to the value bounds, deduplicated, and
 * never equal to the true answer. Exactly one of the four options equals the
 * solver's continuation.
 *
 * Integer-only: all terms and options are integers within [minValue,
 * maxValue] (minValue is 0, so no negative-by-construction traps).
 *
 * Bounded regeneration: a puzzle attempt is rejected when the solver does
 * not confirm the family+answer, when fewer than three valid distractors are
 * available, or when it is a near-duplicate of the previous round. Up to
 * `MAX_PUZZLE_ATTEMPTS` attempts; the deterministic length-aware fallback
 * (a canonical arithmetic puzzle) is only reachable if the entire budget is
 * exhausted and itself satisfies every invariant.
 */
import type { Rng } from '@/sdk';

import { visibleLengthForTier } from './difficulty';
import type { LogicDifficultyParams, LogicPuzzle, RecipeFamily } from './types';

/** Upper bound on puzzle re-draw attempts before the fallback is used. */
export const MAX_PUZZLE_ATTEMPTS = 24;

/** Recipe pool per tier; tier 0 is the easiest, tier 3 the full pool. */
export const RECIPE_TIERS: readonly (readonly RecipeFamily[])[] = Object.freeze([
  Object.freeze(['arithmetic'] as const),
  Object.freeze(['arithmetic', 'geometric', 'squares'] as const),
  Object.freeze(['arithmetic', 'geometric', 'squares', 'cubes', 'alternating'] as const),
  Object.freeze([
    'arithmetic',
    'geometric',
    'squares',
    'cubes',
    'alternating',
    'fibonacci',
    'increments',
  ] as const),
]);

export interface GeneratePuzzleInput {
  /** Session rng; the round's attempts are drawn from `round:<i>:attempt:<a>` forks. */
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Recipe tier of this round (adaptive rounds vary it). */
  readonly tier: number;
  /** Resolved difficulty parameters (value bounds). */
  readonly params: LogicDifficultyParams;
  /** Previous round's puzzle, or null for round 0 (near-duplicate avoidance). */
  readonly prevPuzzle: LogicPuzzle | null;
}

/** What the solver found: the canonical family, its params, and the next term. */
export interface SolvedPattern {
  readonly family: RecipeFamily;
  readonly next: number;
  readonly params: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * Infer the canonical pattern of the visible terms and compute the next term.
 *
 * Priority order (documented; players see the explanation for the family the
 * solver picks): arithmetic, geometric, squares, cubes, fibonacci, alternating,
 * increments. Returns null when no family fits exactly (or when there are
 * fewer than two terms). The function is total on arbitrary integer input —
 * it never throws and never guesses.
 */
export function solveSequence(terms: readonly number[]): SolvedPattern | null {
  if (terms.length < 2) {
    return null;
  }

  // 1. Arithmetic: all consecutive differences equal.
  const d = terms[1] - terms[0];
  let fits = true;
  for (let i = 2; i < terms.length; i += 1) {
    if (terms[i] - terms[i - 1] !== d) {
      fits = false;
      break;
    }
  }
  if (fits) {
    return {
      family: 'arithmetic',
      next: terms[terms.length - 1] + d,
      params: { difference: d },
    };
  }

  // 2. Geometric: constant integer ratio ≥ 2 (needs ≥ 3 terms to verify).
  if (terms.length >= 3 && terms[0] >= 1 && terms[1] % terms[0] === 0) {
    const ratio = terms[1] / terms[0];
    if (Number.isInteger(ratio) && ratio >= 2) {
      let value = terms[0];
      let isGeometric = true;
      for (let i = 1; i < terms.length; i += 1) {
        value *= ratio;
        if (terms[i] !== value) {
          isGeometric = false;
          break;
        }
      }
      if (isGeometric) {
        return {
          family: 'geometric',
          next: terms[terms.length - 1] * ratio,
          params: { ratio },
        };
      }
    }
  }

  // 3. Squares: terms[i] = (k + i)^2 + c. Two terms determine (k, c):
  //    diff = 2k + 1.
  {
    const firstDiff = terms[1] - terms[0];
    const k = (firstDiff - 1) / 2;
    if (Number.isInteger(k) && k >= 0) {
      const c = terms[0] - k * k;
      let areSquares = true;
      for (let i = 0; i < terms.length; i += 1) {
        const base = k + i;
        if (terms[i] !== base * base + c) {
          areSquares = false;
          break;
        }
      }
      if (areSquares) {
        const base = k + terms.length;
        return { family: 'squares', next: base * base + c, params: { base: k, offset: c } };
      }
    }
  }

  // 4. Cubes: terms[i] = (k + i)^3 + c. Two terms determine (k, c):
  //    diff = 3k^2 + 3k + 1 → k = (sqrt(12*diff - 3) - 3) / 6.
  {
    const firstDiff = terms[1] - terms[0];
    const discriminant = 12 * firstDiff - 3;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      if (Number.isInteger(root)) {
        const k = (root - 3) / 6;
        if (Number.isInteger(k) && k >= 0) {
          const c = terms[0] - k * k * k;
          let areCubes = true;
          for (let i = 0; i < terms.length; i += 1) {
            const base = k + i;
            if (terms[i] !== base * base * base + c) {
              areCubes = false;
              break;
            }
          }
          if (areCubes) {
            const base = k + terms.length;
            return {
              family: 'cubes',
              next: base * base * base + c,
              params: { base: k, offset: c },
            };
          }
        }
      }
    }
  }

  // 5. Fibonacci-like: terms[i] = terms[i-1] + terms[i-2] (needs ≥ 4 terms).
  if (terms.length >= 4 && terms[2] === terms[0] + terms[1]) {
    let isFib = true;
    for (let i = 3; i < terms.length; i += 1) {
      if (terms[i] !== terms[i - 1] + terms[i - 2]) {
        isFib = false;
        break;
      }
    }
    if (isFib) {
      return {
        family: 'fibonacci',
        next: terms[terms.length - 1] + terms[terms.length - 2],
        params: { first: terms[0], second: terms[1] },
      };
    }
  }

  // 6. Alternating: two interleaved arithmetic progressions with different
  //    steps (even indices step by d1, odd indices by d2). Needs ≥ 5 terms:
  //    with only 4 terms (2 even + 2 odd points) every sequence fits
  //    trivially, so the check would be meaningless.
  if (terms.length >= 5) {
    const stepA = terms[2] - terms[0];
    const stepB = terms[3] - terms[1];
    let isAlternating = true;
    for (let i = 0; i < terms.length; i += 1) {
      const expected =
        i % 2 === 0
          ? terms[0] + (i / 2) * stepA
          : terms[1] + ((i - 1) / 2) * stepB;
      if (terms[i] !== expected) {
        isAlternating = false;
        break;
      }
    }
    if (isAlternating && stepA !== stepB) {
      const n = terms.length;
      const next =
        n % 2 === 0
          ? terms[0] + (n / 2) * stepA
          : terms[1] + ((n - 1) / 2) * stepB;
      return { family: 'alternating', next, params: { first: terms[0], stepA, stepB } };
    }
  }

  // 7. Increments: consecutive differences grow by a constant k ≠ 0.
  //    Needs ≥ 4 terms: with only 3 terms (2 differences) every sequence fits
  //    trivially, so the check would be meaningless. (k = 0 would be plain
  //    arithmetic, handled above.)
  if (terms.length >= 4) {
    const firstDiff = terms[1] - terms[0];
    const k = terms[2] - terms[1] - firstDiff;
    if (k !== 0) {
      let areIncrements = true;
      for (let i = 2; i < terms.length; i += 1) {
        const currentDiff = terms[i] - terms[i - 1];
        const previousDiff = terms[i - 1] - terms[i - 2];
        if (currentDiff - previousDiff !== k) {
          areIncrements = false;
          break;
        }
      }
      if (areIncrements) {
        const lastDiff = terms[terms.length - 1] - terms[terms.length - 2];
        return {
          family: 'increments',
          next: terms[terms.length - 1] + lastDiff + k,
          params: { first: terms[0], firstDiff, increment: k },
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Family generation
// ---------------------------------------------------------------------------

/** Generated family content: full term list plus the family's parameters. */
interface FamilySpec {
  readonly family: RecipeFamily;
  /** `visibleLength + 1` terms; the last one is the answer. */
  readonly terms: readonly number[];
  readonly params: Readonly<Record<string, number>>;
}

/**
 * Draw parameters and generate `visibleLength + 1` terms for one family.
 * Returns null when the parameters would push the answer beyond `maxValue`
 * (the caller re-draws). All terms are non-negative integers.
 */
function generateFamilyTerms(
  family: RecipeFamily,
  rng: Rng,
  visibleLength: number,
  maxValue: number,
): FamilySpec | null {
  const terms: number[] = [];
  const pushWhileInRange = (value: number): boolean => {
    if (value > maxValue) {
      return false;
    }
    terms.push(value);
    return true;
  };

  switch (family) {
    case 'arithmetic': {
      const first = 1 + rng.nextInt(20);
      const difference = 1 + rng.nextInt(12);
      for (let i = 0; i <= visibleLength; i += 1) {
        if (!pushWhileInRange(first + i * difference)) {
          return null;
        }
      }
      return { family, terms, params: { first, difference } };
    }
    case 'geometric': {
      const first = 1 + rng.nextInt(6);
      const ratio = 2 + rng.nextInt(3);
      let value = first;
      for (let i = 0; i <= visibleLength; i += 1) {
        if (!pushWhileInRange(value)) {
          return null;
        }
        value *= ratio;
      }
      return { family, terms, params: { first, ratio } };
    }
    case 'squares': {
      const base = rng.nextInt(10); // 0..9
      const offset = rng.nextInt(9); // 0..8
      for (let i = 0; i <= visibleLength; i += 1) {
        const value = (base + i) * (base + i) + offset;
        if (!pushWhileInRange(value)) {
          return null;
        }
      }
      return { family, terms, params: { base, offset } };
    }
    case 'cubes': {
      const base = rng.nextInt(5); // 0..4
      const offset = rng.nextInt(3); // 0..2
      for (let i = 0; i <= visibleLength; i += 1) {
        const value = (base + i) * (base + i) * (base + i) + offset;
        if (!pushWhileInRange(value)) {
          return null;
        }
      }
      return { family, terms, params: { base, offset } };
    }
    case 'alternating': {
      const first = 1 + rng.nextInt(10);
      const stepA = 1 + rng.nextInt(6);
      // stepB drawn from the five values different from stepA.
      const stepB = 1 + ((stepA - 1 + rng.nextInt(5)) % 6);
      for (let i = 0; i <= visibleLength; i += 1) {
        const value =
          i % 2 === 0
            ? first + (i / 2) * stepA
            : first + ((i + 1) / 2) * stepB;
        if (!pushWhileInRange(value)) {
          return null;
        }
      }
      return { family, terms, params: { first, stepA, stepB } };
    }
    case 'fibonacci': {
      const first = 1 + rng.nextInt(4);
      const second = 1 + rng.nextInt(4);
      if (!pushWhileInRange(first) || !pushWhileInRange(second)) {
        return null;
      }
      for (let i = 2; i <= visibleLength; i += 1) {
        if (!pushWhileInRange(terms[i - 1] + terms[i - 2])) {
          return null;
        }
      }
      return { family, terms, params: { first, second } };
    }
    case 'increments': {
      const first = 1 + rng.nextInt(10);
      const firstDiff = 1 + rng.nextInt(6);
      const increment = 1 + rng.nextInt(3);
      for (let i = 0; i <= visibleLength; i += 1) {
        // t[i] = first + sum_{j=0}^{i-1} (firstDiff + j * increment)
        const value = first + i * firstDiff + increment * (i * (i - 1)) / 2;
        if (!pushWhileInRange(value)) {
          return null;
        }
      }
      return { family, terms, params: { first, firstDiff, increment } };
    }
  }
}

// ---------------------------------------------------------------------------
// Distractors
// ---------------------------------------------------------------------------

/**
 * Near-miss candidate continuations for one family. Every candidate is the
 * answer you would get from a plausible wrong reading of the same pattern:
 * misapplying the step, using the wrong ratio/summand/base, repeating the
 * last term, or forgetting the offset. Candidates may collide with the answer
 * or each other; `buildDistractors` filters and dedupes.
 */
function candidateValues(
  family: RecipeFamily,
  visible: readonly number[],
  answer: number,
  params: Readonly<Record<string, number>>,
): number[] {
  const last = visible[visible.length - 1];
  switch (family) {
    case 'arithmetic': {
      const d = params.difference;
      return [last + 2 * d, last, answer + 1, answer - 1, last - d];
    }
    case 'geometric': {
      const r = params.ratio;
      // Doubling the step, repeating the last term, wrong ratios r±1, and
      // "adding the step instead of multiplying".
      return [last * r * r, last, last * (r + 1), last * (r - 1), answer + (answer - last)];
    }
    case 'squares':
    case 'cubes': {
      const k = params.base;
      const c = params.offset;
      const n = visible.length;
      const base = k + n;
      const power =
        family === 'squares'
          ? (x: number) => x * x
          : (x: number) => x * x * x;
      // Off-by-one base, linear continuation (ignoring the growth), repeat
      // last term, and forgetting the offset.
      return [
        power(base + 1) + c,
        last,
        last + (last - visible[visible.length - 2]),
        power(base),
      ];
    }
    case 'alternating': {
      const d1 = params.stepA;
      const d2 = params.stepB;
      const n = visible.length;
      // The step that actually applies at index n (even n → stepA, odd → stepB).
      const nextStep = n % 2 === 0 ? d1 : d2;
      const otherStep = nextStep === d1 ? d2 : d1;
      return [last + otherStep, last, last + d1 + d2, answer + 1, answer - 1];
    }
    case 'fibonacci': {
      // Wrong summand (adding the term two back), doubling, repeat last, ±1.
      return [last + visible[visible.length - 3], 2 * last, last, answer + 1, answer - 1];
    }
    case 'increments': {
      const k = params.increment;
      const lastDiff = last - visible[visible.length - 2];
      // Constant-difference continuation, doubled growth, repeat last, ±1.
      return [last + lastDiff, last + lastDiff + 2 * k, last, answer + 1, answer - 1];
    }
  }
}

/**
 * Pick three distinct near-miss distractors in [minValue, maxValue] that are
 * not the answer. Returns null when fewer than three valid candidates exist
 * (the caller re-draws the whole puzzle).
 */
export function buildDistractors(
  family: RecipeFamily,
  visible: readonly number[],
  answer: number,
  params: Readonly<Record<string, number>>,
  rng: Rng,
  minValue: number,
  maxValue: number,
): number[] | null {
  const seen = new Set<number>([answer]);
  const kept: number[] = [];
  for (const value of candidateValues(family, visible, answer, params)) {
    if (!Number.isInteger(value) || value < minValue || value > maxValue) {
      continue;
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    kept.push(value);
  }
  if (kept.length < 3) {
    return null;
  }
  return rng.shuffle(kept).slice(0, 3);
}

/** True when two consecutive puzzles would be confusable. */
export function isNearDuplicatePuzzle(a: LogicPuzzle, b: LogicPuzzle): boolean {
  // The same answer twice in a row invites answer-memorizing; the same
  // family+terms is literally the same puzzle.
  if (a.answer === b.answer) {
    return true;
  }
  if (a.family !== b.family || a.terms.length !== b.terms.length) {
    return false;
  }
  return a.terms.every((value, i) => value === b.terms[i]);
}

// ---------------------------------------------------------------------------
// Puzzle generation
// ---------------------------------------------------------------------------

/** Canonical length-aware fallback puzzle (satisfies every invariant). */
function fallbackPuzzle(visibleLength: number): LogicPuzzle {
  const terms = Array.from({ length: visibleLength }, (_, i) => 2 + 2 * i);
  const answer = 2 + 2 * visibleLength;
  const options = [answer, answer + 2, answer + 4, terms[terms.length - 1]];
  return {
    family: 'arithmetic',
    terms,
    answer,
    options,
    answerIndex: 0,
    params: { first: 2, difference: 2 },
  };
}

/**
 * Generate one puzzle for a round. Deterministic for a given
 * (rng, roundIndex, tier, params, prevPuzzle). Every emitted puzzle satisfies:
 *   - `solveSequence(terms)` identifies `family` and returns exactly `answer`;
 *   - four distinct integer options in [minValue, maxValue];
 *   - exactly one option equals `answer`; the rest are near-miss distractors;
 *   - it is not a near-duplicate of `prevPuzzle`.
 * Rejected attempts re-draw with a fresh attempt salt; after
 * `MAX_PUZZLE_ATTEMPTS` the deterministic fallback is returned.
 */
export function generatePuzzle(input: GeneratePuzzleInput): LogicPuzzle {
  const { rng, roundIndex, tier, params, prevPuzzle } = input;
  const visibleLength = visibleLengthForTier(tier);
  const pool = RECIPE_TIERS[tier];

  for (let attempt = 0; attempt < MAX_PUZZLE_ATTEMPTS; attempt += 1) {
    const attemptRng = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    const family = attemptRng.pick(pool);
    const spec = generateFamilyTerms(family, attemptRng, visibleLength, params.maxValue);
    if (spec === null) {
      continue;
    }
    const visible = spec.terms.slice(0, visibleLength);
    const answer = spec.terms[visibleLength];

    // Solver validation: the canonical pattern must be the intended family
    // and its continuation must be exactly the generated answer.
    const solved = solveSequence(visible);
    if (solved === null || solved.family !== family || solved.next !== answer) {
      continue;
    }

    const distractors = buildDistractors(
      family,
      visible,
      answer,
      spec.params,
      attemptRng,
      params.minValue,
      params.maxValue,
    );
    if (distractors === null) {
      continue;
    }

    const options = attemptRng.shuffle([answer, ...distractors]);
    const puzzle: LogicPuzzle = {
      family,
      terms: visible,
      answer,
      options,
      answerIndex: options.indexOf(answer),
      params: spec.params,
    };
    if (prevPuzzle !== null && isNearDuplicatePuzzle(puzzle, prevPuzzle)) {
      continue;
    }
    return puzzle;
  }

  return fallbackPuzzle(visibleLength);
}

/** Player-facing explanation of a family's pattern (shown on round results). */
export function describePattern(
  family: RecipeFamily,
  params: Readonly<Record<string, number>>,
): string {
  switch (family) {
    case 'arithmetic':
      return `Each step adds ${params.difference}.`;
    case 'geometric':
      return `Each term multiplies by ${params.ratio}.`;
    case 'squares':
      return params.offset === 0
        ? 'Terms are consecutive squares.'
        : `Terms are consecutive squares plus ${params.offset}.`;
    case 'cubes':
      return params.offset === 0
        ? 'Terms are consecutive cubes.'
        : `Terms are consecutive cubes plus ${params.offset}.`;
    case 'alternating':
      return `The steps alternate between +${params.stepA} and +${params.stepB}.`;
    case 'fibonacci':
      return 'Each term is the sum of the two previous terms.';
    case 'increments':
      return `The steps grow by ${params.increment} each time.`;
  }
}
