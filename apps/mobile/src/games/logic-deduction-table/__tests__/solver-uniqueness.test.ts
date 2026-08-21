// Jest globals imported explicitly (repo has no @jest/globals).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { generateRound } from "../generator";
import { LOGIC_DEDUCTION_DIFFICULTY_PARAMS } from "../difficulty";
import { isUniquelySolvable, solveAttribute } from "../solver";
import type {
  AttributeDef,
  Clue,
  LogicDeductionRound,
  Question,
} from "../types";

/**
 * Regression tests for the uniqueness prover.
 *
 * Campaign 009 defect: `answerSet` used to enumerate only the FIRST TWO
 * consistent permutations (solveAttribute cap=2). When those two agreed on
 * the questioned entity while a later permutation differed, the solver
 * falsely proved uniqueness and the generator shipped ambiguous rounds.
 * These tests pin the exhaustive-scan behavior against full enumeration.
 */

const ENTITIES = ["A", "B", "C"];
const COLOR: AttributeDef = {
  id: "color",
  label: "color",
  ordered: false,
  values: ["red", "blue", "green"],
};

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

function roundOf(clues: Clue[], question: Question): LogicDeductionRound {
  return {
    entities: ENTITIES,
    attributes: [COLOR],
    clues,
    question,
    answer: "",
    options: [],
    correctIndex: -1,
    entityCount: ENTITIES.length,
    clueCount: clues.length,
  } as unknown as LogicDeductionRound;
}

/** Ground truth: distinct answers over ALL consistent permutations. */
function trueAnswerSet(clues: Clue[], question: Question): Set<string> {
  const perms = permutations(COLOR.values).filter((perm) =>
    clues.every((clue) => {
      if (clue.kind === "exclusion") {
        return perm[ENTITIES.indexOf(clue.entity)] !== clue.value;
      }
      if (clue.kind === "equality") {
        return perm[ENTITIES.indexOf(clue.entity)] === clue.value;
      }
      return true;
    }),
  );
  return new Set(perms.map((p) => p[ENTITIES.indexOf(question.entity)]));
}

describe("isUniquelySolvable vs full enumeration", () => {
  it("regression: single-exclusion rounds are never falsely proven unique", () => {
    for (const exclEntity of ENTITIES) {
      for (const exclValue of COLOR.values) {
        const clues: Clue[] = [
          {
            text: `${exclEntity}'s color is not ${exclValue}`,
            kind: "exclusion",
            entity: exclEntity,
            attribute: "color",
            value: exclValue,
          },
        ];
        for (const qe of ENTITIES) {
          const question: Question = {
            entity: qe,
            attribute: "color",
            text: "",
          };
          const round = roundOf(clues, question);
          const claimed = isUniquelySolvable(round);
          const trulyUnique = trueAnswerSet(clues, question).size === 1;
          expect(claimed).toBe(trulyUnique);
        }
      }
    }
  });

  it("pins a concrete former false positive: 'C not red', question C", () => {
    // Before the fix the solver claimed unique here; C can be green OR blue.
    const clues: Clue[] = [
      {
        text: "C's color is not red",
        kind: "exclusion",
        entity: "C",
        attribute: "color",
        value: "red",
      },
    ];
    const round = roundOf(clues, {
      entity: "C",
      attribute: "color",
      text: "",
    });
    expect(isUniquelySolvable(round)).toBe(false);
    expect(trueAnswerSet(clues, round.question).size).toBeGreaterThan(1);
  });

  it("still proves genuinely unique rounds unique", () => {
    // Two exclusions pin C's color exactly.
    const clues: Clue[] = [
      {
        text: "C's color is not red",
        kind: "exclusion",
        entity: "C",
        attribute: "color",
        value: "red",
      },
      {
        text: "C's color is not blue",
        kind: "exclusion",
        entity: "C",
        attribute: "color",
        value: "blue",
      },
    ];
    const round = roundOf(clues, {
      entity: "C",
      attribute: "color",
      text: "",
    });
    expect(isUniquelySolvable(round)).toBe(true);
    expect(trueAnswerSet(clues, round.question)).toEqual(new Set(["green"]));
  });

  it("solveAttribute enumerates exhaustively when uncapped", () => {
    const clues: Clue[] = [
      {
        text: "C's color is not red",
        kind: "exclusion",
        entity: "C",
        attribute: "color",
        value: "red",
      },
    ];
    const round = roundOf(clues, {
      entity: "C",
      attribute: "color",
      text: "",
    });
    // 6 total permutations minus the 2 with C=red → 4 consistent.
    expect(solveAttribute(round, COLOR, Number.POSITIVE_INFINITY).length).toBe(4);
    // The default cap stays at 2 for cheap existence/count checks.
    expect(solveAttribute(round, COLOR).length).toBe(2);
  });
});

describe("generated rounds pass an independent uniqueness check", () => {
  /**
   * Ground-truth checker written independently of `solver.ts`: enumerates
   * every per-attribute permutation itself, applies the clue semantics
   * directly, and collects the distinct answers to the question.
   */
  function independentAnswerSet(round: LogicDeductionRound): Set<string> {
    const attr = round.attributes.find((a) => a.id === round.question.attribute)!;
    const ei = round.entities.indexOf(round.question.entity);
    const perms = permutations(attr.values).filter((perm) =>
      round.clues.every((clue) => {
        if (clue.attribute !== attr.id) return true;
        const clueEi = round.entities.indexOf(clue.entity);
        switch (clue.kind) {
          case "equality":
            return perm[clueEi] === clue.value;
          case "exclusion":
            return perm[clueEi] !== clue.value;
          case "inequality": {
            const otherEi = round.entities.indexOf(clue.value as string);
            const a1 = attr.order!.indexOf(perm[clueEi]);
            const a2 = attr.order!.indexOf(perm[otherEi]);
            return clue.relation === ">" ? a1 > a2 : a1 < a2;
          }
          default:
            return true;
        }
      }),
    );
    return new Set(perms.map((p) => p[ei]));
  }

  const levels = ["easy", "normal", "hard", "expert"] as const;

  for (const level of levels) {
    it(`every generated ${level} round has exactly one defensible answer (many seeds)`, () => {
      const params = LOGIC_DEDUCTION_DIFFICULTY_PARAMS[level];
      const seeds = Array.from({ length: 25 }, (_, i) => `independent-${level}-${i}`);
      for (const seed of seeds) {
        const rng = createRng(seed);
        let prev: LogicDeductionRound | null = null;
        for (let round = 0; round < params.rounds; round += 1) {
          const generated = generateRound({ rng, roundIndex: round, params, prevRound: prev });
          const answers = independentAnswerSet(generated);
          expect(answers.size).toBe(1);
          expect(answers.has(generated.answer)).toBe(true);
          // The shipped options must encode exactly that answer once.
          expect(generated.options.filter((o) => o === generated.answer)).toHaveLength(1);
          prev = generated;
        }
      }
    });
  }
});
