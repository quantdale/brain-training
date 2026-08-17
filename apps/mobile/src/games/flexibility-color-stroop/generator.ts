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
 * - Neutral trials use non-color words.
 * - The first trial always starts with the 'ink' rule.
 */
export function generateTrials(input: GenerateTrialsInput): StroopTrial[] {
  const { rng, params } = input;
  const { trials: totalTrials, incongruentRatio, flipFrequency } = params;

  const result: StroopTrial[] = [];
  let currentRule: AnswerRule = 'ink';
  let trialsSinceFlip = 0;

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

  for (let i = 0; i < totalTrials; i += 1) {
    // Check for rule flip.
    const isFlipPoint = i > 0 && trialsSinceFlip >= flipFrequency;
    if (isFlipPoint) {
      currentRule = currentRule === 'ink' ? 'word' : 'ink';
      trialsSinceFlip = 0;
    }
    trialsSinceFlip += 1;

    const trialType = shuffledTypes[i];
    const trial = generateSingleTrial(rng.fork(`trial:${i}`), trialType, currentRule, isFlipPoint);
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
    }

    // Rule flip points should not be the first trial.
    if (trial.isFlipPoint && i === 0) {
      return false;
    }
  }

  return true;
}