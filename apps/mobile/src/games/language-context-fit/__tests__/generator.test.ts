import { describe, expect, it } from '@jest/globals';

import { createRng } from '@/sdk';

import { loadContentPack } from '../content-validation';
import { filterByTiers, isNearDuplicateRound, selectRound, validateRound } from '../generator';
import type { ContextFitRound } from '../types';

const ALL = loadContentPack().items;
const POOL = filterByTiers(ALL, ['t1', 't2', 't3']);

function selectSession(seed: string, rounds: number): ContextFitRound[] {
  const roundsOut: ContextFitRound[] = [];
  let previous: ContextFitRound | null = null;
  const used = new Set<string>();
  for (let i = 0; i < rounds; i += 1) {
    const r = selectRound({ rng: createRng(seed), roundIndex: i, pool: POOL, usedItemIds: used, previousRound: previous });
    used.add(r.itemId);
    previous = r;
    roundsOut.push(r);
  }
  return roundsOut;
}

describe('selectRound', () => {
  it('is deterministic: same seed reproduces the same session', () => {
    expect(selectSession('seed-a', 8)).toEqual(selectSession('seed-a', 8));
  });

  it('produces different sessions for different seeds', () => {
    const a = selectSession('seed-a', 8).map((r) => r.itemId);
    const b = selectSession('seed-b', 8).map((r) => r.itemId);
    expect(a).not.toEqual(b);
  });

  it('every round is valid: 4 options, answer present and correct, distinct options', () => {
    const session = selectSession('mixed-seed', 8);
    for (const round of session) {
      expect(validateRound(round)).toBe(true);
      expect(round.options).toHaveLength(4);
      expect(round.options[round.correctIndex]).toBe(round.correctWord);
      expect(new Set(round.options.map((o) => o.toLowerCase())).size).toBe(4);
      expect(round.options).not.toContain(round.correctWord === round.options[round.correctIndex]);
    }
  });

  it('never repeats the same context in consecutive rounds', () => {
    const session = selectSession('near-dup', 8);
    for (let i = 1; i < session.length; i += 1) {
      expect(isNearDuplicateRound(session[i], session[i - 1])).toBe(false);
    }
  });

  it('works across many seeds and tier pools without producing invalid rounds', () => {
    for (let s = 0; s < 50; s += 1) {
      const seed = `bulk-${s}`;
      const session = selectSession(seed, 8);
      expect(session).toHaveLength(8);
      for (const round of session) expect(validateRound(round)).toBe(true);
    }
  });

  it('is bounded: generation always terminates deterministically (no infinite loop)', () => {
    const start = Date.now();
    selectSession('perf-seed', 8);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('respects a filtered tier pool (t1 only)', () => {
    const pool = filterByTiers(ALL, ['t1']);
    const round = selectRound({ rng: createRng('t1only'), roundIndex: 0, pool, usedItemIds: new Set(), previousRound: null });
    expect(round.tier).toBe('t1');
  });
});
