/**
 * SignalWatchScreen — the Cue Keeper game (event-based prospective memory).
 *
 * Renders a pure state machine (`prospectiveCueGameReducer`) and owns the
 * side effects: per-item response-window pacing, the SDK `SessionLifecycle`
 * (start/pause/resume/complete/abandon), auto-pause on backgrounding, the
 * tutorial, the dev-only QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer AND the current item's
 * response window (the pacing interval is cleared; elapsed window time stays
 * accumulated in a ref); resuming continues the remaining window (freeze-and-
 * continue, never a restart). The tutorial overlay freezes the item window
 * the same way while it covers the stream. The stream is covered by the
 * opaque `PauseOverlay` and hidden from the accessibility tree while paused — the
 * watchlist lives only in the player's head, and pausing must not buy study
 * time either.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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

import { BriefingPanel, GlyphChip } from "./components/briefing-panel";
import { GameButton } from "./components/button";
import { PauseOverlay } from "./components/pause-overlay";
import { QaPanel } from "./components/qa-panel";
import { ResponseControls } from "./components/response-controls";
import { StreamView } from "./components/stream-view";
import { Tutorial } from "./components/tutorial";
import {
  prospectiveCueParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createProspectiveCueQaForceStateHooks,
  createProspectiveCueTutorialLifecycle,
} from "./hooks";
import { prospectiveCueGameReducer } from "./reducer";
import { normalizeProspectiveCueResult } from "./scoring";
import {
  buildProspectiveCueRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistProspectiveCueSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialProspectiveCueState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface ProspectiveCueScreenProps {
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

/** Pacing tick granularity for the per-item response window (ms). */
const WINDOW_TICK_MS = 50;

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SignalWatchScreen(
  props: ProspectiveCueScreenProps = {},
) {
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
    prospectiveCueGameReducer,
    undefined,
    createInitialProspectiveCueState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  // Per-item response-window baseline: tracks elapsed ACTIVE (non-paused)
  // window time so pausing freezes and resuming resumes the remaining window
  // (freeze-and-continue; mirrors memory-pair-recall's study-tick semantics).
  /**
   * Per-item response-window elapsed ms as pure RENDER STATE, driving both
   * the urgency bar and the press-path elapsedFraction. Written ONLY by the
   * pacing interval (50 ms) and reset via the sanctioned render-phase
   * adjustment when the current item changes — never synchronously in an
   * effect and never via refs, so renders stay pure.
   */
  const [windowElapsedState, setWindowElapsedState] = useState({
    itemIndex: state.itemIndex,
    elapsedMs: 0,
  });
  if (windowElapsedState.itemIndex !== state.itemIndex) {
    setWindowElapsedState({ itemIndex: state.itemIndex, elapsedMs: 0 });
  }

  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createProspectiveCueTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createProspectiveCueQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params =
    state.profile !== null
      ? prospectiveCueParamsFromProfile(state.profile)
      : null;
  const rounds = params?.rounds ?? 5;
  const streamLen = params?.streamLen ?? 14;
  const itemMs = state.itemMs || params?.initialItemMs || 1700;
  const inSession =
    state.phase === "briefing" ||
    state.phase === "stream" ||
    state.phase === "roundResult";
  const isLastRound = state.roundIndex + 1 >= rounds;


  // Response-window pacing with freeze-and-continue: a window of `itemMs` of
  // ACTIVE (non-paused, tutorial-closed) time, accumulated in 50ms steps.
  // While paused OR the tutorial overlay is open the interval is cleared so
  // no window time accrues; on resume/close it continues from where it left
  // off. Expiry dispatches an index-stamped `item-timeout` — only the
  // interval that owns the current item can expire it.
  useEffect(() => {
    if (state.phase !== "stream" || state.paused || state.tutorialOpen) {
      return undefined;
    }
    const itemIndex = state.itemIndex;
    let elapsedMs = 0;
    const interval = setInterval(() => {
      elapsedMs = Math.min(itemMs, elapsedMs + WINDOW_TICK_MS);
      setWindowElapsedState((prev) =>
        prev.itemIndex === itemIndex
          ? { ...prev, elapsedMs }
          : prev,
      );
      if (elapsedMs >= itemMs) {
        clearInterval(interval);
        dispatch({ type: "item-timeout", itemIndex });
      }
    }, WINDOW_TICK_MS);
    return () => clearInterval(interval);
  }, [
    state.phase,
    state.paused,
    state.tutorialOpen,
    state.itemIndex,
    itemMs,
    dispatch,
  ]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial]);

  // ---- Per-item feedback (covers both responses and timeouts uniformly).
  useEffect(() => {
    if (state.lastItem !== null) {
      liveAudioHaptics.feedback(state.lastItem.correct ? "correct" : "wrong");
    }
  }, [state.lastItem]);

  // ---- Round outcome feedback (canonical feedback events only).
  useEffect(() => {
    if (state.roundOutcome === "passed") {
      liveAudioHaptics.feedback("success");
    } else if (state.roundOutcome === "failed") {
      liveAudioHaptics.feedback("failure");
    }
  }, [state.roundOutcome]);

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
    const resolvedParams = prospectiveCueParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.signalCount,
    );

    const raw = buildProspectiveCueRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      finalItemMs: state.itemMs,
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
    const normalized = normalizeProspectiveCueResult(raw, context);
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
    void persistProspectiveCueSession(record, persistSession).then(
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
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.signalCount,
    state.itemMs,
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
        current.phase === "briefing" ||
        current.phase === "stream" ||
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

  const handleRespond = useCallback(
    (kind: "go" | "signal") => {
      const current = stateRef.current;
      if (
        current.phase !== "stream" ||
        current.paused ||
        current.tutorialOpen ||
        current.roundScored
      ) {
        return;
      }
      // State-carried drain (≤ one 50 ms tick stale) is the press-path truth;
      // a press on a freshly-switched item reads 0 elapsed.
      const pressedElapsedMs =
        windowElapsedState.itemIndex === current.itemIndex
          ? windowElapsedState.elapsedMs
          : 0;
      const elapsedFraction = Math.min(
        1,
        Math.max(0, pressedElapsedMs / itemMs),
      );
      // Stamped with the item the player actually saw; the reducer ignores
      // presses for any other index (double-tap / late-press protection).
      dispatch({ type: "respond", kind, elapsedFraction, itemIndex: current.itemIndex });
    },
    [dispatch, itemMs],
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
    tutorial.skipForQa(GAME_ID); // dev-only (assertDevOnly inside)
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

  const round = state.round;
  const currentItem =
    round !== null && state.phase === "stream"
      ? round.items[state.itemIndex]
      : null;
  // Survivors carried over unnamed: previous active minus this round's
  // announced retirements (new signals were never in the previous set).
  const survivorIds =
    round !== null
      ? state.prevActiveSignalIds.filter(
          (id) => !round.retiredSignalIds.includes(id),
        )
      : [];

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

            {state.phase === "briefing" ? (
              <>
                <BriefingPanel round={round} survivorIds={survivorIds} />
                <GameButton
                  testID={testId(GAME_ID, "briefing-start")}
                  label="Start stream"
                  onPress={() => dispatch({ type: "briefing-done" })}
                />
              </>
            ) : null}

            {state.phase === "stream" && currentItem !== null ? (
              <>
                <View style={styles.statusRow}>
                  <ThemedText
                    type="bodyLarge"
                    themeColor="text"
                    testID={testId(GAME_ID, "stream-status")}
                  >
                    Watch the stream…
                  </ThemedText>
                  <View
                    style={styles.dots}
                    testID={testId(GAME_ID, "progress")}
                    accessibilityLabel={`Item ${state.itemIndex + 1} of ${streamLen}`}
                  >
                    {Array.from({ length: streamLen }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              i < state.itemIndex ? theme.accent : theme.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <StreamView
                  item={currentItem}
                  fractionRemaining={
                    1 - Math.min(windowElapsedMs, itemMs) / itemMs
                  }
                  disabled={state.paused}
                />
                <ResponseControls
                  disabled={state.paused}
                  onRespond={handleRespond}
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
                    ? "All signals caught!"
                    : "Not quite"}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Signals caught {state.roundSignalHits}/
                  {state.roundSignalTotal}
                  {state.roundFalseAlarms > 0
                    ? ` · ${state.roundFalseAlarms} false alarm${state.roundFalseAlarms > 1 ? "s" : ""}`
                    : ""}
                </ThemedText>
                {/* Reveal the round's watchlist after scoring. */}
                <View style={styles.chipRow}>
                  {round.activeSignalIds.map((id) => (
                    <GlyphChip key={id} glyphId={id} />
                  ))}
                </View>
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
              label="Signals caught"
              value={`${state.stats.signalHits}/${state.stats.totalSignals}`}
              testID={testId(GAME_ID, "signals-caught")}
            />
            <StatRow
              label="Accuracy"
              value={`${Math.round(
                (state.stats.totalItems > 0
                  ? state.stats.correctResponses / state.stats.totalItems
                  : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, "accuracy")}
            />
            <StatRow
              label="False alarms"
              value={String(state.stats.falseAlarms)}
              testID={testId(GAME_ID, "false-alarms")}
            />
            <StatRow
              label="Rounds passed"
              value={`${state.stats.roundsPassed}/${state.stats.roundsPlayed}`}
              testID={testId(GAME_ID, "rounds-passed")}
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
});
