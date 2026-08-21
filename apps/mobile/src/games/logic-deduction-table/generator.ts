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
 *   4. Add candidates (shuffled) until the INDEPENDENT solver
 *      (`isUniquelySolvable`) confirms the target has exactly one answer.
 *      Because adding clues can only shrink the solution space, once a
 *      uniquely-solvable subset is found, further clues (up to `clueCount`)
 *      keep it uniquely solvable. A full set of equalities always determines
 *      everything, so uniqueness is ALWAYS achievable → the loop can never
 *      spin forever.
 *   5. Outer retries (bounded) re-draw with a fresh attempt salt and avoid
 *      near-duplicate (same entities + question) rounds.
 *
 * `validateGeneratedRound` reuses the solver so callers/tests can verify any
 * round independently of how it was made.
 */
import type { Rng } from "@/sdk";

import { isUniquelySolvable } from "./solver";
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

function buildRound(
  rng: Rng,
  _roundIndex: number,
  params: LogicDeductionDifficultyParams,
): LogicDeductionRound {
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

  // Add clues until uniquely solvable (always reachable), then pad up to clueCount.
  const chosen: Clue[] = [];
  let unique = false;
  for (const cand of candidates) {
    chosen.push(cand);
    const probe = roundWith(entities, attributes, chosen, question, answer);
    if (isUniquelySolvable(probe)) {
      unique = true;
      break;
    }
  }
  // Pad with remaining candidates to increase reading load (keeps uniqueness).
  if (unique) {
    let idx = candidates.indexOf(chosen[chosen.length - 1]) + 1;
    while (chosen.length < params.clueCount && idx < candidates.length) {
      chosen.push(candidates[idx]);
      idx += 1;
    }
  } else {
    // Defensive fallback: use all candidates (full equalities always determine).
    chosen.length = 0;
    chosen.push(...candidates);
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
    last = round;
    if (validateGeneratedRound(round) && !isNearDuplicate(round, prevRound)) {
      return round;
    }
  }
  // Extremely unlikely fallback: accept the last deterministically built round.
  return last!;
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
