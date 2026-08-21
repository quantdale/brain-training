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
