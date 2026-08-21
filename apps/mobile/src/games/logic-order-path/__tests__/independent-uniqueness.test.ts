// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { ORDER_PATH_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import type { OrderPathRound } from '../types';

/**
 * Independent uniqueness evidence (campaign 009 audit): a brute-force
 * topological-order counter written here does NOT share code with the game's
 * `solver.ts`. It enumerates permutations with early pruning and counts up to
 * 2 complete orders. Every generated round must have exactly one valid order,
 * and it must be the shipped `solution`.
 */
function countTopologicalOrdersBruteForce(
  items: readonly string[],
  edges: readonly (readonly [string, string])[],
  cap: number,
): number {
  const placed: string[] = [];
  const used = new Set<string>();
  let count = 0;

  function isBlocked(item: string): boolean {
    for (const [from, to] of edges) {
      if (to === item && !used.has(from)) return true;
    }
    return false;
  }

  function recurse(): void {
    if (count >= cap) return;
    if (placed.length === items.length) {
      count += 1;
      return;
    }
    for (const item of items) {
      if (used.has(item) || isBlocked(item)) continue;
      used.add(item);
      placed.push(item);
      recurse();
      placed.pop();
      used.delete(item);
      if (count >= cap) return;
    }
  }

  recurse();
  return count;
}

describe('order-path independent uniqueness property', () => {
  const levels = ['easy', 'normal', 'hard', 'expert'] as const;

  for (const level of levels) {
    it(`brute force confirms exactly one valid order per generated ${level} round`, () => {
      const params = ORDER_PATH_DIFFICULTY_PARAMS[level];
      const seeds = Array.from({ length: 20 }, (_, i) => `independent-${level}-${i}`);
      for (const seed of seeds) {
        let prevSolution: readonly string[] | null = null;
        for (let round = 0; round < Math.min(params.rounds, 3); round += 1) {
          const generated: OrderPathRound = generateRound({
            rng: createRng(`${seed}-${round}`),
            roundIndex: round,
            itemCount: params.itemCount,
            edgeDensityTarget: params.edgeDensityTarget,
            prevSolution,
          });
          // Exactly one topological order exists…
          expect(
            countTopologicalOrdersBruteForce(generated.items, generated.edges, 2),
          ).toBe(1);
          // …and it is exactly the shipped solution.
          const forced: string[] = [];
          const remaining = new Set(generated.items);
          while (remaining.size > 0) {
            const avail = [...remaining].filter(
              (item) =>
                !generated.edges.some(([from, to]) => to === item && remaining.has(from)),
            );
            expect(avail).toHaveLength(1);
            forced.push(avail[0]);
            remaining.delete(avail[0]);
          }
          expect(forced).toEqual(generated.solution);
          prevSolution = generated.solution;
        }
      }
    });
  }
});
