/**
 * LogicDeductionScreen — the Deduction Table game.
 *
 * Renders a pure state machine (`logicDeductionReducer`) and owns the side
 * effects: the per-round expiry timer, the SDK `SessionLifecycle`
 * (start/pause/resume/complete/abandon), auto-pause on backgrounding, the
 * tutorial, the dev-only QA panel, and result persistence. All gameplay
 * timing comes from the injectable SDK monotonic clock.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the round
 * deadline; resuming re-arms the remaining budget. The screen is covered by
 * the opaque `PauseOverlay` and hidden from the accessibility tree while
 * paused, so the puzzle cannot be studied during a pause.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  SessionLifecycle,
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from "@/sdk";
import type {
  Clock,
  DifficultyLevel,
  TutorialStore,
  XpRatingHook,
} from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import {
  DifficultySelector,
  SessionHeader,
  StatRow,
} from "@/components/game-ui";
import { Spacing } from "@/constants/theme";

import { ClueTable } from "./components/clue-table";
import { GameButton } from "./components/button";
import { Option } from "./components/option";
import type { OptionVisualState } from "./components/option";
import { PauseOverlay } from "./components/pause-overlay";
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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
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
  // clears the timeout (effect cleanup) and the reducer freezes the remaining
  // budget; resuming re-arms a fresh timeout for whatever is left.
  useEffect(() => {
    if (
      state.phase !== "question" ||
      state.paused ||
      state.roundDeadlineMs === null
    ) {
      return undefined;
    }
    const remaining = Math.max(0, state.roundDeadlineMs - clock.now());
    const timer = setTimeout(() => {
      dispatch({ type: "expire-round", nowMs: clock.now() });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.roundDeadlineMs, clock, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial]);

  // ---- Session finalization: complete the lifecycle, run the SDK scoring
  // pipeline (raw → normalized → XP hook), and persist atomically.
  useEffect(() => {
    if (
      state.phase !== "results" ||
      finalizedRef.current ||
      state.profile === null ||
      state.params === null ||
      state.sessionId === null ||
      state.startedAtMs === null
    ) {
      return;
    }
    finalizedRef.current = true;

    const lifecycle = lifecycleRef.current;
    if (
      lifecycle !== null &&
      lifecycle.status !== "completed" &&
      lifecycle.status !== "abandoned"
    ) {
      lifecycle.complete();
    }
    const activeDurationMs = lifecycle?.elapsedMs() ?? 0;
    const pausedDurationMs = lifecycle?.pausedDurationMs() ?? 0;
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
    xpHook,
    persistSession,
  ]);

  // ---- Session controls.
  const startSession = useCallback(
    (level: DifficultyLevel, seed: string) => {
      finalizedRef.current = false;
      lifecycleRef.current = new SessionLifecycle({ clock });
      lifecycleRef.current.start();
      dispatch({
        type: "start-session",
        seed,
        sessionId: newSessionId(),
        startedAtMs: Date.now(),
        nowMs: clock.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== "question" || current.paused) return;
    lifecycleRef.current?.pause();
    dispatch({ type: "pause", nowMs: clock.now() });
  }, [clock, dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: "resume", nowMs: clock.now() });
  }, [clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (
      lifecycle !== null &&
      (lifecycle.status === "active" || lifecycle.status === "paused")
    ) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

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
    const level = current.difficulty ?? "normal";
    const seed =
      current.seedOverride ??
      (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(level, seed);
  }, [startSession, sessionSeed]);

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
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: "tutorial-close" });
  }, [tutorial, dispatch]);

  // ---- Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

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
    <View style={styles.screen} testID={testId(GAME_ID, "screen")}>
      <View
        style={styles.content}
        importantForAccessibility={
          state.paused ? "no-hide-descendants" : "auto"
        }
        accessibilityElementsHidden={state.paused}
        accessible={false}
      >
        {state.phase === "intro" ? (
          <View style={styles.section} testID={testId(GAME_ID, "intro")}>
            <ThemedText type="small" themeColor="textSecondary">
              {gameDefinition.description}
            </ThemedText>

            <DifficultySelector
              gameId={GAME_ID}
              selected={state.difficulty}
              onSelect={(level) =>
                dispatch({ type: "select-difficulty", level })
              }
            />

            <View style={styles.buttonRow}>
              <GameButton
                testID={testId(GAME_ID, "start")}
                label="Start"
                onPress={handleStart}
              />
              <GameButton
                testID={testId(GAME_ID, "help")}
                label="How to play"
                variant="secondary"
                onPress={openTutorial}
              />
            </View>

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
            ) : null}
          </View>
        ) : null}

        {inSession ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, "round", String(state.roundIndex + 1))}
              >
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, "score")}
              >
                Score {state.stats.score}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, "pause")}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

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

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
            ) : null}
          </View>
        ) : null}

        {state.phase === "results" ? (
          <View style={styles.section} testID={testId(GAME_ID, "results")}>
            <ThemedText type="title">Session complete</ThemedText>
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

            {state.persistState === "failed" ? (
              <ThemedText
                type="small"
                themeColor="danger"
                testID={testId(GAME_ID, "persist-error")}
              >
                Your session could not be saved. {state.lastError ?? ""}
              </ThemedText>
            ) : null}
            {state.forced ? (
              <ThemedText
                type="caption"
                themeColor="warning"
                testID={testId(GAME_ID, "forced-badge")}
              >
                QA-forced session
              </ThemedText>
            ) : null}

            <View style={styles.buttonRow}>
              <GameButton
                testID={testId(GAME_ID, "restart")}
                label="Play again"
                onPress={handleRestart}
              />
              <GameButton
                testID={testId(GAME_ID, "quit")}
                label="Done"
                variant="secondary"
                onPress={quitToLibrary}
              />
            </View>
          </View>
        ) : null}
      </View>

      {state.paused && state.phase === "question" ? (
        <PauseOverlay onResume={resumeSession} onQuit={quitToLibrary} />
      ) : null}

      {state.tutorialOpen ? (
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  clues: {
    gap: Spacing.one,
  },
  options: {
    gap: Spacing.two,
  },
});
