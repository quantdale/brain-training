// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  CATEGORY_LABELS,
  MIN_SENTENCE_BANK_SIZE,
  SENTENCE_BANK,
  SentenceBankError,
  loadSentenceBank,
  validateSentenceBank,
} from "../content-validation";

/** Deep-clone the raw bank entries for mutation tests. */
function cloneBank(): { text: string; category: string; wordCount: number }[] {
  return SENTENCE_BANK.map((s) => ({
    text: s.text,
    category: s.category,
    wordCount: s.wordCount,
  }));
}

describe("bundled sentence bank validation", () => {
  it("loadSentenceBank validates the bundled bank at module load", () => {
    const bank = loadSentenceBank();
    expect(bank.length).toBeGreaterThanOrEqual(MIN_SENTENCE_BANK_SIZE);
    for (const sentence of bank) {
      expect(sentence.text.trim().length).toBeGreaterThan(0);
      expect(CATEGORY_LABELS).toHaveProperty(sentence.category);
      expect(sentence.wordCount).toBe(sentence.text.split(/\s+/).length);
    }
  });

  it("has no duplicate normalized sentences", () => {
    const bank = loadSentenceBank();
    const norms = new Set(
      bank.map((s) => s.text.replace(/\s+/g, " ").trim().toLowerCase()),
    );
    expect(norms.size).toBe(bank.length);
  });

  it("rejects non-array input", () => {
    expect(() => validateSentenceBank(null)).toThrow(SentenceBankError);
    expect(() => validateSentenceBank({})).toThrow(SentenceBankError);
  });

  it("rejects a bank smaller than the coverage floor", () => {
    expect(() => validateSentenceBank(cloneBank().slice(0, 10))).toThrow(
      /at least/,
    );
  });

  it("rejects an empty / whitespace-only text", () => {
    const bank = cloneBank();
    bank[0].text = "   ";
    expect(() => validateSentenceBank(bank)).toThrow(/non-empty/);
  });

  it("rejects a category that is not a declared CATEGORY_LABELS key", () => {
    const bank = cloneBank();
    bank[0].category = "not-a-real-category";
    expect(() => validateSentenceBank(bank)).toThrow(/not a declared/);
  });

  it("rejects a wordCount that drifts from the actual token count", () => {
    const bank = cloneBank();
    // The real sentence has 5 words; claim 6 to simulate an authoring drift.
    bank[0].wordCount = bank[0].text.split(/\s+/).length + 1;
    expect(() => validateSentenceBank(bank)).toThrow(
      /does not match actual token count/,
    );
  });

  it("rejects a duplicate normalized sentence", () => {
    const bank = cloneBank();
    bank[1].text = bank[0].text;
    bank[1].wordCount = bank[0].wordCount;
    expect(() => validateSentenceBank(bank)).toThrow(
      /duplicate normalized sentence/,
    );
  });

  it("rejects a bank missing a declared category", () => {
    const bank = cloneBank().filter((s) => s.category !== "idiomatic");
    expect(() => validateSentenceBank(bank)).toThrow(/has no sentences/);
  });
});

describe("alternative word-order validation", () => {
  const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

  /** Build an 8-token filler sentence with a unique text and a rotating category. */
  function filler(i: number): { text: string; category: string; wordCount: number } {
    return {
      text: `Filler sentence number ${i} walks home today now`,
      category: ALL_CATEGORIES[i % ALL_CATEGORIES.length],
      wordCount: 8,
    };
  }

  function bankWithFirst(entry: Record<string, unknown>): unknown[] {
    const rest = Array.from({ length: MIN_SENTENCE_BANK_SIZE - 1 }, (_, i) => filler(i + 1));
    return [{ category: "conditional", ...entry }, ...rest];
  }

  it("accepts alternatives that are exact word-permutations of the original", () => {
    const bank = bankWithFirst({
      text: "If she finishes early she might join us",
      wordCount: 8,
      alternatives: ["She might join us if she finishes early"],
    });
    expect(() => validateSentenceBank(bank)).not.toThrow();
  });

  it("rejects an alternative that is not a word-permutation", () => {
    const bank = bankWithFirst({
      text: "If she finishes early she might join us",
      wordCount: 8,
      alternatives: ["She might join us if she finishes early today"],
    });
    expect(() => validateSentenceBank(bank)).toThrow(/not a word-permutation/);
  });

  it("rejects an alternative identical to the original", () => {
    const bank = bankWithFirst({
      text: "If she finishes early she might join us",
      wordCount: 8,
      alternatives: ["if SHE finishes early she might join us"],
    });
    expect(() => validateSentenceBank(bank)).toThrow(/duplicates the original/);
  });

  it("rejects duplicate alternatives within one sentence", () => {
    const bank = bankWithFirst({
      text: "If she finishes early she might join us",
      wordCount: 8,
      alternatives: [
        "She might join us if she finishes early",
        "She might join us if she finishes early",
      ],
    });
    expect(() => validateSentenceBank(bank)).toThrow(/duplicate alternative/);
  });

  it("rejects a non-array alternatives field", () => {
    const bank = bankWithFirst({
      text: "If she finishes early she might join us",
      wordCount: 8,
      alternatives: "She might join us if she finishes early",
    });
    expect(() => validateSentenceBank(bank)).toThrow(/must be an array/);
  });

  it("bundled bank declares clause-swap alternatives for ambiguous sentences", () => {
    const withAlts = SENTENCE_BANK.filter((s) => s.alternatives !== undefined && s.alternatives.length > 0);
    // The conditional category alone contributes 14; pin a floor so the
    // ambiguity fix cannot silently regress to an empty annotation set.
    expect(withAlts.length).toBeGreaterThanOrEqual(30);
    for (const s of withAlts) {
      for (const alt of s.alternatives ?? []) {
        expect(alt.split(/\s+/).length).toBe(s.wordCount);
      }
    }
  });
});
