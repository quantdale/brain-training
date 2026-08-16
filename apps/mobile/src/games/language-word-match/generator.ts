/**
 * Deterministic round selection for Word Match.
 *
 * A session's seed is recorded with its result, so the session is reproducible
 * from `(RNG_ALGORITHM_VERSION, gameVersion, seed, difficulty, per-round
 * outcomes)` per the SDK generator rule. Every random draw comes from a
 * per-round RNG fork (item pick and option arrangement use separate salts, so
 * changing one never reshuffles the other).
 *
 * Rules:
 * - Items are drawn from the round's pool (difficulty tier selection, see
 *   difficulty.ts) without replacement, so a prompt never repeats within a
 *   session (fallback to the full pool only when the pool is exhausted —
 *   deterministic and documented).
 * - Options are a seeded shuffle of the item's four words; the correct word
 *   keeps its identity and the new index is derived, never re-rolled.
 * - Near-duplicate avoidance: consecutive rounds that share the same prompt
 *   or the same correct word are confusable, so a candidate is re-drawn with
 *   an incremented attempt salt until it passes `isNearDuplicateRound` (or the
 *   bounded budget is exhausted).
 */
import type { Rng } from '@/sdk';

import type { PackItem, Tier } from './content-validation';
import type { LanguageRound } from './types';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_SELECTION_ATTEMPTS = 12;

/** Filter a pack's items down to the given tiers (stable pack order). */
export function filterByTiers(items: readonly PackItem[], tiers: readonly Tier[]): PackItem[] {
  const allowed = new Set(tiers);
  return items.filter((item) => allowed.has(item.tier));
}

/** True when round `a` is confusable with round `b` (too similar). */
export function isNearDuplicateRound(a: LanguageRound, b: LanguageRound | null): boolean {
  if (b === null) {
    return false;
  }
  return a.prompt === b.prompt || a.correctWord === b.correctWord;
}

export interface SelectRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salts. */
  readonly roundIndex: number;
  /** Eligible items for this round (difficulty tier selection). */
  readonly pool: readonly PackItem[];
  /** Item ids already used this session (never reused). */
  readonly usedItemIds: ReadonlySet<string>;
  /** Previous round's selection, or null for round 0. */
  readonly previousRound: LanguageRound | null;
}

function drawCandidate(
  rng: Rng,
  roundIndex: number,
  attempt: number,
  pool: readonly PackItem[],
  usedItemIds: ReadonlySet<string>,
): LanguageRound {
  const eligible = pool.filter((item) => !usedItemIds.has(item.id));
  // Pool exhaustion fallback: deterministic reuse rather than a stuck round.
  const source = eligible.length > 0 ? eligible : pool;
  const item = rng.fork(`round:${roundIndex}:attempt:${attempt}`).pick(source);
  const options = rng.fork(`round:${roundIndex}:attempt:${attempt}:options`).shuffle(item.options);
  const correctWord = item.options[item.correctIndex];
  return {
    itemId: item.id,
    prompt: item.prompt,
    options,
    correctIndex: options.indexOf(correctWord),
    correctWord,
    tier: item.tier,
    family: item.family,
  };
}

/** Deterministically select one round; same seed → same round. */
export function selectRound(input: SelectRoundInput): LanguageRound {
  const { rng, roundIndex, pool, usedItemIds, previousRound } = input;
  for (let attempt = 0; attempt < MAX_SELECTION_ATTEMPTS; attempt += 1) {
    const candidate = drawCandidate(rng, roundIndex, attempt, pool, usedItemIds);
    if (!isNearDuplicateRound(candidate, previousRound)) {
      return candidate;
    }
  }
  // Extremely unlikely fallback: deterministically accept the last candidate.
  return drawCandidate(rng, roundIndex, MAX_SELECTION_ATTEMPTS - 1, pool, usedItemIds);
}
