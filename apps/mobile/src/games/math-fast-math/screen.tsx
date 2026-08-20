/**
 * MathScreen — the Fast Math game (validated procedural arithmetic).
 *
 * Renders a pure state machine (`mathGameReducer`) and owns the side
 * effects: the per-problem budget ticker, the SDK `SessionLifecycle`
 * (start/pause/resume/complete/abandon), auto-pause on backgrounding, the
 * tutorial, the dev-only QA panel, and result persistence.
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
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  SessionLifecycle,
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
import {
  DifficultySelector,
  GameButton,
  PauseOverlay,
  SessionHeader,
  StatRow,
} from '@/components/game-ui';

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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createMathTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createMathQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? mathParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'problem' || state.phase === 'feedback';
  const isLastProblem = state.problemIndex + 1 >= rounds;

  // ---- Per-problem budget ticker: feeds the reducer with active-only
  // elapsed ms; the reducer transitions to `timeout` when the budget is
  // crossed. Pause cancels the ticker (timers frozen); resume re-schedules
  // from the current active elapsed (paused segments excluded by lifecycle).
  useEffect(() => {
    if (state.phase !== 'problem' || state.paused || state.problemBudgetMs <= 0) {
      return;
    }
    const timer = setInterval(() => {
      const activeMs = lifecycleRef.current?.elapsedMs() ?? 0;
      dispatch({ type: 'problem-tick', atActiveMs: activeMs });
    }, TIMER_TICK_MS);
    return () => clearInterval(timer);
  }, [state.phase, state.paused, state.problemIndex, state.problemBudgetMs, dispatch]);

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
        startedAtMs: Date.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (
      !(current.phase === 'problem' || current.phase === 'feedback') ||
      current.paused
    ) {
      return;
    }
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause' });
  }, [dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: 'resume' });
  }, [dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

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
    const activeMs = lifecycleRef.current?.elapsedMs() ?? 0;
    dispatch({ type: 'submit-answer', atActiveMs: activeMs });
  }, [dispatch]);

  const handleNext = useCallback(() => {
    const activeMs = lifecycleRef.current?.elapsedMs() ?? 0;
    dispatch({ type: 'next-problem', startedAtActiveMs: activeMs });
  }, [dispatch]);

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

  const remainingMs = Math.max(0, state.problemBudgetMs - state.problemElapsedMs);

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
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, 'problem-label', String(state.problemIndex + 1))}>
                Problem {state.problemIndex + 1}/{rounds}
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
                (state.stats.problemsPlayed > 0 ? state.stats.problemsCorrect / state.stats.problemsPlayed : 0) * 100,
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
              value={state.stats.fastestMs === null ? '—' : `${(state.stats.fastestMs / 1000).toFixed(1)}s`}
              testID={testId(GAME_ID, 'fastest')}
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
        <PauseOverlay gameId={GAME_ID} onResume={resumeSession} onQuit={quitToLibrary} />
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
