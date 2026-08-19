/**
 * MathMissingOperatorScreen — the Missing Operator game.
 *
 * Renders a pure state machine (`mathMissingOperatorGameReducer`) and owns
 * the side effects: the per-round budget timer, the SDK `SessionLifecycle`
 * (start/pause/resume/complete/abandon), auto-pause on backgrounding, the
 * tutorial, the dev-only QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Round timer: while the round is open the effect schedules a timeout for
 * `budget − roundElapsedMs − (clock.now() − roundStartedAtMs)`. Pausing
 * cancels the timer (the reducer banks the elapsed segment), so pause freezes
 * the countdown and resume restarts it with the remaining time; an
 * over-long pause that exceeds the budget times the round out immediately on
 * resume. The equation is covered by the opaque `PauseOverlay` and hidden
 * from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  SessionLifecycle,
  isDevBuild,
  noopAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { DifficultySelector, SessionHeader, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { GameButton } from './components/button';
import { EquationDisplay } from './components/equation-display';
import { OperatorButton } from './components/operator-button';
import { PauseOverlay } from './components/pause-overlay';
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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
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
  useEffect(() => {
    if (
      state.phase !== 'results' ||
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
      lifecycle.status !== 'completed' &&
      lifecycle.status !== 'abandoned'
    ) {
      lifecycle.complete();
    }
    const activeDurationMs = lifecycle?.elapsedMs() ?? 0;
    const pausedDurationMs = lifecycle?.pausedDurationMs() ?? 0;
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
        type: 'start-session',
        seed,
        sessionId: newSessionId(),
        // Wall-clock epoch for the record; monotonic anchor for round pacing.
        startedAtMs: Date.now(),
        roundStartedAtMs: clock.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (!(current.phase === 'answer' || current.phase === 'roundResult') || current.paused) {
      return;
    }
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause', pausedAtMs: clock.now() });
  }, [clock, dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: 'resume', resumedAtMs: clock.now() });
  }, [clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

  const handleAnswer = useCallback(
    (operator: Operator) => {
      const current = stateRef.current;
      if (current.phase !== 'answer' || current.paused || current.equation === null) {
        return;
      }
      const responseMs = current.roundElapsedMs + (clock.now() - current.roundStartedAtMs);
      if (operator === current.equation.answerOperator) {
        noopAudioHaptics.playSfx('math-missing-operator-correct');
        noopAudioHaptics.haptic('light');
      } else {
        noopAudioHaptics.playSfx('math-missing-operator-wrong');
        noopAudioHaptics.haptic('warning');
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
    const level = current.difficulty ?? 'normal';
    const seed = current.seedOverride ?? (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(level, seed);
  }, [startSession, sessionSeed]);

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

  // ---- Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  // ---- Round presentation.
  const revealedOperator: Operator | null =
    state.roundOutcome === 'correct'
      ? state.lastAnsweredOperator
      : state.roundOutcome === 'wrong' || state.roundOutcome === 'timeout'
        ? (state.equation?.answerOperator ?? null)
        : null;

  const highlightFor = (operator: Operator): 'correct' | 'wrong' | null => {
    if (state.phase !== 'roundResult') {
      return null;
    }
    if (operator === state.equation?.answerOperator) {
      return 'correct';
    }
    return operator === state.lastAnsweredOperator ? 'wrong' : null;
  };

  return (
    <View style={styles.screen} testID={testId(GAME_ID, 'screen')}>
      <View
        style={styles.content}
        importantForAccessibility={state.paused ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={state.paused}
        accessible={false}>
        {state.phase === 'intro' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'intro')}>
            <ThemedText type="small" themeColor="textSecondary">
              {gameDefinition.description}
            </ThemedText>

            <ThemedText type="caption" themeColor="textSecondary">
              Difficulty
            </ThemedText>
            <DifficultySelector
              gameId={GAME_ID}
              selected={state.difficulty}
              onSelect={(level) => dispatch({ type: 'select-difficulty', level })}
            />

            <View style={styles.buttonRow}>
              <GameButton testID={testId(GAME_ID, 'start')} label="Start" onPress={handleStart} />
              <GameButton
                testID={testId(GAME_ID, 'help')}
                label="How to play"
                variant="secondary"
                onPress={openTutorial}
              />
            </View>

            {isDevBuild() ? (
              <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
            ) : null}
          </View>
        ) : null}

        {inSession ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'score')}>
                Score {state.stats.score}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

            {state.phase === 'answer' && state.equation !== null ? (
              <>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'answer-status')}>
                  Pick the missing operator
                </ThemedText>
                <EquationDisplay equation={state.equation} />
                <View style={styles.operators}>
                  {OPERATORS.map((operator) => (
                    <OperatorButton
                      key={operator}
                      operator={operator}
                      testID={testId(GAME_ID, 'op', operator)}
                      onPress={() => handleAnswer(operator)}
                    />
                  ))}
                </View>
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
                <View style={styles.operators}>
                  {OPERATORS.map((operator) => (
                    <OperatorButton
                      key={operator}
                      operator={operator}
                      testID={testId(GAME_ID, 'op', operator)}
                      disabled
                      highlight={highlightFor(operator)}
                      onPress={() => handleAnswer(operator)}
                    />
                  ))}
                </View>
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label={isLastRound ? 'See results' : 'Next round'}
                  onPress={handleNextRound}
                />
              </View>
            ) : null}

            {isDevBuild() ? (
              <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
            ) : null}
          </View>
        ) : null}

        {state.phase === 'results' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'results')}>
            <ThemedText type="title">Session complete</ThemedText>
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

            {state.persistState === 'failed' ? (
              <ThemedText
                type="small"
                themeColor="danger"
                testID={testId(GAME_ID, 'persist-error')}>
                Your session could not be saved. {state.lastError ?? ''}
              </ThemedText>
            ) : null}
            {state.forced ? (
              <ThemedText
                type="caption"
                themeColor="warning"
                testID={testId(GAME_ID, 'forced-badge')}>
                QA-forced session
              </ThemedText>
            ) : null}

            <View style={styles.buttonRow}>
              <GameButton testID={testId(GAME_ID, 'restart')} label="Play again" onPress={handleRestart} />
              <GameButton
                testID={testId(GAME_ID, 'quit')}
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

/** Render the average response time as `1.4 s` (or `—` when no round answered). */
function formatAvgResponse(avgMs: number): string {
  return avgMs > 0 ? `${(avgMs / 1000).toFixed(1)} s` : '—';
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  operators: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
