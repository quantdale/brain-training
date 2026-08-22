/**
 * Pure game state machine for the Cue Keeper game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: per-item response
 * window pacing, the SDK `SessionLifecycle` (start/pause/resume/complete/
 * abandon), auto-pause on backgrounding, the tutorial, the dev-only QA panel,
 * and result persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 *
 * Interruption semantics (unit-pinned in __tests__/reducer.test.ts):
 * `respond`/`item-timeout` carry the stream index they were made for and are
 * ignored for any other index, so double taps and late presses can never
 * consume the next unseen item; pausing AND the tutorial overlay both freeze
 * the response window — no window time, tallies, or inputs move while covered.
 */
import { createRng, isDifficultyLevel } from "@/sdk";
import type { DifficultyProfile } from "@/sdk";

import {
  nextItemMs,
  nextSignalCount,
  prospectiveCueParamsFromProfile,
  resolveProspectiveCueDifficulty,
} from "./difficulty";
import { generateRound } from "./generator";
import { itemPoints, perfectSessionScore } from "./scoring";
import {
  GAME_ID,
  INITIAL_STATS,
  createInitialProspectiveCueState,
} from "./types";
import type {
  ItemResponse,
  LastItemOutcome,
  ProspectiveCueAction,
  ProspectiveCueGameState,
  ProspectiveCueStats,
} from "./types";

export { createInitialProspectiveCueState };

/** Open a round: resolve params, generate content, enter the briefing phase. */
function openRound(
  state: ProspectiveCueGameState,
  roundIndex: number,
  signalCount: number,
  itemMs: number,
): ProspectiveCueGameState {
  const rng = createRng(state.seed);
  const prevActive =
    roundIndex === 0 ? null : state.round?.activeSignalIds ?? null;
  const round = generateRound({
    rng,
    roundIndex,
    signalCount,
    streamLen: prospectiveCueParamsFromProfile(state.profile!).streamLen,
    prevActiveSignalIds: prevActive,
  });
  return {
    ...state,
    phase: "briefing",
    paused: false,
    roundIndex,
    signalCount,
    itemMs,
    round,
    prevActiveSignalIds: prevActive ?? [],
    itemIndex: 0,
    roundSignalTotal: 0,
    roundSignalHits: 0,
    roundFalseAlarms: 0,
    lastItem: null,
    roundScored: false,
    roundOutcome: null,
  };
}

/** Resolve one stream item (player response or timeout) and advance. */
function resolveItem(
  state: ProspectiveCueGameState,
  response: ItemResponse,
  elapsedFraction: number,
): ProspectiveCueGameState {
  const { round } = state;
  if (round === null || state.itemIndex >= round.items.length) {
    return state;
  }
  const item = round.items[state.itemIndex];
  const correct =
    (item.isSignal && response === "signal") ||
    (!item.isSignal && response === "go");
  const lastItem: LastItemOutcome = {
    itemIndex: state.itemIndex,
    wasSignal: item.isSignal,
    response,
    correct,
  };
  const points = itemPoints(item.isSignal, response, elapsedFraction);

  const roundSignalTotal = state.roundSignalTotal + (item.isSignal ? 1 : 0);
  const roundSignalHits =
    state.roundSignalHits + (item.isSignal && response === "signal" ? 1 : 0);
  const roundFalseAlarms =
    state.roundFalseAlarms +
    (!item.isSignal && response === "signal" ? 1 : 0);

  const stats: ProspectiveCueStats = {
    ...state.stats,
    score: Math.max(0, state.stats.score + points),
    totalItems: state.stats.totalItems + 1,
    totalSignals: state.stats.totalSignals + (item.isSignal ? 1 : 0),
    signalHits: state.stats.signalHits + (item.isSignal && response === "signal" ? 1 : 0),
    falseAlarms: state.stats.falseAlarms + (!item.isSignal && response === "signal" ? 1 : 0),
    correctResponses: state.stats.correctResponses + (correct ? 1 : 0),
    goMisses: state.stats.goMisses + (!item.isSignal && response === "timeout" ? 1 : 0),
  };

  // Final item: score the round. Passing demands a perfect prospective
  // component — every signal caught, zero false alarms.
  if (state.itemIndex + 1 >= round.items.length) {
    const passed = roundSignalHits === roundSignalTotal && roundFalseAlarms === 0;
    const streak = passed ? state.stats.streak + 1 : 0;
    return {
      ...state,
      phase: "roundResult",
      // Write back the tallies INCLUDING the final item's contribution, so
      // the result screen reveals exact per-round numbers ("caught X/Y",
      // false alarms). The pass decision already used these locals.
      roundSignalTotal,
      roundSignalHits,
      roundFalseAlarms,
      lastItem,
      roundScored: true,
      roundOutcome: passed ? "passed" : "failed",
      stats: {
        ...stats,
        roundsPlayed: stats.roundsPlayed + 1,
        roundsPassed: stats.roundsPassed + (passed ? 1 : 0),
        bestStreak: Math.max(stats.bestStreak, streak),
        streak,
      },
    };
  }

  return {
    ...state,
    itemIndex: state.itemIndex + 1,
    roundSignalTotal,
    roundSignalHits,
    roundFalseAlarms,
    lastItem,
    stats,
  };
}

export function prospectiveCueGameReducer(
  state: ProspectiveCueGameState,
  action: ProspectiveCueAction,
): ProspectiveCueGameState {
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
      const profile = resolveProspectiveCueDifficulty(state.difficulty);
      const params = prospectiveCueParamsFromProfile(profile);
      // openRound sees roundIndex 0 → no carry-over from any previous session.
      return openRound(
        {
          ...state,
          profile,
          seed: action.seed,
          sessionId: action.sessionId,
          startedAtMs: action.startedAtMs,
          completedAtMs: null,
          activeDurationMs: 0,
          pausedDurationMs: 0,
          stats: { ...INITIAL_STATS },
          forced: false,
          xp: 0,
          normalized: null,
          persistState: "idle",
        },
        0,
        params.initialSignalCount,
        params.initialItemMs,
      );
    }

    case "briefing-done": {
      if (state.phase !== "briefing" || state.paused || state.tutorialOpen) {
        return state;
      }
      return { ...state, phase: "stream", itemIndex: 0, lastItem: null };
    }

    case "respond": {
      // Stale-index guard: a press is only valid for the item currently on
      // screen. After an item resolves, itemIndex has already advanced, so a
      // late/double tap stamped for the old index is ignored instead of being
      // stolen by the next unseen item. The tutorial overlay freezes the
      // window the same way a pause does.
      if (
        state.phase !== "stream" ||
        state.paused ||
        state.tutorialOpen ||
        state.roundScored ||
        action.itemIndex !== state.itemIndex
      ) {
        return state;
      }
      return resolveItem(state, action.kind, action.elapsedFraction);
    }

    case "item-timeout": {
      // Same guards as `respond`: only the interval that owns the current
      // item may expire it, and never while paused/tutorial-covered/scored.
      if (
        state.phase !== "stream" ||
        state.paused ||
        state.tutorialOpen ||
        state.roundScored ||
        action.itemIndex !== state.itemIndex
      ) {
        return state;
      }
      return resolveItem(state, "timeout", 1);
    }

    case "next-round": {
      if (
        state.phase !== "roundResult" ||
        state.profile === null ||
        state.difficulty === null
      ) {
        return state;
      }
      const params = prospectiveCueParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: "results", roundOutcome: null };
      }
      const passed = state.roundOutcome === "passed";
      return openRound(
        state,
        nextIndex,
        nextSignalCount(
          state.signalCount,
          passed,
          state.difficulty,
          params,
        ),
        nextItemMs(state.itemMs, passed, params),
      );
    }

    case "pause": {
      if (
        state.paused ||
        state.phase === "results" ||
        state.phase === "intro"
      ) {
        return state;
      }
      return { ...state, paused: true };
    }

    case "resume": {
      return state.paused ? { ...state, paused: false } : state;
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
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.profile === null
      ) {
        return state;
      }
      const params = prospectiveCueParamsFromProfile(state.profile);
      let totalSignals = 0;
      let totalItems = 0;
      for (let round = 0; round < params.rounds; round += 1) {
        const count = Math.min(
          params.maxSignalCount,
          params.initialSignalCount + round,
        );
        totalSignals += count;
        totalItems += params.streamLen;
      }
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        roundScored: true,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScore(params),
          roundsPlayed: params.rounds,
          roundsPassed: params.rounds,
          bestStreak: params.rounds,
          streak: params.rounds,
          totalSignals,
          signalHits: totalSignals,
          falseAlarms: 0,
          totalItems,
          correctResponses: totalItems,
          goMisses: 0,
        },
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
      // The in-flight round (briefing/stream) counts as failed; a round
      // already scored in `roundResult` stays as-is.
      const currentRoundCounted = state.phase === "roundResult" ? 0 : 1;
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
        },
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
      return state;
    }
  }
}
