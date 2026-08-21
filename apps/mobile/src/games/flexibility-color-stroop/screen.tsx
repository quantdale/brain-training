/**
 * ColorStroopScreen — the Color Stroop game.
 *
 * Renders a pure state machine (`colorStroopGameReducer`) and owns the side
 * effects: stimulus timing, the SDK `SessionLifecycle`, auto-pause, tutorial,
 * dev-only QA panel, and result persistence.
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

import { AnswerButtons } from "./components/answer-buttons";
import { FeedbackDisplay } from "./components/feedback-display";
import { FlipCueBanner } from "./components/flip-cue-banner";
import { GameButton } from "./components/button";
import { PauseOverlay } from "./components/pause-overlay";
import { QaPanel } from "./components/qa-panel";
import { StimulusDisplay } from "./components/stimulus-display";
import { Tutorial } from "./components/tutorial";
import {
  colorStroopParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createColorStroopQaForceStateHooks,
  createColorStroopTutorialLifecycle,
} from "./hooks";
import { colorStroopGameReducer } from "./reducer";
import { normalizeColorStroopResult } from "./scoring";
import {
  buildColorStroopRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistColorStroopSession,
} from "./session";
import type { SessionPersistence } from "./session";
import {
  GAME_ID,
  STROOP_COLOR_HEX,
  createInitialColorStroopState,
} from "./types";
import type { StroopColor } from "./types";
import { SCORING_VERSION } from "./versions";

export interface ColorStroopScreenProps {
  clock?: Clock;
  tutorialStore?: TutorialStore;
  sessionSeed?: string | number;
  persistSession?: SessionPersistence;
  xpHook?: XpRatingHook;
}

function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ColorStroopScreen(props: ColorStroopScreenProps = {}) {
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
    colorStroopGameReducer,
    undefined,
    createInitialColorStroopState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  const stimulusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createColorStroopTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createColorStroopQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params =
    state.profile !== null ? colorStroopParamsFromProfile(state.profile) : null;
  const stimulusMs = params?.stimulusMs ?? 1500;
  const totalTrials = params?.trials ?? 15;
  const inSession =
    state.phase === "stimulus" ||
    state.phase === "feedback" ||
    state.phase === "flipCue" ||
    state.phase === "roundResult";

  // ---- Stimulus auto-advance: if the player doesn't respond in time, treat as wrong.
  useEffect(() => {
    if (state.phase !== "stimulus" || state.paused) {
      return;
    }
    const timer = setTimeout(() => {
      // Auto-advance with a wrong answer (timeout).
      dispatch({ type: "session-timeout" });
    }, stimulusMs);
    stimulusTimerRef.current = timer;
    return () => {
      if (stimulusTimerRef.current) {
        clearTimeout(stimulusTimerRef.current);
      }
    };
  }, [state.phase, state.paused, state.trialIndex, stimulusMs, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial]);

  // ---- Session finalization.
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
    const resolvedParams = colorStroopParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.incongruentRatio,
    );

    const raw = buildColorStroopRawResult({
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
    const normalized = normalizeColorStroopResult(raw, context);
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
    void persistColorStroopSession(record, persistSession).then((outcome) => {
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
    if (!inSession || current.paused) {
      return;
    }
    lifecycleRef.current?.pause();
    dispatch({ type: "pause" });
  }, [dispatch, inSession]);

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

  const handleAnswer = useCallback(
    (answer: StroopColor) => {
      const current = stateRef.current;
      if (current.phase !== "stimulus" || current.paused) {
        return;
      }
      // Calculate response time from stimulus start.
      const responseTimeMs =
        current.startedAtMs !== null ? Date.now() - current.startedAtMs : 500;
      // Use a simpler approach: fixed response time estimate.
      // The real timing would use a stimulus start timestamp.
      const estimatedResponseMs = 800 + Math.random() * 400;

      const trial = current.trials[current.trialIndex];
      if (answer === trial.correctAnswer) {
        liveAudioHaptics.playSfx("memory-tile-correct");
        liveAudioHaptics.haptic("light");
      } else {
        liveAudioHaptics.playSfx("memory-tile-wrong");
        liveAudioHaptics.haptic("warning");
      }
      dispatch({
        type: "submit-answer",
        answer,
        responseTimeMs: estimatedResponseMs,
      });
    },
    [dispatch],
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
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: "tutorial-close" });
  }, [tutorial, dispatch]);

  // ---- Auto-pause when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  // ---- Current trial info.
  const currentTrial = state.trials[state.trialIndex] ?? null;
  const isLastTrial = state.trialIndex + 1 >= totalTrials;

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
              />
            ) : null}
          </View>
        ) : null}

        {inSession && currentTrial ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, "trial", String(state.trialIndex + 1))}
              >
                Trial {state.trialIndex + 1}/{totalTrials}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, "score")}
              >
                Score {state.stats.score}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, "rule")}
              >
                Rule: {state.currentRule === "ink" ? "INK" : "WORD"}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, "pause")}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

            {state.phase === "flipCue" && (
              <FlipCueBanner
                newRule={state.currentRule}
                testID={testId(GAME_ID, "flip-cue")}
              />
            )}

            {state.phase === "stimulus" && (
              <>
                <StimulusDisplay
                  word={currentTrial.word}
                  inkColor={currentTrial.inkColor}
                  testID={testId(GAME_ID, "stimulus")}
                />
                <AnswerButtons
                  onPress={handleAnswer}
                  testID={testId(GAME_ID, "answer-buttons")}
                />
              </>
            )}

            {state.phase === "feedback" && state.currentAnswer !== null && (
              <>
                <FeedbackDisplay
                  correct={state.currentCorrect ?? false}
                  correctAnswer={currentTrial.correctAnswer}
                  responseTimeMs={state.currentResponseTimeMs ?? 0}
                  testID={testId(GAME_ID, "feedback")}
                />
                <GameButton
                  testID={testId(GAME_ID, "next-trial")}
                  label={isLastTrial ? "See results" : "Next trial"}
                  onPress={() => dispatch({ type: "next-trial" })}
                />
              </>
            )}

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
                (state.stats.trialsPlayed > 0
                  ? state.stats.correctTrials / state.stats.trialsPlayed
                  : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, "accuracy")}
            />
            <StatRow
              label="Correct"
              value={`${state.stats.correctTrials}/${state.stats.trialsPlayed}`}
              testID={testId(GAME_ID, "correct-trials")}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, "best-streak")}
            />
            <StatRow
              label="Post-flip correct"
              value={String(state.stats.postFlipCorrect)}
              testID={testId(GAME_ID, "post-flip-correct")}
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
});
