// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_WORD_ATTEMPTS,
  generateRound,
  scrambleWord,
  selectDistractors,
} from '../generator';
import { WORD_BANK } from '../content/word-bank';

function fullSession(
  seed: string,
  rounds = 5,
  optionsCount = 4,
  minWordLength = 4,
  maxWordLength = 7,
): ReturnType<typeof generateRound>[] {
  const rng = createRng(seed);
  const result: ReturnType<typeof generateRound>[] = [];
  let prevAnswer: string | null = null;
  for (let i = 0; i < rounds; i += 1) {
    const round = generateRound({
      rng,
      roundIndex: i,
      optionsCount,
      minWordLength,
      maxWordLength,
      prevAnswer,
    });
    result.push(round);
    prevAnswer = round.answer;
  }
  return result;
}

describe('scrambleWord', () => {
  it('is deterministic: same seed produces same scramble', () => {
    const rng1 = createRng('scramble-test');
    const rng2 = createRng('scramble-test');
    expect(scrambleWord('forest', rng1)).toBe(scrambleWord('forest', rng2));
  });

  it('produces a different string from the original', () => {
    const rng = createRng('diff-test');
    const scrambled = scrambleWord('forest', rng);
    expect(scrambled).not.toBe('forest');
  });

  it('preserves all characters (same multiset)', () => {
    const rng = createRng('chars-test');
    const scrambled = scrambleWord('breeze', rng);
    expect(scrambled.split('').sort().join('')).toBe('breeze'.split('').sort().join(''));
  });

  it('produces different scrambles for different seeds', () => {
    const s1 = scrambleWord('forest', createRng('seed-a'));
    const s2 = scrambleWord('forest', createRng('seed-b'));
    // They could theoretically collide but it's extremely unlikely
    // for a 6-letter word with different seeds
    expect(s1).not.toBe(s2);
  });

  it('handles short words', () => {
    const rng = createRng('short');
    const scrambled = scrambleWord('chef', rng);
    expect(scrambled).not.toBe('chef');
    expect(scrambled.split('').sort().join('')).toBe('chef'.split('').sort().join(''));
  });
});

describe('selectDistractors', () => {
  it('returns the requested count of distractors', () => {
    const distractors = selectDistractors('forest', 4, createRng('dist-test'));
    expect(distractors).toHaveLength(3); // count - 1 (answer excluded)
  });

  it('excludes the answer word', () => {
    const distractors = selectDistractors('forest', 4, createRng('dist-no-self'));
    expect(distractors).not.toContain('forest');
  });

  it('selects words of similar length (within ±1)', () => {
    const distractors = selectDistractors('forest', 4, createRng('dist-length'));
    for (const d of distractors) {
      expect(Math.abs(d.length - 6)).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic', () => {
    const d1 = selectDistractors('forest', 4, createRng('det'));
    const d2 = selectDistractors('forest', 4, createRng('det'));
    expect(d1).toEqual(d2);
  });
});

describe('generateRound', () => {
  it('is deterministic: same seed produces the same round', () => {
    const r1 = generateRound({
      rng: createRng('round-det'),
      roundIndex: 0,
      optionsCount: 4,
      minWordLength: 4,
      maxWordLength: 7,
      prevAnswer: null,
    });
    const r2 = generateRound({
      rng: createRng('round-det'),
      roundIndex: 0,
      optionsCount: 4,
      minWordLength: 4,
      maxWordLength: 7,
      prevAnswer: null,
    });
    expect(r1).toEqual(r2);
  });

  it('answer is within the length bounds', () => {
    const rounds = fullSession('bounds', 10, 4, 4, 7);
    for (const round of rounds) {
      expect(round.wordLength).toBeGreaterThanOrEqual(4);
      expect(round.wordLength).toBeLessThanOrEqual(7);
    }
  });

  it('options count matches the requested count', () => {
    const rounds = fullSession('opts', 5, 4, 4, 7);
    for (const round of rounds) {
      expect(round.options).toHaveLength(4);
    }
  });

  it('correct answer is present in options', () => {
    const rounds = fullSession('present', 5, 4, 4, 7);
    for (const round of rounds) {
      expect(round.options).toContain(round.answer);
      expect(round.options[round.correctIndex]).toBe(round.answer);
    }
  });

  it('no duplicate options', () => {
    const rounds = fullSession('unique', 10, 4, 4, 7);
    for (const round of rounds) {
      expect(new Set(round.options).size).toBe(round.options.length);
    }
  });

  it('scrambled word differs from the answer', () => {
    const rounds = fullSession('scram-diff', 10, 4, 4, 7);
    for (const round of rounds) {
      expect(round.scrambled).not.toBe(round.answer);
    }
  });

  it('category is a non-empty string', () => {
    const rounds = fullSession('cat', 5, 4, 4, 7);
    for (const round of rounds) {
      expect(round.category).toBeTruthy();
      expect(typeof round.category).toBe('string');
    }
  });

  it('full session is deterministic', () => {
    const a = fullSession('session-det');
    const b = fullSession('session-det');
    expect(a).toEqual(b);
  });

  it('different seeds produce different sessions', () => {
    const a = fullSession('seed-x');
    const b = fullSession('seed-y');
    expect(a[0].answer).not.toBe(b[0].answer);
  });

  it('avoids near-duplicate answers between consecutive rounds', () => {
    const rounds = fullSession('no-dup', 10, 4, 4, 7);
    for (let i = 1; i < rounds.length; i += 1) {
      expect(rounds[i].answer).not.toBe(rounds[i - 1].answer);
    }
  });
});
