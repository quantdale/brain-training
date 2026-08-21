/**
 * Deterministic round/block generation for the Rule Flip game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. The whole plan is built up
 * front by `generateSession` (so the reducer can store it, QA force paths can
 * count switches accurately, and the block sequence is fixed). Round content
 * comes from a per-round RNG fork (`round:<index>:...`) so reseeding one part
 * of the generator never reshuffles the rest.
 *
 * Block model. The session is a sequence of BLOCKS; within each block every
 * trial shares the same classification rule. At each block boundary we decide
 * (with probability `flipRate`) whether the rule flips to a different rule or
 * stays. The first trial of a block whose rule differs from the previous
 * block's rule is a SWITCH trial; all other trials are REPEAT trials. The
 * generation guarantees at least one switch block when `flipRate > 0` and the
 * round count permits more than one block.
 *
 * Generation invariants (validated per round by `validateRound` — the
 * generator self-checks and throws on violation):
 *
 *   1. Exactly ONE candidate matches the target under the ACTIVE rule.
 *   2. That correct candidate does NOT match under EITHER of the OTHER two
 *      rules — the cue is only meaningful when the three rules disagree.
 *   3. No other candidate matches under the ACTIVE rule.
 *   4. All candidates are distinct cards, and none equals the target.
 *   5. Every card is within the active alphabet (shape × color × number).
 *
 * Distractors are drawn from two pools: "lure" cards that match the target
 * under one of the OTHER rules (the interference that makes flips hard) and
 * "neutral" cards that match under none of the rules. Every step is
 * deterministic — the same seed always yields the same session.
 */
import type { Rng } from '@/sdk';
import { createRng } from '@/sdk';

import { nextBlockRule } from './difficulty';
import { CARD_COLORS, SHAPES, matchesUnder, otherRules } from './types';
import type {
  Card,
  FlexibilityRuleFlipDifficultyParams,
  GeneratedRound,
  RuleId,
  ShapeId,
  ColorId,
} from './types';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_GENERATE_ATTEMPTS = 12;

/** Number of candidate cards per round. */
export const CANDIDATE_COUNT = 4;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of every fork salt. */
  readonly roundIndex: number;
  /** Active classification rule for this block — the correct candidate matches under this. */
  readonly rule: RuleId;
  /** True when this trial is the first trial of a block whose rule differs from the previous block's rule. */
  readonly isSwitch: boolean;
  readonly numShapes: number;
  readonly numColors: number;
  readonly numNumbers: number;
  /** Previous round's target card, or null for round 0. */
  readonly prevTarget?: Card | null;
}

/** All (shape × color × number) cards in the active alphabet. */
export function cardAlphabet(numShapes: number, numColors: number, numNumbers: number): Card[] {
  const shapes = SHAPES.slice(0, numShapes) as readonly ShapeId[];
  const colors = CARD_COLORS.slice(0, numColors) as readonly ColorId[];
  const cards: Card[] = [];
  for (const shape of shapes) {
    for (const color of colors) {
      for (let number = 1; number <= numNumbers; number += 1) {
        cards.push({ shape, color, number });
      }
    }
  }
  return cards;
}

/**
 * Seed-derived choice of the session's first rule. Deterministic: the same
 * seed always opens with the same rule.
 */
export function pickInitialRule(rng: Rng, rulesPool: readonly RuleId[]): RuleId {
  return rng.fork('initial-rule').pick(rulesPool);
}

/** Pick a rule from `rulesPool` that differs from `prevRule` (deterministic). */
export function pickDifferentRule(rng: Rng, rulesPool: readonly RuleId[], prevRule: RuleId): RuleId {
  const others = rulesPool.filter((r) => r !== prevRule);
  return rng.fork('different-rule').pick(others);
}

function sameCard(a: Card, b: Card): boolean {
  return a.shape === b.shape && a.color === b.color && a.number === b.number;
}

function cardKey(card: Card): string {
  return `${card.shape}:${card.color}:${card.number}`;
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
  const { rng, roundIndex, rule, isSwitch, numShapes, numColors, numNumbers } = input;
  const alphabet = cardAlphabet(numShapes, numColors, numNumbers);

  // Target: uniform over the alphabet, avoiding the previous round's target
  // (consecutive-target avoidance makes each trial a fresh classification).
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

  const others = otherRules(rule);

  // Correct candidate: matches under the ACTIVE rule but NOT under EITHER of
  // the other rules — i.e. it shares exactly one relevant dimension with the
  // target and differs in the others. This keeps the cue unambiguous.
  const correctPool = poolWhere(
    alphabet,
    (card) =>
      matchesUnder(rule, card, target) && others.every((r) => !matchesUnder(r, card, target)),
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
      `flexibility-rule-flip: no valid correct candidate for round ${roundIndex} (rule ${rule})`,
    );
  }
  used.push(correct);

  // Distractors: never match under the ACTIVE rule. Prefer "lure" cards that
  // match under one of the OTHER rules (interference that makes flips hard);
  // fall back to neutral cards as needed, then any non-active card.
  const lurePool = poolWhere(
    alphabet,
    (card) => !matchesUnder(rule, card, target) && others.some((r) => matchesUnder(r, card, target)),
  );
  const neutralPool = poolWhere(
    alphabet,
    (card) =>
      !matchesUnder(rule, card, target) && others.every((r) => !matchesUnder(r, card, target)),
  );
  const distractingPool = poolWhere(alphabet, (card) => !matchesUnder(rule, card, target));

  const distractors: Card[] = [];
  for (let slot = 0; slot < CANDIDATE_COUNT - 1; slot += 1) {
    const preferLure = rng.fork(`round:${roundIndex}:distractor:${slot}:lure`).next() < 0.5;
    const pools = preferLure ? [lurePool, neutralPool] : [neutralPool, lurePool];
    let card: Card | null = null;
    for (const pool of pools) {
      card = pickDistinct(rng, `round:${roundIndex}:distractor:${slot}`, pool, used, MAX_GENERATE_ATTEMPTS);
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
      throw new Error(`flexibility-rule-flip: could not draw distractor ${slot} for round ${roundIndex}`);
    }
    used.push(card);
    distractors.push(card);
  }

  // Shuffle the four candidates; locate the correct card afterwards.
  const candidates = rng.fork(`round:${roundIndex}:shuffle`).shuffle([correct, ...distractors]);
  const correctIndex = candidates.findIndex((card) => sameCard(card, correct));

  const round: GeneratedRound = { target, candidates, correctIndex, rule, isSwitch };
  const violations = validateRound(round, numShapes, numColors, numNumbers);
  if (violations.length > 0) {
    throw new Error(
      `flexibility-rule-flip: generated round ${roundIndex} violates invariants: ${violations.join('; ')}`,
    );
  }
  return round;
}

/**
 * Validate the round invariants (see module docs). Returns the list of
 * violations (empty = valid). Exported for tests and used by the generator's
 * self-check.
 */
export function validateRound(
  round: GeneratedRound,
  numShapes: number,
  numColors: number,
  numNumbers: number,
): string[] {
  const violations: string[] = [];
  const { target, candidates, correctIndex, rule } = round;
  const alphabet = cardAlphabet(numShapes, numColors, numNumbers);

  const inAlphabet = (card: Card): boolean => alphabet.some((known) => sameCard(known, card));

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

  const others = otherRules(rule);
  for (let i = 0; i < candidates.length; i += 1) {
    const card = candidates[i];
    const matchesActive = matchesUnder(rule, card, target);
    if (i === correctIndex) {
      if (!matchesActive) {
        violations.push(`correct candidate ${cardKey(card)} does not match under ${rule}`);
      }
      const matchesOther = others.some((r) => matchesUnder(r, card, target));
      if (matchesOther) {
        violations.push(`correct candidate ${cardKey(card)} also matches under another rule`);
      }
    } else if (matchesActive) {
      violations.push(`distractor ${cardKey(card)} matches under the active rule ${rule}`);
    }
  }
  return violations;
}

/** One block in the generated plan: its rule and its length (trial count). */
interface BlockSpec {
  readonly rule: RuleId;
  readonly length: number;
}

/**
 * Choose a block length in [blockMin, blockMax], capped by `remaining` rounds.
 *
 * The fork salt MUST be scoped by `blockIndex`: `Rng.fork(salt)` derives the
 * child stream from the parent's canonical seed string alone (parent
 * consumption does not advance it), so a constant salt would give every block
 * of a session the identical length.
 */
function chooseBlockLength(
  rng: Rng,
  blockIndex: number,
  params: FlexibilityRuleFlipDifficultyParams,
  remaining: number,
): number {
  const max = Math.max(1, Math.min(params.blockMax, remaining));
  const min = Math.max(1, Math.min(params.blockMin, max));
  if (max <= min) {
    return max;
  }
  // rng.nextInt is exclusive on the upper bound.
  return min + rng.fork(`block-len:${blockIndex}`).nextInt(max - min + 1);
}

/** Decide the full block structure (rules + lengths) deterministically. */
function planBlocks(rng: Rng, params: FlexibilityRuleFlipDifficultyParams): BlockSpec[] {
  const blocks: BlockSpec[] = [];
  let prevRule: RuleId | null = null;
  let totalTrials = 0;

  while (totalTrials < params.rounds) {
    const remaining = params.rounds - totalTrials;
    const rule: RuleId =
      prevRule === null
        ? pickInitialRule(rng, params.rulesPool)
        : nextBlockRule(rng, prevRule, params.flipRate, params.rulesPool);
    const length = chooseBlockLength(rng, blocks.length, params, remaining);
    blocks.push({ rule, length });
    totalTrials += length;
    prevRule = rule;
  }

  // Guarantee at least one switch block when flipRate > 0 and rounds permit a
  // second block. With >= 2 blocks but zero flips, force the second block to a
  // different rule from the first (deterministic). Generation of the round
  // content happens afterwards via block-specific forks, so flipping the rule
  // here does not disturb the rest of the plan's randomness.
  if (params.flipRate > 0 && blocks.length >= 2 && !blocks.some((b, i) => i > 0 && b.rule !== blocks[i - 1].rule)) {
    const newRule = pickDifferentRule(rng, params.rulesPool, blocks[0].rule);
    blocks[1] = { ...blocks[1], rule: newRule };
  }

  return blocks;
}

/**
 * Build the full deterministic session plan: a sequence of blocks, each with a
 * constant rule, then the round content for every trial. `isSwitch` is true
 * only for the first trial of a block whose rule differs from the previous
 * block's rule. Every round is validated inside `generateRound`.
 */
export function generateSession(
  seed: string,
  params: FlexibilityRuleFlipDifficultyParams,
): GeneratedRound[] {
  const rng = createRng(seed);
  const blocks = planBlocks(rng, params);
  const rounds: GeneratedRound[] = [];
  let prevTarget: Card | null = null;

  for (let b = 0; b < blocks.length; b += 1) {
    const block = blocks[b];
    const isSwitchBlock = b > 0 && block.rule !== blocks[b - 1].rule;
    const blockRng = rng.fork(`block:${b}`);
    for (let t = 0; t < block.length; t += 1) {
      const isSwitch = isSwitchBlock && t === 0;
      const round = generateRound({
        rng: blockRng.fork(`trial:${t}`),
        roundIndex: rounds.length,
        rule: block.rule,
        isSwitch,
        numShapes: params.numShapes,
        numColors: params.numColors,
        numNumbers: params.numNumbers,
        prevTarget,
      });
      rounds.push(round);
      prevTarget = round.target;
    }
  }
  return rounds;
}
