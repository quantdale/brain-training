/**
 * Pure game state machine for the Word Chain game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths and the
 * per-chain deadline math) is unit testable without a UI. The screen owns the
 * side effects: the chain-expiry timer, the SDK `SessionLifecycle`, tutorial
 * state, and persistence.
 *
 * Timing model: actions that depend on time carry `nowMs` from the SDK
 * monotonic clock (never `Date.now()`). The reducer stores the current
 * chain's deadline (`roundDeadlineMs`) and rebases `roundStartedAtMs` and
 * `stepStartedAtMs` across pauses so answer times never include paused time.
 * An answer arriving after the deadline is ignored — the screen's expiry
 * timer then terminates the chain as a timeout.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from "@/sdk";
import type { DifficultyProfile } from "@/sdk";

import { loadContentPack } from "./content-validation";
import {
  wordChainParamsFromProfile,
  nextRoundParams,
  resolveWordChainDifficulty,
  tierOfNumber,
  tiersFromMask,
} from "./difficulty";
import { filterByLength, filterByTiers, generateRound } from "./generator";
import {
  clamp01,
  FULL_CHAIN_BONUS,
  perfectSessionScore,
  stepScore,
} from "./scoring";
import { INITIAL_STATS, createInitialLanguageWordChainState } from "./types";
import type {
  LanguageWordChainAction,
  LanguageWordChainState,
  WordChainRound,
  WordChainDifficultyParams,
} from "./types";

export { createInitialLanguageWordChainState };

/** Eligible pool for a given tier list + length bounds (stable pack order). */
function eligiblePool(
  tiers: readonly string[],
  params: WordChainDifficultyParams,
) {
  return filterByLength(
    filterByTiers(loadContentPack().chains, tiers as never),
    params.minChainLen,
    params.maxChainLen,
  );
}

/** Deterministically generate one round from the session seed. */
function generateRoundAt(
  seed: string,
  roundIndex: number,
  usedChainIds: ReadonlySet<string>,
  previousRound: WordChainRound | null,
  pool: ReturnType<typeof eligiblePool>,
  params: WordChainDifficultyParams,
): WordChainRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    pool,
    decoyPool: loadContentPack().decoyPool,
    params,
    usedChainIds,
    previousRound,
  });
}

/** Stats update shared by the wrong-answer and timeout paths. */
function failedChainStats(
  state: LanguageWordChainState,
  answerMs: number,
  answerRatio: number,
): LanguageWordChainState["stats"] {
  return {
    ...state.stats,
    roundsPlayed: state.stats.roundsPlayed + 1,
    streak: 0,
    totalAnswerMs: state.stats.totalAnswerMs + answerMs,
    sumAnswerRatio: state.stats.sumAnswerRatio + answerRatio,
    stepsPlayed: state.stats.stepsPlayed + 1,
  };
}

/** Ratio of an answer time to the chain's budget, clamped to [0, 1]. */
function answerRatio(answerMs: number, budgetMs: number): number {
  return budgetMs > 0 ? clamp01(answerMs / budgetMs) : 1;
}

export function wordChainReducer(
  state: LanguageWordChainState,
  action: LanguageWordChainAction,
): LanguageWordChainState {
  switch (action.type) {
    case "select-difficulty": {
      if (state.phase !== "intro") {
        return state;
      }
      return { ...state, difficulty: action.level };
    }

    case "start-session": {
      if (state.difficulty === null) {
        return state;
      }
      const profile = resolveWordChainDifficulty(state.difficulty);
      const params = wordChainParamsFromProfile(profile);
      let currentTier: LanguageWordChainState["currentTier"] = null;
      let poolTiers: LanguageWordChainState["poolTiers"] = [];
      if (state.difficulty === "adaptive") {
        currentTier = tierOfNumber(params.initialTier ?? 1);
        poolTiers = [currentTier];
      } else {
        poolTiers = tiersFromMask(params.tierMask);
      }
      const pool = eligiblePool(poolTiers, params);
      const round = generateRoundAt(
        action.seed,
        0,
        new Set(),
        null,
        pool,
        params,
      );
      return {
        ...state,
        phase: "question",
        paused: false,
        profile,
        params,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        poolTiers,
        currentTier,
        roundBudgetMs: params.timePerRoundMs,
        currentRound: round,
        currentStepIndex: 0,
        chosenPerStep: round.steps.map(() => null),
        roundStartedAtMs: action.nowMs,
        roundDeadlineMs: action.nowMs + params.timePerRoundMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        stepStartedAtMs: action.nowMs,
        stepElapsedMs: null,
        roundOutcome: null,
        lastAnswerIndex: null,
        lastAnswerMs: null,
        roundOutcomes: [],
        usedChainIds: [round.chainId],
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: "idle",
      };
    }

    case "answer-step": {
      if (
        state.phase !== "question" ||
        state.paused ||
        state.currentRound === null ||
        state.roundDeadlineMs === null ||
        state.stepStartedAtMs === null ||
        state.params === null
      ) {
        return state;
      }
      if (action.nowMs > state.roundDeadlineMs) {
        // Expired — a late tap changes nothing; the screen's timer fires the
        // timeout transition instead.
        return state;
      }
      const step = state.currentRound.steps[state.currentStepIndex];
      const correct = action.index === step.correctIndex;
      const answerMs = Math.max(0, action.nowMs - state.stepStartedAtMs);
      const ratio = answerRatio(answerMs, state.roundBudgetMs);
      const isLastStep =
        state.currentStepIndex === state.currentRound.steps.length - 1;
      const streak = correct ? state.stats.streak + 1 : 0;
      const stepsPlayed = state.stats.stepsPlayed + 1;
      const stepsCorrect = state.stats.stepsCorrect + (correct ? 1 : 0);
      const chosen = state.chosenPerStep.slice();
      chosen[state.currentStepIndex] = action.index;

      if (correct) {
        const gained = stepScore(answerMs, state.roundBudgetMs);
        if (isLastStep) {
          // Whole chain solved: step points + full-chain completion bonus.
          return {
            ...state,
            phase: "roundResult",
            roundOutcome: "correct",
            lastAnswerIndex: action.index,
            lastAnswerMs: answerMs,
            chosenPerStep: chosen,
            roundOutcomes: [...state.roundOutcomes, "correct"],
            stats: {
              ...state.stats,
              score: state.stats.score + gained + FULL_CHAIN_BONUS,
              roundsPlayed: state.stats.roundsPlayed + 1,
              roundsCorrect: state.stats.roundsCorrect + 1,
              bestStreak: Math.max(state.stats.bestStreak, streak),
              streak,
              totalAnswerMs: state.stats.totalAnswerMs + answerMs,
              sumAnswerRatio: state.stats.sumAnswerRatio + ratio,
              stepsPlayed,
              stepsCorrect,
            },
          };
        }
        // Advance to the next blank within the same chain.
        return {
          ...state,
          currentStepIndex: state.currentStepIndex + 1,
          lastAnswerIndex: action.index,
          lastAnswerMs: answerMs,
          chosenPerStep: chosen,
          stepStartedAtMs: action.nowMs,
          stats: {
            ...state.stats,
            score: state.stats.score + gained,
            bestStreak: Math.max(state.stats.bestStreak, streak),
            streak,
            totalAnswerMs: state.stats.totalAnswerMs + answerMs,
            sumAnswerRatio: state.stats.sumAnswerRatio + ratio,
            stepsPlayed,
            stepsCorrect,
          },
        };
      }

      // Wrong step: the chain fails; prior correct steps already scored.
      return {
        ...state,
        phase: "roundResult",
        roundOutcome: "wrong",
        lastAnswerIndex: action.index,
        lastAnswerMs: answerMs,
        chosenPerStep: chosen,
        roundOutcomes: [...state.roundOutcomes, "wrong"],
        stats: failedChainStats(state, answerMs, ratio),
      };
    }

    case "expire-round": {
      if (
        state.phase !== "question" ||
        state.paused ||
        state.currentRound === null ||
        state.roundDeadlineMs === null ||
        state.stepStartedAtMs === null
      ) {
        return state;
      }
      if (action.nowMs < state.roundDeadlineMs) {
        // Premature (defensive): the chain is not expired yet.
        return state;
      }
      // Timeout records exactly the budget as the answer time for the step.
      const budget = state.roundBudgetMs;
      return {
        ...state,
        phase: "roundResult",
        roundOutcome: "timeout",
        lastAnswerIndex: null,
        lastAnswerMs: budget,
        roundOutcomes: [...state.roundOutcomes, "timeout"],
        stats: failedChainStats(state, budget, 1),
      };
    }

    case "next-round": {
      if (
        state.phase !== "roundResult" ||
        state.params === null ||
        state.difficulty === null
      ) {
        return state;
      }
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.params.rounds) {
        // Last chain played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: "results", roundOutcome: null };
      }
      const passed = state.roundOutcome === "correct";
      const tuning = nextRoundParams(
        state.difficulty,
        state.params,
        state.currentTier,
        state.roundBudgetMs,
        passed,
      );
      const pool = eligiblePool(tuning.tiers, state.params);
      const round = generateRoundAt(
        state.seed,
        nextIndex,
        new Set(state.usedChainIds),
        state.currentRound,
        pool,
        state.params,
      );
      return {
        ...state,
        phase: "question",
        roundIndex: nextIndex,
        poolTiers: tuning.tiers,
        currentTier: tuning.currentTier,
        roundBudgetMs: tuning.timePerRoundMs,
        currentRound: round,
        currentStepIndex: 0,
        chosenPerStep: round.steps.map(() => null),
        roundStartedAtMs: action.nowMs,
        roundDeadlineMs: action.nowMs + tuning.timePerRoundMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        stepStartedAtMs: action.nowMs,
        stepElapsedMs: null,
        roundOutcome: null,
        lastAnswerIndex: null,
        lastAnswerMs: null,
        usedChainIds: [...state.usedChainIds, round.chainId],
      };
    }

    case "pause": {
      if (
        state.paused ||
        state.phase !== "question" ||
        state.roundDeadlineMs === null ||
        state.roundStartedAtMs === null ||
        state.stepStartedAtMs === null
      ) {
        return state;
      }
      // Freeze both the chain deadline and the current step clock so a resume
      // can rebuild them without ever counting paused time.
      return {
        ...state,
        paused: true,
        roundDeadlineMs: null,
        roundRemainingMs: Math.max(0, state.roundDeadlineMs - action.nowMs),
        roundElapsedMs: Math.max(0, action.nowMs - state.roundStartedAtMs),
        stepStartedAtMs: null,
        stepElapsedMs: Math.max(0, action.nowMs - state.stepStartedAtMs),
      };
    }

    case "resume": {
      if (
        !state.paused ||
        state.roundRemainingMs === null ||
        state.roundElapsedMs === null ||
        state.stepElapsedMs === null
      ) {
        return state;
      }
      return {
        ...state,
        paused: false,
        roundDeadlineMs: action.nowMs + state.roundRemainingMs,
        roundStartedAtMs: action.nowMs - state.roundElapsedMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        stepStartedAtMs: action.nowMs - state.stepElapsedMs,
        stepElapsedMs: null,
      };
    }

    case "tutorial-open": {
      return { ...state, tutorialOpen: true };
    }

    case "tutorial-close": {
      return { ...state, tutorialOpen: false };
    }

    case "session-finalized": {
      return {
        ...state,
        xp: action.xp,
        normalized: action.normalized,
        activeDurationMs: action.activeDurationMs,
        pausedDurationMs: action.pausedDurationMs,
        completedAtMs: action.completedAtMs,
      };
    }

    case "persistence-started": {
      return { ...state, persistState: "started" };
    }

    case "persistence-succeeded": {
      return { ...state, persistState: "succeeded" };
    }

    case "persistence-failed": {
      return { ...state, persistState: "failed", lastError: action.message };
    }

    case "completion-outcome-received": {
      return {
        ...state,
        authoritativeXp: action.xp,
        authoritativeCurrency: action.currency,
        authoritativeDeltas: action.deltas,
      };
    }

    case "qa/force-win": {
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.params === null
      ) {
        return state;
      }
      const params = state.params;
      const perfect = perfectSessionScore(params);
      const steps = params.rounds * params.maxBlanks;
      const stats: LanguageWordChainState["stats"] = {
        score: perfect,
        roundsPlayed: params.rounds,
        roundsCorrect: params.rounds,
        bestStreak: params.rounds,
        streak: params.rounds,
        totalAnswerMs: 0,
        sumAnswerRatio: 0,
        stepsPlayed: steps,
        stepsCorrect: steps,
      };
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        forced: true,
        roundOutcomes: Array.from(
          { length: params.rounds },
          () => "correct" as const,
        ),
        stats,
      };
    }

    case "qa/force-lose": {
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.profile === null
      ) {
        return state;
      }
      // The in-flight chain (question) counts as failed; a chain already
      // scored in `roundResult` stays as-is.
      const currentChainCounted = state.phase === "roundResult" ? 0 : 1;
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        forced: true,
        roundOutcomes:
          currentChainCounted === 1
            ? [...state.roundOutcomes, "wrong" as const]
            : state.roundOutcomes,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentChainCounted,
          streak: currentChainCounted === 1 ? 0 : state.stats.streak,
        },
      };
    }

    case "qa/force-timeout": {
      // Dev-only: expire the current chain as a timeout and keep playing.
      // Deliberately does NOT mark the session as forced — only force-win /
      // force-lose end a session via QA.
      if (
        state.phase !== "question" ||
        state.paused ||
        state.currentRound === null
      ) {
        return state;
      }
      const budget = state.roundBudgetMs;
      return {
        ...state,
        phase: "roundResult",
        roundOutcome: "timeout",
        lastAnswerIndex: null,
        lastAnswerMs: budget,
        roundOutcomes: [...state.roundOutcomes, "timeout"],
        stats: failedChainStats(state, budget, 1),
      };
    }

    case "qa/force-state": {
      if (state.phase !== "intro") {
        return state;
      }
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
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}
