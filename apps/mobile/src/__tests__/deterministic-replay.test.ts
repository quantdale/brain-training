/**
 * Deterministic replay/snapshot tests (006R task 2.5).
 *
 * These tests verify that the same (seed, difficulty, roundIndex) produces
 * the same challenge for representative games of each content type:
 * - Procedural: memory (random tile sequences)
 * - Curated: language-word-match (content pack selection)
 * - Hybrid: math-equation-builder (curated templates + procedural fallback)
 *
 * Per the spec: "Same version + seed/content item + difficulty inputs resolve
 * consistently."
 */
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

// Procedural: memory game
import { generateRoundSequence } from '@/games/memory/generator';

// Curated: language-word-match
import { selectRound } from '@/games/language-word-match/generator';
import type { PackItem } from '@/games/language-word-match/types';

// Hybrid: math-equation-builder
import { generatePuzzle } from '@/games/math-equation-builder/generator';

describe('Deterministic replay — procedural (memory)', () => {
  it('same seed + difficulty produces same sequence', () => {
    const seed = 'memory-test-seed-1';
    const rng = createRng(seed);

    const result1 = generateRoundSequence({
      rng,
      roundIndex: 0,
      length: 4,
      gridSize: 9,
      prevSequence: null,
    });

    const rng2 = createRng(seed);
    const result2 = generateRoundSequence({
      rng: rng2,
      roundIndex: 0,
      length: 4,
      gridSize: 9,
      prevSequence: null,
    });

    expect(result1).toEqual(result2);
  });

  it('different seed produces different sequence', () => {
    const rng1 = createRng('seed-1');
    const result1 = generateRoundSequence({
      rng: rng1,
      roundIndex: 0,
      length: 4,
      gridSize: 9,
      prevSequence: null,
    });

    const rng2 = createRng('seed-2');
    const result2 = generateRoundSequence({
      rng: rng2,
      roundIndex: 0,
      length: 4,
      gridSize: 9,
      prevSequence: null,
    });

    // With high probability, different seeds produce different sequences
    expect(result1).not.toEqual(result2);
  });
});

describe('Deterministic replay — curated (language-word-match)', () => {
  it('same seed + roundIndex produces same round', () => {
    const seed = 'word-match-test-seed-1';
    const rng = createRng(seed);
    const pack: readonly PackItem[] = [
      { id: 'w1', prompt: 'happy', options: ['joyful', 'sad', 'angry', 'tired'], correctIndex: 0, tier: 1 },
      { id: 'w2', prompt: 'fast', options: ['quick', 'slow', 'lazy', 'heavy'], correctIndex: 0, tier: 1 },
    ];

    const result1 = selectRound({
      rng,
      roundIndex: 0,
      pool: pack,
      usedItemIds: new Set(),
      previousRound: null,
    });

    const rng2 = createRng(seed);
    const result2 = selectRound({
      rng: rng2,
      roundIndex: 0,
      pool: pack,
      usedItemIds: new Set(),
      previousRound: null,
    });

    expect(result1).toEqual(result2);
  });
});

describe('Deterministic replay — hybrid (math-equation-builder)', () => {
  it('same seed + difficulty + roundIndex produces same puzzle', () => {
    const seed = 'equation-test-seed-1';
    const rng = createRng(seed);
    const params = {
      numbersCount: 3,
      targetMin: 10,
      targetMax: 30,
      operators: ['+', '-'] as readonly ('+' | '-' | '×' | '÷')[],
      rounds: 5,
      timeBudgetMs: 50000,
    };

    const result1 = generatePuzzle({
      rng,
      roundIndex: 0,
      params,
      prevTarget: null,
    });

    const rng2 = createRng(seed);
    const result2 = generatePuzzle({
      rng: rng2,
      roundIndex: 0,
      params,
      prevTarget: null,
    });

    expect(result1).toEqual(result2);
  });

  it('different roundIndex produces different puzzle (near-duplicate avoidance)', () => {
    const seed = 'equation-test-seed-2';
    const rng = createRng(seed);
    const params = {
      numbersCount: 3,
      targetMin: 10,
      targetMax: 30,
      operators: ['+', '-'] as readonly ('+' | '-' | '×' | '÷')[],
      rounds: 5,
      timeBudgetMs: 50000,
    };

    const result1 = generatePuzzle({
      rng,
      roundIndex: 0,
      params,
      prevTarget: null,
    });

    const result2 = generatePuzzle({
      rng,
      roundIndex: 1,
      params,
      prevTarget: result1.target,
    });

    // Different rounds should have different targets (near-duplicate avoidance)
    expect(result1.target).not.toEqual(result2.target);
  });
});
