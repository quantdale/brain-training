/**
 * Sentence Builder — content-pack validation.
 *
 * Like the other curated Language games, the sentence bank must be validated
 * mechanically at module load so a malformed bank fails fast instead of
 * producing ambiguous or broken rounds. This module closes the gap (only
 * `language-word-match` previously shipped a validator) and enforces:
 *
 *   - every sentence text is non-empty and trimmed;
 *   - `wordCount` matches the actual whitespace-split token count (catches a
 *     common authoring bug where the count drifts from the text);
 *   - every used category is a declared `CATEGORY_LABELS` key (no typos /
 *     orphan categories);
 *   - no two sentences normalize to the same text (duplicate normalized form);
 *   - all ten declared categories are represented in the bank.
 */
import {
  CATEGORY_LABELS,
  SENTENCE_BANK as RAW_SENTENCE_BANK,
} from "./content/sentence-bank";
import type { CuratedSentence } from "./types";

/** Thrown when the bundled sentence bank violates the content contract. */
export class SentenceBankError extends Error {
  constructor(message: string) {
    super(`SentenceBank: ${message}`);
    this.name = "SentenceBankError";
  }
}

/** Minimum total bank size that keeps every difficulty tier well-supplied. */
export const MIN_SENTENCE_BANK_SIZE = 80;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate an unknown sentence-bank value into a frozen, verified array.
 * Throws `SentenceBankError` on the first violation. Every check is mechanical.
 */
export function validateSentenceBank(
  json: unknown,
): readonly CuratedSentence[] {
  if (!Array.isArray(json)) {
    throw new SentenceBankError("sentence bank must be an array of sentences");
  }
  if (json.length < MIN_SENTENCE_BANK_SIZE) {
    throw new SentenceBankError(
      `sentence bank must contain at least ${MIN_SENTENCE_BANK_SIZE} sentences (got ${json.length})`,
    );
  }

  const labels = new Set(Object.keys(CATEGORY_LABELS));
  const perCategory = new Map<string, number>();
  const seen = new Set<string>();

  json.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new SentenceBankError(`entries[${index}] must be an object`);
    }
    const where = `entries[${index}]`;
    const rawText = entry.text;
    const rawCategory = entry.category;
    const rawWordCount = entry.wordCount;

    if (typeof rawText !== "string" || rawText.trim().length === 0) {
      throw new SentenceBankError(`${where}.text must be a non-empty string`);
    }
    const trimmed = rawText.trim();
    if (typeof rawCategory !== "string" || !labels.has(rawCategory)) {
      throw new SentenceBankError(
        `${where}.category "${String(rawCategory)}" is not a declared CATEGORY_LABELS key`,
      );
    }
    if (
      typeof rawWordCount !== "number" ||
      !Number.isInteger(rawWordCount) ||
      rawWordCount < 2
    ) {
      throw new SentenceBankError(`${where}.wordCount must be an integer >= 2`);
    }
    const actual = trimmed.split(/\s+/).length;
    if (actual !== rawWordCount) {
      throw new SentenceBankError(
        `${where}.wordCount ${rawWordCount} does not match actual token count ${actual} for "${trimmed}"`,
      );
    }

    const norm = normalizeText(trimmed);
    if (seen.has(norm)) {
      throw new SentenceBankError(`duplicate normalized sentence "${norm}"`);
    }
    seen.add(norm);
    perCategory.set(rawCategory, (perCategory.get(rawCategory) ?? 0) + 1);
  });

  // Every declared category must be represented.
  for (const category of labels) {
    if ((perCategory.get(category) ?? 0) < 1) {
      throw new SentenceBankError(
        `declared category "${category}" has no sentences`,
      );
    }
  }

  return Object.freeze(json as CuratedSentence[]);
}

let cached: readonly CuratedSentence[] | null = null;

/** Validate and memoize the bundled bank; fails fast on a broken bank. */
export function loadSentenceBank(): readonly CuratedSentence[] {
  if (cached === null) {
    cached = validateSentenceBank(RAW_SENTENCE_BANK);
  }
  return cached;
}

// Re-export the validated bank and the category labels so consumers get a
// single, validated source.
export { CATEGORY_LABELS };
export const SENTENCE_BANK: readonly CuratedSentence[] = loadSentenceBank();
