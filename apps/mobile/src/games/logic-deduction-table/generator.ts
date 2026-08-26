/**
 * Deterministic round generation for the Deduction Table game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * Generation strategy (always terminating, uniqueness proven):
 *   1. Build a full random assignment: for each chosen attribute, assign a
 *      random bijective permutation of `entityCount` distinct values to the
 *      entities.
 *   2. Pick a target question (entity + attribute); its answer is the value
 *      in the full assignment.
 *   3. Derive candidate clues from the assignment (equalities, exclusions,
 *      and — for ordered attributes — pairwise inequalities).
 *   4. Split candidates into SAFE vs GIVEAWAY: a clue that ALONE determines
 *      the asked cell (campaign 014) is never shipped while safe clues can
 *      carry the round.
 *   5. Add safe candidates (shuffled) until the INDEPENDENT solver
 *      (`isUniquelySolvable`) confirms the target has exactly one answer,
 *      then pad with further safe candidates up to `clueCount`. Because adding
 *      clues can only shrink the solution space, once a uniquely-solvable
 *      subset is found, further clues keep it uniquely solvable. A full set
 *      of equalities always determines everything, so uniqueness is ALWAYS
 *      achievable → the loop can never spin forever.
 *   6. Outer retries (bounded) re-draw with a fresh attempt salt and avoid
 *      near-duplicate (same entities + question) rounds.
 *
 * `validateGeneratedRound` reuses the solver so callers/tests can verify any
 * round independently of how it was made.
 */
import type { Rng } from "@/sdk";

import { answerSet, isUniquelySolvable } from "./solver";
import type {
  AttributeDef,
  Clue,
  LogicDeductionDifficultyParams,
  LogicDeductionRound,
  Question,
} from "./types";

/** Upper bound on outer re-draw attempts before accepting the last candidate. */
export const MAX_GENERATION_ATTEMPTS = 200;

/** Attribute value pools (each has >= 5 distinct values so entityCount <= 5 works). */
const ATTRIBUTE_POOL: readonly AttributeDef[] = [
  {
    id: "color",
    label: "color",
    ordered: false,
    values: ["red", "blue", "green", "yellow", "purple"],
  },
  {
    id: "shape",
    label: "shape",
    ordered: false,
    values: ["circle", "square", "triangle", "star", "heart"],
  },
  {
    id: "drink",
    label: "drink",
    ordered: false,
    values: ["tea", "juice", "water", "coffee", "milk"],
  },
  {
    id: "size",
    label: "size",
    ordered: true,
    order: ["tiny", "small", "medium", "large", "huge"],
    values: ["tiny", "small", "medium", "large", "huge"],
  },
  {
    id: "speed",
    label: "speed",
    ordered: true,
    order: ["slow", "steady", "quick", "fast", "swift"],
    values: ["slow", "steady", "quick", "fast", "swift"],
  },
];

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salts. */
  readonly roundIndex: number;
  readonly params: LogicDeductionDifficultyParams;
  /** Previous round, or null for round 0. */
  readonly prevRound: LogicDeductionRound | null;
}

function entityLabel(i: number): string {
  return String.fromCharCode(65 + i); // A, B, C, ...
}

function orderIndex(attr: AttributeDef, value: string): number {
  if (attr.order !== undefined) {
    const i = attr.order.indexOf(value);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  }
  return attr.values.indexOf(value);
}

function buildAssignment(
  rng: Rng,
  entities: readonly string[],
  attributes: readonly AttributeDef[],
): Record<string, Record<string, string>> {
  const assignment: Record<string, Record<string, string>> = {};
  for (const e of entities) {
    assignment[e] = {};
  }
  for (const attr of attributes) {
    const selected = rng.shuffle(attr.values.slice()).slice(0, entities.length);
    const perm = rng.shuffle(selected);
    entities.forEach((e, i) => {
      assignment[e][attr.id] = perm[i];
    });
  }
  return assignment;
}

function deriveCandidates(
  rng: Rng,
  entities: readonly string[],
  attributes: readonly AttributeDef[],
  assignment: Record<string, Record<string, string>>,
): Clue[] {
  const clues: Clue[] = [];
  for (const attr of attributes) {
    for (const e of entities) {
      const v = assignment[e][attr.id];
      clues.push({
        text: `${e}'s ${attr.label} is ${v}`,
        kind: "equality",
        entity: e,
        attribute: attr.id,
        value: v,
      });
      for (const other of attr.values) {
        if (other !== v) {
          clues.push({
            text: `${e}'s ${attr.label} is not ${other}`,
            kind: "exclusion",
            entity: e,
            attribute: attr.id,
            value: other,
          });
        }
      }
      if (attr.ordered) {
        for (const e2 of entities) {
          if (e2 === e) continue;
          const v2 = assignment[e2][attr.id];
          if (orderIndex(attr, v) > orderIndex(attr, v2)) {
            clues.push({
              text: `${e}'s ${attr.label} is greater than ${e2}'s ${attr.label}`,
              kind: "inequality",
              entity: e,
              attribute: attr.id,
              value: e2,
              relation: ">",
            });
          } else if (orderIndex(attr, v) < orderIndex(attr, v2)) {
            clues.push({
              text: `${e}'s ${attr.label} is less than ${e2}'s ${attr.label}`,
              kind: "inequality",
              entity: e,
              attribute: attr.id,
              value: e2,
              relation: "<",
            });
          }
        }
      }
    }
  }
  return rng.shuffle(clues);
}

function roundWith(
  entities: readonly string[],
  attributes: readonly AttributeDef[],
  clues: Clue[],
  question: Question,
  answer: string,
): LogicDeductionRound {
  // The solver only reads `entities`, `attributes`, `clues`, and `question`.
  // `answer`/`options`/`correctIndex` are filled by the caller; we provide
  // placeholders here so the probe object satisfies the round shape.
  return {
    entities,
    attributes,
    clues,
    question,
    answer,
    options: [],
    correctIndex: -1,
    entityCount: entities.length,
    clueCount: clues.length,
  };
}

function isNearDuplicate(
  a: LogicDeductionRound,
  b: LogicDeductionRound | null,
): boolean {
  if (b === null) return false;
  if (a.entities.join(",") !== b.entities.join(",")) return false;
  return (
    a.question.entity === b.question.entity &&
    a.question.attribute === b.question.attribute
  );
}

/**
 * True when this clue BY ITSELF already forces a unique answer to the round's
 * question — e.g. the direct equality naming the asked entity+attribute, or
 * (on tiny domains) an exclusion collapsing the asked cell to one value.
 *
 * Campaign 014: such clues used to leak in via post-uniqueness padding and
 * converted a deduction puzzle into reading comprehension. We reuse the
 * solver's candidate tracking (`answerSet`) on the single-clue probe to test
 * the asked CELL specifically; anything that collapses it to one value is a
 * giveaway and must not ship while safe clues can carry the round.
 */
function aloneDeterminesAskedCell(
  entities: readonly string[],
  attributes: readonly AttributeDef[],
  candidate: Clue,
  question: Question,
): boolean {
  const probe = roundWith(entities, attributes, [candidate], question, "");
  return answerSet(probe, question).size <= 1;
}

function buildRound(
  rng: Rng,
  _roundIndex: number,
  params: LogicDeductionDifficultyParams,
): LogicDeductionRound | null {
  const entities = Array.from({ length: params.entityCount }, (_, i) =>
    entityLabel(i),
  );
  const attributes = rng
    .shuffle(ATTRIBUTE_POOL.slice())
    .slice(0, params.attributeCount);
  const assignment = buildAssignment(rng, entities, attributes);

  // Pick a target question.
  const targetEntity = rng.pick(entities);
  const targetAttr = rng.pick(attributes);
  const answer = assignment[targetEntity][targetAttr.id];
  const question: Question = {
    entity: targetEntity,
    attribute: targetAttr.id,
    text: `What is ${targetEntity}'s ${targetAttr.label}?`,
  };

  const candidates = deriveCandidates(rng, entities, attributes, assignment);

  // Anti-giveaway partition (campaign 014): both the uniqueness phase and the
  // padding draw only from safe candidates. When the safe pool cannot prove
  // uniqueness WITHIN the clueCount reading-load budget, we retry from the
  // full candidate list under the same cap, and finally signal failure so
  // `generateRound` retries with a fresh question/assignment. A round that is
  // over budget or ambiguous must never ship (the old defensive fallback
  // pushed every candidate, shipping 25-clue rounds against clueCount=11).
  const safeCandidates = candidates.filter(
    (cand) => !aloneDeterminesAskedCell(entities, attributes, cand, question),
  );
  const cap = Math.max(1, params.clueCount);

  /**
   * Two-phase minimal proof over `pool`, capped at `cap`:
   * 1. Asked-cell exclusions first — each strictly removes one candidate
   *    answer, and they only combine into a proof in PAIRS+ (no single one
   *    narrows anything until its siblings arrive), so they must be taken
   *    before greedy scoring can see progress.
   * 2. Greedy max-reduction over the remaining pool (ties by pool order,
   *    deterministic) — equalities/pins/inequalities on other cells.
   * Null when uniqueness stays unreachable within the cap.
   */
  const proveWithinCap = (pool: readonly Clue[]): Clue[] | null => {
    const chosen: Clue[] = [];
    const used = new Set<Clue>();
    let currentSize = Infinity;
    const probeSize = (extra: Clue): number =>
      answerSet(roundWith(entities, attributes, [...chosen, extra], question, answer), question)
        .size;

    // Phase 1: asked-cell exclusions (never alone-determining when the value
    // pool has ≥3 entries, so they survive the anti-giveaway filter).
    for (const cand of pool) {
      if (chosen.length >= cap) {
        break;
      }
      if (
        used.has(cand) ||
        cand.entity !== question.entity ||
        cand.attribute !== question.attribute ||
        cand.kind !== "exclusion"
      ) {
        continue;
      }
      used.add(cand);
      chosen.push(cand);
      currentSize = Math.min(currentSize, probeSize(cand));
      if (currentSize === 1) {
        return chosen;
      }
    }

    // Phase 2: greedy max-reduction.
    while (chosen.length < cap && currentSize > 1) {
      let best: Clue | null = null;
      let bestSize = currentSize;
      for (const cand of pool) {
        if (used.has(cand)) {
          continue;
        }
        const size = probeSize(cand);
        if (size < bestSize) {
          best = cand;
          bestSize = size;
          if (size === 1) {
            break;
          }
        }
      }
      if (best === null) {
        return null; // stalled: nothing narrows the solution space anymore
      }
      chosen.push(best);
      used.add(best);
      currentSize = bestSize;
    }
    return currentSize === 1 ? chosen : null;
  };

  let chosen = proveWithinCap(safeCandidates);
  if (chosen === null) {
    // The anti-giveaway property is absolute (campaign 014): we never ship a
    // clue that alone reveals the asked cell, even if that costs this
    // assignment. Signal failure so `generateRound` redraws entity/attribute
    // assignment + question and retries — a compliant configuration is
    // almost always found on the next attempt.
    return null;
  }
  // Pad toward the reading-load target, preferring SAFE candidates so the
  // anti-giveaway property survives padding. Shipping fewer than `clueCount`
  // clues is acceptable — uniqueness stays proven either way.
  const used = new Set(chosen);
  for (const cand of [...safeCandidates, ...candidates]) {
    if (chosen.length >= cap) {
      break;
    }
    if (!used.has(cand)) {
      chosen.push(cand);
      used.add(cand);
    }
  }

  const options = rng.shuffle(targetAttr.values.slice());
  const correctIndex = options.indexOf(answer);
  return {
    entities,
    attributes,
    clues: chosen,
    question,
    answer,
    options,
    correctIndex,
    entityCount: entities.length,
    clueCount: chosen.length,
  };
}

/** Generate one validated, uniquely-solvable round (bounded retries). */
export function generateRound(input: GenerateRoundInput): LogicDeductionRound {
  const { rng, roundIndex, params, prevRound } = input;
  let last: LogicDeductionRound | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    const round = buildRound(fork, roundIndex, params);
    // buildRound returns null when no compliant (unique, in-budget) round
    // exists for that assignment — a fresh attempt redraws entity/attribute
    // assignment and question, which changes the safe-candidate structure.
    if (round === null) {
      continue;
    }
    last = round;
    if (validateGeneratedRound(round) && !isNearDuplicate(round, prevRound)) {
      return round;
    }
  }
  // Extremely unlikely fallback: accept the last deterministically built
  // round (legacy behavior). `last` is null only if EVERY attempt failed to
  // build any round at all, which requires a structurally impossible param set.
  if (last === null) {
    throw new Error(
      `logic-deduction-table: generation produced no round after ${MAX_GENERATION_ATTEMPTS} attempts`,
    );
  }
  return last;
}

/** Independent validation: the round is uniquely solvable per the solver. */
export function validateGeneratedRound(round: LogicDeductionRound): boolean {
  if (round.options.length === 0 || round.correctIndex < 0) {
    return false;
  }
  if (round.options[round.correctIndex] !== round.answer) {
    return false;
  }
  if (!round.options.includes(round.answer)) {
    return false;
  }
  return isUniquelySolvable(round);
}
