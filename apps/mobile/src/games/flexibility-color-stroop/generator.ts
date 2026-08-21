/**
 * Deterministic sequence generation for the Color Stroop game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * The generator produces a sequence of trials with controlled incongruent
 * ratio and rule-flip points. Each trial's correct answer depends on the
 * current rule, which may flip at scheduled intervals.
 */
import type { Rng } from '@/sdk';

import {
  NEUTRAL_WORDS,
  STROOP_COLORS,
  type AnswerRule,
  type ColorStroopDifficultyParams,
  type StroopColor,
  type StroopTrial,
} from './types';

export interface GenerateTrialsInput {
  readonly rng: Rng;
  readonly params: ColorStroopDifficultyParams;
}

/**
 * Generate the full trial sequence for a session.
 *
 * Invariants:
 * - Same seed + params always produces the same trial sequence.
 * - The incongruent ratio is respected (within rounding).
 * - Rule flips occur at the scheduled intervals.
 * - Congruent trials have word === inkColor.
 * - Incongruent trials have word !== inkColor.
 * - Neutral trials use non-color words AND always run under the 'ink' rule:
 *   a neutral word ("TABLE") names no color, so a 'word'-rule trial with a
 *   neutral word would be unanswerable.
 * - The first trial always starts with the 'ink' rule.
 */
export function generateTrials(input: GenerateTrialsInput): StroopTrial[] {
  const { rng, params } = input;
  const { trials: totalTrials, incongruentRatio, flipFrequency } = params;

  // Determine how many incongruent trials to generate.
  const numIncongruent = Math.round(totalTrials * incongruentRatio);
  const numNeutral = Math.min(
    Math.floor((totalTrials - numIncongruent) * 0.3),
    Math.floor(totalTrials * 0.2),
  );
  const numCongruent = totalTrials - numIncongruent - numNeutral;

  // Create a pool of trial types and shuffle.
  const trialTypes: ('congruent' | 'incongruent' | 'neutral')[] = [
    ...Array.from({ length: numCongruent }, () => 'congruent' as const),
    ...Array.from({ length: numIncongruent }, () => 'incongruent' as const),
    ...Array.from({ length: numNeutral }, () => 'neutral' as const),
  ];
  const shuffledTypes = rng.shuffle(trialTypes);

  // Precompute the rule schedule (flip cadence) so neutral trials can be
  // kept off 'word'-rule slots before any trial content is drawn.
  const rules: AnswerRule[] = [];
  let currentRule: AnswerRule = 'ink';
  let trialsSinceFlip = 0;
  for (let i = 0; i < totalTrials; i += 1) {
    const isFlipPoint = i > 0 && trialsSinceFlip >= flipFrequency;
    if (isFlipPoint) {
      currentRule = currentRule === 'ink' ? 'word' : 'ink';
      trialsSinceFlip = 0;
    }
    trialsSinceFlip += 1;
    rules.push(currentRule);
  }

  // Assign trial types to indices. Neutral trials may only occupy 'ink'-rule
  // slots (see invariant above); congruent/incongruent trials are answerable
  // under either rule and fill the remaining slots in shuffled order.
  const inkSlots: number[] = [];
  const wordSlots: number[] = [];
  for (let i = 0; i < totalTrials; i += 1) {
    (rules[i] === 'ink' ? inkSlots : wordSlots).push(i);
  }
  const assigned: ('congruent' | 'incongruent' | 'neutral')[] = new Array(totalTrials);
  let inkPtr = 0;
  let wordPtr = 0;
  for (const trialType of shuffledTypes) {
    if (trialType === 'neutral') {
      if (inkPtr < inkSlots.length) {
        assigned[inkSlots[inkPtr]] = 'neutral';
        inkPtr += 1;
      } else {
        // No 'ink' slot left for this neutral (virtually impossible with the
        // difficulty tunings): degrade deterministically to a congruent trial
        // so counts stay consistent.
        assigned[wordSlots[wordPtr]] = 'congruent';
        wordPtr += 1;
      }
    } else if (wordPtr < wordSlots.length) {
      assigned[wordSlots[wordPtr]] = trialType;
      wordPtr += 1;
    } else {
      assigned[inkSlots[inkPtr]] = trialType;
      inkPtr += 1;
    }
  }

  const result: StroopTrial[] = [];
  for (let i = 0; i < totalTrials; i += 1) {
    const isFlipPoint = i > 0 && rules[i] !== rules[i - 1];
    const trial = generateSingleTrial(rng.fork(`trial:${i}`), assigned[i], rules[i], isFlipPoint);
    result.push(trial);
  }

  return result;
}

/**
 * Generate a single trial with the specified type and rule.
 */
function generateSingleTrial(
  rng: Rng,
  trialType: 'congruent' | 'incongruent' | 'neutral',
  rule: AnswerRule,
  isFlipPoint: boolean,
): StroopTrial {
  const wordColor = rng.pick(STROOP_COLORS);
  let inkColor: StroopColor;
  let word: string;

  switch (trialType) {
    case 'congruent': {
      inkColor = wordColor;
      word = wordColor.toUpperCase();
      break;
    }
    case 'incongruent': {
      // Pick a different color for the ink.
      const otherColors = STROOP_COLORS.filter((c) => c !== wordColor);
      inkColor = rng.pick(otherColors);
      word = wordColor.toUpperCase();
      break;
    }
    case 'neutral': {
      inkColor = rng.pick(STROOP_COLORS);
      word = rng.pick(NEUTRAL_WORDS);
      break;
    }
  }

  // Determine the correct answer based on the current rule.
  const correctAnswer = rule === 'ink' ? inkColor : (wordColor as StroopColor);

  return {
    word,
    inkColor,
    correctAnswer,
    rule,
    isFlipPoint,
    trialType,
  };
}

/**
 * Validate a trial sequence for correctness.
 * Returns true if all invariants hold.
 */
export function validateTrials(trials: readonly StroopTrial[]): boolean {
  for (let i = 0; i < trials.length; i += 1) {
    const trial = trials[i];

    // Congruent: word color matches ink color.
    if (trial.trialType === 'congruent') {
      if (trial.word !== trial.inkColor.toUpperCase()) {
        return false;
      }
    }

    // Incongruent: word color differs from ink color.
    if (trial.trialType === 'incongruent') {
      if (trial.word === trial.inkColor.toUpperCase()) {
        return false;
      }
    }

    // Neutral: word is not a color word.
    if (trial.trialType === 'neutral') {
      if (STROOP_COLORS.includes(trial.word.toLowerCase() as StroopColor)) {
        return false;
      }
      // A neutral word names no color, so it must never run under the
      // 'word' rule (the trial would be unanswerable).
      if (trial.rule !== 'ink') {
        return false;
      }
    }

    // Rule flip points should not be the first trial.
    if (trial.isFlipPoint && i === 0) {
      return false;
    }
  }

  return true;
}