/**
 * Order Path game screen.
 *
 * Renders the pure `orderPathGameReducer` state machine and owns the side
 * effects: the per-round expiry timer, the SDK `SessionLifecycle`, auto-pause
 * on backgrounding, the tutorial, the dev-only QA panel, and result
 * persistence.
 *
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests.
 *
 * Timing comes from the injectable SDK monotonic clock (never `Date.now()`).
 * The round deadline lives in the reducer; the screen schedules one timeout per
 * active round segment (pause cancels it, resume re-schedules).
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

import { GameButton } from "./components/button";
import { ConstraintList } from "./components/constraint-list";
import { PauseOverlay } from "./components/pause-overlay";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import {
  orderPathParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createOrderPathQaForceStateHooks,
  createOrderPathTutorialLifecycle,
} from "./hooks";
import { orderPathGameReducer } from "./reducer";
import { normalizeOrderPathResult } from "./scoring";
import {
  buildOrderPathRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistOrderPathSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialOrderPathState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface OrderPathScreenProps {
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

function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function OrderPathScreen(props: OrderPathScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    orderPathGameReducer,
    undefined,
    createInitialOrderPathState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createOrderPathTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createOrderPathQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params = state.profile
    ? orderPathParamsFromProfile(state.profile)
    : null;
  const inSession = state.phase === "round" || state.phase === "roundResult";

  // ---- Round expiry: one timeout per active round segment.
  useEffect(() => {
    if (
      state.phase !== "round" ||
      state.paused ||
      state.roundDeadlineMs === null
    ) {
      return;
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

  // ---- Session finalization: complete lifecycle, run scoring pipeline, persist.
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
    const resolvedParams = orderPathParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.itemCount,
      resolvedParams.edgeDensityTarget,
    );

    const raw = buildOrderPathRawResult({
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
    const normalized = normalizeOrderPathResult(raw, context);
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
    void persistOrderPathSession(record, persistSession).then((outcome) => {
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
    xpHook,
    persistSession,
  ]);

  const startSession = useCallback(
    (seed: string) => {
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
    if (current.phase !== "round" || current.paused) {
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

  const handleSelectItem = useCallback(
    (item: string) => {
      const current = stateRef.current;
      if (
        current.phase !== "round" ||
        current.paused ||
        current.roundDeadlineMs === null
      ) {
        return;
      }
      const nowMs = clock.now();
      if (nowMs > current.roundDeadlineMs) {
        return;
      }
      if (current.currentRound?.solution[0] === item) {
        liveAudioHaptics.playSfx("logic-order-path-correct");
        liveAudioHaptics.haptic("success");
      } else {
        liveAudioHaptics.playSfx("logic-order-path-wrong");
        liveAudioHaptics.haptic("warning");
      }
      dispatch({ type: "select-item", item, nowMs });
    },
    [clock, dispatch],
  );

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const seed =
      current.seedOverride ??
      (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(seed);
  }, [startSession, sessionSeed]);

  const handleRestart = handleStart;

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

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  const roundResultMessage =
    state.roundOutcome === "correct"
      ? "Solved!"
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
            {isDevBuild() ? <QaPanel hooks={qaHooks} /> : null}
          </View>
        ) : null}

        {inSession ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, "round", String(state.roundIndex + 1))}
              >
                Round {state.roundIndex + 1}/{params?.rounds ?? 0}
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

            {state.currentRound !== null ? (
              <ConstraintList constraints={state.currentRound.constraints} />
            ) : null}

            {state.phase === "round" && state.currentRound !== null ? (
              <View style={styles.section}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Place each item in the only valid order.
                </ThemedText>
                <View style={styles.placedRow}>
                  {state.placedItems.map((item, i) => (
                    <ThemedText
                      key={i}
                      type="default"
                      testID={testId(GAME_ID, "placed", String(i))}
                    >
                      {i + 1}. {item}
                    </ThemedText>
                  ))}
                </View>
                <View style={styles.items}>
                  {state.currentRound.items.map((item) => (
                    <GameButton
                      key={item}
                      testID={testId(GAME_ID, "item", item)}
                      label={item}
                      onPress={() => handleSelectItem(item)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {state.phase === "roundResult" && state.currentRound !== null ? (
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
                <ThemedText type="small" themeColor="textSecondary">
                  Solution: {state.currentRound.solution.join(" → ")}
                </ThemedText>
                <GameButton
                  testID={testId(GAME_ID, "next-round")}
                  label="Next round"
                  onPress={() =>
                    dispatch({ type: "next-round", nowMs: clock.now() })
                  }
                />
              </View>
            ) : null}

            {isDevBuild() ? <QaPanel hooks={qaHooks} /> : null}
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
              label="Best time"
              value={
                state.stats.bestRoundTimeMs === Number.POSITIVE_INFINITY
                  ? "—"
                  : `${(state.stats.bestRoundTimeMs / 1000).toFixed(1)}s`
              }
              testID={testId(GAME_ID, "best-time")}
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

      {state.paused && state.phase === "round" ? (
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
  screen: { flex: 1 },
  content: { flex: 1, gap: Spacing.three },
  section: { gap: Spacing.three },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  placedRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  items: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
});
