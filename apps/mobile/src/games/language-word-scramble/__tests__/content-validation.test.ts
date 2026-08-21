// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  MIN_WORD_BANK_SIZE,
  WORD_BANK,
  WordBankError,
  loadWordBank,
  validateWordBank,
} from "../content-validation";

/** Deep-clone the raw bank entries for mutation tests. */
function cloneBank(): { word: string; category: string }[] {
  return WORD_BANK.map((e) => ({ word: e.word, category: e.category }));
}

describe("bundled word bank validation", () => {
  it("loadWordBank validates the bundled bank at module load", () => {
    const bank = loadWordBank();
    expect(bank.length).toBeGreaterThanOrEqual(MIN_WORD_BANK_SIZE);
    // Every entry is a single lowercase token.
    for (const entry of bank) {
      expect(entry.word).toMatch(/^[a-z]+$/);
    }
  });

  it("has no duplicate normalized words", () => {
    const bank = loadWordBank();
    const norms = new Set(bank.map((e) => e.word));
    expect(norms.size).toBe(bank.length);
  });

  it("rejects non-array input", () => {
    expect(() => validateWordBank(null)).toThrow(WordBankError);
    expect(() => validateWordBank({})).toThrow(WordBankError);
  });

  it("rejects a bank smaller than the coverage floor", () => {
    const small = cloneBank().slice(0, 10);
    expect(() => validateWordBank(small)).toThrow(/at least/);
  });

  it("rejects a non-string / empty word", () => {
    const bank = cloneBank();
    // @ts-expect-error - intentionally malformed
    bank[0].word = 42;
    expect(() => validateWordBank(bank)).toThrow(/word/);
    const empty = cloneBank();
    empty[1].word = "   ";
    expect(() => validateWordBank(empty)).toThrow(/non-empty/);
  });

  it("rejects a word that is not already normalized (mixed case / whitespace / punctuation)", () => {
    const mixed = cloneBank();
    mixed[0].word = "Apple";
    expect(() => validateWordBank(mixed)).toThrow(/trimmed, lowercase/);
    const space = cloneBank();
    space[0].word = "ice cream";
    expect(() => validateWordBank(space)).toThrow(/lowercase a-z/);
    const punct = cloneBank();
    punct[0].word = "can`t";
    expect(() => validateWordBank(punct)).toThrow(/lowercase a-z/);
  });

  it("rejects a word outside the length bounds", () => {
    const tooShort = cloneBank();
    tooShort[0].word = "ab";
    expect(() => validateWordBank(tooShort)).toThrow(/length/);
    const tooLong = cloneBank();
    tooLong[0].word = "abcdefghijklmnop";
    expect(() => validateWordBank(tooLong)).toThrow(/length/);
  });

  it("rejects a missing / empty category", () => {
    const bank = cloneBank();
    bank[0].category = "";
    expect(() => validateWordBank(bank)).toThrow(/category/);
    const missing = cloneBank();
    // @ts-expect-error - intentionally malformed
    delete missing[1].category;
    expect(() => validateWordBank(missing)).toThrow(/category/);
  });

  it("rejects a duplicate normalized word", () => {
    const bank = cloneBank();
    bank[1].word = bank[0].word;
    expect(() => validateWordBank(bank)).toThrow(/duplicate normalized word/);
  });
});
