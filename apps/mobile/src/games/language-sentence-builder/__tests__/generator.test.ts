// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { SENTENCE_BANK } from '../content/sentence-bank';
import {
  MAX_SCRAMBLE_ATTEMPTS,
  categoryDistance,
  generateRound,
  hasNoDuplicateWords,
  scrambleWords,
} from '../generator';
import type { ScrambledSentence } from '../types';

function fullSession(seed: string, minWords = 4, maxWords = 7, rounds = 5): ScrambledSentence[] {
  const rng = createRng(seed);
  const results: ScrambledSentence[] = [];
  let prevCategory: string | null = null;
  for (let round = 0; round < rounds; round += 1) {
    const { scrambled } = generateRound({
      rng,
      roundIndex: round,
      bank: SENTENCE_BANK,
      minWords,
      maxWords,
      prevCategory,
      usedCategories: prevCategory !== null ? [prevCategory] : [],
    });
    results.push(scrambled);
    prevCategory = scrambled.category;
  }
  return results;
}

describe('generateRound', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0].category).not.toBe(b[0].category);
  });

  it('produces sentences within the word-count range', () => {
    const session = fullSession('range-check', 4, 5, 10);
    for (const s of session) {
      expect(s.original.length).toBeGreaterThanOrEqual(4);
      expect(s.original.length).toBeLessThanOrEqual(5);
    }
  });

  it('scramble is different from original order', () => {
    const session = fullSession('scramble-check', 4, 7, 10);
    for (const s of session) {
      if (s.original.length > 1) {
        const isSame = s.scrambleOrder.every((v, i) => v === i);
        expect(isSame).toBe(false);
      }
    }
  });

  it('scramble preserves all words', () => {
    const session = fullSession('preserve-check', 5, 7, 5);
    for (const s of session) {
      expect(s.scrambled.length).toBe(s.original.length);
      const sortedOriginal = [...s.original].sort();
      const sortedScrambled = [...s.scrambled].sort();
      expect(sortedScrambled).toEqual(sortedOriginal);
    }
  });

  it('no duplicate categories in consecutive rounds when possible', () => {
    const session = fullSession('cat-no-dup', 4, 5, 10);
    for (let i = 1; i < session.length; i += 1) {
      // With 10 categories and short sentences, consecutive should differ.
      expect(session[i].category).not.toBe(session[i - 1].category);
    }
  });

  it('works with narrow word range (all available categories)', () => {
    const rng = createRng('narrow');
    const { scrambled } = generateRound({
      rng,
      roundIndex: 0,
      bank: SENTENCE_BANK,
      minWords: 3,
      maxWords: 12,
      prevCategory: null,
      usedCategories: [],
    });
    expect(scrambled.original.length).toBeGreaterThanOrEqual(3);
    expect(scrambled.original.length).toBeLessThanOrEqual(12);
  });
});

describe('scrambleWords', () => {
  it('returns null for single-word sentences', () => {
    const rng = createRng('single');
    expect(scrambleWords(rng, ['hello'])).toBeNull();
  });

  it('returns a valid permutation for multi-word sentences', () => {
    const rng = createRng('multi');
    const result = scrambleWords(rng, ['the', 'cat', 'sat']);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    for (const idx of result!) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    }
  });
});

describe('categoryDistance', () => {
  it('returns 0 for same category', () => {
    expect(categoryDistance('past', 'past')).toBe(0);
  });

  it('returns 1 for different categories', () => {
    expect(categoryDistance('past', 'present')).toBe(1);
  });
});

describe('hasNoDuplicateWords', () => {
  it('detects repeated word tokens', () => {
    expect(hasNoDuplicateWords({ text: 'The cat sat on the mat', category: 'x', wordCount: 7 })).toBe(false);
    expect(hasNoDuplicateWords({ text: 'He ate lunch at noon', category: 'x', wordCount: 5 })).toBe(true);
  });
});

// Regression: sentences with repeated words (e.g. two "the"s) make the
// scrambled reconstruction ambiguous, so generation must only select
// sentences whose words are all distinct — across every difficulty tier.
describe('sentence uniqueness (audit regression)', () => {
  const tiers: ReadonlyArray<readonly [number, number]> = [
    [4, 5],
    [5, 7],
    [6, 9],
    [7, 12],
  ];
  for (const [lo, hi] of tiers) {
    it(`only selects distinct-word sentences for range [${lo}, ${hi}]`, () => {
      for (let s = 0; s < 40; s += 1) {
        const rng = createRng(`uniq-${lo}-${hi}-${s}`);
        let prev: string | null = null;
        for (let r = 0; r < 6; r += 1) {
          const { sentence } = generateRound({
            rng,
            roundIndex: r,
            bank: SENTENCE_BANK,
            minWords: lo,
            maxWords: hi,
            prevCategory: prev,
            usedCategories: prev !== null ? [prev] : [],
          });
          const _ok = hasNoDuplicateWords(sentence);
          if (!_ok) {
            // eslint-disable-next-line no-console
            console.log('DUP', lo, hi, JSON.stringify(sentence.text), 'wc', sentence.wordCount);
          }
          expect(_ok).toBe(true);
          expect(sentence.wordCount).toBeGreaterThanOrEqual(lo);
          expect(sentence.wordCount).toBeLessThanOrEqual(hi);
          prev = sentence.category;
        }
      }
    });
  }
});
