/**
 * Independent solver + uniqueness prover for the Deduction Table game.
 *
 * This module is deliberately independent of `generator.ts`: it takes a
 * `LogicDeductionRound` (entities, attributes, clues, question) and computes,
 * by brute-force enumeration, how many assignments are consistent with the
 * clues and whether the targeted question has exactly one answer. The
 * generator must call `isUniquelySolvable` to PROVE every round it ships is
 * unambiguous (constitution §10; logic procedural-content requirement: unique
 * solution proof).
 *
 * Attributes are mutually independent: clues only ever relate a single
 * attribute (an equality/exclusion on one entity, or an inequality comparing
 * two entities on the SAME attribute). The solver therefore enumerates each
 * attribute's bijective assignments separately — at most `entityCount!`
 * permutations per attribute (entityCount <= 5 → <= 120), which is trivial.
 */
import type {
  AttributeDef,
  Clue,
  LogicDeductionRound,
  Question,
} from "./types";

/** Index of an entity label within the round's entity list. */
function entityIndex(
  round: { entities: readonly string[] },
  entity: string,
): number {
  const i = round.entities.indexOf(entity);
  if (i < 0) {
    throw new Error(`solver: unknown entity "${entity}"`);
  }
  return i;
}

function attributeById(round: LogicDeductionRound, id: string): AttributeDef {
  const attr = round.attributes.find((a) => a.id === id);
  if (attr === undefined) {
    throw new Error(`solver: unknown attribute "${id}"`);
  }
  return attr;
}

/** All permutations of `values` (Heap's algorithm). `n!` elements, n <= 5. */
function permutations(values: readonly string[]): string[][] {
  const result: string[][] = [];
  const a = values.slice();
  const n = a.length;
  const c = new Array<number>(n).fill(0);
  result.push(a.slice());
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
      result.push(a.slice());
      c[i] += 1;
      i = 0;
    } else {
      c[i] = 0;
      i += 1;
    }
  }
  return result;
}

/** Ordering index of a value within an ordered attribute (lower = smaller). */
function orderIndex(attr: AttributeDef, value: string): number {
  if (attr.order !== undefined) {
    const i = attr.order.indexOf(value);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  }
  // Non-ordered attribute: fall back to domain position for inequality sanity.
  return attr.values.indexOf(value);
}

/** True when permutation `perm` (entity i → value) satisfies `clue`. */
function clueHolds(
  clue: Clue,
  perm: readonly string[],
  attr: AttributeDef,
  entities: readonly string[],
): boolean {
  const ei = entityIndex({ entities }, clue.entity);
  const ev = perm[ei];
  switch (clue.kind) {
    case "equality":
      return ev === clue.value;
    case "exclusion":
      return ev !== clue.value;
    case "inequality": {
      if (clue.value === undefined || clue.relation === undefined) {
        return true;
      }
      const oi = entityIndex({ entities }, clue.value);
      const ov = perm[oi];
      const evIdx = orderIndex(attr, ev);
      const ovIdx = orderIndex(attr, ov);
      return clue.relation === ">" ? evIdx > ovIdx : evIdx < ovIdx;
    }
    default:
      return true;
  }
}

/**
 * Enumerate every bijective assignment of `attr.values` to `entities` that is
 * consistent with the clues belonging to `attr`, capped at `cap` results.
 * Returns up to `cap` permutations (each indexed by entity order).
 */
export function solveAttribute(
  round: LogicDeductionRound,
  attr: AttributeDef,
  cap = 2,
): string[][] {
  const cluesForAttr = round.clues.filter((c) => c.attribute === attr.id);
  const perms = permutations(attr.values);
  const consistent: string[][] = [];
  for (const perm of perms) {
    if (cluesForAttr.every((c) => clueHolds(c, perm, attr, round.entities))) {
      consistent.push(perm);
      if (consistent.length >= cap) {
        break;
      }
    }
  }
  return consistent;
}

/**
 * Number of fully-consistent assignments for the whole round, capped at
 * `cap`. Attributes are independent so the total is the product of per-attribute
 * solution counts (capped), but we only need to know whether it is 0, 1, or >1.
 */
export function countSolutions(round: LogicDeductionRound, cap = 2): number {
  let total = 1;
  for (const attr of round.attributes) {
    const len = solveAttribute(round, attr, 2).length;
    if (len === 0) {
      return 0;
    }
    total *= len;
    if (total > cap) {
      return cap + 1;
    }
  }
  return total;
}

/** The set of distinct answers to `question` across consistent assignments. */
export function answerSet(
  round: LogicDeductionRound,
  question: Question,
): Set<string> {
  const attr = attributeById(round, question.attribute);
  const ei = entityIndex(round, question.entity);
  const set = new Set<string>();
  for (const perm of solveAttribute(round, attr, 2)) {
    set.add(perm[ei]);
    if (set.size > 1) {
      break;
    }
  }
  return set;
}

/** Minimum number of consistent assignments (1 if uniquely solvable, else >1 or 0). */
export function isUniquelySolvable(round: LogicDeductionRound): boolean {
  for (const attr of round.attributes) {
    if (solveAttribute(round, attr, 2).length === 0) {
      return false;
    }
  }
  return answerSet(round, round.question).size === 1;
}
