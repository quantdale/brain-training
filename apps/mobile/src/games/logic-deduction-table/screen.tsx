/**
 * LogicDeductionScreen — the Deduction Table game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Deduction-Table-specific — the reducer wiring, the per-round
 * expiry timeout, the scoring/persistence pipeline, and the puzzle view. All
 * gameplay timing comes from the injectable SDK monotonic clock.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the round
 * deadline; resuming re-arms the remaining budget. The screen is covered by
 * the opaque shared `PauseOverlay` and hidden from the accessibility tree
 * while paused, so the puzzle cannot be studied during a pause.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { isDevBuild, liveAudioHaptics, noopXpRatingHook, systemClock, testId } from "@/sdk";
import type { Clock, TutorialStore, XpRatingHook } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, StatRow } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
  useGameTimeout,
} from "@/components/game-host";

import { ClueTable } from "./components/clue-table";
import { Option } from "./components/option";
import type { OptionVisualState } from "./components/option";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import {
  logicDeductionParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createLogicDeductionQaForceStateHooks,
  createLogicDeductionTutorialLifecycle,
} from "./hooks";
import { logicDeductionReducer } from "./reducer";
import { normalizeLogicDeductionResult } from "./scoring";
import {
  buildLogicDeductionRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistLogicDeductionSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialLogicDeductionState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface LogicDeductionScreenProps {
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

export default function LogicDeductionScreen(
  props: LogicDeductionScreenProps = {},
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
    logicDeductionReducer,
    undefined,
    createInitialLogicDeductionState,
  );

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return current.phase === "question" && !current.paused;
    },
    onPause: () => dispatch({ type: "pause", nowMs: clock.now() }),
  });

  const tutorial = useMemo(
    () => createLogicDeductionTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createLogicDeductionQaForceStateHooks(dispatch),
    [dispatch],
  );

  const rounds = state.params?.rounds ?? 6;
  const budgetSeconds = Math.max(
    1,
    Math.round((state.params?.roundTimeMs ?? 24_000) / 1000),
  );
  const inSession = state.phase === "question" || state.phase === "roundResult";
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Per-round expiry timer: fires once at the round deadline. Pausing
  // deactivates the timeout (effect cleanup) and the reducer freezes the
  // remaining budget; resuming re-arms a fresh timeout for whatever is left.
  useGameTimeout(
    state.phase === "question" && !state.paused && state.roundDeadlineMs !== null,
    () => dispatch({ type: "expire-round", nowMs: clock.now() }),
    Math.max(0, state.roundDeadlineMs !== null ? state.roundDeadlineMs - clock.now() : 0),
  );

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
      state.params === null ||
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
    const resolvedParams = logicDeductionParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.entityCount,
      resolvedParams.attributeCount,
    );

    const raw = buildLogicDeductionRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      outcomes: state.roundOutcomes,
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
    const normalized = normalizeLogicDeductionResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
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
    void persistLogicDeductionSession(record, persistSession).then(
      (outcome) => {
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
    state.params,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.roundOutcomes,
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
    session.resume();
    dispatch({ type: "resume", nowMs: clock.now() });
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (
        current.phase !== "question" ||
        current.paused ||
        current.roundDeadlineMs === null
      ) {
        return;
      }
      const nowMs = clock.now();
      if (nowMs > current.roundDeadlineMs) return; // late tap: timer wins
      const correct = index === current.round?.correctIndex;
      liveAudioHaptics.feedback(correct ? "correct" : "wrong");
      dispatch({ type: "answer-option", index, nowMs });
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
      nowMs: clock.now(),
    });
  }, [session, sessionSeed, clock, dispatch]);

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

  // ---- Option visuals. During the question every card is neutral (no hint);
  // after scoring the true answer lights up, the player's own wrong pick is
  // marked, and everything else mutes out.
  const visualFor = useCallback(
    (index: number): OptionVisualState => {
      if (state.phase === "question" || state.round === null) return "idle";
      if (index === state.round.correctIndex) return "correct";
      if (index === state.lastAnswerIndex) return "wrong";
      return "muted";
    },
    [
      state.phase,
      state.round?.correctIndex,
      state.lastAnswerIndex,
    ],
  );

  const roundResultMessage =
    state.roundOutcome === "correct"
      ? "Correct!"
      : state.roundOutcome === "timeout"
        ? "Time’s up"
        : "Not quite";

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={inSession ? "session" : state.phase === "results" ? "results" : "intro"}
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
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={qaHooks.forceTimeout}
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
          {state.phase === "question" && state.round !== null ? (
            <View style={styles.section}>
              <ClueTable
                round={state.round}
                testID={testId(GAME_ID, "clue-table")}
              />
              <View style={styles.clues}>
                {state.round.clues.map((clue, i) => (
                  <ThemedText
                    key={i}
                    type="small"
                    themeColor="textSecondary"
                    testID={testId(GAME_ID, "clue", String(i))}
                  >
                    • {clue.text}
                  </ThemedText>
                ))}
              </View>
              <ThemedText
                type="headline"
                testID={testId(GAME_ID, "question")}
                accessibilityLabel={state.round.question.text}
              >
                {state.round.question.text}
              </ThemedText>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID={testId(GAME_ID, "time-budget")}
              >
                Answer within {budgetSeconds}s
              </ThemedText>
              <View style={styles.options}>
                {state.round.options.map((value, index) => (
                  <Option
                    key={index}
                    index={index}
                    label={value}
                    visual={visualFor(index)}
                    onPressOption={handleAnswer}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {state.phase === "roundResult" && state.round !== null ? (
            <View style={styles.section} testID={testId(GAME_ID, "round-result")}>
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === "correct"
                    ? "success"
                    : state.roundOutcome === "timeout"
                      ? "warning"
                      : "danger"
                }
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === "correct"
                    ? "round-correct"
                    : state.roundOutcome === "timeout"
                      ? "round-timeout"
                      : "round-wrong",
                )}
              >
                {roundResultMessage}
              </ThemedText>
              {state.roundOutcome !== "correct" ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, "round-answer-reveal")}
                >
                  The answer was {state.round.answer}
                </ThemedText>
              ) : null}
              <View style={styles.options}>
                {state.round.options.map((value, index) => (
                  <Option
                    key={index}
                    index={index}
                    label={value}
                    visual={visualFor(index)}
                    selected={index === state.lastAnswerIndex}
                    disabled
                    onPressOption={handleAnswer}
                  />
                ))}
              </View>
              <GameButton
                testID={testId(GAME_ID, "next-round")}
                label={isLastRound ? "See results" : "Next round"}
                onPress={() =>
                  dispatch({ type: "next-round", nowMs: clock.now() })
                }
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === "results" ? (
        <GameResults
          gameId={GAME_ID}
          persistState={state.persistState}
          lastError={state.lastError}
          forced={state.forced}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          <StatRow
            label="Score"
            value={String(state.stats.score)}
            testID={testId(GAME_ID, "score")}
          />
          <StatRow
            label="Accuracy"
            value={`${Math.round(
              (state.stats.roundsPlayed > 0
                ? state.stats.roundsCorrect / state.stats.roundsPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, "accuracy")}
          />
          <StatRow
            label="Rounds correct"
            value={`${state.stats.roundsCorrect}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, "rounds-correct")}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, "best-streak")}
          />
          <StatRow
            label="Avg answer time"
            value={
              state.stats.roundsPlayed > 0
                ? `${(state.stats.totalAnswerMs / state.stats.roundsPlayed / 1000).toFixed(1)}s`
                : "—"
            }
            testID={testId(GAME_ID, "avg-time")}
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
  clues: {
    gap: Spacing.one,
  },
  options: {
    gap: Spacing.two,
  },
});
