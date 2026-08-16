// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { loadContentPack } from '../content-validation';
import type { PackItem } from '../content-validation';
import {
  MAX_SELECTION_ATTEMPTS,
  filterByTiers,
  isNearDuplicateRound,
  selectRound,
} from '../generator';
import type { LanguageRound } from '../types';

const PACK = loadContentPack();

/** Draw a full fixed-level-style session from a pool, tracking used items. */
function buildSessionRounds(
  seed: string,
  pool: readonly PackItem[],
  rounds: number,
): LanguageRound[] {
  const rng = createRng(seed);
  const used = new Set<string>();
  let previous: LanguageRound | null = null;
  const out: LanguageRound[] = [];
  for (let index = 0; index < rounds; index += 1) {
    const round = selectRound({ rng, roundIndex: index, pool, usedItemIds: used, previousRound: previous });
    used.add(round.itemId);
    previous = round;
    out.push(round);
  }
  return out;
}

describe('filterByTiers', () => {
  it('keeps only the requested tiers in stable pack order', () => {
    const t1 = filterByTiers(PACK.items, ['t1']);
    expect(t1.length).toBeGreaterThan(0);
    for (const item of t1) {
      expect(item.tier).toBe('t1');
    }
    const mixed = filterByTiers(PACK.items, ['t1', 't3']);
    expect(mixed.filter((item) => item.tier === 't2')).toHaveLength(0);
    expect(mixed.length).toBe(filterByTiers(PACK.items, ['t1']).length + filterByTiers(PACK.items, ['t3']).length);
  });
});

describe('selectRound', () => {
  it('is deterministic: same seed reproduces the same session', () => {
    const pool = filterByTiers(PACK.items, ['t1', 't2']);
    expect(buildSessionRounds('seed-42', pool, 6)).toEqual(buildSessionRounds('seed-42', pool, 6));
  });

  it('produces different sessions for different seeds', () => {
    const pool = filterByTiers(PACK.items, ['t1', 't2']);
    const a = buildSessionRounds('seed-a', pool, 6);
    const b = buildSessionRounds('seed-b', pool, 6);
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('never repeats an item within a session', () => {
    const pool = filterByTiers(PACK.items, ['t1', 't2']);
    for (let seed = 1; seed <= 20; seed += 1) {
      const session = buildSessionRounds(String(seed), pool, 6);
      const ids = session.map((round) => round.itemId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('arranges options as a permutation that keeps the correct word', () => {
    const pool = filterByTiers(PACK.items, ['t1']);
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const round of buildSessionRounds(String(seed), pool, 5)) {
        const item = PACK.items.find((candidate) => candidate.id === round.itemId);
        expect(item).toBeDefined();
        expect(round.options).toHaveLength(4);
        expect([...round.options].sort()).toEqual([...item!.options].sort());
        expect(round.correctWord).toBe(item!.options[item!.correctIndex]);
        expect(round.options[round.correctIndex]).toBe(round.correctWord);
        expect(round.prompt).toBe(item!.prompt);
      }
    }
  });

  it('avoids near-duplicate consecutive rounds for many seeds', () => {
    const pool = filterByTiers(PACK.items, ['t1', 't2']);
    for (let seed = 1; seed <= 40; seed += 1) {
      const session = buildSessionRounds(String(seed), pool, 6);
      for (let index = 1; index < session.length; index += 1) {
        expect(isNearDuplicateRound(session[index], session[index - 1])).toBe(false);
      }
    }
  });

  it('excludes used items even when they are near-duplicates of the previous round', () => {
    const rng = createRng('used-check');
    const pool = filterByTiers(PACK.items, ['t1']);
    const first = selectRound({ rng, roundIndex: 0, pool, usedItemIds: new Set(), previousRound: null });
    const second = selectRound({
      rng,
      roundIndex: 1,
      pool,
      usedItemIds: new Set([first.itemId]),
      previousRound: first,
    });
    expect(second.itemId).not.toBe(first.itemId);
    expect(isNearDuplicateRound(second, first)).toBe(false);
  });

  it('is bounded: generation always terminates deterministically', () => {
    // A one-item pool forces the exhaustion fallback path.
    const rng = createRng('budget');
    const single = [PACK.items[0]];
    const round = selectRound({ rng, roundIndex: 0, pool: single, usedItemIds: new Set(), previousRound: null });
    expect(round.itemId).toBe(PACK.items[0].id);
    const again = selectRound({
      rng,
      roundIndex: 1,
      pool: single,
      usedItemIds: new Set([PACK.items[0].id]),
      previousRound: round,
    });
    // Pool exhausted → deterministic reuse of the same item.
    expect(again.itemId).toBe(PACK.items[0].id);
    expect(MAX_SELECTION_ATTEMPTS).toBeGreaterThan(0);
  });
});

describe('isNearDuplicateRound', () => {
  const base: LanguageRound = {
    itemId: 'x',
    prompt: 'happy',
    options: ['joyful', 'merry', 'cheerful', 'glad'],
    correctIndex: 0,
    correctWord: 'joyful',
    tier: 't1',
    family: 'happiness',
  };

  it('treats a null previous round as not near-duplicate', () => {
    expect(isNearDuplicateRound(base, null)).toBe(false);
  });

  it('flags rounds sharing the same prompt or the same correct word', () => {
    expect(isNearDuplicateRound(base, { ...base, itemId: 'y', options: [...base.options] })).toBe(true);
    expect(
      isNearDuplicateRound(base, {
        ...base,
        prompt: 'cheerful',
        options: ['joyful', 'glad', 'merry', 'delighted'],
        correctIndex: 0,
        correctWord: 'joyful',
      }),
    ).toBe(true);
    expect(
      isNearDuplicateRound(base, {
        ...base,
        prompt: 'happy',
        options: ['merry', 'glad', 'cheerful', 'joyful'],
        correctIndex: 3,
        correctWord: 'joyful',
      }),
    ).toBe(true);
  });

  it('accepts rounds that differ in both prompt and correct word', () => {
    expect(
      isNearDuplicateRound(base, {
        ...base,
        prompt: 'glad',
        options: ['content', 'pleased', 'merry', 'cheerful'],
        correctIndex: 1,
        correctWord: 'pleased',
      }),
    ).toBe(false);
  });
});
