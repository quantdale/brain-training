/**
 * PairRecallScreen — the Pair Recall game (associative pair-recall variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Pair-Recall-specific — the reducer wiring, the study pacing
 * timer, the scoring/persistence pipeline, and the board/cue views.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels study
 * pacing; resuming continues the remaining study window (freeze-and-continue,
 * never a restart). The board is covered by the opaque shared `PauseOverlay`
 * and hidden from the accessibility tree while paused, so the associations
 * cannot be read off the UI during a pause.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
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
  useGameInterval,
  useGameSession,
} from "@/components/game-host";
import type { GameHostView } from "@/components/game-host";

import { GameButton } from "./components/button";
import { CuePanel } from "./components/cue-panel";
import { PairBoard } from "./components/pair-board";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import {
  pairRecallParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createPairRecallQaForceStateHooks,
  createPairRecallTutorialLifecycle,
} from "./hooks";
import { responseById, stimulusById } from "./pairs";
import { pairRecallGameReducer } from "./reducer";
import { normalizePairRecallResult } from "./scoring";
import {
  buildPairRecallRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistPairRecallSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialPairRecallState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface PairRecallScreenProps {
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

/** Study pacing tick granularity in ms (freeze-and-continue accumulation step). */
const STUDY_TICK_MS = 100;

export default function PairRecallScreen(props: PairRecallScreenProps = {}) {
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
    pairRecallGameReducer,
    undefined,
    createInitialPairRecallState,
  );

  const stateRef = useRef(state);
  // Per-round study timer baseline: tracks elapsed ACTIVE (non-paused) study
  // time so pausing freezes and resuming resumes the remaining window (not a
  // restart).
  const studyElapsedRef = useRef(0);
  const studyRoundRef = useRef(-1);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === "study" ||
          current.phase === "recall" ||
          current.phase === "roundResult") &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: "pause" }),
  });

  const tutorial = useMemo(
    () => createPairRecallTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createPairRecallQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params =
    state.profile !== null ? pairRecallParamsFromProfile(state.profile) : null;
  const studyMs = params?.studyMs ?? 2600;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === "study" ||
    state.phase === "recall" ||
    state.phase === "roundResult";
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Reset the per-round study timer baseline when a new study round begins.
  useEffect(() => {
    if (state.phase === "study" && studyRoundRef.current !== state.roundIndex) {
      studyRoundRef.current = state.roundIndex;
      studyElapsedRef.current = 0;
    }
  }, [state.phase, state.roundIndex]);

  // Study pacing with freeze-and-continue: a window of `studyMs` of ACTIVE
  // (non-paused) time, accumulated in 100ms steps. While paused, the interval
  // is cleared so no time accrues; on resume it continues from where it left
  // off, so the pairs stay visible for exactly the time the player has not yet
  // studied.
  useGameInterval(
    state.phase === "study" && !state.paused,
    () => {
      const current = stateRef.current;
      if (current.phase !== "study" || current.paused) {
        return; // stale tick across a phase/pause boundary — never re-fire
      }
      studyElapsedRef.current = Math.min(
        studyMs,
        studyElapsedRef.current + STUDY_TICK_MS,
      );
      if (studyElapsedRef.current >= studyMs) {
        dispatch({ type: "study-tick" });
      }
    },
    STUDY_TICK_MS,
  );

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial]);

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
    const resolvedParams = pairRecallParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.pairCount,
    );

    const raw = buildPairRecallRawResult({
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
    const normalized = normalizePairRecallResult(raw, context);
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
    void persistPairRecallSession(record, persistSession).then((outcome) => {
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
    state.pairCount,
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

  const handleRespond = useCallback(
    (responseId: number) => {
      const current = stateRef.current;
      if (current.phase !== "recall" || current.paused || current.roundScored) {
        return;
      }
      // Per-cue feedback matches the answer actually given; the round-level
      // success/failure sting plays via the roundOutcome effect.
      const round = current.round;
      const correct =
        round !== null &&
        round.pairs[round.cueOrder[current.cueIndex]].responseId === responseId;
      liveAudioHaptics.feedback(correct ? "correct" : "wrong");
      dispatch({ type: "respond", responseId });
    },
    [dispatch],
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

  const round = state.round;
  const cueStimulusLabel =
    round !== null && state.phase === "recall"
      ? stimulusById(round.pairs[round.cueOrder[state.cueIndex]].stimulusId)
          .label
      : "";

  const view: GameHostView =
    state.phase === "intro" ? "intro" : state.phase === "results" ? "results" : "session";

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={view}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) => dispatch({ type: "select-difficulty", level })}
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
          {state.phase === "study" ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, "study-status")}
              >
                Memorize the pairs…
              </ThemedText>
              <PairBoard round={round} disabled={state.paused} />
            </>
          ) : null}

          {state.phase === "recall" ? (
            <>
              <View style={styles.statusRow}>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, "recall-status")}
                >
                  Which partner goes with {cueStimulusLabel}?
                </ThemedText>
                <View
                  style={styles.dots}
                  testID={testId(GAME_ID, "progress")}
                  accessibilityLabel={`Cue ${state.cueIndex + 1} of ${state.pairCount}`}
                >
                  {Array.from({ length: state.pairCount }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            i < state.cueIndex ? theme.accent : theme.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
              <CuePanel
                round={round}
                cueIndex={state.cueIndex}
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
                  ? "All partners recalled!"
                  : "Not quite"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You recalled {state.correctCues} of {state.pairCount}{" "}
                partners
                {state.wrongCues > 0
                  ? ` (${state.wrongCues} wrong pick${state.wrongCues > 1 ? "s" : ""})`
                  : ""}
              </ThemedText>
              {/* Reveal the round's true pairs after scoring. */}
              <PairBoard round={round} disabled />
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
});
