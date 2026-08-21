/**
 * Word Scramble — content-pack validation.
 *
 * The other curated Language games ship a `content-validation.ts` that
 * mechanically validates their bank at module load and rejects malformed
 * content (see `language-word-match/content-validation.ts`). Word Scramble
 * shipped only a typed `word-bank.ts`; this module closes that gap so the
 * bank is validated exactly once (memoized) and a broken bank fails fast
 * instead of producing broken rounds.
 *
 * Normalization contract (mechanical, no hand-asserted semantics):
 *   - every entry word is a single trimmed, lowercase token (no internal
 *     whitespace, no punctuation, no mixed case);
 *   - no two entries normalize to the same word (duplicate normalized form);
 *   - every entry has a non-empty category;
 *   - the bank meets a coverage floor so difficulty tiers have enough
 *     material to draw distinct rounds.
 */
import {
  WORD_BANK as RAW_WORD_BANK,
  WORD_LIST,
  categoryForWord,
} from "./content/word-bank";
import type { WordEntry } from "./content/word-bank";

/** Thrown when the bundled word bank violates the content contract. */
export class WordBankError extends Error {
  constructor(message: string) {
    super(`WordBank: ${message}`);
    this.name = "WordBankError";
  }
}

/** Minimum bank size that keeps every difficulty tier well-supplied. */
export const MIN_WORD_BANK_SIZE = 150;

/** Lower/upper bounds on a single answer word's length. */
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 14;

function isPlainWord(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]+$/.test(value);
}

/**
 * Validate an unknown word-bank value into a frozen, verified array.
 * Throws `WordBankError` on the first violation. Every check is mechanical.
 */
export function validateWordBank(json: unknown): readonly WordEntry[] {
  if (!Array.isArray(json)) {
    throw new WordBankError("word bank must be an array of entries");
  }
  if (json.length < MIN_WORD_BANK_SIZE) {
    throw new WordBankError(
      `word bank must contain at least ${MIN_WORD_BANK_SIZE} entries (got ${json.length})`,
    );
  }

  const seen = new Set<string>();
  json.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new WordBankError(`entries[${index}] must be an object`);
    }
    const where = `entries[${index}]`;
    const rawWord = (entry as Record<string, unknown>).word;
    const rawCategory = (entry as Record<string, unknown>).category;

    if (typeof rawWord !== "string" || rawWord.trim().length === 0) {
      throw new WordBankError(`${where}.word must be a non-empty string`);
    }
    // Normalize: trim + lowercase; reject anything that changes under
    // normalization (mixed case, internal whitespace, punctuation).
    const normalized = rawWord.trim().toLowerCase();
    if (normalized !== rawWord) {
      throw new WordBankError(
        `${where}.word "${rawWord}" must already be trimmed, lowercase, and punctuation-free`,
      );
    }
    if (!isPlainWord(rawWord)) {
      throw new WordBankError(
        `${where}.word "${rawWord}" must contain only lowercase a-z letters`,
      );
    }
    if (rawWord.length < MIN_WORD_LENGTH || rawWord.length > MAX_WORD_LENGTH) {
      throw new WordBankError(
        `${where}.word "${rawWord}" length ${rawWord.length} outside [${MIN_WORD_LENGTH}, ${MAX_WORD_LENGTH}]`,
      );
    }
    if (typeof rawCategory !== "string" || rawCategory.trim().length === 0) {
      throw new WordBankError(`${where}.category must be a non-empty string`);
    }
    if (seen.has(normalized)) {
      throw new WordBankError(`duplicate normalized word "${normalized}"`);
    }
    seen.add(normalized);
  });

  return Object.freeze(json as WordEntry[]);
}

let cached: readonly WordEntry[] | null = null;

/** Validate and memoize the bundled bank; fails fast on a broken bank. */
export function loadWordBank(): readonly WordEntry[] {
  if (cached === null) {
    cached = validateWordBank(RAW_WORD_BANK);
  }
  return cached;
}

// Re-export the validated bank and its derived helpers so the generator can
// import a single module and always get a validated bank.
export { WORD_LIST, categoryForWord };
export const WORD_BANK: readonly WordEntry[] = loadWordBank();
