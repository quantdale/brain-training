/**
 * GridRecallScreen — the Grid Recall game (simultaneous pattern-recall variant).
 *
 * Renders a pure state machine (`gridRecallGameReducer`) and owns the side
 * effects: study pacing timer, the SDK `SessionLifecycle` (start/pause/
 * resume/complete/abandon), auto-pause on backgrounding, the tutorial, the
 * dev-only QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels study
 * pacing; resuming re-shows the pattern for the full study window; the board is
 * covered by the opaque `PauseOverlay` and hidden from the accessibility tree
 * while paused, so the answer cannot be read off the UI during a pause.
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
import { Board } from "./components/board";
import type { CellVisualState } from "./components/cell";
import { PauseOverlay } from "./components/pause-overlay";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import {
  gridRecallParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createGridRecallQaForceStateHooks,
  createGridRecallTutorialLifecycle,
} from "./hooks";
import { gridRecallGameReducer } from "./reducer";
import { normalizeGridRecallResult } from "./scoring";
import {
  buildGridRecallRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistGridRecallSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialGridRecallState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface GridRecallScreenProps {
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

export default function GridRecallScreen(props: GridRecallScreenProps = {}) {
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
    gridRecallGameReducer,
    undefined,
    createInitialGridRecallState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  // Per-round study timer baseline: tracks elapsed ACTIVE (non-paused) study time
  // so pausing freezes and resuming resumes the remaining window (not a restart).
  const studyElapsedRef = useRef(0);
  const studyRoundRef = useRef(-1);

  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createGridRecallTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createGridRecallQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params =
    state.profile !== null ? gridRecallParamsFromProfile(state.profile) : null;
  const studyMs = params?.studyMs ?? 1800;
  const gridSize = params?.gridSize ?? 16;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === "study" ||
    state.phase === "input" ||
    state.phase === "roundResult";
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Reset the per-round study timer baseline when a new study round begins.
  useEffect(() => {
    if (state.phase === "study" && studyRoundRef.current !== state.roundIndex) {
      studyRoundRef.current = state.roundIndex;
      studyElapsedRef.current = 0;
    }
  }, [state.phase, state.roundIndex]);

  // Study pacing with freeze-and-continue: a single window of `studyMs` of
  // ACTIVE (non-paused) time. Pausing cancels the timer; resuming schedules the
  // remaining window rather than restarting it, so the board stays obscured for
  // exactly the time the player has not yet studied.
  useEffect(() => {
    if (state.phase !== "study" || state.paused) {
      return undefined;
    }
    const remaining = Math.max(0, studyMs - studyElapsedRef.current);
    const timer = setTimeout(() => {
      studyElapsedRef.current = studyMs;
      dispatch({ type: "study-tick" });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, studyMs, dispatch]);

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
    const resolvedParams = gridRecallParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.targetCount,
    );

    const raw = buildGridRecallRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
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
    const normalized = normalizeGridRecallResult(raw, context);
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
    void persistGridRecallSession(record, persistSession).then((outcome) => {
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
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.targetCount,
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
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (
      !(
        current.phase === "study" ||
        current.phase === "input" ||
        current.phase === "roundResult"
      ) ||
      current.paused
    ) {
      return;
    }
    lifecycleRef.current?.pause();
    dispatch({ type: "pause" });
  }, [dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: "resume" });
  }, [dispatch]);

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

  const handleTapCell = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== "input" || current.paused || current.roundScored) {
        return;
      }
      liveAudioHaptics.feedback("tap");
      dispatch({ type: "tap-cell", index });
    },
    [dispatch],
  );

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== "input" || current.paused || current.roundScored) {
      return;
    }
    dispatch({ type: "submit" });
  }, [dispatch]);

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

  // ---- Cell visuals. Stable across per-round re-renders; depends only on
  // round-transition state, never on study ticks, so the memoized board skips
  // re-rendering cells whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): CellVisualState => {
      if (state.phase === "study") {
        return state.targets.includes(index) ? "target" : "idle";
      }
      if (state.phase === "input") {
        return state.selections.includes(index) ? "selected" : "idle";
      }
      if (state.phase === "roundResult") {
        const isTarget = state.targets.includes(index);
        const isSelected = state.selections.includes(index);
        if (isSelected && !isTarget) {
          return "error";
        }
        if (isTarget) {
          return "correct";
        }
        return "idle";
      }
      return "idle";
    },
    [state.phase, state.targets, state.selections],
  );

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
              {state.phase === "study" ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, "study-status")}
                >
                  Memorize {state.targetCount} cells
                </ThemedText>
              ) : null}
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, "pause")}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

            {state.phase === "study" ? (
              <>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, "reveal-status")}
                >
                  Memorize the highlighted pattern…
                </ThemedText>
                <Board
                  gridSize={gridSize}
                  testID={testId(GAME_ID, "study-board")}
                  visualFor={visualFor}
                  disabled
                  onPressCell={handleTapCell}
                />
              </>
            ) : null}

            {state.phase === "input" ? (
              <>
                <View style={styles.statusRow}>
                  <ThemedText
                    type="bodyLarge"
                    themeColor="text"
                    testID={testId(GAME_ID, "input-status")}
                  >
                    Rebuild the pattern
                  </ThemedText>
                  <View
                    style={styles.dots}
                    testID={testId(GAME_ID, "progress")}
                    accessibilityLabel={`${state.selections.length} of ${state.targetCount} cells selected`}
                  >
                    {Array.from({ length: state.targetCount }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              i < state.selections.length
                                ? theme.accent
                                : theme.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <Board
                  gridSize={gridSize}
                  testID={testId(GAME_ID, "input-board")}
                  visualFor={visualFor}
                  onPressCell={handleTapCell}
                />
                <GameButton
                  testID={testId(GAME_ID, "submit")}
                  label="Check answer"
                  onPress={handleSubmit}
                />
              </>
            ) : null}

            {state.phase === "roundResult" ? (
              <View
                style={styles.section}
                testID={testId(GAME_ID, "round-result")}
              >
                <ThemedText
                  type="headline"
                  themeColor={
                    state.roundOutcome === "passed" ? "success" : "danger"
                  }
                  testID={testId(
                    GAME_ID,
                    state.roundOutcome === "passed"
                      ? "round-passed"
                      : "round-failed",
                  )}
                >
                  {state.roundOutcome === "passed"
                    ? "Pattern rebuilt!"
                    : "Not quite"}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  You recalled {state.roundCorrectTargets} of{" "}
                  {state.targetCount} cells
                  {state.roundWrongTaps > 0
                    ? ` (${state.roundWrongTaps} wrong tap${state.roundWrongTaps > 1 ? "s" : ""})`
                    : ""}
                </ThemedText>
                <Board
                  gridSize={gridSize}
                  testID={testId(GAME_ID, "round-result-board")}
                  visualFor={visualFor}
                  disabled
                  onPressCell={handleTapCell}
                />
                <GameButton
                  testID={testId(GAME_ID, "next-round")}
                  label={isLastRound ? "See results" : "Next round"}
                  onPress={() => dispatch({ type: "next-round" })}
                />
              </View>
            ) : null}

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
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
                  ? state.stats.roundsPassed / state.stats.roundsPlayed
                  : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, "accuracy")}
            />
            <StatRow
              label="Rounds passed"
              value={`${state.stats.roundsPassed}/${state.stats.roundsPlayed}`}
              testID={testId(GAME_ID, "rounds-passed")}
            />
            <StatRow
              label="Best recall"
              value={String(state.stats.bestRecall)}
              testID={testId(GAME_ID, "best-recall")}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, "best-streak")}
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
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
});
