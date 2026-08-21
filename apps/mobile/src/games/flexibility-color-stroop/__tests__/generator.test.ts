// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { generateTrials, validateTrials } from '../generator';
import { COLOR_STROOP_DIFFICULTY_PARAMS } from '../difficulty';
import { STROOP_COLORS } from '../types';

function fullSession(seed: string, level: 'easy' | 'normal' | 'hard' | 'expert' = 'normal') {
  const rng = createRng(seed);
  const params = COLOR_STROOP_DIFFICULTY_PARAMS[level];
  return generateTrials({ rng, params });
}

describe('generateTrials', () => {
  it('is deterministic: same seed reproduces the same trial sequence', () => {
    const a = fullSession('seed-42');
    const b = fullSession('seed-42');
    expect(a).toEqual(b);
  });

  it('produces different sequences for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a).not.toEqual(b);
  });

  it('generates the correct number of trials', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const trials = fullSession('count-test', level);
      expect(trials).toHaveLength(COLOR_STROOP_DIFFICULTY_PARAMS[level].trials);
    }
  });

  it('respects the incongruent ratio approximately', () => {
    const trials = fullSession('ratio-test', 'normal');
    const incongruentCount = trials.filter((t) => t.trialType === 'incongruent').length;
    const ratio = incongruentCount / trials.length;
    // Allow some rounding tolerance (±0.15)
    expect(ratio).toBeGreaterThanOrEqual(0.25);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });

  it('first trial always starts with the ink rule', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const trials = fullSession(String(seed));
      expect(trials[0].rule).toBe('ink');
    }
  });

  it('congruent trials have word matching ink color', () => {
    const trials = fullSession('congruent-check');
    for (const trial of trials) {
      if (trial.trialType === 'congruent') {
        expect(trial.word).toBe(trial.inkColor.toUpperCase());
      }
    }
  });

  it('incongruent trials have word different from ink color', () => {
    const trials = fullSession('incongruent-check');
    for (const trial of trials) {
      if (trial.trialType === 'incongruent') {
        expect(trial.word).not.toBe(trial.inkColor.toUpperCase());
      }
    }
  });

  it('neutral trials use non-color words', () => {
    const trials = fullSession('neutral-check');
    for (const trial of trials) {
      if (trial.trialType === 'neutral') {
        expect(STROOP_COLORS).not.toContain(trial.word.toLowerCase());
      }
    }
  });

  it('validates trial invariants', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const trials = fullSession(String(seed));
      expect(validateTrials(trials)).toBe(true);
    }
  });

  it('schedules rule flips at the correct frequency', () => {
    const trials = fullSession('flip-check', 'normal');
    const flipFrequency = COLOR_STROOP_DIFFICULTY_PARAMS.normal.flipFrequency;
    // Check that flip points occur at the right intervals
    let lastFlipIndex = -1;
    for (let i = 0; i < trials.length; i += 1) {
      if (trials[i].isFlipPoint) {
        if (lastFlipIndex >= 0) {
          expect(i - lastFlipIndex).toBe(flipFrequency);
        }
        lastFlipIndex = i;
      }
    }
  });

  it('never schedules a neutral trial under the word rule', () => {
    // Regression: neutral words ("TABLE", …) name no color, so a 'word'-rule
    // trial with a neutral word was unanswerable. Neutrals must only occupy
    // 'ink'-rule slots.
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      for (let seed = 1; seed <= 25; seed += 1) {
        const trials = fullSession(`neutral-rule-${level}-${seed}`, level);
        for (const trial of trials) {
          if (trial.trialType === 'neutral') {
            expect(trial.rule).toBe('ink');
          }
        }
      }
    }
  });

  it('still produces neutral trials at all', () => {
    // Guard the previous fix against overcorrection: neutrals must remain in
    // the mix (they only move to ink-rule slots).
    let seen = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      seen += fullSession(String(seed), 'normal').filter((t) => t.trialType === 'neutral').length;
    }
    expect(seen).toBeGreaterThan(0);
  });
});