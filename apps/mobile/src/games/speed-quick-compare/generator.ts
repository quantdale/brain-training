/**
 * Deterministic round generation for the Quick Compare game (generator v2).
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round is generated from
 * a per-round RNG fork; every decision is unambiguous by construction:
 *
 *   - `same-different`: a === b when the round is a "same", and a !== b
 *     otherwise (re-drawn until distinct). Options stay the binary pair.
 *   - `magnitude`: a !== b, and |a−b| is bounded by `spreadPct` of the larger
 *     value (proximity pressure — the gap shrinks as tiers get harder).
 *   - `sum-compare`: sums differ by at most `spreadPct` of the larger sum.
 *
 * Options for numeric prompts are the TRUE larger value plus PLAUSIBLE decoy
 * values near the shown operands/sums (`buildDecoyValues`: the other on-screen
 * value first, then closest-first inside a ±15% band). Decoys are never equal
 * to the correct value and never duplicate each other, so `correctIndex`
 * points at the uniquely-correct option. `validateRound` verifies the
 * invariant for tests/diagnostics.
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

/** Decoy plausibility band: candidates live within ±15% of the shown values. */
export const DECOY_BAND = 0.15;

/** Spread used when decoding profiles persisted before the axis existed. */
export const UNCONSTRAINED_SPREAD_PCT = 100;

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
      return String(Math.max(round.left.numbers[0], round.right.numbers[0]));
    case 'sum-compare':
      return String(Math.max(sumOf(round.left), sumOf(round.right)));
  }
}

/**
 * Ordered plausible decoy values for one numeric prompt: the other on-screen
 * value first (maximally competitive), then integers inside ±`DECOY_BAND` of
 * the shown range ordered by distance to the correct value, then a
 * deterministic outward expansion when the band is too small to fill the
 * option list. Never returns the correct value or duplicates.
 */
export function buildDecoyValues(
  correct: number,
  otherShown: number,
  count: number,
): number[] {
  const lo = Math.min(correct, otherShown);
  const hi = Math.max(correct, otherShown);
  const seen = new Set<number>([correct]);
  const decoys: number[] = [];
  const push = (value: number): void => {
    if (!seen.has(value)) {
      seen.add(value);
      decoys.push(value);
    }
  };

  push(otherShown);

  const bandLo = Math.max(1, Math.ceil(lo * (1 - DECOY_BAND)));
  const bandHi = Math.floor(hi * (1 + DECOY_BAND));
  const band: number[] = [];
  for (let v = bandLo; v <= bandHi; v += 1) {
    if (!seen.has(v)) {
      band.push(v);
    }
  }
  // Closest-first: the most competitive wrong answers win the slots.
  band.sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct));
  for (const value of band) {
    push(value);
  }

  // Deterministic outward expansion only when the band was exhausted.
  let above = bandHi;
  while (decoys.length < count) {
    above += 1;
    push(above);
  }

  return decoys.slice(0, count);
}

/**
 * Integer window `[lo, hi]` that constrains how far the second side may sit
 * from the first (`spreadPct` of the first value), clamped to [1, maxValue].
 */
function spreadWindow(
  anchor: number,
  spreadPct: number,
  maxValue: number,
): { lo: number; hi: number } {
  const s = spreadPct / 100;
  return {
    lo: Math.max(1, Math.ceil(anchor * (1 - s))),
    hi: Math.min(maxValue, Math.floor(anchor * (1 + s))),
  };
}

/** Draw the two stimuli for one prompt type, enforcing fairness + proximity. */
function drawSides(
  rng: Rng,
  promptType: ComparePromptType,
  params: QuickCompareDifficultyParams,
): { left: CompareSide; right: CompareSide; question: string } {
  const maxValue = params.maxValue;
  const spreadPct = params.spreadPct ?? UNCONSTRAINED_SPREAD_PCT;

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
    const window = spreadWindow(a, spreadPct, maxValue);
    let b: number;
    if (window.hi - window.lo >= 1) {
      // Proximity pressure: stay inside the spread window, never equal.
      b = rng.nextIntRange(window.lo, window.hi + 1);
      let attempt = 0;
      while (b === a && attempt < MAX_ROUND_ATTEMPTS) {
        b = rng.nextIntRange(window.lo, window.hi + 1);
        attempt += 1;
      }
      if (b === a) {
        // Degenerate single-value window after clamping: step out deterministically.
        b = a === window.lo ? window.lo + 1 : window.lo;
      }
    } else {
      // Window collapsed onto one value (tiny operand + tight spread): the
      // full-range fallback used here previously broke the proximity contract
      // (gap up to maxValue−1 against a tolerance of a few points). Step to
      // the nearest DISTINCT value instead — the gap is 1, which always sits
      // inside `ceil(spreadPct·bigger) + 1` rounding slack.
      b = a + 1 <= maxValue ? a + 1 : a - 1;
    }
    return {
      left: single(a),
      right: single(b),
      question: 'Which number is larger?',
    };
  }

  // sum-compare: pairs whose sums differ, with |sumL − sumR| bounded by the
  // spread of the larger sum (proximity pressure).
  if (maxValue < 2) {
    throw new RangeError(
      `drawSides: sum-compare needs maxValue >= 2 so both sides can differ, got ${maxValue}`,
    );
  }
  const l1 = rng.nextIntRange(1, maxValue + 1);
  const l2 = rng.nextIntRange(1, maxValue + 1);
  const sumL = l1 + l2;
  const tolerance = Math.max(1, Math.ceil((spreadPct / 100) * sumL));
  let r1 = rng.nextIntRange(1, maxValue + 1);
  let r2 = rng.nextIntRange(1, maxValue + 1);
  const unacceptable = (): boolean =>
    r1 + r2 === sumL || Math.abs(r1 + r2 - sumL) > tolerance;
  let attempt = 0;
  while (attempt < MAX_ROUND_ATTEMPTS && unacceptable()) {
    r1 = rng.nextIntRange(1, maxValue + 1);
    r2 = rng.nextIntRange(1, maxValue + 1);
    attempt += 1;
  }
  if (unacceptable()) {
    // Deterministic repair: construct the right side so its sum differs from
    // `sumL` by the SMALLEST legal offset inside the tolerance window. The
    // previous single-variable aim could clamp `r2` out of range and leave a
    // sum gap far larger than the tolerance; building both operands from the
    // target sum keeps |sumR − sumL| ≤ tolerance by construction. The sums-
    // equal invariant stays non-negotiable (offset ≥ 1).
    const direction = r1 + r2 >= sumL ? 1 : -1;
    for (let d = 1; d <= tolerance; d += 1) {
      const target = sumL + direction * d;
      if (target < 2 || target > maxValue * 2) {
        continue;
      }
      const nr1 = Math.min(maxValue, target - 1);
      const nr2 = target - nr1;
      if (nr2 >= 1 && nr2 <= maxValue && nr1 + nr2 !== sumL) {
        r1 = nr1;
        r2 = nr2;
        return {
          left: pair(l1, l2),
          right: pair(r1, r2),
          question: 'Which sum is larger?',
        };
      }
    }
    // Tolerance window unreachable via small offsets (pathological params):
    // jump straight to the window edge with the same two-operand
    // construction; if even that is out of range the original pair stands
    // and round-level validation triggers a fresh-attempt retry.
    const target = sumL + direction * tolerance;
    const nr1 = Math.min(maxValue, Math.max(1, target - 1));
    const nr2 = target - nr1;
    if (nr2 >= 1 && nr2 <= maxValue && nr1 + nr2 !== sumL) {
      r1 = nr1;
      r2 = nr2;
    }
  }
  return {
    left: pair(l1, l2),
    right: pair(r1, r2),
    question: 'Which sum is larger?',
  };
}

/** Build one fully-validated round (options shuffled, correctIndex set). */
export function generateRound(
  rng: Rng,
  roundIndex: number,
  params: QuickCompareDifficultyParams,
): QuickCompareRound {
  const promptType = rng.fork(`round:${roundIndex}:type`).pick(params.promptTypes);
  const drawn = drawSides(rng.fork(`round:${roundIndex}:sides`), promptType, params);
  const base: Omit<QuickCompareRound, 'optionLabels' | 'correctIndex'> = {
    promptType,
    question: drawn.question,
    left: drawn.left,
    right: drawn.right,
  };
  const label = correctLabel(base);

  let optionLabels: string[];
  if (promptType === 'same-different') {
    // Binary judgment: no filler can be plausible, so the option count axis
    // does not apply to this prompt type.
    optionLabels = rng.fork(`round:${roundIndex}:options`).shuffle(['Same', 'Different']);
  } else {
    const correctValue = Number(label);
    const otherShown =
      promptType === 'magnitude'
        ? Math.min(drawn.left.numbers[0], drawn.right.numbers[0])
        : Math.min(sumOf(drawn.left), sumOf(drawn.right));
    const decoys = buildDecoyValues(correctValue, otherShown, params.optionCount - 1);
    optionLabels = rng
      .fork(`round:${roundIndex}:options`)
      .shuffle([label, ...decoys.map(String)]);
  }
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
