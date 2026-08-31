/**
 * ColorStroopScreen — the Color Stroop game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Stroop-specific — the reducer wiring, the response-time
 * measurement against the monotonic clock, the stimulus/flip-cue pacing
 * timers, the scoring/persistence pipeline, and the trial view.
 *
 * Campaign 009 defect-fix invariants preserved here (do not regress):
 * neutral trials stay answerable, reaction times are real monotonic-clock
 * measurements (timeouts record the full window rather than a fabricated
 * short RT, and pause spans are compensated on resume), the flip-cue phase
 * auto-advances so it never dead-ends, and a stimulus timeout scores the
 * trial wrong WITHOUT ending the session.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouter } from "expo-router";

import {
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from "@/sdk";
import type { Clock, TutorialStore, XpRatingHook } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, StatRow } from "@/components/game-ui";
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameDeadlineTimeout,
  useGameSession,
} from "@/components/game-host";
import type { GameHostView } from "@/components/game-host";

import { AnswerButtons } from "./components/answer-buttons";
import { FeedbackDisplay } from "./components/feedback-display";
import { FlipCueBanner } from "./components/flip-cue-banner";
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
  createInitialColorStroopState,
} from "./types";
import type { StroopColor } from "./types";
import { SCORING_VERSION } from "./versions";

export interface ColorStroopScreenProps {
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

/** How long the rule-flip banner stays up before the next stimulus appears. */
const FLIP_CUE_MS = 1500;

export default function ColorStroopScreen(props: ColorStroopScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    colorStroopGameReducer,
    undefined,
    createInitialColorStroopState,
  );

  const stateRef = useRef(state);
  /** Monotonic-clock time the current stimulus was shown (response origin). */
  const trialStartRef = useRef(0);
  /** Clock time a pause began inside the current trial, or null. */
  const pauseStartRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    // Multi-phase precision: every in-session phase is pausable exactly once
    // and only while not already paused (the host's guarded path reads this
    // lazily at pause time for both the button and AppState backgrounding).
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === "stimulus" ||
          current.phase === "feedback" ||
          current.phase === "flipCue" ||
          current.phase === "roundResult") &&
        !current.paused
      );
    },
    onPause: () => {
      // Freeze the response clock so paused time never counts against RT.
      pauseStartRef.current = clock.now();
      dispatch({ type: "pause" });
    },
  });

  // Mark the response origin each time a fresh stimulus is shown.
  useEffect(() => {
    if (state.phase === "stimulus" && !state.paused) {
      trialStartRef.current = clock.now();
    }
    // `state.paused` is deliberately excluded: this effect must fire only on
    // stimulus ENTRY. Re-running on unpause would reset the response origin
    // to resume time and erase the pre-pause span that resumeSession
    // compensates for (campaign-009 RT invariant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.trialIndex, clock]);

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

  // ---- Stimulus auto-advance: an unanswered trial counts as wrong (with the
  // full window recorded as its response time — never a fabricated fast RT),
  // then the session continues with the next trial (a slow trial must never
  // end the whole session).
  useGameDeadlineTimeout(
    state.phase === "stimulus" && !state.paused,
    () => dispatch({ type: "trial-timeout", responseTimeMs: stimulusMs }),
    stimulusMs,
    clock,
    `stimulus:${state.sessionId ?? 'idle'}:${state.trialIndex}`,
  );

  // ---- Flip-cue auto-advance: the rule-change banner shows briefly, then the
  // next stimulus appears. Without this the flipCue phase has no continue
  // affordance and the session would dead-end mid-run.
  useGameDeadlineTimeout(
    state.phase === "flipCue" && !state.paused,
    () => dispatch({ type: "dismiss-flip-cue" }),
    FLIP_CUE_MS,
    clock,
    `flip:${state.sessionId ?? 'idle'}:${state.trialIndex}`,
  );

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
      totalFlips: state.trials.filter((trial) => trial.isFlipPoint).length,
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
    void persistColorStroopSession(record, persistSession).then((outcome) => {
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
    state.trials,
    state.forced,
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
    // Compensate the response clock for the paused span.
    if (pauseStartRef.current !== null) {
      trialStartRef.current += clock.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    if (session.resumeIfPaused()) {
      dispatch({ type: "resume" });
    }
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleAnswer = useCallback(
    (answer: StroopColor) => {
      const current = stateRef.current;
      if (current.phase !== "stimulus" || current.paused) {
        return;
      }
      // Real response time against the monotonic clock, measured from the
      // moment the stimulus was shown (pause-compensated).
      const responseTimeMs = Math.max(0, clock.now() - trialStartRef.current);

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
        responseTimeMs,
      });
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
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: "tutorial-close" });
  }, [tutorial, dispatch]);

  // ---- Current trial info.
  const currentTrial = state.trials[state.trialIndex] ?? null;
  const isLastTrial = state.trialIndex + 1 >= totalTrials;

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
        <>
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
        </>
      }
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
      {inSession && currentTrial ? (
        <>
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

          {state.phase === "feedback" && (
            <>
              <FeedbackDisplay
                correct={state.currentCorrect ?? false}
                correctAnswer={currentTrial.correctAnswer}
                responseTimeMs={state.currentResponseTimeMs ?? 0}
                timedOut={state.currentAnswer === null}
                testID={testId(GAME_ID, "feedback")}
              />
              <GameButton
                testID={testId(GAME_ID, "next-trial")}
                label={isLastTrial ? "See results" : "Next trial"}
                onPress={() => dispatch({ type: "next-trial" })}
              />
            </>
          )}
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}
