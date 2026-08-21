/**
 * Independent solver/oracle for the Order Path game.
 *
 * This module is deliberately SEPARATE from the generator: it only reasons
 * about `(items, edges)` and never assumes how a round was produced. The
 * generator calls it to prove that a generated puzzle has exactly one valid
 * topological order. Tests cross-check the generator against this solver.
 */

/** Items remaining (not yet placed) and the edges that still apply. */
type Remaining = ReadonlySet<string>;

function successorsBlocked(
  item: string,
  remaining: Remaining,
  edges: readonly (readonly [string, string])[],
): boolean {
  // `item` is blocked if some predecessor edge (from -> item) has `from` still remaining.
  for (const [from, to] of edges) {
    if (to === item && remaining.has(from)) {
      return true;
    }
  }
  return false;
}

/**
 * Items that are currently available: still remaining and not blocked by any
 * remaining predecessor.
 */
export function availableNext(
  items: readonly string[],
  edges: readonly (readonly [string, string])[],
  placed: readonly string[],
): string[] {
  const placedSet = new Set(placed);
  const remaining = new Set(items.filter((i) => !placedSet.has(i)));
  const result: string[] = [];
  for (const item of items) {
    if (remaining.has(item) && !successorsBlocked(item, remaining, edges)) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Count the number of topological orders, capped at `cap` (default 2). Capping
 * lets us answer "is the order unique?" in O(M!) worst case but practically
 * prunes as soon as two orders are found or a dead end is hit.
 */
export function countTopologicalOrders(
  items: readonly string[],
  edges: readonly (readonly [string, string])[],
  placed: readonly string[] = [],
  cap = 2,
): number {
  const placedSet = new Set(placed);
  const remaining = items.filter((i) => !placedSet.has(i));

  if (remaining.length === 0) {
    return 1;
  }

  // Available items at this step.
  const avail = remaining.filter((item) => !successorsBlocked(item, new Set(remaining), edges));

  // Dead end: items remain but none are available -> inconsistent (cycle / trapped).
  if (avail.length === 0) {
    return 0;
  }
  // More than one available -> at least two distinct orders exist.
  if (avail.length > 1) {
    return 2;
  }
  // Exactly one available: recurse.
  return countTopologicalOrders(items, edges, [...placed, avail[0]], cap);
}

/** True iff the DAG has exactly one topological order. */
export function isUniquelyOrdered(
  items: readonly string[],
  edges: readonly (readonly [string, string])[],
): boolean {
  return countTopologicalOrders(items, edges, []) === 1;
}

/**
 * Verify a generated round end-to-end: the solver must find exactly one
 * topological order, and at every step the unique available item must be the
 * next item in `solution`.
 */
export function validateRound(
  items: readonly string[],
  edges: readonly (readonly [string, string])[],
  solution: readonly string[],
): boolean {
  if (!isUniquelyOrdered(items, edges)) {
    return false;
  }
  if (solution.length !== items.length) {
    return false;
  }
  const seen = new Set<string>();
  for (const s of solution) {
    if (seen.has(s)) return false;
    seen.add(s);
  }
  let placed: string[] = [];
  for (const expected of solution) {
    const avail = availableNext(items, edges, placed);
    if (avail.length !== 1 || avail[0] !== expected) {
      return false;
    }
    placed = [...placed, expected];
  }
  return true;
}
