/**
 * SpatialGridNavScreen — the Spatial Grid Navigator game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Grid-Navigator-specific — the reducer wiring, the response-time
 * measurement against the monotonic clock, the scoring/persistence pipeline,
 * and the board view.
 *
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests. Pause freezes the lifecycle timer;
 * the board is covered by the opaque shared `PauseOverlay` while paused.
 *
 * Dev-only QA controls are anchored ABOVE the tall board content
 * (`qaPanelPosition="above"`) so they stay reachable by automation — the
 * board pushes anything rendered below it past several viewport-heights.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  assertDevOnly,
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from "@/sdk";
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

import { GameButton } from "./components/button";
import { GridBoard, CommandList, OptionCell } from "./components/grid";
import type { GridMarker } from "./components/grid";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import { paramsFromProfile, sessionChallengeRating } from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createQaForceStateHooks,
  createSpatialGridNavTutorialLifecycle,
} from "./hooks";
import { gameReducer } from "./reducer";
import { normalizeSpatialGridNavResult } from "./scoring";
import {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSpatialGridNavSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialState } from "./types";
import { SCORING_VERSION } from "./versions";

export interface SpatialGridNavScreenProps {
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

export default function SpatialGridNavScreen(
  props: SpatialGridNavScreenProps = {},
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
    gameReducer,
    undefined,
    createInitialState,
  );

  const stateRef = useRef(state);
  /** Monotonic timestamp (clock.now()) of when the trial became active. */
  const choiceStartedAtRef = useRef(0);

  // Keep a ref of the latest state for event handlers (guards).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === "trialActive" || current.phase === "trialResult") &&
        !current.paused &&
        current.round !== null
      );
    },
    onPause: () => dispatch({ type: "pause" }),
  });

  const tutorial = useMemo(
    () => createSpatialGridNavTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createQaForceStateHooks(dispatch), [dispatch]);

  const params =
    state.profile !== null ? paramsFromProfile(state.profile) : null;
  const side = params?.gridSide ?? 5;
  const rounds = params?.rounds ?? 0;
  const inSession =
    state.phase === "trialActive" || state.phase === "trialResult";
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Record the monotonic time when a trial becomes active (answer timing).
  useEffect(() => {
    if (state.phase === "trialActive" && !state.paused) {
      choiceStartedAtRef.current = clock.now();
    }
  }, [state.phase, state.paused, clock]);

  // First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial]);

  // Session finalization: complete the lifecycle, run the SDK scoring
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
      resolvedParams.gridSide,
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
    const normalized = normalizeSpatialGridNavResult(raw, context);
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
    void persistSpatialGridNavSession(record, persistSession).then((outcome) => {
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
    persistSession,
  ]);

  // Session controls (mechanics live here; mechanics-free plumbing does not).
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

  const handlePickCell = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== "trialActive" || current.paused) {
        return;
      }
      const answerMs = clock.now() - choiceStartedAtRef.current;
      if (index === current.round?.correctIndex) {
        liveAudioHaptics.playSfx("memory-tile-correct");
        liveAudioHaptics.haptic("light");
      } else {
        liveAudioHaptics.playSfx("memory-tile-wrong");
        liveAudioHaptics.haptic("warning");
      }
      dispatch({ type: "pick-cell", index, responseMs: answerMs });
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

  // Tutorial controls.
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

  const forceTimeout = useCallback(() => {
    assertDevOnly();
    dispatch({ type: "qa/force-timeout" });
  }, [dispatch]);

  const accuracyPct =
    state.stats.roundsPlayed > 0
      ? Math.round((state.stats.correctPicks / state.stats.roundsPlayed) * 100)
      : 0;
  const hardAccuracyPct =
    state.stats.hardPlayed > 0
      ? Math.round((state.stats.hardCorrect / state.stats.hardPlayed) * 100)
      : 0;

  const resultMarkers = (() => {
    if (state.phase !== "trialResult" || state.round === null) return [];
    const markers: GridMarker[] = [
      { cell: state.round.finalCell, color: theme.success, glyph: "✓" },
    ];
    const sel = state.selectedOptionIndex;
    if (
      sel !== null &&
      sel !== state.round.correctIndex &&
      state.round.options[sel]
    ) {
      markers.push({ cell: state.round.options[sel], color: theme.danger });
    }
    return markers;
  })();

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
          {`Round ${state.roundIndex + 1}/${rounds}`}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={forceTimeout}
        />
      }
      qaPanelPosition="above"
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      }>
      {inSession && state.round !== null ? (
        <>
          {/* Board/commands stay mounted while paused; the decorative
           * option boards do not. Workaround for an RN/Fabric Android a11y
           * defect (campaign 011 device finding, bisected on device): deep
           * non-flattenable view nests inside accessibility buttons (each
           * option board is ~26 views) make the PauseOverlay subtree vanish
           * from the Android accessibility tree, leaving Resume/Quit
           * unreachable for TalkBack and automation alike. While paused the
           * overlay is opaque and game content is already hidden from a11y,
           * so unmounting the options has no user impact; they remount on
           * resume. */}
          {!state.paused ? (
            <>
              <GridBoard
                side={side}
                start={state.round.start}
                startDir={state.round.startDir}
                markers={resultMarkers}
                testID={testId(GAME_ID, "grid")}
                accessibilityLabel="Game board"
              />
              <CommandList
                commands={state.round.commands}
                testID={testId(GAME_ID, "command-list")}
              />
              <View
                style={styles.optionRow}
                testID={testId(GAME_ID, "options-grid")}
              >
                {state.round.options.map((cell, i) => (
                  <OptionCell
                    key={i}
                    index={i}
                    side={side}
                    cell={cell}
                    selected={state.selectedOptionIndex === i}
                    correct={
                      state.phase === "trialResult" &&
                      i === state.round!.correctIndex
                    }
                    disabled={state.phase === "trialResult"}
                    onPress={() => handlePickCell(i)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {state.phase === "trialResult" ? (
            <View
              style={styles.section}
              testID={testId(GAME_ID, "round-result")}
            >
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === "correct" ? "success" : "danger"
                }
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === "correct"
                    ? "round-correct"
                    : "round-wrong",
                )}
              >
                {state.roundOutcome === "correct" ? "Correct!" : "Wrong!"}
              </ThemedText>
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
            value={`${accuracyPct}%`}
            testID={testId(GAME_ID, "accuracy")}
          />
          <StatRow
            label="Speed"
            value={`${Math.round(state.stats.scoredPicks > 0 ? state.stats.totalResponseMs / state.stats.scoredPicks : 0)} ms`}
            testID={testId(GAME_ID, "speed")}
          />
          <StatRow
            label="Long sequences"
            value={`${hardAccuracyPct}%`}
            testID={testId(GAME_ID, "long-sequences")}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, "best-streak")}
          />
          <StatRow
            label="Mistakes"
            value={String(state.stats.mistakes)}
            testID={testId(GAME_ID, "mistakes")}
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
