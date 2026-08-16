// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  cardAlphabet,
  generateRound,
  pickInitialRule,
  validateRound,
} from '../generator';
import { FLEXIBILITY_DIFFICULTY_PARAMS } from '../difficulty';
import type { FlexibilityDifficultyParams, GeneratedRound, RuleId } from '../types';
import { matchesUnder, otherRule } from '../types';

/** Rule of round `i` for fixed params: blocks alternate from the seed's rule. */
function ruleForRound(initialRule: RuleId, roundIndex: number, switchEvery: number): RuleId {
  const block = Math.floor(roundIndex / switchEvery);
  return block % 2 === 0 ? initialRule : otherRule(initialRule);
}

/** Full session: consecutive rounds with alternating rules and target avoidance. */
function fullSession(
  seed: string,
  params: FlexibilityDifficultyParams,
): GeneratedRound[] {
  const rng = createRng(seed);
  const initialRule = pickInitialRule(rng);
  const rounds: GeneratedRound[] = [];
  let prevTarget = null;
  for (let roundIndex = 0; roundIndex < params.rounds; roundIndex += 1) {
    const rule = ruleForRound(initialRule, roundIndex, params.switchEvery);
    const round = generateRound({
      rng,
      roundIndex,
      rule,
      numShapes: params.numShapes,
      numColors: params.numColors,
      prevTarget,
    });
    rounds.push(round);
    prevTarget = round.target;
  }
  return rounds;
}

describe('generateRound', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42', FLEXIBILITY_DIFFICULTY_PARAMS.normal)).toEqual(
      fullSession('seed-42', FLEXIBILITY_DIFFICULTY_PARAMS.normal),
    );
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a', FLEXIBILITY_DIFFICULTY_PARAMS.normal);
    const b = fullSession('seed-b', FLEXIBILITY_DIFFICULTY_PARAMS.normal);
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('draws exactly four distinct candidates and locates the correct one', () => {
    const rng = createRng('layout-check');
    const round = generateRound({
      rng,
      roundIndex: 0,
      rule: 'color',
      numShapes: 3,
      numColors: 3,
      prevTarget: null,
    });
    expect(round.candidates).toHaveLength(CANDIDATE_COUNT);
    expect(new Set(round.candidates.map((card) => `${card.shape}:${card.color}`)).size).toBe(4);
    expect(round.correctIndex).toBeGreaterThanOrEqual(0);
    expect(round.correctIndex).toBeLessThan(4);
  });

  it('never places the target card among the candidates', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed), FLEXIBILITY_DIFFICULTY_PARAMS.easy);
      for (const round of sessions) {
        for (const card of round.candidates) {
          expect(card).not.toEqual(round.target);
        }
      }
    }
  });

  it('avoids reusing the previous round target for many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed), FLEXIBILITY_DIFFICULTY_PARAMS.easy);
      for (let round = 1; round < sessions.length; round += 1) {
        expect(sessions[round].target).not.toEqual(sessions[round - 1].target);
      }
    }
  });

  it('validates round invariants across many seeds and difficulty combos', () => {
    const paramSets = Object.values(FLEXIBILITY_DIFFICULTY_PARAMS);
    for (const params of paramSets) {
      for (let seed = 1; seed <= 50; seed += 1) {
        const sessions = fullSession(String(seed), params);
        for (const round of sessions) {
          expect(validateRound(round, params.numShapes, params.numColors)).toEqual([]);
        }
      }
    }
  });

  it('makes the rule switch meaningful: the correct card disagrees across rules', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed), FLEXIBILITY_DIFFICULTY_PARAMS.normal);
      for (const round of sessions) {
        const correct = round.candidates[round.correctIndex];
        expect(matchesUnder(round.rule, correct, round.target)).toBe(true);
        expect(matchesUnder(otherRule(round.rule), correct, round.target)).toBe(false);
        for (let i = 0; i < round.candidates.length; i += 1) {
          if (i !== round.correctIndex) {
            expect(matchesUnder(round.rule, round.candidates[i], round.target)).toBe(false);
          }
        }
      }
    }
  });

  it('works on the 4×4 alphabet too', () => {
    const rng = createRng('alphabet-16');
    const round = generateRound({
      rng,
      roundIndex: 0,
      rule: 'shape',
      numShapes: 4,
      numColors: 4,
      prevTarget: null,
    });
    expect(round.candidates).toHaveLength(4);
    expect(cardAlphabet(4, 4)).toHaveLength(16);
    expect(validateRound(round, 4, 4)).toEqual([]);
  });

  it('is bounded: generation always terminates deterministically', () => {
    const rng = createRng('budget');
    const prevTarget = { shape: 'circle' as const, color: 'red' as const };
    const round = generateRound({
      rng,
      roundIndex: 1,
      rule: 'color',
      numShapes: 3,
      numColors: 3,
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
      expect(['color', 'shape'] as RuleId[]).toContain(rule);
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
      numShapes: 3,
      numColors: 3,
      prevTarget: null,
    });
    const target = round.target;
    const distractorIndex = (round.correctIndex + 1) % round.candidates.length;
    const violating = round.candidates.map((card, i) =>
      i === distractorIndex ? { ...card, color: target.color } : card,
    );
    const violations = validateRound(
      { ...round, candidates: violating },
      3,
      3,
    );
    expect(violations.some((v) => v.includes('matches under the active rule'))).toBe(true);
  });

  it('flags a correct card that also matches under the other rule', () => {
    const rng = createRng('v-check2');
    const round = generateRound({
      rng,
      roundIndex: 0,
      rule: 'color',
      numShapes: 3,
      numColors: 3,
      prevTarget: null,
    });
    // Make the correct card identical to the target: matches under both rules.
    const candidates = round.candidates.map((card, i) =>
      i === round.correctIndex ? { ...round.target } : card,
    );
    const violations = validateRound({ ...round, candidates }, 3, 3);
    expect(violations.some((v) => v.includes('also matches under'))).toBe(true);
    expect(violations.some((v) => v.includes('target card appears'))).toBe(true);
  });
});
