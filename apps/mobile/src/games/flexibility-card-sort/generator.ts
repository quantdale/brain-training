/**
 * Deterministic round generation for the Card Sort game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Round content comes from a
 * per-round RNG fork (`round:<index>:...`) so reseeding one part of the
 * generator never reshuffles the rest.
 *
 * Generation invariants (validated per round by `validateRound` — the
 * generator self-checks and throws on violation):
 *
 *   1. Exactly ONE candidate matches the target under the ACTIVE rule.
 *   2. That correct candidate does NOT also match under the OTHER rule —
 *      the rule switch is only meaningful when the two rules disagree.
 *   3. No other candidate matches under the ACTIVE rule.
 *   4. All four candidates are distinct cards, and none equals the target.
 *   5. Consecutive rounds never reuse the same target card (bounded re-draws).
 *
 * Distractors are drawn from two pools: "tempting" cards that match the
 * target under the INACTIVE rule (the interference that makes rule switches
 * hard) and "neutral" cards that match under neither rule. Every step is
 * deterministic — the same seed always yields the same session.
 */
import type { Rng } from '@/sdk';

import type { Card, RuleId, ShapeId, ColorId } from './types';
import { SHAPES, CARD_COLORS, matchesUnder, otherRule } from './types';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_GENERATE_ATTEMPTS = 12;

/** Number of candidate cards per round (2×2 grid). */
export const CANDIDATE_COUNT = 4;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of every fork salt. */
  readonly roundIndex: number;
  /** Active classification rule — the correct candidate matches under this. */
  readonly rule: RuleId;
  readonly numShapes: number;
  readonly numColors: number;
  /** Previous round's target card, or null for round 0. */
  readonly prevTarget?: Card | null;
}

export interface GeneratedRound {
  readonly target: Card;
  readonly candidates: readonly Card[];
  readonly correctIndex: number;
  readonly rule: RuleId;
}

/** All (shape × color) cards in the active alphabet. */
export function cardAlphabet(numShapes: number, numColors: number): Card[] {
  const shapes = SHAPES.slice(0, numShapes) as readonly ShapeId[];
  const colors = CARD_COLORS.slice(0, numColors) as readonly ColorId[];
  const cards: Card[] = [];
  for (const shape of shapes) {
    for (const color of colors) {
      cards.push({ shape, color });
    }
  }
  return cards;
}

/**
 * Seed-derived choice of the session's first rule. Deterministic: the same
 * seed always opens with the same rule.
 */
export function pickInitialRule(rng: Rng): RuleId {
  return rng.fork('initial-rule').pick(['color', 'shape'] as const);
}

function sameCard(a: Card, b: Card): boolean {
  return a.shape === b.shape && a.color === b.color;
}

function cardKey(card: Card): string {
  return `${card.shape}:${card.color}`;
}

/** Cards in `pool` that satisfy `predicate` (fresh array each call). */
function poolWhere(pool: readonly Card[], predicate: (card: Card) => boolean): Card[] {
  return pool.filter(predicate);
}

/**
 * Pick an unused card from `pool`, re-drawing with a per-attempt fork salt up
 * to `attempts` times. Returns `null` when the pool has no unused cards, or a
 * deterministic fallback (the first unused card) when the budget is exhausted.
 */
function pickDistinct(
  rng: Rng,
  salt: string,
  pool: readonly Card[],
  used: readonly Card[],
  attempts: number,
): Card | null {
  const available = poolWhere(pool, (card) => !used.some((usedCard) => sameCard(usedCard, card)));
  if (available.length === 0) {
    return null;
  }
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = rng.fork(`${salt}:${attempt}`).pick(available);
    if (!used.some((usedCard) => sameCard(usedCard, candidate))) {
      return candidate;
    }
  }
  return available[0];
}

/**
 * Generate one round. See the module docs for the invariants; `validateRound`
 * runs at the end and throws if any invariant is violated (defense in depth —
 * the same check is exercised exhaustively in the generator tests).
 */
export function generateRound(input: GenerateRoundInput): GeneratedRound {
  const { rng, roundIndex, rule, numShapes, numColors } = input;
  const alphabet = cardAlphabet(numShapes, numColors);

  // Target: uniform over the alphabet, avoiding the previous round's target
  // (consecutive-target avoidance makes each round a fresh classification).
  let target = rng.fork(`round:${roundIndex}:target`).pick(alphabet);
  if (input.prevTarget !== undefined && input.prevTarget !== null) {
    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt += 1) {
      const candidate = rng.fork(`round:${roundIndex}:target:${attempt}`).pick(alphabet);
      if (!sameCard(candidate, input.prevTarget)) {
        target = candidate;
        break;
      }
    }
  }

  // Correct candidate: matches under the ACTIVE rule but NOT under the other
  // rule — i.e. it shares the active dimension with the target and differs in
  // the inactive dimension.
  const correctPool = poolWhere(
    alphabet,
    (card) => matchesUnder(rule, card, target) && !matchesUnder(otherRule(rule), card, target),
  );
  const used: Card[] = [];
  const correct = pickDistinct(
    rng,
    `round:${roundIndex}:correct`,
    correctPool,
    used,
    MAX_GENERATE_ATTEMPTS,
  );
  if (correct === null) {
    throw new Error(
      `flexibility-card-sort: no valid correct candidate for round ${roundIndex} (rule ${rule})`,
    );
  }
  used.push(correct);

  // Distractors: never match under the ACTIVE rule. Prefer "tempting" cards
  // that match under the inactive rule (they create the interference that
  // makes rule switches hard); fall back to neutral cards as needed.
  const temptingPool = poolWhere(
    alphabet,
    (card) => matchesUnder(otherRule(rule), card, target) && !matchesUnder(rule, card, target),
  );
  const neutralPool = poolWhere(
    alphabet,
    (card) => !matchesUnder(rule, card, target) && !matchesUnder(otherRule(rule), card, target),
  );
  const distractingPool = poolWhere(
    alphabet,
    (card) => !matchesUnder(rule, card, target),
  );
  const distractors: Card[] = [];
  for (let slot = 0; slot < CANDIDATE_COUNT - 1; slot += 1) {
    // Prefer one distractor pool (tempting or neutral, seeded), then the
    // other; the final fallback is any card that does not match the active
    // rule. The fallback never matches the active rule, so the round
    // invariants hold even for tiny alphabets.
    const preferTempting = rng.fork(`round:${roundIndex}:distractor:${slot}:tempting`).next() < 0.5;
    const pools = preferTempting ? [temptingPool, neutralPool] : [neutralPool, temptingPool];
    let card: Card | null = null;
    for (const pool of pools) {
      card = pickDistinct(
        rng,
        `round:${roundIndex}:distractor:${slot}`,
        pool,
        used,
        MAX_GENERATE_ATTEMPTS,
      );
      if (card !== null) {
        break;
      }
    }
    if (card === null) {
      card = pickDistinct(
        rng,
        `round:${roundIndex}:distractor:${slot}:fallback`,
        distractingPool,
        used,
        MAX_GENERATE_ATTEMPTS,
      );
    }
    if (card === null) {
      throw new Error(`flexibility-card-sort: could not draw distractor ${slot} for round ${roundIndex}`);
    }
    used.push(card);
    distractors.push(card);
  }

  // Shuffle the four candidates; locate the correct card afterwards.
  const candidates = rng.fork(`round:${roundIndex}:shuffle`).shuffle([correct, ...distractors]);
  const correctIndex = candidates.findIndex((card) => sameCard(card, correct));

  const round: GeneratedRound = { target, candidates, correctIndex, rule };
  const violations = validateRound(round, numShapes, numColors);
  if (violations.length > 0) {
    throw new Error(
      `flexibility-card-sort: generated round ${roundIndex} violates invariants: ${violations.join('; ')}`,
    );
  }
  return round;
}

/**
 * Validate the round invariants (see module docs). Returns the list of
 * violations (empty = valid). Exported for tests and used by the generator's
 * self-check.
 */
export function validateRound(round: GeneratedRound, numShapes: number, numColors: number): string[] {
  const violations: string[] = [];
  const { target, candidates, correctIndex, rule } = round;
  const alphabet = cardAlphabet(numShapes, numColors);

  const inAlphabet = (card: Card): boolean =>
    alphabet.some((known) => sameCard(known, card));

  if (candidates.length !== CANDIDATE_COUNT) {
    violations.push(`expected ${CANDIDATE_COUNT} candidates, got ${candidates.length}`);
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= candidates.length) {
    violations.push(`correctIndex ${correctIndex} out of range`);
  }
  if (!inAlphabet(target)) {
    violations.push('target is outside the active alphabet');
  }

  const distinct = new Set<string>();
  for (const card of candidates) {
    if (distinct.has(cardKey(card))) {
      violations.push(`duplicate candidate ${cardKey(card)}`);
    }
    distinct.add(cardKey(card));
    if (!inAlphabet(card)) {
      violations.push(`candidate ${cardKey(card)} is outside the active alphabet`);
    }
    if (sameCard(card, target)) {
      violations.push('target card appears among the candidates');
    }
  }

  const correctCard = candidates[correctIndex];
  for (let i = 0; i < candidates.length; i += 1) {
    const card = candidates[i];
    const matchesActive = matchesUnder(rule, card, target);
    const matchesOther = matchesUnder(otherRule(rule), card, target);
    if (i === correctIndex) {
      if (!matchesActive) {
        violations.push(`correct candidate ${cardKey(card)} does not match under ${rule}`);
      }
      if (matchesOther) {
        violations.push(`correct candidate ${cardKey(card)} also matches under ${otherRule(rule)}`);
      }
    } else if (matchesActive) {
      violations.push(`distractor ${cardKey(card)} matches under the active rule ${rule}`);
    } else if (correctCard !== undefined && matchesOther && sameCard(card, correctCard)) {
      // (unreachable guard) the correct card must never double as a distractor
      violations.push('correct card duplicated as distractor');
    }
  }
  return violations;
}
