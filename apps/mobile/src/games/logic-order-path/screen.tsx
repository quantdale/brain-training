/**
 * Order Path game screen.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Order-Path-specific — the per-round expiry timer, item
 * selection against the solver, and the scoring/persistence pipeline.
 *
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests.
 *
 * Timing comes from the injectable SDK monotonic clock (gameplay timing never
 * uses `Date.now()`; the wall clock only stamps session ids and the completion
 * timestamp). The round deadline lives in the reducer; the screen schedules one
 * timeout per active round segment via the host's pause-aware helper (pause
 * cancels it, resume re-schedules).
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
  useGameTimeout,
} from "@/components/game-host";
import type { GameHostView } from "@/components/game-host";

import { ConstraintList } from "./components/constraint-list";
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
import { availableNext } from "./solver";
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

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return current.phase === "round" && !current.paused;
    },
    onPause: () => dispatch({ type: "pause", nowMs: clock.now() }),
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

  // ---- Round expiry: one timeout per active round segment. Pause
  // deactivates the timer; resume re-schedules it from the deadline the
  // reducer rebuilt.
  const roundRemainingMs =
    state.phase === "round" && !state.paused && state.roundDeadlineMs !== null
      ? Math.max(0, state.roundDeadlineMs - clock.now())
      : 0;
  useGameTimeout(
    state.phase === "round" && !state.paused && state.roundDeadlineMs !== null,
    () => dispatch({ type: "expire-round", nowMs: clock.now() }),
    roundRemainingMs,
  );

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial]);

  // ---- Session finalization: complete lifecycle, run scoring pipeline, persist.
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
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

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
      // Feedback reflects whether the tapped item is the unique valid next
      // placement at the current step — not merely the first solution item.
      const round = current.currentRound;
      const available =
        round !== null
          ? availableNext(round.items, round.edges, current.placedItems)
          : [];
      liveAudioHaptics.feedback(
        available.length === 1 && available[0] === item ? "correct" : "wrong",
      );
      dispatch({ type: "select-item", item, nowMs });
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
      // Same clock as select-item/expire-round: the reducer derives the
      // round-1 deadline and answer timing from this value, so it must live
      // on the injectable monotonic clock's epoch, not the wall clock.
      startedAtMs: clock.now(),
    });
  }, [clock, session, sessionSeed, dispatch]);

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

  const roundResultMessage =
    state.roundOutcome === "correct"
      ? "Solved!"
      : state.roundOutcome === "timeout"
        ? "Time’s up"
        : "Not quite";

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
          Round {state.roundIndex + 1}/{params?.rounds ?? 0}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={<QaPanel hooks={qaHooks} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      }>
      {inSession ? (
        <>
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  placedRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  items: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
});
