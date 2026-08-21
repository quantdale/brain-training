// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { SENTENCE_BANK } from "../content/sentence-bank";
import { DIFFICULTY_PARAMS } from "../difficulty";
import { generateRound, hasNoDuplicateWords } from "../generator";
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
