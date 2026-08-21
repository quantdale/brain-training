/**
 * MathMissingOperatorScreen — the Missing Operator game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Missing-Operator-specific — the reducer wiring, the per-round
 * budget timer, the scoring/persistence pipeline, and the equation view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Round timer: while the round is open the effect schedules a timeout for
 * `budget − roundElapsedMs − (clock.now() − roundStartedAtMs)`. Pausing
 * cancels the timer (the reducer banks the elapsed segment), so pause freezes
 * the countdown and resume restarts it with the remaining time; an
 * over-long pause that exceeds the budget times the round out immediately on
 * resume. The equation is covered by the opaque shared PauseOverlay and
 * hidden from the accessibility tree while paused.
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
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';

import { EquationDisplay } from './components/equation-display';
import { OperatorRow } from './components/operator-button';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  budgetForRound,
  mathMissingOperatorParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createMathMissingOperatorQaForceStateHooks,
  createMathMissingOperatorTutorialLifecycle,
} from './hooks';
import { mathMissingOperatorGameReducer } from './reducer';
import { avgResponseMs, normalizeMathMissingOperatorResult } from './scoring';
import {
  buildMathMissingOperatorRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMathMissingOperatorSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, OPERATORS, OPERATOR_GLYPHS, createInitialMathMissingOperatorState } from './types';
import type { Operator } from './types';
import { SCORING_VERSION } from './versions';

export interface MathMissingOperatorScreenProps {
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

export default function MathMissingOperatorScreen(props: MathMissingOperatorScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    mathMissingOperatorGameReducer,
    undefined,
    createInitialMathMissingOperatorState,
  );

  const stateRef = useRef(state);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'answer' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause', pausedAtMs: clock.now() }),
  });

  const tutorial = useMemo(
    () => createMathMissingOperatorTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createMathMissingOperatorQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params = state.profile !== null ? mathMissingOperatorParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 7;
  const roundBudget =
    params !== null && state.phase === 'answer' ? budgetForRound(params, state.roundIndex) : null;
  const inSession = state.phase === 'answer' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Round budget timer: one timeout per round; pause cancels (timers
  // frozen), resume re-schedules with the remaining time.
  useEffect(() => {
    if (state.phase !== 'answer' || state.paused || roundBudget === null) {
      return;
    }
    const elapsed = state.roundElapsedMs + (clock.now() - state.roundStartedAtMs);
    const remaining = Math.max(0, roundBudget - elapsed);
    if (remaining <= 0) {
      // Resume after a pause longer than the remaining budget: time out now.
      dispatch({ type: 'round-timeout' });
      return;
    }
    const timer = setTimeout(() => dispatch({ type: 'round-timeout' }), remaining);
    return () => clearTimeout(timer);
  }, [
    state.phase,
    state.paused,
    state.roundIndex,
    state.roundElapsedMs,
    state.roundStartedAtMs,
    roundBudget,
    clock,
    dispatch,
  ]);

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
      state.profile === null ||
      state.sessionId === null ||
      state.startedAtMs === null ||
      !session.claimFinalize()
    ) {
      return;
    }

    session.completeIfActive();
    const activeDurationMs = session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
    const completedAtMs = Date.now();
    const difficulty = state.difficulty ?? 'normal';
    const resolvedParams = mathMissingOperatorParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.adaptiveRating,
    );

    const raw = buildMathMissingOperatorRawResult({
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
    const normalized = normalizeMathMissingOperatorResult(raw, context);
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
    void persistMathMissingOperatorSession(record, persistSession).then((outcome) => {
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
    state.adaptiveRating,
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
    session.resume();
    dispatch({ type: 'resume', resumedAtMs: clock.now() });
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleAnswer = useCallback(
    (operator: Operator) => {
      const current = stateRef.current;
      if (current.phase !== 'answer' || current.paused || current.equation === null) {
        return;
      }
      const responseMs = current.roundElapsedMs + (clock.now() - current.roundStartedAtMs);
      if (operator === current.equation.answerOperator) {
        liveAudioHaptics.playSfx('math-missing-operator-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('math-missing-operator-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'answer-round', operator, responseMs });
    },
    [clock, dispatch],
  );

  const handleNextRound = useCallback(() => {
    dispatch({ type: 'next-round', roundStartedAtMs: clock.now() });
  }, [clock, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    const identity = session.begin();
    dispatch({
      type: 'start-session',
      seed,
      sessionId: identity.sessionId,
      startedAtMs: identity.startedAtMs,
      // Monotonic anchor for round pacing (identity.startedAtMs is wall-clock).
      roundStartedAtMs: clock.now(),
    });
  }, [session, sessionSeed, clock, dispatch]);

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

  // ---- Round presentation.
  const revealedOperator: Operator | null =
    state.roundOutcome === 'correct'
      ? state.lastAnsweredOperator
      : state.roundOutcome === 'wrong' || state.roundOutcome === 'timeout'
        ? (state.equation?.answerOperator ?? null)
        : null;

  // Stable highlight resolver — depends only on round-resolution state, never
  // on any per-tick value (this game uses a one-shot round timeout, not a tick
  // timer), so the memoized operator row skips re-renders on unrelated changes.
  const highlightFor = useCallback(
    (operator: Operator): 'correct' | 'wrong' | null => {
      if (state.phase !== 'roundResult') {
        return null;
      }
      if (operator === state.equation?.answerOperator) {
        return 'correct';
      }
      return operator === state.lastAnsweredOperator ? 'wrong' : null;
    },
    [state.phase, state.equation?.answerOperator, state.lastAnsweredOperator],
  );

  const view =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

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
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
          Round {state.roundIndex + 1}/{rounds}
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
          {state.phase === 'answer' && state.equation !== null ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'answer-status')}>
                Pick the missing operator
              </ThemedText>
              <EquationDisplay equation={state.equation} />
              <OperatorRow operators={OPERATORS} onPressOperator={handleAnswer} highlightFor={highlightFor} />
            </>
          ) : null}

          {state.phase === 'roundResult' && state.equation !== null ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === 'correct'
                    ? 'success'
                    : state.roundOutcome === 'wrong'
                      ? 'danger'
                      : 'warning'
                }
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === 'correct'
                    ? 'round-correct'
                    : state.roundOutcome === 'wrong'
                      ? 'round-wrong'
                      : 'round-timeout',
                )}>
                {state.roundOutcome === 'correct'
                  ? 'Correct!'
                  : state.roundOutcome === 'wrong'
                    ? 'Not quite'
                    : 'Time’s up'}
              </ThemedText>
              <EquationDisplay equation={state.equation} reveal={revealedOperator} />
              {state.roundOutcome === 'wrong' && state.lastAnsweredOperator !== null ? (
                <ThemedText type="small" themeColor="textSecondary">
                  You picked {OPERATOR_GLYPHS[state.lastAnsweredOperator]} — the answer is{' '}
                  {OPERATOR_GLYPHS[state.equation.answerOperator]}.
                </ThemedText>
              ) : null}
              {state.roundOutcome === 'timeout' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  The answer is {OPERATOR_GLYPHS[state.equation.answerOperator]}.
                </ThemedText>
              ) : null}
              <OperatorRow disabled operators={OPERATORS} onPressOperator={handleAnswer} highlightFor={highlightFor} />
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={handleNextRound}
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
              (state.stats.roundsPlayed > 0 ? state.stats.roundsCorrect / state.stats.roundsPlayed : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Correct"
            value={`${state.stats.roundsCorrect}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'correct')}
          />
          <StatRow
            label="Timeouts"
            value={String(state.stats.timeouts)}
            testID={testId(GAME_ID, 'timeouts')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Avg response"
            value={formatAvgResponse(avgResponseMs(state.stats))}
            testID={testId(GAME_ID, 'avg-response')}
          />
          <StatRow label="XP" value={String(state.authoritativeXp ?? state.xp)} testID={testId(GAME_ID, 'xp')} />
        </GameResults>
      ) : null}
    </GameHost>
  );
}

/** Render the average response time as `1.4 s` (or `—` when no round answered). */
function formatAvgResponse(avgMs: number): string {
  return avgMs > 0 ? `${(avgMs / 1000).toFixed(1)} s` : '—';
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
});
