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
 * response window (measured exposure stops synchronously); resuming continues
 * the exact remaining window. Render state only drives the urgency bar. The
 * tutorial overlay freezes the item window the same way while it covers the
 * stream. The stream is covered by the opaque shared `PauseOverlay` and hidden
 * from the accessibility tree while paused — the watchlist lives only in the
 * player's head, and pausing must not buy study time either.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";

import { assertDevOnly, isDevBuild, liveAudioHaptics, systemClock, testId } from "@/sdk";
import type { Clock, TutorialStore, XpRatingHook } from "@/sdk";
import { pipelineXpRatingHook } from "@/rating/xp-hook";
import { ThemedText } from "@/components/themed-text";
import { AnimatedNumber, useSafeBack } from "@/components/ui";
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
import { StreamVerdictBanner } from "./components/verdict-banner";
import {
  prospectiveCueParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
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
import { SCORING_VERSION } from "./versions";
import { continuationStamp, ownsItemCue, ownsContinuation, GAME_ID, createInitialProspectiveCueState } from './types';
import { freezeWindow, readWindowElapsed } from './observed-window';
import type { ObservedWindow } from './observed-window';
import type { ItemCueStamp, ProspectiveCueAction } from './types';

export interface ProspectiveCueScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the shared pipeline-backed hook. */
  xpHook?: XpRatingHook;
}

/** Bar refresh/expiry-notice cadence; measured exposure owns all decisions. */
const WINDOW_TICK_MS = 50;

export default function SignalWatchScreen(
  props: ProspectiveCueScreenProps = {},
) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const theme = useTheme();
  const goBack = useSafeBack('/games');
  const [state, reactDispatch] = useReducer(
    prospectiveCueGameReducer,
    undefined,
    createInitialProspectiveCueState,
  );

  const stateRef = useRef(state);
  const windowRef = useRef<ObservedWindow | null>(null);
  const presentedCueRef = useRef<ItemCueStamp | null>(null);
  const deliveredPresses = useRef(new WeakSet<object>());

  // Claim every accepted action before React commits: old rendered controls
  // cannot resolve a newly queued item, even when native deliveries share a batch.
  const dispatch = useCallback((action: ProspectiveCueAction) => {
    const current = stateRef.current;
    const next = prospectiveCueGameReducer(current, action);
    if (next === current) return null;
    if (next.paused || next.tutorialOpen || next.sessionId !== current.sessionId ||
        next.roundIndex !== current.roundIndex || next.itemIndex !== current.itemIndex || next.phase !== current.phase) {
      freezeWindow(windowRef.current, clock.now());
    }
    stateRef.current = next;
    reactDispatch(action);
    return next;
  }, [clock]);
  const dispatchContinuation = dispatch;

  const [windowElapsedState, setWindowElapsedState] = useState({
    sessionId: state.sessionId, roundIndex: state.roundIndex, itemIndex: state.itemIndex, elapsedMs: 0,
  });
  if (windowElapsedState.sessionId !== state.sessionId ||
      windowElapsedState.roundIndex !== state.roundIndex || windowElapsedState.itemIndex !== state.itemIndex) {
    setWindowElapsedState({ sessionId: state.sessionId, roundIndex: state.roundIndex, itemIndex: state.itemIndex, elapsedMs: 0 });
  }
  const windowElapsedMs = windowElapsedState.sessionId === state.sessionId &&
    windowElapsedState.roundIndex === state.roundIndex && windowElapsedState.itemIndex === state.itemIndex
      ? windowElapsedState.elapsedMs : 0;

  useLayoutEffect(() => { stateRef.current = state; });

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
    onPause: () => dispatchContinuation({ type: "pause" }),
  });

  const renderedContinuation = continuationStamp(state);
  const handleContinue = () => {
    if (session.status() !== 'active' || !session.isCurrentSession(renderedContinuation.sessionId)) {
      return;
    }
    const current = stateRef.current;
    const action: ProspectiveCueAction = {
      type: 'next-round', stamp: renderedContinuation,
    };
    const next = prospectiveCueGameReducer(current, action);
    if (next === current) return;
    dispatch(action);
  };

  const tutorial = useMemo(
    () => createProspectiveCueTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const forceWin = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-win' }); }, [dispatch]);
  const forceLose = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-lose' }); }, [dispatch]);

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

  const renderedCue = useMemo<ItemCueStamp>(() => ({ sessionId: state.sessionId, roundIndex: state.roundIndex, itemIndex: state.itemIndex, phase: state.phase, epoch: state.continuationEpoch }), [state.sessionId, state.roundIndex, state.itemIndex, state.phase, state.continuationEpoch]);
  const readStatus = session.status;

  // Exposure starts at the commit that actually mounts the cue. Resumes keep
  // measured exposure; a queued transition never charges an unseen next item.
  useLayoutEffect(() => {
    if (state.phase !== "stream" || state.paused || state.tutorialOpen || readStatus() !== 'active') return;
    const previous = windowRef.current;
    const sameItem = previous !== null && previous.sessionId === state.sessionId && previous.roundIndex === state.roundIndex &&
      previous.itemIndex === state.itemIndex && previous.phase === state.phase;
    const window: ObservedWindow = { sessionId: state.sessionId, roundIndex: state.roundIndex, itemIndex: state.itemIndex,
      phase: state.phase, elapsedMs: sameItem ? previous.elapsedMs : 0, startedAtMs: clock.now() };
    windowRef.current = window;
    presentedCueRef.current = renderedCue;
    const observed = window;
    return () => freezeWindow(observed, clock.now());
  }, [state.phase, state.paused, state.tutorialOpen, state.sessionId, state.roundIndex, state.itemIndex, renderedCue, readStatus, clock]);

  // The 50 ms cadence only refreshes the bar/notices expiry. All decisions
  // read measured exposure, and captured/cancelled work owns only this cue.
  useEffect(() => {
    if (state.phase !== "stream" || state.paused || state.tutorialOpen) return;
    const observed = windowRef.current;
    if (observed === null) return;
    let cancelled = false;
    const interval = setInterval(() => {
      const current = stateRef.current;
      if (cancelled || readStatus() !== 'active' || windowRef.current !== observed || !ownsItemCue(current, renderedCue)) return;
      const elapsedMs = readWindowElapsed(observed, clock.now());
      setWindowElapsedState((prev) => prev.sessionId === renderedCue.sessionId &&
        prev.roundIndex === renderedCue.roundIndex && prev.itemIndex === renderedCue.itemIndex
          ? { ...prev, elapsedMs: Math.min(elapsedMs, itemMs) } : prev);
      if (elapsedMs >= itemMs) {
        dispatch({ type: 'item-timeout', itemIndex: renderedCue.itemIndex, stamp: renderedCue });
      }
    }, WINDOW_TICK_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [state.phase, state.paused, state.tutorialOpen, renderedCue, readStatus, itemMs, clock, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial, dispatch]);

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
      // Rating pipeline reads the final computed challenge from the record
      // difficulty, not the SDK baseline profile (006r adaptive contract).
      difficulty: { ...state.profile, challengeRating },
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
    dispatch,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    if (session.resumeIfPaused()) {
      dispatchContinuation({ type: "resume" });
    }
  }, [session, dispatchContinuation]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    goBack();
  }, [session, goBack]);

  const handleRespond = (kind: "go" | "signal", event?: GestureResponderEvent) => {
    const current = stateRef.current;
    const observed = windowRef.current;
    const presented = presentedCueRef.current;
    if (readStatus() !== 'active' || current.phase !== 'stream' || current.roundScored ||
        !ownsItemCue(current, renderedCue) || observed === null || observed.startedAtMs === null ||
        presented === null || !ownsItemCue(current, presented)) return;
    // The native payload survives different JS wrappers. Distinct physical
    // presses remain valid; no arbitrary debounce interval discards them.
    const nativePress = event?.nativeEvent;
    if (nativePress != null) {
      if (deliveredPresses.current.has(nativePress)) return;
      deliveredPresses.current.add(nativePress);
    }
    const elapsedMs = readWindowElapsed(observed, clock.now());
    if (elapsedMs >= itemMs) {
      dispatch({ type: 'item-timeout', itemIndex: renderedCue.itemIndex, stamp: renderedCue });
      return;
    }
    dispatch({ type: 'respond', kind, elapsedFraction: Math.max(0, elapsedMs / itemMs), itemIndex: renderedCue.itemIndex, stamp: renderedCue });
  };

  const handleBriefingDone = () => {
    const current = stateRef.current;
    if (readStatus() === 'active' && current.phase === 'briefing' && ownsContinuation(current, renderedContinuation)) {
      dispatch({ type: 'briefing-done' });
    }
  };

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    if ((current.phase !== "intro" && current.phase !== "results") || current.paused || current.tutorialOpen) return;
    // A result may be claimed before its finalization effect commits.
    // Restart only after the old SDK lifecycle is terminal, never replace it.
    const status = session.status();
    if (status !== null && status !== 'completed' && status !== 'abandoned') return;
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
  // Authoritative per-item verdict: the resolved item restated from the
  // reducer's `lastItem` outcome (never the tap handler), rendered while the
  // next item's window is already live. The resolved prompt is restated so
  // the cue the player answered stays mounted alongside the verdict.
  const lastResolvedItem =
    round !== null && state.lastItem !== null
      ? round.items[state.lastItem.itemIndex] ?? null
      : null;
  const verdictBanner =
    state.lastItem !== null && lastResolvedItem !== null ? (
      <StreamVerdictBanner outcome={state.lastItem} item={lastResolvedItem} />
    ) : null;

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
      // The session is a known, finite number of rounds (difficulty params),
      // so the HUD shows real position instead of a bare round chip.
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      header={
        <ThemedText
          type="subtitle"
          testID={testId(GAME_ID, "round", String(state.roundIndex + 1))}
         themeColor="stageInk">
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel onForceWin={forceWin} onForceLose={forceLose} />
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
          {/* Live score: count-up readout mounted across every session phase
          so a score change reads as movement, not a jump (R5). The GameHost
          `score` prop above is untouched. */}
          <View style={styles.scoreStrip}>
            <ThemedText type="small" themeColor="textSecondary">
              Score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeral"
              themeColor="text"
              testID={testId(GAME_ID, "score-live")}
            />
          </View>

          {state.phase === "briefing" ? (
            <>
              <BriefingPanel round={round} survivorIds={survivorIds} />
              <GameButton
                testID={testId(GAME_ID, "briefing-start")}
                label="Start stream"
                onPress={handleBriefingDone}
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
                            i < state.itemIndex ? theme.memory : theme.border,
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
              {/* Verdict of the just-resolved item; the live prompt above and
              the controls below belong to the next item and stay neutral. */}
              {verdictBanner}
              <ResponseControls
                disabled={state.paused || state.tutorialOpen}
                onRespond={handleRespond}
              />
            </>
          ) : null}

          {state.phase === "roundResult" ? (
            <View
              style={styles.section}
              testID={testId(GAME_ID, "round-result")}
            >
              {/* The final item's verdict has no next item to flash over, so
              it is shown here above the round summary. */}
              {verdictBanner}
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
                onPress={handleContinue}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === "results" ? (
        <GameResults
          reward={{
            xp: state.authoritativeXp ?? state.xp,
            coins: state.authoritativeCurrency ?? 0,
          }}
          gameId={GAME_ID}
          normalizedResult={state.normalized ?? undefined}
          forced={state.forced}
          persistState={state.persistState}
          lastError={state.lastError}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          {/* Animated final score beside the existing rows; the plain StatRow
          below keeps its testID contract. */}
          <View style={styles.finalScore}>
            <ThemedText type="small" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              themeColor="text"
              testID={testId(GAME_ID, "score-final")}
            />
          </View>
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
  scoreStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  finalScore: {
    alignItems: "center",
    gap: Spacing.one,
  },
});
