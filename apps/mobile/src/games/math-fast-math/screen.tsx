/**
 * MathScreen — the Fast Math game (validated procedural arithmetic).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Fast-Math-specific — the reducer wiring, the per-problem
 * budget ticker, the scoring/persistence pipeline, and the problem view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Timing model: the reducer never reads a clock. The ticker feeds
 * `problem-tick` actions with the lifecycle's active-only elapsed ms, so
 * paused time is excluded from the per-problem budget exactly — pausing
 * cannot be used to gain thinking time (see reducer.ts docs).
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GameButton, StatRow } from '@/components/game-ui';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { FeedbackPanel } from './components/feedback';
import { NumberPad } from './components/number-pad';
import { ProblemDisplay } from './components/problem';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { mathParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createMathQaForceStateHooks, createMathTutorialLifecycle } from './hooks';
import { mathGameReducer } from './reducer';
import { normalizeMathResult } from './scoring';
import {
  buildMathRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMathSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialMathState } from './types';
import { SCORING_VERSION } from './versions';

/** Budget ticker granularity in ms (drives both display and timeout checks). */
export const TIMER_TICK_MS = 100;

export interface MathScreenProps {
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

export default function MathScreen(props: MathScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(mathGameReducer, undefined, createInitialMathState);

  const stateRef = useRef(state);
  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'problem' || current.phase === 'feedback') && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createMathTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createMathQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? mathParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'problem' || state.phase === 'feedback';
  const isLastProblem = state.problemIndex + 1 >= rounds;

  // ---- Per-problem budget ticker: feeds the reducer with active-only
  // elapsed ms; the reducer transitions to `timeout` when the budget is
  // crossed. Pause deactivates the ticker (timers frozen); resume re-schedules
  // from the current active elapsed (paused segments excluded by lifecycle).
  useGameInterval(
    state.phase === 'problem' && !state.paused && state.problemBudgetMs > 0,
    () => dispatch({ type: 'problem-tick', atActiveMs: session.elapsedMs() }),
    TIMER_TICK_MS,
  );

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // ---- Session finalization: complete the lifecycle, run the SDK scoring
  // pipeline (raw → normalized → XP hook), and persist atomically.
  // `claimFinalize()` guards against double submission (once per session).
  useEffect(() => {
    if (
      state.phase !== 'results' ||
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
    const difficulty = state.difficulty ?? 'normal';
    const resolvedParams = mathParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.difficultyStep,
    );

    const raw = buildMathRawResult({
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
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeMathResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
    // Phase-2 seam: rating deltas are computed but unused while the shared
    // hook is a no-op.
    xpHook.computeRatingDeltas(normalized, context);

    dispatch({
      type: 'session-finalized',
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
    dispatch({ type: 'persistence-started' });
    void persistMathSession(record, persistSession).then((outcome) => {
      if (outcome.ok) {
        dispatch({ type: 'persistence-succeeded' });
        const co = outcome.result.completionOutcome;
        if (co) {
          dispatch({
            type: 'completion-outcome-received',
            xp: co.xp,
            currency: co.currency,
            deltas: co.deltas,
          });
        }
      } else {
        dispatch({ type: 'persistence-failed', message: String(outcome.error) });
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
    state.difficultyStep,
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
    dispatch({ type: 'resume' });
  }, [session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleDigit = useCallback(
    (digit: number) => {
      dispatch({ type: 'digit', digit });
    },
    [dispatch],
  );

  const handleBackspace = useCallback(() => {
    dispatch({ type: 'backspace' });
  }, [dispatch]);

  const handleClearInput = useCallback(() => {
    dispatch({ type: 'clear-input' });
  }, [dispatch]);

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'problem' || current.paused || current.input.length === 0) {
      return;
    }
    const problem = current.problem;
    const correct = problem !== null && Number(current.input) === problem.answer;
    if (correct) {
      liveAudioHaptics.playSfx('math-fast-math-correct');
      liveAudioHaptics.haptic('success');
    } else {
      liveAudioHaptics.playSfx('math-fast-math-wrong');
      liveAudioHaptics.haptic('warning');
    }
    dispatch({ type: 'submit-answer', atActiveMs: session.elapsedMs() });
  }, [session, dispatch]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'next-problem', startedAtActiveMs: session.elapsedMs() });
  }, [session, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const level = current.difficulty ?? 'normal';
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    const identity = session.begin();
    dispatch({
      type: 'start-session',
      seed,
      sessionId: identity.sessionId,
      startedAtMs: identity.startedAtMs,
    });
  }, [session, sessionSeed, dispatch]);

  const handleRestart = handleStart;

  // ---- Tutorial controls.
  const openTutorial = useCallback(() => {
    tutorial.requestReplay(GAME_ID);
    dispatch({ type: 'tutorial-open' });
  }, [tutorial, dispatch]);

  const completeTutorial = useCallback(() => {
    tutorial.complete(GAME_ID);
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  const skipTutorial = useCallback(() => {
    tutorial.skipForQa(GAME_ID); // dev-only (assertDevOnly inside)
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  const view: GameHostView =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  const remainingMs = Math.max(0, state.problemBudgetMs - state.problemElapsedMs);

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={view}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) => dispatch({ type: 'select-difficulty', level })}
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      header={
        <ThemedText
          type="subtitle"
          testID={testId(GAME_ID, 'problem-label', String(state.problemIndex + 1))}>
          Problem {state.problemIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {state.phase === 'problem' && state.problem !== null ? (
            <View
              style={styles.section}
              testID={testId(GAME_ID, 'problem', String(state.problemIndex + 1))}>
              <ProblemDisplay problem={state.problem} input={state.input} />
              {state.problemBudgetMs > 0 ? (
                <TimerBar
                  remainingMs={remainingMs}
                  totalMs={state.problemBudgetMs}
                  theme={theme}
                />
              ) : null}
              <View style={styles.padRow}>
                <GameButton
                  small
                  variant="secondary"
                  testID={testId(GAME_ID, 'clear')}
                  label="Clear"
                  onPress={handleClearInput}
                />
              </View>
              <NumberPad
                onDigit={handleDigit}
                onBackspace={handleBackspace}
                onSubmit={handleSubmit}
              />
            </View>
          ) : null}

          {state.phase === 'feedback' && state.problem !== null && state.outcome !== null ? (
            <View style={styles.section}>
              <FeedbackPanel
                outcome={state.outcome}
                problem={state.problem}
                enteredAnswer={state.enteredAnswer}
                isLastProblem={isLastProblem}
                onNext={handleNext}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === 'results' ? (
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
            testID={testId(GAME_ID, 'score')}
          />
          <StatRow
            label="Accuracy"
            value={`${Math.round(
              (state.stats.problemsPlayed > 0
                ? state.stats.problemsCorrect / state.stats.problemsPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Correct"
            value={`${state.stats.problemsCorrect}/${state.stats.problemsPlayed}`}
            testID={testId(GAME_ID, 'problems-correct')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Fastest answer"
            value={
              state.stats.fastestMs === null ? '—' : `${(state.stats.fastestMs / 1000).toFixed(1)}s`
            }
            testID={testId(GAME_ID, 'fastest')}
          />
          <StatRow
            label="XP"
            value={String(state.authoritativeXp ?? state.xp)}
            testID={testId(GAME_ID, 'xp')}
          />
        </GameResults>
      ) : null}
    </GameHost>
  );
}

/** Budget countdown bar (rendered only for timed problems). */
function TimerBar({
  remainingMs,
  totalMs,
  theme,
}: {
  remainingMs: number;
  totalMs: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  return (
    <View
      style={[styles.timerBar, { backgroundColor: theme.border }]}
      testID={testId(GAME_ID, 'timer')}
      accessibilityLabel={`Time remaining ${seconds} second${seconds === 1 ? '' : 's'}`}
      accessible>
      <View
        style={[
          styles.timerFill,
          { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  timerBar: {
    height: 10,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
});
