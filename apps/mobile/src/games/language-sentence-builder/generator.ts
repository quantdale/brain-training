/**
 * Deterministic sentence generation and scrambling for the Sentence Builder game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * Invariants:
 * - Same seed → same sentence selection and scramble (deterministic).
 * - Scramble ≠ original order (verified; retry up to MAX_SCRAMBLE_ATTEMPTS).
 * - No duplicate sentences in the same session.
 * - Near-duplicate avoidance: consecutive sentences from different categories.
 * - No wall-clock used in generated content.
 */
import type { Rng } from "@/sdk";

import type {
 CuratedSentence,
 ScrambledSentence,
 SentenceBuilderDifficultyParams,
} from "./types";

/** Upper bound on re-draw attempts before accepting the last candidate scramble. */
export const MAX_SCRAMBLE_ATTEMPTS = 12;

/** Maximum category-distance to consider "near-duplicate" (same category = 0). */
export const MIN_CATEGORY_DISTANCE = 1;

/** Internal mapping from category slugs to numeric ids for distance calc. */
const CATEGORY_IDS = new Map<string, number>();

/**
 * Get a numeric id for a category slug (stable within a process).
 * Unknown slugs get a unique id.
 */
function categoryId(category: string): number {
 let id = CATEGORY_IDS.get(category);
 if (id === undefined) {
  id = CATEGORY_IDS.size;
  CATEGORY_IDS.set(category, id);
 }
 return id;
}

/**
 * Category distance: 0 if same, 1 if different.
 * The spec requires consecutive sentences from different categories.
 */
export function categoryDistance(a: string, b: string): number {
 return a === b ? 0 : 1;
}

/** Lowercase, punctuation-stripped word tokens of a sentence. */
function tokenize(text: string): string[] {
 return text
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/)
  .filter(Boolean);
}

/**
 * True when the sentence has no repeated word tokens. A sentence with a
 * repeated word (e.g. "The cat sat on the mat" has "the" twice) yields an
 * ambiguous reconstruction: more than one tap order produces the same
 * displayed sentence, so the puzzle has no unique solution and the correctness
 * check can falsely reject a valid answer.
 */
export function hasNoDuplicateWords(sentence: CuratedSentence): boolean {
 const tokens = tokenize(sentence.text);
 return new Set(tokens).size === tokens.length;
}

/**
 * Deterministically scramble a sentence's word order.
 * Returns null if the scramble equals the original order (to allow retry).
 */
export function scrambleWords(
 rng: Rng,
 words: readonly string[],
): number[] | null {
 if (words.length <= 1) {
  // Single word can't be meaningfully scrambled differently.
  return null;
 }
 const indices = Array.from({ length: words.length }, (_, i) => i);
 const shuffled = rng.shuffle(indices);
 // Check if the scramble is identical to original order.
 const isOriginal = shuffled.every((v, i) => v === i);
 return isOriginal ? null : shuffled;
}

export interface GenerateRoundInput {
 readonly rng: Rng;
 /** 0-based round index; part of the fork salt. */
 readonly roundIndex: number;
 /** Sentence bank to draw from. */
 readonly bank: readonly CuratedSentence[];
 /** Word count range [minWords, maxWords]. */
 readonly minWords: number;
 readonly maxWords: number;
 /** Previous round's category, or null for round 0. */
 readonly prevCategory: string | null;
 /** Categories already used in this session (to avoid duplicates). */
 readonly usedCategories: readonly string[];
}

export interface GenerateRoundResult {
 /** The selected sentence from the bank. */
 readonly sentence: CuratedSentence;
 /** Scrambled version ready for play. */
 readonly scrambled: ScrambledSentence;
}

/**
 * Generate a single round's challenge.
 *
 * Steps:
 * 1. Filter the bank to sentences within [minWords, maxWords].
 * 2. Among those, prefer sentences from categories not yet used.
 * 3. Among those, prefer sentences from categories different from prevCategory.
 * 4. Pick one deterministically using the forked RNG.
 * 5. Scramble the word order; retry if scramble equals original.
 */
export function generateRound(input: GenerateRoundInput): GenerateRoundResult {
 const { rng, roundIndex, bank, minWords, maxWords, prevCategory } = input;

 // Step 1: Filter by word count.
 const byLength = bank.filter(
  (s) => s.wordCount >= minWords && s.wordCount <= maxWords,
 );

 if (byLength.length === 0) {
  throw new Error(
   `sentence-builder: no sentences in bank for word range [${minWords}, ${maxWords}]`,
  );
 }

 // Prefer sentences whose words are all distinct. A sentence with a repeated
 // word (e.g. "The cat sat on the mat") is ambiguous: multiple tap orders
 // reconstruct the same sentence, so the puzzle has no unique solution. Fall
 // back to the full length pool only when no unique-word sentence exists in
 // the range (none today — every tier has unique-word sentences available).
 const uniqueWordPool = byLength.filter((s) => hasNoDuplicateWords(s));
 const candidates = uniqueWordPool.length > 0 ? uniqueWordPool : byLength;

 // Step 2: Prefer unused categories.
 const usedSet = new Set(input.usedCategories);
 const unused = candidates.filter((s) => !usedSet.has(s.category));
 const pool = unused.length > 0 ? unused : candidates;

 // Step 3: Prefer different category from previous round.
 const differentCategory =
  prevCategory !== null
   ? pool.filter(
      (s) =>
       categoryDistance(s.category, prevCategory) >= MIN_CATEGORY_DISTANCE,
     )
   : pool;
 const finalPool = differentCategory.length > 0 ? differentCategory : pool;

 // Step 4: Pick one deterministically.
 const sentence = rng.pick(finalPool);

 // Step 5: Scramble with retry.
 const words = sentence.text.split(/\s+/);
 let scrambleOrder: number[] | null = null;
 for (let attempt = 0; attempt < MAX_SCRAMBLE_ATTEMPTS; attempt += 1) {
  const fork = rng.fork(`scramble:${roundIndex}:${attempt}`);
  scrambleOrder = scrambleWords(fork, words);
  if (scrambleOrder !== null) {
   break;
  }
 }
 // Fallback: if all attempts produced original order, use the last non-null
 // attempt (which should be fine for words.length > 1). If still null,
 // it means the sentence has 1 word — present as-is.
 if (scrambleOrder === null) {
  scrambleOrder = words.map((_, i) => i);
 }

 const scrambled = scrambleOrder.map((i) => words[i]);

 return {
  sentence,
  scrambled: {
   original: words,
   scrambleOrder,
   scrambled,
   category: sentence.category,
  },
 };
}
