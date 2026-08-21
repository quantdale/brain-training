/**
 * Deterministic round (chain puzzle) generation for Word Chain.
 *
 * A session's seed is recorded with its result, so the session is reproducible
 * from `(RNG_ALGORITHM_VERSION, gameVersion, seed, difficulty, per-chain
 * outcomes)` per the SDK generator rule. Every random draw comes from a
 * per-round RNG fork (chain pick, blank selection, and option arrangement use
 * separate salts, so changing one never reshuffles the others).
 *
 * Uniqueness guarantee: the curated chain already satisfies the lexical rule
 * (each next word starts with the previous last letter). For every blank we
 * offer exactly one word that starts with the required letter — the chain's
 * own word — plus distractors drawn only from words that do NOT start with
 * that letter. Therefore exactly one option is a valid link and there is no
 * ambiguous "also-correct" distractor (see `validateGeneratedRound`).
 *
 * Near-duplicate avoidance: consecutive chains that share the same chain id
 * are confusable, so a candidate is re-drawn with an incremented attempt salt
 * until it passes (or the bounded budget is exhausted).
 */
import type { Rng } from "@/sdk";

import type { ChainItem, Tier } from "./content-validation";
import type {
  ChainStep,
  WordChainDifficultyParams,
  WordChainRound,
} from "./types";

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_GENERATION_ATTEMPTS = 12;

function lastLetter(word: string): string {
  return word[word.length - 1];
}

/** Filter a pack's chains down to the given tiers (stable pack order). */
export function filterByTiers(
  chains: readonly ChainItem[],
  tiers: readonly Tier[],
): ChainItem[] {
  const allowed = new Set(tiers);
  return chains.filter((chain) => allowed.has(chain.tier));
}

/** Filter a pack's chains to those whose length is within [min, max]. */
export function filterByLength(
  chains: readonly ChainItem[],
  min: number,
  max: number,
): ChainItem[] {
  return chains.filter(
    (chain) => chain.words.length >= min && chain.words.length <= max,
  );
}

/** True when round `a` is confusable with round `b` (same chain id). */
export function isNearDuplicateRound(
  a: WordChainRound,
  b: WordChainRound | null,
): boolean {
  if (b === null) {
    return false;
  }
  return a.chainId === b.chainId;
}

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salts. */
  readonly roundIndex: number;
  /** Eligible chains for this round (difficulty tier + length selection). */
  readonly pool: readonly ChainItem[];
  /** Words used only as distractors (disjoint from every chain word). */
  readonly decoyPool: readonly string[];
  /** Resolved difficulty tuning (blank count + options per step). */
  readonly params: WordChainDifficultyParams;
  /** Chain ids already used this session (never reused). */
  readonly usedChainIds: ReadonlySet<string>;
  /** Previous round's selection, or null for round 0. */
  readonly previousRound: WordChainRound | null;
}

/** Build the answer options for one blank (exactly one valid link). */
function buildOptions(
  fork: Rng,
  correctWord: string,
  requiredFirstLetter: string,
  decoyPool: readonly string[],
  optionsPerStep: number,
): { options: string[]; correctIndex: number } {
  // Distractors must not equal the answer and must NOT start with the required
  // letter, so none of them is a valid lexical link.
  const distractors = fork
    .shuffle(decoyPool)
    .filter((d) => d !== correctWord && d[0] !== requiredFirstLetter)
    .slice(0, Math.max(0, optionsPerStep - 1));
  const options = fork.shuffle([correctWord, ...distractors]);
  return { options, correctIndex: options.indexOf(correctWord) };
}

function drawCandidate(
  rng: Rng,
  roundIndex: number,
  attempt: number,
  pool: readonly ChainItem[],
  decoyPool: readonly string[],
  params: WordChainDifficultyParams,
  usedChainIds: ReadonlySet<string>,
  previousRound: WordChainRound | null,
  allowNearDuplicate = false,
): WordChainRound {
  const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
  const eligible = pool.filter((chain) => !usedChainIds.has(chain.id));
  // Pool exhaustion fallback: deterministic reuse rather than a stuck round.
  const source = eligible.length > 0 ? eligible : pool;
  const chain = fork.pick(source);

  if (
    !allowNearDuplicate &&
    previousRound !== null &&
    previousRound.chainId === chain.id
  ) {
    // Near-duplicate: signal the caller to re-draw with the next attempt.
    throw new NearDuplicateError();
  }

  const length = chain.words.length;
  const maxBlanks = Math.max(1, Math.min(params.maxBlanks, length - 1));
  const minBlanks = Math.min(params.minBlanks, maxBlanks);
  const blankCount = fork.nextIntRange(minBlanks, maxBlanks + 1);

  // Choose `blankCount` distinct positions from {1..length-1} (position 0 is
  // always the revealed anchor), then sort ascending so steps fill in order.
  const candidatePositions = Array.from(
    { length: length - 1 },
    (_, i) => i + 1,
  );
  const blankPositions = fork
    .shuffle(candidatePositions)
    .slice(0, blankCount)
    .sort((a, b) => a - b);
  const blankSet = new Set(blankPositions);

  const fixed: boolean[] = chain.words.map((_, i) => !blankSet.has(i));

  const steps: ChainStep[] = blankPositions.map((position) => {
    const requiredFirstLetter = lastLetter(chain.words[position - 1]);
    const correctWord = chain.words[position];
    const { options, correctIndex } = buildOptions(
      fork.fork(`step:${position}`),
      correctWord,
      requiredFirstLetter,
      decoyPool,
      params.optionsPerStep,
    );
    return {
      position,
      requiredFirstLetter,
      options,
      correctIndex,
      correctWord,
    };
  });

  return {
    chainId: chain.id,
    tier: chain.tier,
    words: chain.words,
    fixed: Object.freeze(fixed),
    blankCount,
    steps: Object.freeze(steps),
  };
}

/** Internal signal used to retry on a near-duplicate chain pick. */
class NearDuplicateError extends Error {}

/** Deterministically select one round; same seed → same round. */
export function generateRound(input: GenerateRoundInput): WordChainRound {
  const {
    rng,
    roundIndex,
    pool,
    decoyPool,
    params,
    usedChainIds,
    previousRound,
  } = input;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      return drawCandidate(
        rng,
        roundIndex,
        attempt,
        pool,
        decoyPool,
        params,
        usedChainIds,
        previousRound,
      );
    } catch (error) {
      if (error instanceof NearDuplicateError) {
        continue;
      }
      throw error;
    }
  }
  // Extremely unlikely fallback: deterministically accept a near-duplicate
  // (same fork salt as the last failed attempt, but the duplicate check is
  // suppressed so a degenerate single-chain pool can never crash generation).
  return drawCandidate(
    rng,
    roundIndex,
    MAX_GENERATION_ATTEMPTS - 1,
    pool,
    decoyPool,
    params,
    usedChainIds,
    previousRound,
    true,
  );
}

/**
 * Validate a generated round: every step has exactly one option that starts
 * with the required letter (and it equals the correct word), no distractor
 * starts with that letter (so the solution is unique), and the fixed mask
 * matches the step positions.
 */
export function validateGeneratedRound(round: WordChainRound): boolean {
  if (round.steps.length === 0 || round.blankCount !== round.steps.length) {
    return false;
  }
  const blankSet = new Set(round.steps.map((step) => step.position));
  for (let i = 0; i < round.words.length; i += 1) {
    if (round.fixed[i] === blankSet.has(i)) {
      return false;
    }
  }
  for (const step of round.steps) {
    if (step.position < 1 || step.position >= round.words.length) {
      return false;
    }
    if (
      lastLetter(round.words[step.position - 1]) !== step.requiredFirstLetter
    ) {
      return false;
    }
    if (step.correctWord !== round.words[step.position]) {
      return false;
    }
    if (!step.options.includes(step.correctWord)) {
      return false;
    }
    let validCount = 0;
    for (const option of step.options) {
      if (option[0] === step.requiredFirstLetter) {
        validCount += 1;
      }
    }
    // Exactly one valid link → unambiguous unique solution.
    if (validCount !== 1) {
      return false;
    }
    if (step.options[step.correctIndex] !== step.correctWord) {
      return false;
    }
  }
  return true;
}
