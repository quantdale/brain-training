// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { generateRound } from "../generator";
import { WORD_BANK } from "../content/word-bank";
import type { WordScrambleRound } from "../types";

/** Build one round directly with explicit params. */
function round(
  seed: string,
  roundIndex: number,
  optionsCount: number,
  minWordLength: number,
  maxWordLength: number,
  prevAnswer: string | null,
): WordScrambleRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    optionsCount,
    minWordLength,
    maxWordLength,
    prevAnswer,
  });
}

describe("word-scramble option correctness (correctIndex always valid)", () => {
  const optionsCounts = [3, 4, 5];
  const seeds = Array.from({ length: 60 }, (_, i) => `correct-${i}`);

  for (const optionsCount of optionsCounts) {
    it(`correctIndex points at the answer for optionsCount=${optionsCount} across many seeds`, () => {
      for (const seed of seeds) {
        const r = round(seed, 0, optionsCount, 4, 10, null);
        expect(r.options).toContain(r.answer);
        expect(r.options[r.correctIndex]).toBe(r.answer);
        expect(r.correctIndex).toBeGreaterThanOrEqual(0);
        expect(r.correctIndex).toBeLessThan(r.options.length);
        // Options must be distinct (no duplicate answers/distractors).
        expect(new Set(r.options).size).toBe(r.options.length);
        // The scrambled form must differ from the answer.
        expect(r.scrambled).not.toBe(r.answer);
      }
    });
  }

  it("stays correct across a full multi-round session for every difficulty range", () => {
    const ranges: [number, number, number][] = [
      [3, 4, 5],
      [4, 4, 6],
      [4, 5, 8],
      [5, 6, 10],
    ];
    for (const [optionsCount, minLen, maxLen] of ranges) {
      let prev: string | null = null;
      for (let i = 0; i < 8; i += 1) {
        const r = round(
          `session-${optionsCount}-${minLen}-${maxLen}-${i}`,
          i,
          optionsCount,
          minLen,
          maxLen,
          prev,
        );
        expect(r.options[r.correctIndex]).toBe(r.answer);
        expect(new Set(r.options).size).toBe(r.options.length);
        prev = r.answer;
      }
    }
  });
});

describe("word-bank content integrity", () => {
  it("has no duplicate words", () => {
    const seen = new Set<string>();
    for (const e of WORD_BANK) {
      expect(seen.has(e.word)).toBe(false);
      seen.add(e.word);
    }
  });

  it("has no anagram pairs (no two words share the same letter multiset)", () => {
    const key = (w: string) => w.split("").sort().join("");
    const groups = new Map<string, string[]>();
    for (const e of WORD_BANK) {
      const k = key(e.word);
      const g = groups.get(k) ?? [];
      g.push(e.word);
      groups.set(k, g);
    }
    for (const [, g] of groups) {
      expect(g).toHaveLength(1);
    }
  });

  it("every word is single-token lowercase a-z with length >= 3", () => {
    for (const e of WORD_BANK) {
      expect(e.word).toMatch(/^[a-z]+$/);
      expect(e.word.length).toBeGreaterThanOrEqual(3);
    }
  });
});
