/**
 * Deterministic word selection and letter-scramble generation for the
 * Word Scramble game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round forks the RNG
 * for independent word selection and scrambling.
 *
 * Near-duplicate avoidance: consecutive rounds do not reuse the same word
 * (checked against `prevAnswer`). The scramble always differs from the
 * original word.
 *
 * Distractor integrity (Campaign 014): distractors previously came from any
 * similar-length word, so sorting options by length/letters eliminated three
 * of four choices without ever unscrambling anything. Distractors are now
 * chosen by maximum LETTER-OVERLAP with the answer (multiset intersection),
 * so wrong options look like plausible rearrangements and eliminating them
 * genuinely requires solving the scramble. True anagrams of the answer can
 * never be distractors (they would be equally valid solutions), and the
 * length band stays as the candidate pool filter.
 */
import type { Rng } from "@/sdk";

import { categoryForWord, WORD_BANK } from "./content/word-bank";
import type { WordScrambleRound } from "./types";

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_WORD_ATTEMPTS = 12;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Number of options (including correct answer). */
  readonly optionsCount: number;
  /** Minimum word length to accept. */
  readonly minWordLength: number;
  /** Maximum word length to accept. */
  readonly maxWordLength: number;
  /** Previous round's answer, or null for round 0. */
  readonly prevAnswer: string | null;
}

/**
 * Scramble a word's letters so the result differs from the original.
 * Uses Fisher-Yates via the SDK RNG. Retries up to MAX_WORD_ATTEMPTS times
 * to ensure the scrambled version is different.
 */
export function scrambleWord(word: string, rng: Rng): string {
  const letters = word.split("");
  for (let attempt = 0; attempt < MAX_WORD_ATTEMPTS; attempt += 1) {
    const shuffled = rng.fork(`scramble:${attempt}`).shuffle(letters);
    const result = shuffled.join("");
    if (result !== word) {
      return result;
    }
  }
  // Fallback: swap the first pair of adjacent differing characters
  // (guarantees a different string whenever the word has two distinct
  // letters; unreachable for the curated bank, kept as a safe bound).
  for (let i = 0; i < letters.length - 1; i += 1) {
    if (letters[i] !== letters[i + 1]) {
      const swapped = [...letters];
      const temp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = temp;
      return swapped.join("");
    }
  }
  return word;
}

/**
 * Size of the letter multiset shared by `a` and `b` (multiset intersection).
 * The plausibility metric for distractors: higher overlap ⇒ harder to rule
 * out without actually unscrambling.
 */
export function letterOverlap(a: string, b: string): number {
  const counts = new Map<string, number>();
  for (const ch of a) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let shared = 0;
  for (const ch of b) {
    const left = counts.get(ch) ?? 0;
    if (left > 0) {
      shared += 1;
      counts.set(ch, left - 1);
    }
  }
  return shared;
}

/**
 * Select distractor words for a round. Candidates stay within ±1 letter of
 * the answer's length; among them, MAXIMUM letter-overlap wins so every
 * wrong option is a near-rearrangement of the displayed letters. Ties break
 * by a pre-shuffle (seeded), keeping selection deterministic. The answer
 * itself is excluded by definition — and so is every other word with the
 * SAME multiset (a true anagram would be a second correct solution).
 */
export function selectDistractors(
  answer: string,
  count: number,
  rng: Rng,
): string[] {
  const answerLen = answer.length;
  const answerCounts = new Map<string, number>();
  for (const ch of answer) {
    answerCounts.set(ch, (answerCounts.get(ch) ?? 0) + 1);
  }
  const sameMultiset = (word: string): boolean => {
    if (word.length !== answerLen) {
      return false;
    }
    const counts = new Map(answerCounts);
    for (const ch of word) {
      const left = counts.get(ch) ?? 0;
      if (left === 0) {
        return false;
      }
      counts.set(ch, left - 1);
    }
    return counts.size === 0 || [...counts.values()].every((n) => n === 0);
  };
  const candidates = WORD_BANK.filter(
    (e) =>
      e.word !== answer &&
      !sameMultiset(e.word) &&
      Math.abs(e.word.length - answerLen) <= 1,
  );
  if (candidates.length === 0) {
    // Extremely rare: fall back to any non-anagram word not equal to the
    // answer (integrity rule outranks the length band).
    const fallback = WORD_BANK.filter(
      (e) => e.word !== answer && !sameMultiset(e.word),
    );
    const shuffled = rng.shuffle(fallback);
    return shuffled.slice(0, count - 1).map((e) => e.word);
  }
  // Pre-shuffle gives equal-overlap ties a seeded order; the stable sort then
  // ranks strictly by plausibility.
  const shuffled = rng.shuffle(candidates);
  const ranked = shuffled
    .map((entry) => ({ word: entry.word, overlap: letterOverlap(answer, entry.word) }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, count - 1)
    .map((entry) => entry.word);
  return ranked;
}

/**
 * Generate one round: pick a word, scramble it, build the option set.
 * The answer is placed at a random position in the options array.
 */
export function generateRound(input: GenerateRoundInput): WordScrambleRound {
  const {
    rng,
    roundIndex,
    optionsCount,
    minWordLength,
    maxWordLength,
    prevAnswer,
  } = input;

  // Step 1: Build the eligible word pool (length filter + near-duplicate avoidance).
  const pool = WORD_BANK.filter((e) => {
    if (e.word.length < minWordLength || e.word.length > maxWordLength) {
      return false;
    }
    if (prevAnswer !== null && e.word === prevAnswer) {
      return false;
    }
    return true;
  });

  // Step 2: Pick the answer word.
  const wordRng = rng.fork(`round:${roundIndex}:word`);
  let answer: string;
  if (pool.length === 0) {
    // Fallback: use any word not equal to prevAnswer.
    const fallbackPool = WORD_BANK.filter(
      (e) => prevAnswer === null || e.word !== prevAnswer,
    );
    answer = rng.pick(fallbackPool).word;
  } else {
    answer = wordRng.pick(pool).word;
  }

  // Step 3: Scramble the answer.
  const scrambleRng = rng.fork(`round:${roundIndex}:scramble`);
  const scrambled = scrambleWord(answer, scrambleRng);

  // Step 4: Select distractors and build options.
  const distractorRng = rng.fork(`round:${roundIndex}:distractors`);
  const distractors = selectDistractors(answer, optionsCount, distractorRng);

  // Place the correct answer at a random position.
  const placementRng = rng.fork(`round:${roundIndex}:placement`);
  const correctIndex = placementRng.nextInt(optionsCount);
  const options: string[] = [...distractors];
  options.splice(correctIndex, 0, answer);

  return {
    answer,
    category: categoryForWord(answer),
    scrambled,
    options,
    correctIndex,
    wordLength: answer.length,
  };
}

/**
 * Generate all rounds for a session. Returns an array of round data in
 * order, deterministic for the given seed and params.
 */
export function generateFullSession(
  rng: Rng,
  rounds: number,
  optionsCount: number,
  minWordLength: number,
  maxWordLength: number,
): WordScrambleRound[] {
  const result: WordScrambleRound[] = [];
  let prevAnswer: string | null = null;
  for (let i = 0; i < rounds; i += 1) {
    const round = generateRound({
      rng,
      roundIndex: i,
      optionsCount,
      minWordLength,
      maxWordLength,
      prevAnswer,
    });
    result.push(round);
    prevAnswer = round.answer;
  }
  return result;
}
