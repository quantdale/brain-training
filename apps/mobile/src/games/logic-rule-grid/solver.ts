/**
 * Canonical solver for Rule Grid chained-deduction puzzles.
 *
 * Puzzle model:
 *   - `solution` is an n×n Latin square (each row/col permutation of 0..n-1).
 *   - `blanks` is the set of hidden cells (flat indices). The visible board is
 *     `solution` with those cells replaced by -1.
 *   - A valid puzzle has exactly one completion that is a Latin square.
 *
 * Solver provides:
 *   - exhaustive uniqueness proof (bounded enumeration, limit 2)
 *   - dependency-depth metric via iterative singleton propagation
 *
 * Depth definition:
 *   Depth = number of propagation layers needed to solve all blanks via
 *   singleton candidates alone. A cell is "direct" (depth 1) when its candidate
 *   set size is 1 using only initially visible cells. Cells whose candidate set
 *   becomes singleton only after a previous layer is filled have depth >1.
 *   Depth >=2 therefore proves a dependent chain: at least one required fact
 *   cannot be obtained without first deriving another.
 */

export interface PropagationTraceStep {
  readonly depth: number;
  readonly cells: ReadonlyArray<{ readonly r: number; readonly c: number; readonly val: number }>;
}

export interface PropagationResult {
  /** Number of singleton layers; 0 when no cell was directly deducible. */
  readonly depth: number;
  readonly trace: ReadonlyArray<PropagationTraceStep>;
  /** True when every blank became singleton via propagation alone. */
  readonly fullyPropagated: boolean;
  /** Number of blanks that propagation could not solve (0 when fullyPropagated). */
  readonly remaining: number;
}

/** Build a board with blanks hidden as -1. */
export function buildVisibleBoard(
  solution: readonly (readonly number[])[],
  blanks: readonly number[],
  n: number,
): number[][] {
  const board: number[][] = solution.map((row) => [...row]);
  for (const idx of blanks) {
    const r = Math.floor(idx / n);
    const c = idx % n;
    board[r][c] = -1;
  }
  return board;
}

/** Candidate set for cell (r,c) given current board (-1 = unknown). */
export function candidatesForCell(board: readonly (readonly number[])[], n: number, r: number, c: number): Set<number> {
  if (board[r][c] !== -1) return new Set();
  const rowVals = new Set<number>();
  for (let cc = 0; cc < n; cc += 1) {
    const v = board[r][cc];
    if (v !== -1) rowVals.add(v);
  }
  const colVals = new Set<number>();
  for (let rr = 0; rr < n; rr += 1) {
    const v = board[rr][c];
    if (v !== -1) colVals.add(v);
  }
  const cand = new Set<number>();
  for (let s = 0; s < n; s += 1) {
    if (!rowVals.has(s) && !colVals.has(s)) cand.add(s);
  }
  return cand;
}

/**
 * Iteratively fill cells that have exactly one candidate.
 * Returns depth (layers) and whether all blanks were solved by this rule alone.
 */
export function computePropagationDepth(
  visibleBoard: readonly (readonly number[])[],
  blanks: readonly number[],
  n: number,
): PropagationResult {
  const board: number[][] = visibleBoard.map((row) => [...row]);
  const remaining = new Set<number>(blanks);
  const trace: PropagationTraceStep[] = [];
  let depth = 0;

  while (remaining.size > 0) {
    const singletons: Array<{ idx: number; r: number; c: number; val: number }> = [];
    for (const idx of remaining) {
      const r = Math.floor(idx / n);
      const c = idx % n;
      const cand = candidatesForCell(board, n, r, c);
      if (cand.size === 1) {
        const val = [...cand][0];
        singletons.push({ idx, r, c, val });
      }
    }
    if (singletons.length === 0) break;
    depth += 1;
    trace.push({
      depth,
      cells: singletons.map((s) => ({ r: s.r, c: s.c, val: s.val })),
    });
    for (const s of singletons) {
      board[s.r][s.c] = s.val;
      remaining.delete(s.idx);
    }
  }

  return {
    depth,
    trace,
    fullyPropagated: remaining.size === 0,
    remaining: remaining.size,
  };
}

/**
 * Count Latin completions of `board` (with -1 blanks) up to `limit`.
 * Uses MRV + forward checking.
 */
export function countSolutions(
  board: readonly (readonly number[])[],
  n: number,
  limit = 2,
): number {
  const b: number[][] = board.map((row) => [...row]);

  // quick duplicate check: any row/col already has duplicate visible values -> 0 solutions
  for (let r = 0; r < n; r += 1) {
    const seen = new Set<number>();
    for (let c = 0; c < n; c += 1) {
      const v = b[r][c];
      if (v !== -1) {
        if (seen.has(v)) return 0;
        seen.add(v);
      }
    }
  }
  for (let c = 0; c < n; c += 1) {
    const seen = new Set<number>();
    for (let r = 0; r < n; r += 1) {
      const v = b[r][c];
      if (v !== -1) {
        if (seen.has(v)) return 0;
        seen.add(v);
      }
    }
  }

  let count = 0;

  const findBest = (): { r: number; c: number; cand: number[] } | null => {
    let best: { r: number; c: number; cand: number[] } | null = null;
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (b[r][c] !== -1) continue;
        const candSet = candidatesForCell(b, n, r, c);
        const cand = [...candSet];
        if (cand.length === 0) return { r, c, cand: [] }; // dead end
        if (best === null || cand.length < best.cand.length) {
          best = { r, c, cand };
          if (cand.length === 1) return best; // can't do better
        }
      }
    }
    return best;
  };

  const dfs = (): void => {
    if (count >= limit) return;
    const best = findBest();
    if (best === null) {
      count += 1;
      return;
    }
    if (best.cand.length === 0) return; // dead end
    const { r, c, cand } = best;
    for (const v of cand) {
      b[r][c] = v;
      dfs();
      b[r][c] = -1;
      if (count >= limit) return;
    }
  };

  dfs();
  return count;
}

/** Validate that a puzzle has exactly one Latin completion. */
export function isUniquelySolvableBoard(
  visibleBoard: readonly (readonly number[])[],
  n: number,
  limit = 2,
): boolean {
  return countSolutions(visibleBoard, n, limit) === 1;
}

/** Minimum depth required per difficulty level. */
export function minDepthForLevel(level: string): number {
  switch (level) {
    case 'easy':
      return 1;
    case 'normal':
      return 1;
    case 'hard':
      return 2;
    case 'expert':
      return 2;
    default:
      return 1;
  }
}

/** Desired depth for expert to prove strictly stronger than easy (used for expert generation target). */
export function targetDepthForLevel(level: string): number {
  switch (level) {
    case 'expert':
      return 3;
    case 'hard':
      return 2;
    default:
      return 1;
  }
}
