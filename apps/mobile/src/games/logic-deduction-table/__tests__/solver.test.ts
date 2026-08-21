// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  answerSet,
  countSolutions,
  isUniquelySolvable,
  solveAttribute,
} from "../solver";
import type { AttributeDef, Clue, LogicDeductionRound } from "../types";

const COLOR: AttributeDef = {
  id: "color",
  label: "color",
  ordered: false,
  values: ["red", "blue"],
};
const SIZE: AttributeDef = {
  id: "size",
  label: "size",
  ordered: true,
  order: ["small", "large"],
  values: ["small", "large"],
};

function makeRound(
  clues: readonly Clue[],
  questionEntity = "A",
  attributes: readonly AttributeDef[] = [COLOR],
): LogicDeductionRound {
  return {
    entities: ["A", "B"],
    attributes,
    clues,
    question: {
      entity: questionEntity,
      attribute: attributes[0].id,
      text: `What is ${questionEntity}'s ${attributes[0].label}?`,
    },
    answer: "red",
    options: ["red", "blue"],
    correctIndex: 0,
    entityCount: 2,
    clueCount: clues.length,
  };
}

describe("solveAttribute", () => {
  it("enumerates consistent permutations up to the cap", () => {
    const round = makeRound([]);
    // No clues: both permutations of [red, blue] are consistent.
    expect(solveAttribute(round, COLOR, 2)).toHaveLength(2);
    expect(solveAttribute(round, COLOR, 1)).toHaveLength(1);
  });

  it("narrows to one permutation under an equality clue", () => {
    const clue: Clue = {
      text: "A's color is red",
      kind: "equality",
      entity: "A",
      attribute: "color",
      value: "red",
    };
    const perms = solveAttribute(makeRound([clue]), COLOR, 5);
    expect(perms).toHaveLength(1);
    expect(perms[0]).toEqual(["red", "blue"]);
  });

  it("honors exclusion and inequality clues", () => {
    const exclusion: Clue = {
      text: "A's color is not blue",
      kind: "exclusion",
      entity: "A",
      attribute: "color",
      value: "blue",
    };
    expect(solveAttribute(makeRound([exclusion]), COLOR, 5)).toEqual([
      ["red", "blue"],
    ]);
    const greater: Clue = {
      text: "B's size is greater than A's size",
      kind: "inequality",
      entity: "B",
      attribute: "size",
      value: "A",
      relation: ">",
    };
    const sizeRound = makeRound([greater], "A", [SIZE]);
    expect(solveAttribute(sizeRound, SIZE, 5)).toEqual([
      ["small", "large"],
    ]);
  });
});

describe("countSolutions / answerSet / isUniquelySolvable", () => {
  it("counts 0 for contradictory clues", () => {
    const contradiction: Clue = {
      text: "A's color is red",
      kind: "equality",
      entity: "A",
      attribute: "color",
      value: "red",
    };
    const negation: Clue = {
      text: "A's color is not red",
      kind: "exclusion",
      entity: "A",
      attribute: "color",
      value: "red",
    };
    expect(countSolutions(makeRound([contradiction, negation]))).toBe(0);
    expect(isUniquelySolvable(makeRound([contradiction, negation]))).toBe(
      false,
    );
  });

  it("reports multiple solutions without clues and one with enough clues", () => {
    expect(countSolutions(makeRound([]))).toBeGreaterThan(1);
    expect(isUniquelySolvable(makeRound([]))).toBe(false);
    const clue: Clue = {
      text: "A's color is red",
      kind: "equality",
      entity: "A",
      attribute: "color",
      value: "red",
    };
    expect(countSolutions(makeRound([clue]))).toBe(1);
    expect(isUniquelySolvable(makeRound([clue]))).toBe(true);
    expect(answerSet(makeRound([clue]), makeRound([clue]).question)).toEqual(
      new Set(["red"]),
    );
  });

  it("requires uniqueness only for the asked question", () => {
    // The unasked attribute may stay ambiguous.
    const clue: Clue = {
      text: "A's color is red",
      kind: "equality",
      entity: "A",
      attribute: "color",
      value: "red",
    };
    const twoAttrRound = makeRound([clue], "A", [COLOR, SIZE]);
    expect(isUniquelySolvable(twoAttrRound)).toBe(true);
  });

  it("throws on unknown entities/attributes", () => {
    const broken = makeRound([]);
    const badClue: Clue = {
      text: "Z's color is red",
      kind: "equality",
      entity: "Z",
      attribute: "color",
      value: "red",
    };
    expect(() =>
      solveAttribute({ ...broken, clues: [badClue] }, COLOR, 2),
    ).toThrow();
    // `answerSet` resolves the question's attribute by id and throws on a miss.
    expect(() =>
      answerSet(broken, { ...broken.question, attribute: "mood" }),
    ).toThrow();
  });
});
