/**
 * Deterministic round generation for the Order Path game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * Construction (uniqueness by design):
 *   1. Pick M distinct item labels and a random PERMUTATION = the unique
 *      solution order.
 *   2. Derive the full forward-edge set: for every pair i<j in the solution,
 *      edge solution[i] -> solution[j]. With every forward edge present, at
 *      each step only the next solution item is available, so the topological
 *      order is UNIQUE (the solution).
 *   3. Sparsify: attempt to drop edges (in a shuffled, deterministic order)
 *      and KEEP the drop only if the puzzle remains uniquely ordered; restore
 *      the edge otherwise. Because dropping constraints can only increase the
 *      number of valid orders, a non-unique result is detected and rejected,
 *      so the final set is always uniquely ordered. This never loops forever:
 *      it is a single bounded pass over the edge list, and the full forward
 *      set is always a valid (unique) fallback.
 *
 * All randomness is drawn from a per-round RNG fork. Near-duplicate
 * avoidance: consecutive rounds do not reuse the same item set / first step.
 */
import type { Rng } from '@/sdk';

import { isUniquelyOrdered, validateRound } from './solver';
import type { OrderPathRound } from './types';

/** Item labels used (uppercase letters; M is at most the pool length). */
export const ITEM_POOL: readonly string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_ATTEMPTS = 12;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Number of items (M). */
  readonly itemCount: number;
  /** Target fraction of all forward edges to keep (0..1). */
  readonly edgeDensityTarget: number;
  /** Previous round's solution (for near-duplicate avoidance), or null. */
  readonly prevSolution: readonly string[] | null;
}

function buildForwardEdges(solution: readonly string[]): [string, string][] {
  const edges: [string, string][] = [];
  for (let i = 0; i < solution.length; i += 1) {
    for (let j = i + 1; j < solution.length; j += 1) {
      edges.push([solution[i], solution[j]]);
    }
  }
  return edges;
}

function constraintText(edges: readonly (readonly [string, string])[]): string[] {
  return edges.map(([from, to]) => `${from} before ${to}`);
}

function isNearDuplicate(
  solution: readonly string[],
  prev: readonly string[] | null,
): boolean {
  if (prev === null) return false;
  // Confusable if same first item and same length (likely the same puzzle).
  return solution[0] === prev[0] && solution.length === prev.length;
}

/**
 * Generate one round: a uniquely-ordered precedence puzzle.
 * Re-draws deterministically (via an incremented attempt salt) until the
 * puzzle is uniquely ordered and not confusable with the previous round
 * (or the budget is exhausted — the last candidate is always valid).
 */
export function generateRound(input: GenerateRoundInput): OrderPathRound {
  const { rng, roundIndex, itemCount, edgeDensityTarget, prevSolution } = input;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    const chosenItems = fork.shuffle(ITEM_POOL).slice(0, itemCount).sort();
    const solution = fork.shuffle(chosenItems);
    if (isNearDuplicate(solution, prevSolution)) {
      continue;
    }

    const fullEdges = buildForwardEdges(solution);
    const kept = sparsifyEdges(fullEdges, solution, edgeDensityTarget, fork);

    const round: OrderPathRound = {
      items: [...chosenItems],
      edges: kept,
      constraints: constraintText(kept),
      solution: [...solution],
      stepCount: itemCount,
    };
    if (validateRound(round.items, round.edges, round.solution)) {
      return round;
    }
  }

  // Extremely unlikely fallback: accept the last deterministically drawn round.
  const fork = rng.fork(`round:${roundIndex}:attempt:${MAX_ATTEMPTS - 1}`);
  const chosenItems = fork.shuffle(ITEM_POOL).slice(0, itemCount).sort();
  const solution = fork.shuffle(chosenItems);
  const fullEdges = buildForwardEdges(solution);
  const round: OrderPathRound = {
    items: [...chosenItems],
    edges: fullEdges,
    constraints: constraintText(fullEdges),
    solution: [...solution],
    stepCount: itemCount,
  };
  // The full forward-edge set is always uniquely ordered.
  return round;
}

/**
 * Drop edges from `fullEdges` while preserving a unique topological order.
 * Iterates over a shuffled copy once; an edge is dropped only if the remaining
 * set is still uniquely ordered. `targetCount` bounds how many edges remain.
 */
function sparsifyEdges(
  fullEdges: readonly (readonly [string, string])[],
  solution: readonly string[],
  edgeDensityTarget: number,
  rng: Rng,
): [string, string][] {
  const totalPossible = (solution.length * (solution.length - 1)) / 2;
  const targetCount = Math.max(solution.length - 1, Math.round(totalPossible * clamp01(edgeDensityTarget)));

  const shuffled = rng.shuffle([...fullEdges]);
  let kept: [string, string][] = fullEdges.map((e) => [e[0], e[1]] as [string, string]);

  for (const edge of shuffled) {
    if (kept.length <= targetCount) {
      break;
    }
    const trial = kept.filter((e) => !(e[0] === edge[0] && e[1] === edge[1]));
    if (isUniquelyOrdered(solution, trial)) {
      kept = trial;
    }
  }
  return kept;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Validate a generated round (used by tests and self-checks). */
export function validateGeneratedRound(round: OrderPathRound): boolean {
  return validateRound(round.items, round.edges, round.solution);
}
