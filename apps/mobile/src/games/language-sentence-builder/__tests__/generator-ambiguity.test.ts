// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { SENTENCE_BANK } from "../content/sentence-bank";
import { DIFFICULTY_PARAMS } from "../difficulty";
import {
  acceptedOrdersOf,
  generateRound,
  hasNoDuplicateWords,
  sameWordOrder,
} from "../generator";
import type { CuratedSentence } from "../types";

describe("hasNoDuplicateWords", () => {
  it("detects sentences with repeated words as ambiguous", () => {
    const ambiguous: CuratedSentence = {
      text: "The cat sat on the mat",
      category: "simple-past",
      wordCount: 6,
    };
    expect(hasNoDuplicateWords(ambiguous)).toBe(false);
  });

  it("accepts sentences whose words are all distinct", () => {
    const ok: CuratedSentence = {
      text: "She walked to the store yesterday",
      category: "simple-past",
      wordCount: 6,
    };
    expect(hasNoDuplicateWords(ok)).toBe(true);
  });

  it("is case-insensitive about duplicate detection", () => {
    const ambiguous: CuratedSentence = {
      text: "We can leave now or we can wait here",
      category: "compound",
      wordCount: 9,
    };
    expect(hasNoDuplicateWords(ambiguous)).toBe(false);
  });
});

describe("generateRound ambiguity guard", () => {
  const levels = ["easy", "normal", "hard", "expert"] as const;

  for (const level of levels) {
    it(`never selects a sentence with duplicate words for ${level} (many seeds)`, () => {
      const params = DIFFICULTY_PARAMS[level];
      const seeds = Array.from({ length: 40 }, (_, i) => `audit-${level}-${i}`);
      for (const seed of seeds) {
        const rng = createRng(seed);
        // Simulate a multi-round session using the public generateRound API.
        const usedCategories: string[] = [];
        let prevCategory: string | null = null;
        for (let round = 0; round < params.rounds; round += 1) {
          const { sentence } = generateRound({
            rng,
            roundIndex: round,
            bank: SENTENCE_BANK,
            minWords: params.minWords,
            maxWords: params.maxWords,
            prevCategory,
            usedCategories,
          });
          expect(hasNoDuplicateWords(sentence)).toBe(true);
          usedCategories.push(sentence.category);
          prevCategory = sentence.category;
        }
      }
    });
  }

  it("does not throw for any difficulty across many seeds", () => {
    for (const level of levels) {
      const params = DIFFICULTY_PARAMS[level];
      for (let i = 0; i < 40; i += 1) {
        const rng = createRng(`throw-${level}-${i}`);
        expect(() =>
          generateRound({
            rng,
            roundIndex: 0,
            bank: SENTENCE_BANK,
            minWords: params.minWords,
            maxWords: params.maxWords,
            prevCategory: null,
            usedCategories: [],
          }),
        ).not.toThrow();
      }
    }
  });
});

describe("acceptedOrdersOf", () => {
  it("returns just the original when no alternatives are declared", () => {
    const sentence: CuratedSentence = {
      text: "He ate lunch at noon",
      category: "simple-past",
      wordCount: 5,
    };
    expect(acceptedOrdersOf(sentence)).toEqual([["He", "ate", "lunch", "at", "noon"]]);
  });

  it("includes every declared alternative as tokens (surface casing preserved)", () => {
    const sentence = SENTENCE_BANK.find((s) => s.alternatives !== undefined);
    expect(sentence).toBeDefined();
    const orders = acceptedOrdersOf(sentence!);
    expect(orders.length).toBe(1 + sentence!.alternatives!.length);
    // Every order is a permutation of the same token multiset (case-folded).
    const canonical = orders[0].map((w) => w.toLowerCase()).sort().join(" ");
    for (const order of orders) {
      expect(order.map((w) => w.toLowerCase()).sort().join(" ")).toBe(canonical);
    }
  });

  it("sameWordOrder compares element-wise", () => {
    expect(sameWordOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameWordOrder(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameWordOrder(["a"], ["a", "a"])).toBe(false);
  });
});

describe("generateRound scramble vs accepted orders", () => {
  const levels = ["easy", "normal", "hard", "expert"] as const;

  for (const level of levels) {
    it(`never deals a pre-solved board (scramble ≠ any accepted order) for ${level}`, () => {
      const params = DIFFICULTY_PARAMS[level];
      const seeds = Array.from({ length: 40 }, (_, i) => `presolved-${level}-${i}`);
      for (const seed of seeds) {
        const rng = createRng(seed);
        let prevCategory: string | null = null;
        const usedCategories: string[] = [];
        for (let round = 0; round < params.rounds; round += 1) {
          const { scrambled } = generateRound({
            rng,
            roundIndex: round,
            bank: SENTENCE_BANK,
            minWords: params.minWords,
            maxWords: params.maxWords,
            prevCategory,
            usedCategories,
          });
          for (const order of scrambled.acceptedOrders) {
            expect(sameWordOrder(order, scrambled.scrambled)).toBe(false);
          }
          usedCategories.push(scrambled.category);
          prevCategory = scrambled.category;
        }
      }
    });
  }

  it("carries the accepted orders of the selected sentence into the round", () => {
    const rng = createRng("carry-accepted");
    const { sentence, scrambled } = generateRound({
      rng,
      roundIndex: 0,
      bank: SENTENCE_BANK,
      minWords: DIFFICULTY_PARAMS.normal.minWords,
      maxWords: DIFFICULTY_PARAMS.normal.maxWords,
      prevCategory: null,
      usedCategories: [],
    });
    expect(scrambled.acceptedOrders).toEqual(acceptedOrdersOf(sentence));
    expect(scrambled.acceptedOrders[0]).toEqual([...scrambled.original]);
  });
});
