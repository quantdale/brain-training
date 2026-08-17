/**
 * Pure game state machine for the Equation Builder game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: timer pacing,
 * the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import { evaluateEquation } from './evaluator';
import {
  mathEquationBuilderParamsFromProfile,
  nextAdaptiveParams,
  resolveMathEquationBuilderDifficulty,
} from './difficulty';
import { generatePuzzle } from './generator';
import { partialCreditScore, perfectSessionScore, puzzleScore } from './scoring';
import {
  GAME_ID,
  INITIAL_STATS,
  createInitialMathEquationBuilderState,
} from './types';
import type {
  EquationToken,
  MathEquationBuilderAction,
  MathEquationBuilderGameState,
  MathEquationBuilderStats,
  Operator,
} from './types';

export { createInitialMathEquationBuilderState };

/**
 * Evaluate an equation built from tokens. Handles left-to-right evaluation
 * by default, with parentheses for grouping.
 *
 * Grammar (left-to-right, no standard precedence):
 *   expr → factor (op factor)*
 *   factor → number | '(' expr ')'
 */

/** Re-export from shared evaluator for backward compatibility. */
export { evaluateEquation as evaluateEquationTokens } from './evaluator';

/**
 * Validate that the equation tokens form a valid alternating sequence:
 * number, operator, number, operator, ..., number
 * with possible parentheses around numbers or sub-expressions.
 */
export function isValidEquationStructure(
  tokens: readonly EquationToken[],
  usedCount: number,
  totalNumbers: number,
): boolean {
  if (tokens.length === 0) return false;
  if (usedCount !== totalNumbers) return false;

  // Flatten: remove parentheses and check alternation.
  const flat: EquationToken[] = [];
  for (const t of tokens) {
    if (t !== '(' && t !== ')') flat.push(t);
  }

  // Must be odd length: num, op, num, op, ..., num
  if (flat.length % 2 === 0) return false;
  // Must start and end with a number.
  if (typeof flat[0] !== 'number') return false;
  if (typeof flat[flat.length - 1] !== 'number') return false;
  // Must alternate: num, op, num, op, ...
  for (let i = 0; i < flat.length; i += 1) {
    if (i % 2 === 0 && typeof flat[i] !== 'number') return false;
    if (i % 2 === 1 && typeof flat[i] !== 'number') return true; // operator check
  }

  return true;
}

/**
 * Insert parentheses around the last operation in the equation.
 * The "last operation" is the last operator and the two operands around it.
 * Returns a new array; does not mutate the input.
 */
export function insertGroupParens(
  tokens: readonly EquationToken[],
): EquationToken[] {
  // Find the last operator (not inside parens).
  let lastOpIdx = -1;
  let depth = 0;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (tokens[i] === ')') depth += 1;
    if (tokens[i] === '(') depth -= 1;
    if (depth === 0 && typeof tokens[i] === 'string' && tokens[i] !== '(' && tokens[i] !== ')') {
      lastOpIdx = i;
      break;
    }
  }

  if (lastOpIdx < 1 || lastOpIdx >= tokens.length - 1) {
    // Cannot group: no valid operator found.
    return [...tokens];
  }

  // Find the number before the operator (scan backward past any parens).
  let openIdx = lastOpIdx - 1;
  if (tokens[openIdx] === ')') {
    // Find matching '('
    let d = 1;
    while (openIdx > 0 && d > 0) {
      openIdx -= 1;
      if (tokens[openIdx] === ')') d += 1;
      if (tokens[openIdx] === '(') d -= 1;
    }
  }

  // Find the number after the operator (scan forward past any parens).
  let closeIdx = lastOpIdx + 1;
  if (tokens[closeIdx] === '(') {
    // Find matching ')'
    let d = 1;
    while (closeIdx < tokens.length - 1 && d > 0) {
      closeIdx += 1;
      if (tokens[closeIdx] === '(') d += 1;
      if (tokens[closeIdx] === ')') d -= 1;
    }
  }

  const result: EquationToken[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (i === openIdx) result.push('(');
    result.push(tokens[i]);
    if (i === closeIdx) result.push(')');
  }
  return result;
}

export function mathEquationBuilderGameReducer(
  state: MathEquationBuilderGameState,
  action: MathEquationBuilderAction,
): MathEquationBuilderGameState {
  switch (action.type) {
    case 'select-difficulty': {
      if (state.phase !== 'intro') return state;
      return { ...state, difficulty: action.level };
    }

    case 'start-session': {
      if (state.difficulty === null) return state;
      const profile = resolveMathEquationBuilderDifficulty(state.difficulty);
      const params = mathEquationBuilderParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const puzzle = generatePuzzle({
        rng,
        roundIndex: 0,
        params,
        prevTarget: null,
      });

      return {
        ...state,
        phase: 'playing',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        target: puzzle.target,
        availableNumbers: puzzle.numbers,
        allowedOperators: puzzle.operators,
        equationTokens: [],
        usedNumberIndices: [],
        expectOperator: false,
        roundCorrect: false,
        roundResult: null,
        timeRemainingMs: params.timeBudgetMs,
        timeBudgetMs: params.timeBudgetMs,
        prevTarget: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'add-number': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;
      if (state.expectOperator) return state;
      if (action.numberIndex < 0 || action.numberIndex >= state.availableNumbers.length) return state;
      if (state.usedNumberIndices.includes(action.numberIndex)) return state;

      const newTokens = [...state.equationTokens, state.availableNumbers[action.numberIndex]];
      const newUsed = [...state.usedNumberIndices, action.numberIndex];

      return {
        ...state,
        equationTokens: newTokens,
        usedNumberIndices: newUsed,
        expectOperator: true,
      };
    }

    case 'add-operator': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;
      if (!state.expectOperator) return state;
      if (!state.allowedOperators.includes(action.operator)) return state;

      return {
        ...state,
        equationTokens: [...state.equationTokens, action.operator],
        expectOperator: false,
      };
    }

    case 'group': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;
      if (state.equationTokens.length < 3) return state;

      const newTokens = insertGroupParens(state.equationTokens);
      return { ...state, equationTokens: newTokens };
    }

    case 'undo': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;
      if (state.equationTokens.length === 0) return state;

      const lastToken = state.equationTokens[state.equationTokens.length - 1];
      const newTokens = state.equationTokens.slice(0, -1);

      if (typeof lastToken === 'number') {
        // Find which number index this was.
        const numIdx = state.availableNumbers.indexOf(lastToken);
        // Remove the last used index that corresponds to this number.
        const newUsed = state.usedNumberIndices.slice(0, -1);
        return {
          ...state,
          equationTokens: newTokens,
          usedNumberIndices: newUsed,
          expectOperator: false,
        };
      }
      // Removed an operator or paren: expectOperator stays the same.
      // If we removed an operator, expectOperator should be false (next is number).
      // If we removed a paren, keep the previous state.
      if (lastToken === '(' || lastToken === ')') {
        return { ...state, equationTokens: newTokens };
      }
      // Removed an operator.
      return { ...state, equationTokens: newTokens, expectOperator: false };
    }

    case 'clear': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;
      return {
        ...state,
        equationTokens: [],
        usedNumberIndices: [],
        expectOperator: false,
      };
    }

    case 'submit': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;

      // Validate: all numbers must be used.
      if (state.usedNumberIndices.length !== state.availableNumbers.length) return state;

      // Evaluate the equation.
      const result = evaluateEquation(state.equationTokens);
      if (result === null) return state;

      const isCorrect = Math.abs(result - state.target) < 1e-9;
      const timeBonus = isCorrect
        ? puzzleScore(state.timeRemainingMs, state.timeBudgetMs).timeBonus
        : 0;
      const baseScore = isCorrect ? 200 : partialCreditScore();
      const totalScore = baseScore + timeBonus;

      const streak = isCorrect ? state.stats.streak + 1 : 0;
      const stats: MathEquationBuilderStats = {
        score: state.stats.score + totalScore,
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsPassed: state.stats.roundsPassed + (isCorrect ? 1 : 0),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        totalTimeBonus: state.stats.totalTimeBonus + timeBonus,
        puzzlesSolvedFirstTry:
          state.stats.puzzlesSolvedFirstTry + (isCorrect ? 1 : 0),
      };

      return {
        ...state,
        phase: 'roundResult',
        roundCorrect: isCorrect,
        roundResult: result,
        stats,
      };
    }

    case 'puzzle-timeout': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;

      const stats: MathEquationBuilderStats = {
        ...state.stats,
        roundsPlayed: state.stats.roundsPlayed + 1,
        streak: 0,
      };

      return {
        ...state,
        phase: 'roundResult',
        roundCorrect: false,
        roundResult: null,
        timeRemainingMs: 0,
        stats,
      };
    }

    case 'tick-timer': {
      if (state.phase !== 'playing') return state;
      if (state.paused) return state;
      if (state.timeRemainingMs <= 0) return state;

      const next = state.timeRemainingMs - 1000;
      if (next <= 0) {
        // Timer expired: auto-submit as timeout.
        const stats: MathEquationBuilderStats = {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
        };
        return {
          ...state,
          phase: 'roundResult',
          roundCorrect: false,
          roundResult: null,
          timeRemainingMs: 0,
          stats,
        };
      }
      return { ...state, timeRemainingMs: next };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = mathEquationBuilderParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;

      if (nextIndex >= params.rounds) {
        return { ...state, phase: 'results', roundCorrect: false, roundResult: null };
      }

      const passed = state.roundCorrect;
      let nextParams = params;
      if (state.difficulty === 'adaptive') {
        nextParams = nextAdaptiveParams(params, passed);
      }

      const rng = createRng(state.seed);
      const puzzle = generatePuzzle({
        rng,
        roundIndex: nextIndex,
        params: nextParams,
        prevTarget: state.target,
      });

      return {
        ...state,
        phase: 'playing',
        roundIndex: nextIndex,
        target: puzzle.target,
        availableNumbers: puzzle.numbers,
        allowedOperators: puzzle.operators,
        equationTokens: [],
        usedNumberIndices: [],
        expectOperator: false,
        roundCorrect: false,
        roundResult: null,
        timeRemainingMs: nextParams.timeBudgetMs,
        timeBudgetMs: nextParams.timeBudgetMs,
        prevTarget: state.target,
        // Update profile params for adaptive mode (convert operators to numeric flags).
        ...(state.difficulty === 'adaptive'
          ? {
              profile: {
                ...state.profile,
                parameters: {
                  numbersCount: nextParams.numbersCount,
                  targetMin: nextParams.targetMin,
                  targetMax: nextParams.targetMax,
                  rounds: nextParams.rounds,
                  timeBudgetMs: nextParams.timeBudgetMs,
                  hasPlus: nextParams.operators.includes('+') ? 1 : 0,
                  hasMinus: nextParams.operators.includes('-') ? 1 : 0,
                  hasTimes: nextParams.operators.includes('×') ? 1 : 0,
                  hasDivide: nextParams.operators.includes('÷') ? 1 : 0,
                  ...(nextParams.minNumbersCount !== undefined
                    ? { minNumbersCount: nextParams.minNumbersCount }
                    : {}),
                  ...(nextParams.maxNumbersCount !== undefined
                    ? { maxNumbersCount: nextParams.maxNumbersCount }
                    : {}),
                  ...(nextParams.minTarget !== undefined ? { minTarget: nextParams.minTarget } : {}),
                  ...(nextParams.maxTarget !== undefined ? { maxTarget: nextParams.maxTarget } : {}),
                },
              },
            }
          : {}),
      };
    }

    case 'pause': {
      if (state.paused || state.phase === 'results' || state.phase === 'intro') return state;
      return { ...state, paused: true };
    }

    case 'resume': {
      return state.paused ? { ...state, paused: false } : state;
    }

    case 'tutorial-open': {
      return { ...state, tutorialOpen: true };
    }

    case 'tutorial-close': {
      return { ...state, tutorialOpen: false };
    }

    case 'session-finalized': {
      return {
        ...state,
        xp: action.xp,
        normalized: action.normalized,
        activeDurationMs: action.activeDurationMs,
        pausedDurationMs: action.pausedDurationMs,
        completedAtMs: action.completedAtMs,
      };
    }

    case 'persistence-started': {
      return { ...state, persistState: 'started' };
    }

    case 'persistence-succeeded': {
      return { ...state, persistState: 'succeeded' };
    }

    case 'persistence-failed': {
      return { ...state, persistState: 'failed', lastError: action.message };
    }

    case 'completion-outcome-received': {
      return {
        ...state,
        authoritativeXp: action.xp,
        authoritativeCurrency: action.currency,
        authoritativeDeltas: action.deltas,
      };
    }

    case 'qa/force-win': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = mathEquationBuilderParamsFromProfile(state.profile);
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundCorrect: false,
        roundResult: null,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScore(params),
          roundsPlayed: params.rounds,
          roundsPassed: params.rounds,
          bestStreak: params.rounds,
          streak: params.rounds,
          totalTimeBonus: params.rounds * 100,
          puzzlesSolvedFirstTry: params.rounds,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundCorrect: false,
        roundResult: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
        },
      };
    }

    case 'qa/force-state': {
      if (state.phase !== 'intro') return state;
      const patch = action.patch;
      const difficulty =
        patch.difficulty !== undefined && isDifficultyLevel(patch.difficulty)
          ? patch.difficulty
          : state.difficulty;
      const seedOverride =
        patch.seed !== undefined ? String(patch.seed) : state.seedOverride;
      return { ...state, difficulty, seedOverride };
    }

    default: {
      return state;
    }
  }
}
