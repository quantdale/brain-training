/**
 * WordChainScreen — the Word Chain game.
 *
 * Renders a pure state machine (`wordChainReducer`) and owns the side
 * effects: the per-chain expiry timer, the SDK `SessionLifecycle` (start/
 * pause/resume/complete/abandon), auto-pause on backgrounding, the tutorial,
 * the dev-only QA panel, and result persistence. All gameplay timing comes
 * from the injectable SDK monotonic clock.
 *
 * Pause semantics: pausing freezes the chain deadline (the reducer nulls it
 * and stores the remaining budget; resume rebuilds it), the expiry timer is
 * torn down while paused, and the board is covered by the opaque
 * `PauseOverlay` and hidden from the accessibility tree so the chain cannot
 * be studied during a pause.
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
import { useTheme } from "@/hooks/use-theme";

import { GameButton } from "./components/button";
import { Option } from "./components/option";
import type { OptionVisualState } from "./components/option";
import { PauseOverlay } from "./components/pause-overlay";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import {
  wordChainParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createWordChainQaForceStateHooks,
  createWordChainTutorialLifecycle,
} from "./hooks";
import { wordChainReducer } from "./reducer";
import { normalizeWordChainResult } from "./scoring";
import {
  buildWordChainRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistWordChainSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialLanguageWordChainState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface WordChainScreenProps {
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

export default function WordChainScreen(props: WordChainScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(
    wordChainReducer,
    undefined,
    createInitialLanguageWordChainState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createWordChainTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createWordChainQaForceStateHooks(dispatch),
    [dispatch],
  );

  const rounds = state.params?.rounds ?? 6;
  const budgetSeconds = Math.max(1, Math.round(state.roundBudgetMs / 1000));
  const inSession = state.phase === "question" || state.phase === "roundResult";
  const isLastRound = state.roundIndex + 1 >= rounds;
  // Hoisted so the JSX below can narrow without non-null assertions.
  const round = state.currentRound;
  const activeStep =
    state.phase === "question" && round !== null
      ? (round.steps[state.currentStepIndex] ?? null)
      : null;

  // ---- Chain expiry: one timer per question phase; paused tears it down
  // (the reducer nulls the deadline) and resume re-arms it for the remainder.
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
      liveAudioHaptics.feedback("failure");
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
    const resolvedParams = wordChainParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.currentTier,
    );

    const raw = buildWordChainRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      outcomes: state.roundOutcomes,
      finalTier: state.currentTier,
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
    const normalized = normalizeWordChainResult(raw, context);
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
    void persistWordChainSession(record, persistSession).then((outcome) => {
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
    });
  }, [
    state.phase,
    state.profile,
    state.params,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.currentTier,
    state.roundOutcomes,
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
    if (current.phase !== "question" || current.paused) {
      return;
    }
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
        current.currentRound === null ||
        current.roundDeadlineMs === null
      ) {
        return;
      }
      const nowMs = clock.now();
      if (nowMs > current.roundDeadlineMs) {
        // Expired — a late tap changes nothing; the expiry timer fires the
        // timeout transition instead.
        return;
      }
      const step =
        current.currentRound.steps[current.currentStepIndex];
      liveAudioHaptics.feedback(
        index === step.correctIndex ? "correct" : "wrong",
      );
      dispatch({ type: "answer-step", index, nowMs });
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

  // ---- Chain rendering: which positions are known, and option visuals.
  const activeStepPosition = activeStep?.position ?? null;

  const visualFor = useCallback(
    (index: number): OptionVisualState => {
      if (state.phase === "question" || round === null) {
        return "idle";
      }
      const step = round.steps[state.currentStepIndex];
      if (state.roundOutcome === "correct") {
        return index === state.lastAnswerIndex ? "correct" : "muted";
      }
      if (index === step.correctIndex) return "correct";
      if (index === state.lastAnswerIndex) return "wrong";
      return "muted";
    },
    [
      state.phase,
      round,
      state.currentStepIndex,
      state.roundOutcome,
      state.lastAnswerIndex,
    ],
  );

  const roundResultMessage =
    state.roundOutcome === "correct"
      ? "Chain complete!"
      : state.roundOutcome === "timeout"
        ? "Time’s up"
        : "Broken link";

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

        {inSession && round !== null ? (
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

            {/* The chain: revealed words plus blanks. Unknown positions render
                as "?" (or the required first letter for the active blank), so
                the answer is never readable off the UI or accessibility tree. */}
            <View style={styles.chain} testID={testId(GAME_ID, "chain")}>
              {round.words.map((word, index) => {
                const solved =
                  round.fixed[index] ||
                  (activeStepPosition !== null && index < activeStepPosition);
                const isActiveBlank = index === activeStepPosition;
                return (
                  <View
                    key={index}
                    style={[
                      styles.chipWrap,
                      { borderColor: theme.border },
                      isActiveBlank && state.phase === "question"
                        ? { borderColor: theme.accent }
                        : null,
                    ]}
                    testID={testId(GAME_ID, "chain-word", String(index))}
                  >
                    <ThemedText type="bodyLarge">
                      {solved
                        ? word
                        : isActiveBlank && state.phase === "question" && activeStep !== null
                          ? `${activeStep.requiredFirstLetter}…`
                          : "?"}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            {state.phase === "question" && activeStep !== null ? (
              <View style={styles.section}>
                <ThemedText
                  type="caption"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, "time-budget")}
                >
                  Answer within {budgetSeconds}s
                </ThemedText>
                <View
                  style={styles.dots}
                  testID={testId(GAME_ID, "progress")}
                  accessibilityLabel={`${state.currentStepIndex} of ${round.steps.length} links filled`}
                >
                  {Array.from({ length: round.steps.length }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            i < state.currentStepIndex
                              ? theme.accent
                              : theme.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.options}>
                  {activeStep.options.map((word, index) => (
                    <Option
                      key={index}
                      index={index}
                      label={word}
                      visual={visualFor(index)}
                      onPressOption={handleAnswer}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {state.phase === "roundResult" ? (
              <View
                style={styles.section}
                testID={testId(GAME_ID, "round-result")}
              >
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
                    The chain was {round.words.join(" → ")}
                  </ThemedText>
                ) : null}
                <View style={styles.options}>
                  {round.steps[state.currentStepIndex].options.map(
                    (word, index) => (
                      <Option
                        key={index}
                        index={index}
                        label={word}
                        visual={visualFor(index)}
                        disabled
                        onPressOption={handleAnswer}
                      />
                    ),
                  )}
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

      {state.paused && inSession ? (
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
  chain: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chipWrap: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.oneHalf,
  },
  dots: {
    flexDirection: "row",
    gap: Spacing.oneHalf,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  options: {
    gap: Spacing.two,
  },
});
