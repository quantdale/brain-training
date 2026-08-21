import type { Rng } from '@/sdk';

import type { PackItem, Tier } from './content-validation';
import type { ContextFitRound } from './types';

export const MAX_SELECTION_ATTEMPTS = 12;

export function filterByTiers(items: readonly PackItem[], tiers: readonly Tier[]): PackItem[] {
  const allowed = new Set(tiers);
  return items.filter((item) => allowed.has(item.tier));
}

export function isNearDuplicateRound(a: ContextFitRound, b: ContextFitRound | null): boolean {
  if (b === null) return false;
  return a.context === b.context;
}

export interface SelectRoundInput {
  readonly rng: Rng;
  readonly roundIndex: number;
  readonly pool: readonly PackItem[];
  readonly usedItemIds: ReadonlySet<string>;
  readonly previousRound: ContextFitRound | null;
}

function drawCandidate(
  rng: Rng,
  roundIndex: number,
  attempt: number,
  pool: readonly PackItem[],
  usedItemIds: ReadonlySet<string>,
): ContextFitRound {
  const eligible = pool.filter((item) => !usedItemIds.has(item.id));
  const source = eligible.length > 0 ? eligible : pool;
  const item = rng.fork(`round:${roundIndex}:attempt:${attempt}`).pick(source);
  const options = rng.fork(`round:${roundIndex}:attempt:${attempt}:options`).shuffle([item.answer, ...item.distractors]);
  return {
    itemId: item.id,
    context: item.context,
    options,
    correctIndex: options.indexOf(item.answer),
    correctWord: item.answer,
    tier: item.tier,
  };
}

export function validateRound(round: ContextFitRound): boolean {
  if (round.options.length !== 4) return false;
  if (round.options.indexOf(round.correctWord) !== round.correctIndex) return false;
  if (new Set(round.options.map((o) => o.toLowerCase())).size !== round.options.length) return false;
  return round.options[round.correctIndex] === round.correctWord;
}

export function selectRound(input: SelectRoundInput): ContextFitRound {
  const { rng, roundIndex, pool, usedItemIds, previousRound } = input;
  let last: ContextFitRound | null = null;
  for (let attempt = 0; attempt < MAX_SELECTION_ATTEMPTS; attempt += 1) {
    const candidate = drawCandidate(rng, roundIndex, attempt, pool, usedItemIds);
    last = candidate;
    if (!isNearDuplicateRound(candidate, previousRound)) return candidate;
  }
  return last as ContextFitRound;
}
