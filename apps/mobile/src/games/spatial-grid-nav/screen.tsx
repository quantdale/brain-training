/**
 * SpatialGridNavScreen — the Spatial Grid Navigator game.
 *
 * Renders a pure state machine (`gameReducer`) and owns the side effects:
 * the SDK `SessionLifecycle` (start/pause/resume/complete/abandon),
 * auto-pause on backgrounding, the tutorial, the dev-only QA panel, and result
 * persistence.
 *
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests. Pause freezes the lifecycle timer;
 * the board is covered by the opaque `PauseOverlay` while paused.
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
  assertDevOnly,
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
  PauseOverlay as SharedPauseOverlay,
} from "@/components/game-ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SpatialGridNavScreen(
  props: SpatialGridNavScreenProps = {},
) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession: persisterProp = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    createInitialState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  /** Monotonic timestamp (clock.now()) of when the trial became active. */
  const choiceStartedAtRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
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
    void persistSpatialGridNavSession(record, persisterProp).then((outcome) => {
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
    xpHook,
    persisterProp,
  ]);

  // Session controls.
  const startSession = useCallback(
    (_level: DifficultyLevel, seed: string) => {
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
      !(current.phase === "trialActive" || current.phase === "trialResult") ||
      current.paused ||
      current.round === null
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
    const level = current.difficulty ?? "normal";
    const seed =
      current.seedOverride ??
      (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(level, seed);
  }, [startSession, sessionSeed]);

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

  // Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

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
        {/* ---- Intro phase ---- */}
        {state.phase === "intro" ? (
          <View style={styles.section} testID={testId(GAME_ID, "intro")}>
            <ThemedText type="small" themeColor="textSecondary">
              {gameDefinition.description}
            </ThemedText>

            <ThemedText type="caption" themeColor="textSecondary">
              Difficulty
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
                onForceTimeout={forceTimeout}
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
                {`Round ${state.roundIndex + 1}/${rounds}`}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, "score")}
              >
                {`Score ${state.stats.score}`}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, "pause")}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

            {/* Dev-only QA controls anchored above the tall board content so
                they stay reachable by automation (the board pushes anything
                rendered below it past several viewport-heights). */}
            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={forceTimeout}
              />
            ) : null}

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
            {!state.paused && state.round !== null ? (
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

            {state.persistState === "failed" ? (
              <ThemedText
                type="small"
                themeColor="danger"
                testID={testId(GAME_ID, "persist-error")}
              >
                {`Your session could not be saved. ${state.lastError ?? ""}`}
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
        <SharedPauseOverlay
          gameId={GAME_ID}
          onResume={resumeSession}
          onQuit={quitToLibrary}
        />
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
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
});
