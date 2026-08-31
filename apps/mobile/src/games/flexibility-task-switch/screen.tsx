/**
 * TaskSwitchScreen — the Flexibility game (cue-driven task switching).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Task-Switch-specific — the response-time measurement against
 * the monotonic clock (with pause-shifted trial origins), answer handling,
 * and the scoring/persistence pipeline.
 *
 * Each trial shows a TOKEN and an explicit TASK CUE simultaneously (no
 * cue–stimulus gap), so response time reflects pure processing and timing
 * artifacts do not dominate the score (per the design brief). The route
 * (`app/game/[id].tsx`) renders this component with no props; every prop is an
 * optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer; response time measured
 * for the current trial excludes paused time (the trial's start reference is
 * shifted forward by the pause duration on resume). The board is covered by the
 * opaque `PauseOverlay` and hidden from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from "@/sdk";
import type {
  Clock,
  TutorialStore,
  XpRatingHook,
} from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, StatRow } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from "@/components/game-host";
import type { GameHostView } from "@/components/game-host";

import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import { TokenView } from "./components/token-view";
import {
  flexibilityTaskSwitchParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createFlexibilityTaskSwitchQaForceStateHooks,
  createFlexibilityTaskSwitchTutorialLifecycle,
} from "./hooks";
import { flexibilityTaskSwitchReducer } from "./reducer";
import { normalizeFlexibilityTaskSwitchResult } from "./scoring";
import {
  buildFlexibilityTaskSwitchRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilityTaskSwitchSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, TASK_CUE_WORDS, createInitialFlexibilityTaskSwitchState, switchCostMsOf } from "./types";
import { SCORING_VERSION } from "./versions";

export interface FlexibilityTaskSwitchScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the shared no-op (Phase 2 real impl). */
  xpHook?: XpRatingHook;
}

export default function TaskSwitchScreen(
  props: FlexibilityTaskSwitchScreenProps = {},
) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    flexibilityTaskSwitchReducer,
    undefined,
    createInitialFlexibilityTaskSwitchState,
  );

  const stateRef = useRef(state);
  /** Monotonic-clock time the current trial became active (response origin). */
  const trialStartRef = useRef(0);
  /** Clock time a pause began inside the current trial, or null. */
  const pauseStartRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers (pause guard, answers).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === "trialActive" || current.phase === "trialResult") &&
        !current.paused
      );
    },
    onPause: () => {
      const current = stateRef.current;
      if (current.phase === "trialActive") {
        pauseStartRef.current = clock.now();
      }
      dispatch({ type: "pause" });
    },
  });

  const tutorial = useMemo(
    () => createFlexibilityTaskSwitchTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createFlexibilityTaskSwitchQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params =
    state.profile !== null
      ? flexibilityTaskSwitchParamsFromProfile(state.profile)
      : null;
  const speedTargetMs = params?.speedTargetMs ?? 5000;
  const speedPercent =
    state.stats.scoredPicks > 0
      ? Math.min(
          1,
          Math.max(
            0,
            1 -
              state.stats.totalResponseMs /
                state.stats.scoredPicks /
                speedTargetMs,
          ),
        )
      : 0;
  const switchAccuracy =
    state.stats.switchPlayed > 0
      ? state.stats.switchCorrect / state.stats.switchPlayed
      : 0;
  const isLastRound = state.roundIndex + 1 >= state.rounds;
  const inSession =
    state.phase === "trialActive" || state.phase === "trialResult";

  // ---- Response-time origin: reset whenever a new trial becomes active.
  useEffect(() => {
    if (state.phase === "trialActive") {
      trialStartRef.current = clock.now();
    }
  }, [state.phase, state.roundIndex, clock]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial]);

  // ---- Session finalization: complete the lifecycle, run the SDK scoring
  // pipeline (raw → normalized → XP hook), and persist atomically.
  // `claimFinalize()` guards against double submission (once per session).
  useEffect(() => {
    if (
      state.phase !== "results" ||
      !session.claimFinalize() ||
      state.profile === null ||
      state.sessionId === null ||
      state.startedAtMs === null
    ) {
      return;
    }

    session.completeIfActive();
    const activeDurationMs = session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
    const completedAtMs = Date.now();
    const difficulty = state.difficulty ?? "normal";
    const resolvedParams = flexibilityTaskSwitchParamsFromProfile(
      state.profile,
    );
    const finalSwitchRate = resolvedParams.switchRate;
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      finalSwitchRate,
    );

    const raw = buildFlexibilityTaskSwitchRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      finalSwitchRate,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = {
      gameId: GAME_ID,
      difficulty,
      durationMs: activeDurationMs,
    };
    const normalized = normalizeFlexibilityTaskSwitchResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
    // Phase-2 seam: rating deltas are computed but unused while the shared
    // hook is a no-op.
    xpHook.computeRatingDeltas(normalized, context);

    dispatch({
      type: "session-finalized",
      xp,
      normalized: normalized.value,
      activeDurationMs,
      pausedDurationMs,
      completedAtMs,
    });

    const record = buildSessionRecord({
      sessionId: state.sessionId,
      rawResult: raw,
      difficulty: state.profile,
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: "persistence-started" });
    void persistFlexibilityTaskSwitchSession(record, persistSession).then(
      (outcome) => {
        if (!session.isCurrentSession(record.id)) return;
        if (outcome.ok) {
          dispatch({ type: "persistence-succeeded" });
          const co = outcome.result.completionOutcome;
          if (co) {
            dispatch({
              type: "completion-outcome-received",
              xp: co.xp,
              currency: co.currency,
              deltas: co.deltas,
            });
          }
        } else {
          dispatch({
            type: "persistence-failed",
            message: String(outcome.error),
          });
        }
      },
    );
  }, [
    state.phase,
    state.profile,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.difficulty,
    session,
    xpHook,
    persistSession,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    // Shift the trial's response-time origin by the pause duration so the
    // player never gains or loses time on a trial because of pausing.
    if (pauseStartRef.current !== null) {
      trialStartRef.current += clock.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    if (session.resumeIfPaused()) {
      dispatch({ type: "resume" });
    }
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (
        current.phase !== "trialActive" ||
        current.paused ||
        current.round === null
      ) {
        return;
      }
      const responseMs = Math.max(0, clock.now() - trialStartRef.current);
      if (index === current.round.correctIndex) {
        liveAudioHaptics.feedback("correct");
      } else {
        liveAudioHaptics.feedback("wrong");
      }
      dispatch({ type: "answer", index, responseMs });
    },
    [clock, dispatch],
  );

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    const identity = session.begin();
    dispatch({
      type: "start-session",
      seed,
      sessionId: identity.sessionId,
      startedAtMs: identity.startedAtMs,
    });
  }, [session, sessionSeed, dispatch]);

  const handleRestart = handleStart;

  // ---- Tutorial controls.
  const openTutorial = useCallback(() => {
    tutorial.requestReplay(GAME_ID);
    dispatch({ type: "tutorial-open" });
  }, [tutorial, dispatch]);

  const completeTutorial = useCallback(() => {
    tutorial.complete(GAME_ID);
    dispatch({ type: "tutorial-close" });
  }, [tutorial, dispatch]);

  const skipTutorial = useCallback(() => {
    tutorial.skipForQa(GAME_ID); // dev-only (assertDevOnly inside)
    dispatch({ type: "tutorial-close" });
  }, [tutorial, dispatch]);

  const view: GameHostView =
    state.phase === "intro" ? "intro" : state.phase === "results" ? "results" : "session";

  // ---- Trial option visuals.
  const visualFor = (index: number): "idle" | "selected" | "error" => {
    if (state.round === null) {
      return "idle";
    }
    if (state.phase === "trialResult") {
      if (index === state.round.correctIndex) {
        return "selected";
      }
      if (state.roundOutcome === "wrong" && index === state.lastPickIndex) {
        return "error";
      }
    }
    return "idle";
  };

  const cardGridTestID = testId(GAME_ID, "option-grid");

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={view}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) =>
        dispatch({ type: "select-difficulty", level })
      }
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      header={
        <ThemedText
          type="subtitle"
          testID={testId(GAME_ID, "round", String(state.roundIndex + 1))}
        >
          Trial {state.roundIndex + 1}/{state.rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      }>
      {inSession ? (
        <>
          {state.phase === "trialActive" && state.round !== null ? (
            <>
              <View
                style={styles.cueBanner}
                testID={testId(GAME_ID, "task-banner")}
              >
                <ThemedText
                  type="headline"
                  themeColor="accent"
                  testID={testId(GAME_ID, "task-banner-text")}
                >
                  {TASK_CUE_WORDS[state.round.task]}
                </ThemedText>
                {state.round.isSwitch ? (
                  <ThemedText
                    type="caption"
                    themeColor="warning"
                    testID={testId(GAME_ID, "task-switch")}
                  >
                    Task switched!
                  </ThemedText>
                ) : null}
              </View>
              <View
                style={styles.targetRow}
                testID={testId(GAME_ID, "token")}
              >
                <TokenView
                  token={state.round.token}
                  testID={testId(GAME_ID, "token-view")}
                  disabled
                />
              </View>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, "answer-status")}
              >
                Pick the answer for this task
              </ThemedText>
              <View style={styles.grid} testID={cardGridTestID}>
                {state.round.options.map((option, index) => (
                  <GameButton
                    key={index}
                    testID={`${cardGridTestID}.option.${index}`}
                    label={option}
                    variant={
                      visualFor(index) === "error" ? "danger" : "primary"
                    }
                    onPress={() => handleAnswer(index)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {state.phase === "trialResult" && state.round !== null ? (
            <View
              style={styles.section}
              testID={testId(GAME_ID, "round-result")}
            >
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === "correct" ? "success" : "danger"
                }
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === "correct"
                    ? "round-correct"
                    : "round-wrong",
                )}
              >
                {state.roundOutcome === "correct" ? "Correct!" : "Not quite"}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, "round-explainer")}
              >
                {state.roundOutcome === "correct"
                  ? `Matched "${state.round.options[state.round.correctIndex]}" under the ${TASK_CUE_WORDS[state.round.task]} task.`
                  : `The answer was "${state.round.options[state.round.correctIndex]}" for the ${TASK_CUE_WORDS[state.round.task]} task.`}
              </ThemedText>
              <GameButton
                testID={testId(GAME_ID, "next-round")}
                label={isLastRound ? "See results" : "Next trial"}
                onPress={() => dispatch({ type: "next-round" })}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === "results" ? (
        <GameResults
          gameId={GAME_ID}
          forced={state.forced}
          persistState={state.persistState}
          lastError={state.lastError}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          <StatRow
            label="Score"
            value={String(state.stats.score)}
            testID={testId(GAME_ID, "score")}
          />
          <StatRow
            label="Accuracy"
            value={`${Math.round((state.stats.roundsPlayed > 0 ? state.stats.correctPicks / state.stats.roundsPlayed : 0) * 100)}%`}
            testID={testId(GAME_ID, "accuracy")}
          />
          <StatRow
            label="Speed"
            value={`${Math.round(speedPercent * 100)}%`}
            testID={testId(GAME_ID, "speed")}
          />
          <StatRow
            label="Switch accuracy"
            value={`${Math.round(switchAccuracy * 100)}%`}
            testID={testId(GAME_ID, "switch-accuracy")}
          />
          <StatRow
            label="Switch cost"
            value={`${Math.round(switchCostMsOf(state.stats))} ms`}
            testID={testId(GAME_ID, "switch-cost")}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, "best-streak")}
          />
          <StatRow
            label="Mistakes"
            value={String(state.stats.mistakes)}
            testID={testId(GAME_ID, "mistakes")}
          />
          <StatRow
            label="XP"
            value={String(state.authoritativeXp ?? state.xp)}
            testID={testId(GAME_ID, "xp")}
          />
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  cueBanner: {
    alignItems: "center",
    gap: Spacing.one,
  },
  targetRow: {
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    justifyContent: "center",
  },
});
