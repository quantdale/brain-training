/**
 * SpatialTransformMatchScreen — the Spatial Transform Match game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Transform-Match-specific — the source reveal pacing timer, the
 * choice-phase response-time origin, option handling, and the
 * scoring/persistence pipeline.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the source
 * reveal; resuming restarts the reveal from scratch. The board is covered by
 * the opaque `PauseOverlay` and hidden from the accessibility tree while paused.
 *
 * Inference contract (campaign 014): during the choice phase neither the
 * source pattern nor the applied transform label is rendered — the round is a
 * memory + transform hybrid solved from recall alone. Feedback after the pick
 * names the transform; the source stays hidden.
 *
 * NOTE on remount-safe layout: the pattern grid uses percentage-based cell
 * sizing (see PatternGrid), so tap-area width is preserved across remounts.
 * The source-reveal timer re-fires after each remount via the host helper's
 * activation dependency.
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
  useGameDeadlineTimeout,
} from "@/components/game-host";
import type { GameHostView } from "@/components/game-host";

import { OptionButton } from "./components/option-button";
import { PatternGrid } from "./components/pattern-grid";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import { paramsFromProfile, sessionChallengeRating } from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createQaForceStateHooks,
  createSpatialTransformMatchTutorialLifecycle,
} from "./hooks";
import { gameReducer } from "./reducer";
import { normalizeResult } from "./scoring";
import {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface SpatialTransformMatchScreenProps {
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

export default function SpatialTransformMatchScreen(
  props: SpatialTransformMatchScreenProps = {},
) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession: persisterProp = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    createInitialState,
  );

  const stateRef = useRef(state);
  /** Monotonic timestamp (clock.now()) of when the choice phase started. */
  const choiceStartedAtRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);

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
        (current.phase === "source" ||
          current.phase === "choice" ||
          current.phase === "roundResult") &&
        !current.paused
      );
    },
    onPause: () => {
      pauseStartedAtRef.current = clock.now();
      dispatch({ type: "pause" });
    },
  });

  const tutorial = useMemo(
    () => createSpatialTransformMatchTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createQaForceStateHooks(dispatch), [dispatch]);

  const params =
    state.profile !== null ? paramsFromProfile(state.profile) : null;
  const sourceRevealMs = params?.sourceRevealMs ?? 1500;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === "source" ||
    state.phase === "choice" ||
    state.phase === "roundResult";
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Source reveal pacing: single tick after sourceRevealMs. Pause
  // deactivates the timer; resume continues its remaining active budget.
  useGameDeadlineTimeout(
    state.phase === "source" && !state.paused,
    () => dispatch({ type: "source-tick" }),
    sourceRevealMs,
    clock,
    `source:${state.sessionId ?? 'idle'}:${state.roundIndex}`,
  );

  // ---- Record the monotonic time when the choice phase begins.
  useEffect(() => {
    if (state.phase === "choice") {
      choiceStartedAtRef.current = clock.now();
    }
  }, [state.phase, state.roundIndex, clock]);

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
    const resolvedParams = paramsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.filledCells,
    );

    const raw = buildRawResult({
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
    const normalized = normalizeResult(raw, context);
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
    void persistSession(record, persisterProp).then((outcome) => {
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
    });
  }, [
    state.phase,
    state.profile,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.difficulty,
    session,
    xpHook,
    persisterProp,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    if (session.resumeIfPaused()) {
      if (pauseStartedAtRef.current !== null) {
        choiceStartedAtRef.current += Math.max(0, clock.now() - pauseStartedAtRef.current);
        pauseStartedAtRef.current = null;
      }
      dispatch({ type: "resume" });
    }
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleSelectOption = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== "choice" || current.paused) {
        return;
      }
      const answerMs = clock.now() - choiceStartedAtRef.current;
      if (index === current.correctOptionIndex) {
        liveAudioHaptics.playSfx("memory-tile-correct");
        liveAudioHaptics.haptic("light");
      } else {
        liveAudioHaptics.playSfx("memory-tile-wrong");
        liveAudioHaptics.haptic("warning");
      }
      dispatch({ type: "select-option", index, answerMs });
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

  const view: GameHostView =
    state.phase === "intro"
      ? "intro"
      : state.phase === "results"
        ? "results"
        : "session";

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
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
        />
      }
      qaPanelPosition="above"
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      }
    >
      {inSession ? (
        <>
          {/* Source phase: show the source pattern alone */}
          {state.phase === "source" ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, "source-status")}
              >
                Study the pattern…
              </ThemedText>
              <PatternGrid
                gridSize={params?.gridSize ?? 9}
                pattern={state.sourcePattern}
                testID={testId(GAME_ID, "source-grid")}
                accessibilityLabel="Source pattern"
              />
            </>
          ) : null}

          {/* Choice phase: memory + transform hybrid. The source pattern and
           * the applied-transform label are BOTH removed from the tree here:
           * the player must recall the studied pattern and infer which
           * transform was applied. Both are revealed in the round-result
           * feedback below. */}
          {state.phase === "choice" ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, "choice-status")}
              >
                Which grid is transformed correctly?
              </ThemedText>
              {/* A11y summary of what just happened (the source itself is no
               * longer rendered): screen readers get the same context as
               * sighted players without re-exposing the pattern. */}
              <ThemedText type="small" themeColor="textSecondary">
                The source pattern was shown briefly — recall it, work out the
                transform, and pick its result.
              </ThemedText>
              {/* Options unmount while paused — RN/Fabric Android a11y
               * workaround (see spatial-grid-nav screen.tsx): deep option
               * board nests inside accessibility buttons make the session
               * PauseOverlay subtree vanish from the Android accessibility
               * tree while paused. The opaque overlay covers them anyway. */}
              {!state.paused && (
                <View
                  style={styles.optionRow}
                  testID={testId(GAME_ID, "options")}
                >
                  {state.options.map((opt, i) => (
                    <OptionButton
                      key={i}
                      index={i}
                      gridSize={params?.gridSize ?? 9}
                      pattern={opt}
                      selected={false}
                      correct={false}
                      onPressOption={handleSelectOption}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}

          {/* Round result phase */}
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
                {state.roundOutcome === "passed" ? "Correct!" : "Wrong!"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.transformLabel}
              </ThemedText>
              <View style={styles.optionRow}>
                {state.options.map((opt, i) => (
                  <OptionButton
                    key={i}
                    index={i}
                    gridSize={params?.gridSize ?? 9}
                    pattern={opt}
                    selected={state.selectedOptionIndex === i}
                    correct={state.correctOptionIndex === i}
                    disabled
                  />
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
          onQuit={quitToLibrary}
        >
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
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
});
