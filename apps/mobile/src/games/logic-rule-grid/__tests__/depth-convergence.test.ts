// Jest globals imported explicitly.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { RULE_GRID_DIFFICULTY_PARAMS } from '../difficulty';
import { blanksForSize, generateRound, generateSquare, minDepthForSize, validateGeneratedRound } from '../generator';
import { buildVisibleBoard, candidatesForCell, computePropagationDepth, countSolutions } from '../solver';
import type { RuleGridRound } from '../types';

function paramsForSize(size: number) {
  return { size, rounds: 5, roundTimeMs: 20000 };
}

describe('Rule Grid depth convergence — property sweeps', () => {
  it('keeps at least two initially viable answer choices for a chained target', () => {
    const choiceShortcuts: string[] = [];
    for (const size of [5, 6]) {
      for (let index = 0; index < 30; index += 1) {
        const seed = `asked-options-${size}-${index}`;
        const round = generateRound({ rng: createRng(seed), roundIndex: 0, params: paramsForSize(size), prevRound: null });
        const visible = buildVisibleBoard(round.square, round.blanks, size);
        const candidates = candidatesForCell(visible, size, round.blankRow, round.blankCol);
        if (round.options.filter((value) => candidates.has(value)).length < 2) choiceShortcuts.push(seed);
      }
    }
    expect(choiceShortcuts).toEqual([]);
  });

  it('rejects a deep board when its asked cell is changed to a direct blank', () => {
    const round = generateRound({ rng: createRng('direct-asked-validator'), roundIndex: 0, params: paramsForSize(5), prevRound: null });
    const visible = buildVisibleBoard(round.square, round.blanks, round.size);
    const direct = computePropagationDepth(visible, round.blanks, round.size).trace[0].cells[0];
    expect(validateGeneratedRound({
      ...round,
      blankIndex: direct.r * round.size + direct.c,
      blankRow: direct.r,
      blankCol: direct.c,
      answer: direct.val,
    })).toBe(false);
  });

  it('requires the asked Hard and Expert cells themselves to need a deduction chain', () => {
    const directTargets: string[] = [];
    for (const size of [5, 6]) {
      for (let index = 0; index < 30; index += 1) {
        const seed = `asked-depth-${size}-${index}`;
        const round = generateRound({ rng: createRng(seed), roundIndex: 0, params: paramsForSize(size), prevRound: null });
        const visible = buildVisibleBoard(round.square, round.blanks, size);
        const propagation = computePropagationDepth(visible, round.blanks, size);
        const askedStep = propagation.trace.find((step) => step.cells.some(
          (cell) => cell.r === round.blankRow && cell.c === round.blankCol,
        ));
        if ((askedStep?.depth ?? 0) < 2) directTargets.push(seed);
      }
    }
    expect(directTargets).toEqual([]);
  });

  const sizes = [3, 4, 5, 6] as const;
  const sizeToLevel: Record<number, string> = { 3: 'easy', 4: 'normal', 5: 'hard', 6: 'expert' };

  it('every difficulty broad-seed corpus has exactly one solution and meets min depth', () => {
    for (const n of sizes) {
      const level = sizeToLevel[n];
      const minDepth = minDepthForSize(n);
      const seeds = Array.from({ length: 40 }, (_, i) => `depth-sweep-${level}-${i}`);
      for (const seed of seeds) {
        let prev: RuleGridRound | null = null;
        for (let roundIdx = 0; roundIdx < 3; roundIdx += 1) {
          const round = generateRound({
            rng: createRng(seed),
            roundIndex: roundIdx,
            params: paramsForSize(n),
            prevRound: prev,
          });
          expect(validateGeneratedRound(round)).toBe(true);
          const visible = buildVisibleBoard(round.square, round.blanks, n);
          expect(countSolutions(visible, n, 2)).toBe(1);
          const prop = computePropagationDepth(visible, round.blanks, n);
          expect(prop.fullyPropagated).toBe(true);
          expect(prop.depth).toBe(round.depth);
          expect(round.depth).toBeGreaterThanOrEqual(minDepth);
          expect(round.blanks.length).toBe(blanksForSize(n));
          expect(round.blanks).toContain(round.blankIndex);
          if (n >= 5) {
            expect(round.depth).toBeGreaterThanOrEqual(2);
          }
          const round2 = generateRound({
            rng: createRng(seed),
            roundIndex: roundIdx,
            params: paramsForSize(n),
            prevRound: prev,
          });
          expect(round2.square).toEqual(round.square);
          expect(round2.blanks).toEqual(round.blanks);
          expect(round2.depth).toBe(round.depth);
          prev = round;
        }
      }
    }
  });

  it('rejects Hard/Expert puzzles where every blank is independently solvable', () => {
    const n = 5;
    let foundIndependent: RuleGridRound | null = null;
    for (let seedIdx = 0; seedIdx < 200; seedIdx += 1) {
      const rng = createRng(`independent-hunt-${seedIdx}`);
      const square = generateSquare(n, rng);
      const blanks = [0, 6, 12, 18];
      const visible = buildVisibleBoard(square, blanks, n);
      if (countSolutions(visible, n, 2) !== 1) continue;
      const prop = computePropagationDepth(visible, blanks, n);
      if (prop.fullyPropagated && prop.depth === 1) {
        foundIndependent = {
          size: n,
          square,
          blankIndex: blanks[0],
          blankRow: 0,
          blankCol: 0,
          answer: square[0][0],
          options: [0, 1, 2, 3, 4],
          blanks,
          depth: prop.depth,
          fullyPropagated: true,
        } as RuleGridRound;
        break;
      }
    }
    expect(foundIndependent).not.toBeNull();
    if (foundIndependent !== null) {
      expect(foundIndependent.depth).toBe(1);
      expect(foundIndependent.blanks.length).toBeGreaterThan(1);
      expect(validateGeneratedRound(foundIndependent)).toBe(false);
      const nEasy = 3;
      const rngEasy = createRng('easy-independent');
      const sqEasy = generateSquare(nEasy, rngEasy);
      const blanksEasy = [0, 4];
      const visEasy = buildVisibleBoard(sqEasy, blanksEasy, nEasy);
      if (countSolutions(visEasy, nEasy, 2) === 1) {
        const propEasy = computePropagationDepth(visEasy, blanksEasy, nEasy);
        if (propEasy.fullyPropagated && propEasy.depth === 1) {
          const roundEasy = {
            size: nEasy,
            square: sqEasy,
            blankIndex: blanksEasy[0],
            blankRow: 0,
            blankCol: 0,
            answer: sqEasy[0][0],
            options: [0, 1, 2],
            blanks: blanksEasy,
            depth: 1,
            fullyPropagated: true,
          } as RuleGridRound;
          expect(validateGeneratedRound(roundEasy)).toBe(true);
        }
      }
    }
  });

  it('expert is mechanically deeper than easy (corpus comparison)', () => {
    const easyDepths: number[] = [];
    const expertDepths: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const easy = generateRound({
        rng: createRng(`easy-depth-${i}`),
        roundIndex: 0,
        params: paramsForSize(3),
        prevRound: null,
      });
      easyDepths.push(easy.depth);
      const expert = generateRound({
        rng: createRng(`expert-depth-${i}`),
        roundIndex: 0,
        params: paramsForSize(6),
        prevRound: null,
      });
      expertDepths.push(expert.depth);
    }
    const avgEasy = easyDepths.reduce((a, b) => a + b, 0) / easyDepths.length;
    const avgExpert = expertDepths.reduce((a, b) => a + b, 0) / expertDepths.length;
    const minEasy = Math.min(...easyDepths);
    const minExpert = Math.min(...expertDepths);
    expect(minExpert).toBeGreaterThan(minEasy);
    expect(avgExpert).toBeGreaterThan(avgEasy);
    expect(blanksForSize(6)).toBeGreaterThan(blanksForSize(3));
    expect(blanksForSize(5)).toBeGreaterThan(blanksForSize(3));
  });

  it('difficulty scales blanks and depth, not just size/time', () => {
    expect(RULE_GRID_DIFFICULTY_PARAMS.easy.size).toBe(3);
    expect(RULE_GRID_DIFFICULTY_PARAMS.expert.size).toBe(6);
    expect(blanksForSize(6)).toBeGreaterThan(blanksForSize(3));
    expect(minDepthForSize(6)).toBeGreaterThan(minDepthForSize(3));
  });

  it('final generator validation proves uniqueness + min depth; no fallback to weak puzzles', () => {
    for (const n of [5, 6] as const) {
      for (let s = 0; s < 50; s += 1) {
        const round = generateRound({
          rng: createRng(`no-fallback-${n}-${s}`),
          roundIndex: 0,
          params: paramsForSize(n),
          prevRound: null,
        });
        expect(validateGeneratedRound(round)).toBe(true);
        expect(round.depth).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
