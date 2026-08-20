// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  cardAlphabet,
  generateRound,
  generateSession,
  pickInitialRule,
  validateRound,
} from '../generator';
import { ADAPTIVE_PARAMS, FLEXIBILITY_CUE_DIFFICULTY_PARAMS } from '../difficulty';
import type { FlexibilityCueDifficultyParams, GeneratedRound } from '../types';
import { RULES, matchesUnder, otherRules } from '../types';

/** Full deterministic session plan for a seed + params (mirrors the reducer). */
function fullSession(seed: string, params: FlexibilityCueDifficultyParams): GeneratedRound[] {
  return generateSession(seed, params);
}

describe('generateSession / generateRound', () => {
  it('is deterministic: same seed reproduces the same full plan', () => {
    expect(fullSession('seed-42', FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal)).toEqual(
      fullSession('seed-42', FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal),
    );
  });

  it('produces different plans for different seeds', () => {
    const a = fullSession('seed-a', FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal);
    const b = fullSession('seed-b', FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal);
    expect(a).not.toEqual(b);
  });

  it('draws exactly four distinct candidates and locates the correct one', () => {
    const rng = createRng('layout-check');
    const round = generateRound({
      rng,
      roundIndex: 0,
      rule: 'color',
      isSwitch: false,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget: null,
    });
    expect(round.candidates).toHaveLength(CANDIDATE_COUNT);
    expect(new Set(round.candidates.map((card) => `${card.shape}:${card.color}:${card.number}`)).size).toBe(4);
    expect(round.correctIndex).toBeGreaterThanOrEqual(0);
    expect(round.correctIndex).toBeLessThan(4);
  });

  it('never places the target card among the candidates', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed), FLEXIBILITY_CUE_DIFFICULTY_PARAMS.easy);
      for (const round of sessions) {
        for (const card of round.candidates) {
          expect(card).not.toEqual(round.target);
        }
      }
    }
  });

  it('avoids reusing the previous round target for many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed), FLEXIBILITY_CUE_DIFFICULTY_PARAMS.easy);
      for (let round = 1; round < sessions.length; round += 1) {
        expect(sessions[round].target).not.toEqual(sessions[round - 1].target);
      }
    }
  });

  it('validates round invariants across many seeds and difficulty combos', () => {
    const paramSets = [...Object.values(FLEXIBILITY_CUE_DIFFICULTY_PARAMS), ADAPTIVE_PARAMS];
    for (const params of paramSets) {
      for (let seed = 1; seed <= 50; seed += 1) {
        const sessions = fullSession(String(seed), params);
        expect(sessions).toHaveLength(params.rounds);
        for (const round of sessions) {
          expect(validateRound(round, params.numShapes, params.numColors, params.numNumbers)).toEqual([]);
        }
      }
    }
  });

  it('makes the cue unambiguous: the correct card matches ONLY the active rule', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed), FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal);
      for (const round of sessions) {
        const correct = round.candidates[round.correctIndex];
        expect(matchesUnder(round.rule, correct, round.target)).toBe(true);
        for (const other of otherRules(round.rule)) {
          expect(matchesUnder(other, correct, round.target)).toBe(false);
        }
        for (let i = 0; i < round.candidates.length; i += 1) {
          if (i !== round.correctIndex) {
            expect(matchesUnder(round.rule, round.candidates[i], round.target)).toBe(false);
          }
        }
      }
    }
  });

  it('records isSwitch correctly (rule changes exactly where expected)', () => {
    const paramSets = [...Object.values(FLEXIBILITY_CUE_DIFFICULTY_PARAMS), ADAPTIVE_PARAMS];
    for (const params of paramSets) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const sessions = fullSession(String(seed), params);
        expect(sessions[0].isSwitch).toBe(false);
        for (let i = 1; i < sessions.length; i += 1) {
          expect(sessions[i].isSwitch).toBe(sessions[i].rule !== sessions[i - 1].rule);
        }
      }
    }
  });

  it('works on the largest alphabet (4×4×6)', () => {
    const rng = createRng('alphabet-96');
    const round = generateRound({
      rng,
      roundIndex: 0,
      rule: 'number',
      isSwitch: false,
      numShapes: 4,
      numColors: 4,
      numNumbers: 6,
      prevTarget: null,
    });
    expect(round.candidates).toHaveLength(4);
    expect(cardAlphabet(4, 4, 6)).toHaveLength(96);
    expect(validateRound(round, 4, 4, 6)).toEqual([]);
  });

  it('is bounded: generation always terminates deterministically', () => {
    const rng = createRng('budget');
    const prevTarget = { shape: 'circle' as const, color: 'red' as const, number: 1 };
    const round = generateRound({
      rng,
      roundIndex: 1,
      rule: 'color',
      isSwitch: true,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget,
    });
    expect(round.candidates).toHaveLength(4);
    expect(MAX_GENERATE_ATTEMPTS).toBeGreaterThan(0);
  });
});

describe('pickInitialRule', () => {
  it('is deterministic and picks a valid rule', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const rule = pickInitialRule(createRng(String(seed)));
      expect(RULES).toContain(rule);
    }
    expect(pickInitialRule(createRng('s'))).toBe(pickInitialRule(createRng('s')));
  });

  it('produces variety across seeds', () => {
    const rules = new Set(Array.from({ length: 24 }, (_, i) => pickInitialRule(createRng(`v${i}`))));
    expect(rules.size).toBeGreaterThan(1);
  });
});

describe('validateRound', () => {
  it('flags a distractor that matches the active rule', () => {
    const rng = createRng('v-check');
    const round = generateRound({
      rng,
      roundIndex: 0,
      rule: 'color',
      isSwitch: false,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget: null,
    });
    const target = round.target;
    const distractorIndex = (round.correctIndex + 1) % round.candidates.length;
    const violating = round.candidates.map((card, i) =>
      i === distractorIndex ? { ...card, color: target.color } : card,
    );
    const violations = validateRound({ ...round, candidates: violating }, 3, 3, 3);
    expect(violations.some((v) => v.includes('matches under the active rule'))).toBe(true);
  });

  it('flags a correct card that also matches under another rule', () => {
    const rng = createRng('v-check2');
    const round = generateRound({
      rng,
      roundIndex: 0,
      rule: 'color',
      isSwitch: false,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget: null,
    });
    // Make the correct card identical to the target: matches under all rules and equals target.
    const candidates = round.candidates.map((card, i) =>
      i === round.correctIndex ? { ...round.target } : card,
    );
    const violations = validateRound({ ...round, candidates }, 3, 3, 3);
    expect(violations.some((v) => v.includes('also matches under'))).toBe(true);
    expect(violations.some((v) => v.includes('target card appears'))).toBe(true);
  });
});
