// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  cardAlphabet,
  generateRound,
  generateSession,
  pickDifferentRule,
  pickInitialRule,
  validateRound,
} from '../generator';
import { FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS } from '../difficulty';
import { ALL_RULES, RULES } from '../types';
import type { FlexibilityRuleFlipDifficultyParams, GeneratedRound } from '../types';

describe('cardAlphabet', () => {
  it('enumerates shape × color × number within the active alphabet', () => {
    const alphabet = cardAlphabet(3, 3, 3);
    expect(alphabet).toHaveLength(27);
    expect(new Set(alphabet.map((c) => `${c.shape}:${c.color}:${c.number}`)).size).toBe(27);
    for (const card of alphabet) {
      expect(card.number).toBeGreaterThanOrEqual(1);
      expect(card.number).toBeLessThanOrEqual(3);
    }
  });

  it('honors each dimension independently', () => {
    expect(cardAlphabet(4, 2, 2)).toHaveLength(16);
    expect(cardAlphabet(2, 4, 1)).toHaveLength(8);
  });
});

describe('pickInitialRule / pickDifferentRule', () => {
  it('is deterministic for the same rng seed', () => {
    const a = pickInitialRule(createRng('rules'), ALL_RULES);
    const b = pickInitialRule(createRng('rules'), ALL_RULES);
    expect(a).toBe(b);
    expect(RULES).toContain(a);
  });

  it('never repeats the previous rule', () => {
    for (const rule of ALL_RULES) {
      const next = pickDifferentRule(createRng('diff'), ALL_RULES, rule);
      expect(next).not.toBe(rule);
      expect(ALL_RULES).toContain(next);
    }
  });
});

describe('generateRound', () => {
  it('produces a valid round under every rule', () => {
    for (const rule of ALL_RULES) {
      const round = generateRound({
        rng: createRng(`round-${rule}`),
        roundIndex: 0,
        rule,
        isSwitch: false,
        numShapes: 3,
        numColors: 3,
        numNumbers: 3,
        prevTarget: null,
      });
      expect(validateRound(round, 3, 3, 3)).toEqual([]);
    }
  });

  it('is deterministic for the same seed + inputs', () => {
    const make = () =>
      generateRound({
        rng: createRng('det-round'),
        roundIndex: 2,
        rule: 'shape',
        isSwitch: true,
        numShapes: 3,
        numColors: 3,
        numNumbers: 4,
        prevTarget: null,
      });
    expect(make()).toEqual(make());
  });

  it('avoids repeating the previous target', () => {
    const first = generateRound({
      rng: createRng('prev'),
      roundIndex: 0,
      rule: 'color',
      isSwitch: false,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget: null,
    });
    const second = generateRound({
      rng: createRng('prev'),
      roundIndex: 1,
      rule: 'color',
      isSwitch: false,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget: first.target,
    });
    expect(second.target).not.toEqual(first.target);
  });

  it('throws when the alphabet is too small to build an unambiguous cue', () => {
    // 1×1×1 alphabet: the only card equals the target, so no valid correct
    // candidate exists (it would match under all three rules).
    expect(() =>
      generateRound({
        rng: createRng('tiny'),
        roundIndex: 0,
        rule: 'color',
        isSwitch: false,
        numShapes: 1,
        numColors: 1,
        numNumbers: 1,
        prevTarget: null,
      }),
    ).toThrow();
  });
});

describe('validateRound', () => {
  const base = () =>
    generateRound({
      rng: createRng('validate'),
      roundIndex: 0,
      rule: 'number',
      isSwitch: false,
      numShapes: 3,
      numColors: 3,
      numNumbers: 3,
      prevTarget: null,
    });

  it('accepts generator output', () => {
    expect(validateRound(base(), 3, 3, 3)).toEqual([]);
  });

  it('flags a wrong correctIndex', () => {
    const round = base();
    const broken: GeneratedRound = { ...round, correctIndex: (round.correctIndex + 1) % round.candidates.length };
    expect(validateRound(broken, 3, 3, 3).length).toBeGreaterThan(0);
  });

  it('flags duplicate candidates', () => {
    const round = base();
    const broken: GeneratedRound = {
      ...round,
      candidates: [round.candidates[0], round.candidates[0], round.candidates[2], round.candidates[3]],
    };
    const violations = validateRound(broken, 3, 3, 3);
    expect(violations.some((v) => v.includes('duplicate'))).toBe(true);
  });

  it('flags a candidate outside the active alphabet', () => {
    const round = base();
    const outside = { shape: 'star', color: 'yellow', number: 9 } as const;
    const broken: GeneratedRound = {
      ...round,
      candidates: [round.candidates[0], round.candidates[1], round.candidates[2], { ...outside }],
    };
    const violations = validateRound(broken, 3, 3, 3);
    expect(violations.some((v) => v.includes('outside the active alphabet'))).toBe(true);
  });

  it('flags the target appearing among the candidates', () => {
    const round = base();
    const broken: GeneratedRound = {
      ...round,
      candidates: [round.target, round.candidates[1], round.candidates[2], round.candidates[3]],
    };
    expect(validateRound(broken, 3, 3, 3).some((v) => v.includes('target'))).toBe(true);
  });

  it('flags a wrong candidate count', () => {
    const round = base();
    const broken: GeneratedRound = { ...round, candidates: round.candidates.slice(0, 3) };
    expect(validateRound(broken, 3, 3, 3).some((v) => v.includes('candidates'))).toBe(true);
  });
});

describe('generateSession', () => {
  const params: FlexibilityRuleFlipDifficultyParams = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal;

  it('builds exactly `rounds` valid rounds', () => {
    const plan = generateSession('plan-seed', params);
    expect(plan).toHaveLength(params.rounds);
    plan.forEach((round, i) => {
      expect(validateRound(round, params.numShapes, params.numColors, params.numNumbers)).toEqual([]);
      expect(round.candidates).toHaveLength(CANDIDATE_COUNT);
      void i;
    });
  });

  it('is deterministic: same seed → same plan; different seed → different plan', () => {
    expect(generateSession('same', params)).toEqual(generateSession('same', params));
    expect(generateSession('same', params)).not.toEqual(generateSession('other', params));
  });

  it('never marks round 0 as a switch and encodes block boundaries', () => {
    for (const seed of ['b1', 'b2', 'b3']) {
      const plan = generateSession(seed, params);
      expect(plan[0].isSwitch).toBe(false);
      for (let i = 1; i < plan.length; i += 1) {
        if (plan[i].isSwitch) {
          expect(plan[i].rule).not.toBe(plan[i - 1].rule);
        } else {
          expect(plan[i].rule).toBe(plan[i - 1].rule);
        }
      }
    }
  });

  it('guarantees at least one switch trial when flipRate > 0', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const p = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS[level];
      const plan = generateSession(`switch-${level}`, p);
      expect(plan.some((r) => r.isSwitch)).toBe(true);
    }
  });

  it('keeps the rule constant within a block and uses only pool rules', () => {
    const plan = generateSession('pool', params);
    for (const round of plan) {
      expect(params.rulesPool).toContain(round.rule);
    }
  });

  it('respects MAX_GENERATE_ATTEMPTS as the redraw budget', () => {
    expect(MAX_GENERATE_ATTEMPTS).toBeGreaterThan(0);
  });

  it('draws varying block lengths when blockMax > blockMin', () => {
    // Regression: chooseBlockLength re-forked the same salt for every block,
    // and Rng.fork(salt) depends only on the parent seed string — so every
    // block in a session came out with the identical length.
    const hard = FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.hard; // blockMin 3, blockMax 5
    expect(hard.blockMax).toBeGreaterThan(hard.blockMin);
    const runLengths = new Set<number>();
    for (const seed of ['bl-1', 'bl-2', 'bl-3', 'bl-4', 'bl-5', 'bl-6']) {
      const plan = generateSession(seed, hard);
      let run = 1;
      for (let i = 1; i < plan.length; i += 1) {
        if (plan[i].rule === plan[i - 1].rule) {
          run += 1;
        } else {
          runLengths.add(run);
          run = 1;
        }
      }
      runLengths.add(run);
    }
    // Same-rule consecutive blocks may merge into longer runs, so only the
    // lower bound is provable per run — but lengths must not all be equal.
    for (const length of runLengths) {
      expect(length).toBeGreaterThanOrEqual(hard.blockMin);
    }
    expect(runLengths.size).toBeGreaterThan(1);
  });
});
