/**
 * SignalWatchScreen — the Cue Keeper game (event-based prospective memory).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Cue-Keeper-specific — the reducer wiring, the per-item
 * response-window pacer (campaign 011 fix), the scoring/persistence pipeline,
 * and the stream view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer AND the current item's
 * response window (the pacing interval is cleared; elapsed window time stays
 * accumulated in render state); resuming continues the remaining window. The
 * tutorial overlay freezes the item window the same way while it covers the
 * stream. The stream is covered by the opaque shared `PauseOverlay` and hidden
 * from the accessibility tree while paused — the watchlist lives only in the
 * player's head, and pausing must not buy study time either.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { isDevBuild, liveAudioHaptics, noopXpRatingHook, systemClock, testId } from "@/sdk";
import type { Clock, TutorialStore, XpRatingHook } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { StatRow } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from "@/components/game-host";
import type { GameHostView } from "@/components/game-host";

import { BriefingPanel, GlyphChip } from "./components/briefing-panel";
import { GameButton } from "./components/button";
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

  const stateRef = useRef(state);
  /**
   * Per-item response-window elapsed ms as pure RENDER STATE, driving both
   * the urgency bar and the press-path elapsedFraction. Written ONLY by the
   * pacing interval (50 ms) and reset via the sanctioned render-phase
   * adjustment when the current item changes — never synchronously in an
   * effect and never via refs, so renders stay pure. (Campaign 011 fix: the
   * item-index stamping keeps a press or timeout belonging to one item from
   * bleeding into the next.)
   */
  const [windowElapsedState, setWindowElapsedState] = useState({
    itemIndex: state.itemIndex,
    elapsedMs: 0,
  });
  if (windowElapsedState.itemIndex !== state.itemIndex) {
    setWindowElapsedState({ itemIndex: state.itemIndex, elapsedMs: 0 });
  }
  // Pure-derived read for render paths (0 until the adjustment above
  // commits for a freshly-switched item).
  const windowElapsedMs =
    windowElapsedState.itemIndex === state.itemIndex
      ? windowElapsedState.elapsedMs
      : 0;
  /**
   * Cross-lifecycle seed for the response-window accumulator: pausing or
   * covering the stream must resume the REMAINING window, not grant a fresh
   * one. Written and read ONLY inside the pacing effect below — never during
   * render and never from event handlers — so renders stay pure per the
   * campaign-011 rule. The press path reads the committed render state via
   * fully-specified useCallback deps instead (see handleRespond).
   */
  const windowElapsedSeedRef = useRef({
    itemIndex: state.itemIndex,
    elapsedMs: 0,
  });

  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === "briefing" ||
          current.phase === "stream" ||
          current.phase === "roundResult") &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: "pause" }),
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
  // no window time accrues; on resume/close the accumulator is re-seeded
  // from the mirror so the REMAINING window continues (never a restart).
  // Expiry dispatches an index-stamped `item-timeout` — only the
  // interval that owns the current item can expire it.
  //
  // Kept as a game-local effect (not `useGameInterval`) DELIBERATELY: the
  // campaign 011 bleed-through fix couples the accumulator lifecycle to this
  // effect's dependency-scoped closures (index-stamped render-state writes +
  // index-stamped expiry). Hoisting it behind the shared helper would either
  // change resume semantics or reintroduce the render-phase ref access that
  // 011 removed. Correctness beats mechanical uniformity.
  useEffect(() => {
    if (state.phase !== "stream" || state.paused || state.tutorialOpen) {
      return undefined;
    }
    const itemIndex = state.itemIndex;
    // Freeze-and-continue seed: same item → keep accumulated ACTIVE time
    // across pause/tutorial coverage; fresh item → start at 0. Without this,
    // a resume silently granted a full fresh window on every pause/resume.
    // The accumulator lives in the seed ref itself (no outer mutable
    // binding captured by the tick closure — keeps the value's mutable
    // range legible to the React Compiler).
    const seed = windowElapsedSeedRef.current;
    const startMs = seed.itemIndex === itemIndex ? seed.elapsedMs : 0;
    windowElapsedSeedRef.current = { itemIndex, elapsedMs: startMs };
    const interval = setInterval(() => {
      // Accumulate UNCLAMPED ticks in the seed ref (nothing derived from
      // itemMs is ever stored there); clamp only at the consumers.
      const rawElapsedMs =
        windowElapsedSeedRef.current.elapsedMs + WINDOW_TICK_MS;
      windowElapsedSeedRef.current = { itemIndex, elapsedMs: rawElapsedMs };
      setWindowElapsedState((prev) =>
        prev.itemIndex === itemIndex
          ? { ...prev, elapsedMs: Math.min(rawElapsedMs, itemMs) }
          : prev,
      );
      if (rawElapsedMs >= itemMs) {
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
    state.signalCount,
    state.itemMs,
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
    if (session.resumeIfPaused()) {
      dispatch({ type: "resume" });
    }
  }, [session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  // NOTE: deliberately NOT wrapped in useCallback. The React Compiler
  // cannot preserve a manual memo whose dependency chain includes the
  // render-derived `itemMs` (preserve-manual-memoization), and freshness
  // matters more than identity here: a per-render closure always sees the
  // latest committed window drain, and ResponseControls is not memoized,
  // so nothing downstream benefited from a stable identity.
  const handleRespond = (kind: "go" | "signal") => {
    const current = stateRef.current;
    if (
      current.phase !== "stream" ||
      current.paused ||
      current.tutorialOpen ||
      current.roundScored
    ) {
      return;
    }
    // Committed drain (≤ one WINDOW_TICK_MS stale) is the press-path
    // truth; a press on a freshly-switched item reads 0 elapsed.
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
  };

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

  const view: GameHostView =
    state.phase === "intro" ? "intro" : state.phase === "results" ? "results" : "session";

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
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      }>
      {inSession && round !== null ? (
        <>
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
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
