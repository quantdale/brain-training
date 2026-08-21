// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { TRACKER_SYMBOL_COUNT } from '../symbols';
import { EMPTY, generateRound, isNearDuplicateTracked } from '../generator';

describe('generateRound', () => {
  it('places exactly tokenCount distinct tokens on the observe board', () => {
    const round = generateRound({
      rng: createRng('gen-1'),
      roundIndex: 0,
      gridSize: 16,
      tokenCount: 8,
      trackCount: 3,
      distractors: 2,
      prevTracked: null,
    });
    expect(round.observeBoard).toHaveLength(16);
    const tokens = round.observeBoard.filter((id) => id !== EMPTY);
    expect(tokens).toHaveLength(8);
    expect(new Set(tokens).size).toBe(8); // all distinct
    for (const id of tokens) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(TRACKER_SYMBOL_COUNT);
    }
  });

  it('is deterministic for the same seed + round', () => {
    const a = generateRound({
      rng: createRng('det'),
      roundIndex: 2,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    });
    const b = generateRound({
      rng: createRng('det'),
      roundIndex: 2,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    });
    expect(a).toEqual(b);
  });

  it('diverges for different seeds', () => {
    const a = generateRound({
      rng: createRng('seed-A'),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    });
    const b = generateRound({
      rng: createRng('seed-B'),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    });
    expect(a).not.toEqual(b);
  });

  it('tracks a sorted subset of the observe tokens', () => {
    const round = generateRound({
      rng: createRng('tracked'),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 3,
      distractors: 1,
      prevTracked: null,
    });
    const tokens = new Set(round.observeBoard.filter((id) => id !== EMPTY));
    expect(round.trackedSymbolIds).toHaveLength(3);
    expect([...round.trackedSymbolIds]).toEqual(
      [...round.trackedSymbolIds].sort((x, y) => x - y),
    );
    for (const id of round.trackedSymbolIds) {
      expect(tokens.has(id)).toBe(true);
    }
  });

  it('scrambles the tokens onto the respond board and adds distractors', () => {
    const round = generateRound({
      rng: createRng('scramble'),
      roundIndex: 0,
      gridSize: 16,
      tokenCount: 8,
      trackCount: 3,
      distractors: 2,
      prevTracked: null,
    });
    const observeTokens = round.observeBoard.filter((id) => id !== EMPTY);
    const respondFilled = round.respondBoard.filter((id) => id !== EMPTY);
    // Same multiset of tokens plus exactly `distractors` extras.
    expect(respondFilled).toHaveLength(observeTokens.length + 2);
    const tokenSet = new Set(observeTokens);
    const extras = respondFilled.filter((id) => !tokenSet.has(id));
    expect(extras).toHaveLength(2);
    expect(new Set(extras).size).toBe(2); // distinct distractors
    for (const id of extras) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(TRACKER_SYMBOL_COUNT);
    }
    // The scramble actually relocated at least one token.
    expect(round.respondBoard).not.toEqual(round.observeBoard);
    // Distractors never displace a token: every respond cell holds either a
    // token or a distractor, and empty cells stay empty.
    for (let c = 0; c < round.respondBoard.length; c += 1) {
      const id = round.respondBoard[c];
      if (id === EMPTY) {
        continue;
      }
      expect(tokenSet.has(id) || extras.includes(id)).toBe(true);
    }
  });

  it('avoids identical tracked sets between consecutive rounds', () => {
    let prev = generateRound({
      rng: createRng('near'),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    }).trackedSymbolIds;
    for (let round = 1; round < 6; round += 1) {
      const current = generateRound({
        rng: createRng('near'),
        roundIndex: round,
        gridSize: 9,
        tokenCount: 6,
        trackCount: 2,
        distractors: 0,
        prevTracked: prev,
      }).trackedSymbolIds;
      expect(isNearDuplicateTracked(current, prev)).toBe(false);
      prev = current;
    }
  });

  it('throws on invalid gridSize / tokenCount / trackCount', () => {
    const base = {
      rng: createRng('x'),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    };
    expect(() => generateRound({ ...base, gridSize: 0 })).toThrow();
    expect(() => generateRound({ ...base, gridSize: 7.5 })).toThrow();
    expect(() => generateRound({ ...base, tokenCount: 0 })).toThrow();
    expect(() => generateRound({ ...base, tokenCount: 10 })).toThrow(); // > gridSize
    expect(() =>
      generateRound({ ...base, tokenCount: TRACKER_SYMBOL_COUNT + 1 }),
    ).toThrow();
    expect(() => generateRound({ ...base, trackCount: 0 })).toThrow();
    expect(() => generateRound({ ...base, trackCount: 7 })).toThrow(); // > tokenCount
  });
});

describe('isNearDuplicateTracked', () => {
  it('flags only identical tracked sets as near-duplicates', () => {
    expect(isNearDuplicateTracked([1, 2], [1, 2])).toBe(true);
    expect(isNearDuplicateTracked([2, 1], [1, 2])).toBe(true); // order-insensitive
    expect(isNearDuplicateTracked([1, 2], [1, 3])).toBe(false);
    expect(isNearDuplicateTracked([1, 2], [1, 2, 3])).toBe(false);
    expect(isNearDuplicateTracked([1, 2], null)).toBe(false);
  });
});
