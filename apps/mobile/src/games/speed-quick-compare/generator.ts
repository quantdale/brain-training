/**
 * Deterministic round generation for the Quick Compare game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round is generated from
 * a per-round RNG fork; every decision is unambiguous by construction:
 *
 *   - `same-different`: a === b when the round is a "same", and a !== b
 *     otherwise (re-drawn until distinct).
 *   - `magnitude`: a !== b (re-drawn until distinct), so "larger" is unique.
 *   - `sum-compare`: sum(left) !== sum(right) (re-drawn until distinct).
 *
 * Options are the canonical correct label plus filler labels that are never
 * correct (e.g. "Equal" when the sides are unequal); the option list is
 * shuffled and `correctIndex` records the position of the uniquely-correct
 * label. `validateRound` verifies the invariant for tests/diagnostics.
 */
import type { Rng } from '@/sdk';

import type {
  ComparePromptType,
  CompareSide,
  QuickCompareDifficultyParams,
  QuickCompareRound,
} from './types';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_ROUND_ATTEMPTS = 32;

/** Wrong-but-plausible filler options per prompt type (never the correct label). */
const FILLERS: Readonly<Record<ComparePromptType, readonly string[]>> = {
  'same-different': ['Unknown', 'Both'],
  magnitude: ['Equal', 'Neither', 'Tie'],
  'sum-compare': ['Equal', 'Neither', 'Tie'],
};

function single(n: number): CompareSide {
  return { kind: 'single', numbers: [n], display: String(n) };
}

function pair(a: number, b: number): CompareSide {
  return { kind: 'pair', numbers: [a, b], display: `${a} + ${b}` };
}

function sumOf(side: CompareSide): number {
  return side.numbers.reduce((acc, n) => acc + n, 0);
}

/** The uniquely-correct option label for a drawn round. */
function correctLabel(round: Omit<QuickCompareRound, 'optionLabels' | 'correctIndex'>): string {
  switch (round.promptType) {
    case 'same-different':
      return round.left.numbers[0] === round.right.numbers[0] ? 'Same' : 'Different';
    case 'magnitude':
      return round.left.numbers[0] > round.right.numbers[0] ? 'Left' : 'Right';
    case 'sum-compare':
      return sumOf(round.left) > sumOf(round.right) ? 'Left' : 'Right';
  }
}

/** Draw the two stimuli for one prompt type, enforcing the fairness invariant. */
function drawSides(
  rng: Rng,
  promptType: ComparePromptType,
  maxValue: number,
): { left: CompareSide; right: CompareSide; question: string } {
  if (promptType === 'same-different') {
    const a = rng.nextIntRange(0, maxValue + 1);
    const wantSame = rng.next() < 0.5;
    let b = rng.nextIntRange(0, maxValue + 1);
    let attempt = 0;
    while (b === a && attempt < MAX_ROUND_ATTEMPTS) {
      b = rng.nextIntRange(0, maxValue + 1);
      attempt += 1;
    }
    const right = wantSame ? a : b;
    return {
      left: single(a),
      right: single(right),
      question: 'Are the two values the same?',
    };
  }

  if (promptType === 'magnitude') {
    const a = rng.nextIntRange(1, maxValue + 1);
    let b = rng.nextIntRange(1, maxValue + 1);
    let attempt = 0;
    while (b === a && attempt < MAX_ROUND_ATTEMPTS) {
      b = rng.nextIntRange(1, maxValue + 1);
      attempt += 1;
    }
    return {
      left: single(a),
      right: single(b),
      question: 'Which side is larger?',
    };
  }

  // sum-compare
  const l1 = rng.nextIntRange(1, maxValue + 1);
  const l2 = rng.nextIntRange(1, maxValue + 1);
  let r1 = rng.nextIntRange(1, maxValue + 1);
  let r2 = rng.nextIntRange(1, maxValue + 1);
  let attempt = 0;
  while (l1 + l2 === r1 + r2 && attempt < MAX_ROUND_ATTEMPTS) {
    r1 = rng.nextIntRange(1, maxValue + 1);
    r2 = rng.nextIntRange(1, maxValue + 1);
    attempt += 1;
  }
  return {
    left: pair(l1, l2),
    right: pair(r1, r2),
    question: 'Which side sums to more?',
  };
}

/** Build one fully-validated round (options shuffled, correctIndex set). */
export function generateRound(
  rng: Rng,
  roundIndex: number,
  params: QuickCompareDifficultyParams,
): QuickCompareRound {
  const promptType = rng.fork(`round:${roundIndex}:type`).pick(params.promptTypes);
  const drawn = drawSides(rng.fork(`round:${roundIndex}:sides`), promptType, params.maxValue);
  const base: Omit<QuickCompareRound, 'optionLabels' | 'correctIndex'> = {
    promptType,
    question: drawn.question,
    left: drawn.left,
    right: drawn.right,
  };
  const label = correctLabel(base);
  const fillers = FILLERS[promptType].filter((f) => f !== label);
  const extra = fillers.slice(0, Math.max(0, params.optionCount - 1));
  const optionLabels = rng.fork(`round:${roundIndex}:options`).shuffle([label, ...extra]);
  const correctIndex = optionLabels.indexOf(label);
  return { ...base, optionLabels, correctIndex };
}

/** Convenience: the full deterministic round list for one session. */
export function generateSessionRounds(
  rng: Rng,
  params: QuickCompareDifficultyParams,
  rounds: number = params.rounds,
): QuickCompareRound[] {
  const list: QuickCompareRound[] = [];
  for (let i = 0; i < rounds; i += 1) {
    list.push(generateRound(rng, i, params));
  }
  return list;
}

export interface RoundValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

/**
 * Verify a round's invariant: the correct label appears exactly once among
 * the options at `correctIndex`, and no other option is also correct. Used by
 * tests and diagnostics; generation satisfies this, so a non-ok result means
 * a real regression.
 */
export function validateRound(round: QuickCompareRound): RoundValidation {
  const seen = new Set<string>();
  for (const label of round.optionLabels) {
    if (seen.has(label)) {
      return { ok: false, reason: `duplicate option label "${label}"` };
    }
    seen.add(label);
  }
  const expected = correctLabel(round);
  let count = 0;
  let foundAt = -1;
  round.optionLabels.forEach((label, index) => {
    if (label === expected) {
      count += 1;
      foundAt = index;
    }
  });
  if (count !== 1) {
    return {
      ok: false,
      reason: `expected exactly one correct option, found ${count} ("${expected}")`,
    };
  }
  if (foundAt !== round.correctIndex) {
    return {
      ok: false,
      reason: `correctIndex ${round.correctIndex} does not point at the correct option`,
    };
  }
  return { ok: true, reason: null };
}
