/**
 * MathEquationBuilderScreen — the Equation Builder game.
 *
 * Renders a pure state machine (`mathEquationBuilderGameReducer`) and owns the side
 * effects: timer pacing, the SDK `SessionLifecycle` (start/pause/resume/complete/abandon),
 * auto-pause on backgrounding, the tutorial, the dev-only QA panel, and result persistence.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  DIFFICULTY_LABELS,
  SessionLifecycle,
  isDevBuild,
  noopAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { EquationDisplay } from './components/equation-display';
import { GameButton } from './components/button';
import { NumberPad } from './components/number-pad';
import { OperatorPad } from './components/operator-pad';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { mathEquationBuilderParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createMathEquationBuilderQaForceStateHooks,
  createMathEquationBuilderTutorialLifecycle,
} from './hooks';
import { mathEquationBuilderGameReducer } from './reducer';
import { normalizeMathEquationBuilderResult } from './scoring';
import {
  buildMathEquationBuilderRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMathEquationBuilderSession,
} from './session';
import type { SessionPersistence } from './session';
import {
  GAME_ID,
  createInitialMathEquationBuilderState,
} from './types';
import type { Operator } from './types';
import { SCORING_VERSION } from './versions';

export interface MathEquationBuilderScreenProps {
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

export default function MathEquationBuilderScreen(props: MathEquationBuilderScreenProps = {}) {
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
    mathEquationBuilderGameReducer,
    undefined,
    createInitialMathEquationBuilderState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createMathEquationBuilderTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createMathEquationBuilderQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params = state.profile !== null ? mathEquationBuilderParamsFromProfile(state.profile) : null;
  const timeBudgetMs = params?.timeBudgetMs ?? 50_000;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'playing' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Timer pacing: one tick per second; pause cancels.
  useEffect(() => {
    if (state.phase !== 'playing' || state.paused) return;
    if (state.timeRemainingMs <= 0) return;
    const timer = setTimeout(() => dispatch({ type: 'tick-timer' }), 1000);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.timeRemainingMs, dispatch]);

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
    const resolvedParams = mathEquationBuilderParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.numbersCount,
    );

    const raw = buildMathEquationBuilderRawResult({
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
    const normalized = normalizeMathEquationBuilderResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
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
    void persistMathEquationBuilderSession(record, persistSession).then((outcome) => {
      if (outcome.ok) {
        dispatch({ type: 'persistence-succeeded' });
        // Use the authoritative outcome from the rating pipeline for display.
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
    if (!(current.phase === 'playing' || current.phase === 'roundResult') || current.paused) {
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

  const handleNumberPress = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.paused) return;
      noopAudioHaptics.playSfx('memory-tile-correct');
      noopAudioHaptics.haptic('light');
      dispatch({ type: 'add-number', numberIndex: index });
    },
    [dispatch],
  );

  const handleOperatorPress = useCallback(
    (operator: Operator) => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.paused) return;
      noopAudioHaptics.playSfx('memory-tile-correct');
      noopAudioHaptics.haptic('light');
      dispatch({ type: 'add-operator', operator });
    },
    [dispatch],
  );

  const handleGroup = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
    dispatch({ type: 'group' });
  }, [dispatch]);

  const handleUndo = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
    dispatch({ type: 'undo' });
  }, [dispatch]);

  const handleClear = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
    dispatch({ type: 'clear' });
  }, [dispatch]);

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
    dispatch({ type: 'submit' });
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
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  // ---- Auto-pause when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  const canInteract = state.phase === 'playing' && !state.paused;
  const canGroup = canInteract && state.equationTokens.length >= 3;

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
            <View style={styles.difficultyRow}>
              {Object.entries(DIFFICULTY_LABELS).map(([level, label]) => {
                const selected = state.difficulty === level;
                return (
                  <GameButton
                    key={level}
                    small
                    testID={testId(GAME_ID, 'difficulty', level)}
                    label={label}
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() =>
                      dispatch({ type: 'select-difficulty', level: level as DifficultyLevel })
                    }
                  />
                );
              })}
            </View>

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
            <View style={styles.sessionHeader}>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, 'score')}>
                Score {state.stats.score}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor={state.timeRemainingMs < 10_000 ? 'danger' : 'textSecondary'}
                testID={testId(GAME_ID, 'timer')}>
                {Math.max(0, Math.ceil(state.timeRemainingMs / 1000))}s
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </View>

            <EquationDisplay
              target={state.target}
              tokens={state.equationTokens}
              result={state.phase === 'roundResult' ? state.roundResult : null}
              isCorrect={state.phase === 'roundResult' ? state.roundCorrect : null}
            />

            {state.phase === 'playing' ? (
              <>
                <NumberPad
                  numbers={state.availableNumbers}
                  usedIndices={state.usedNumberIndices}
                  disabled={!canInteract}
                  onNumberPress={handleNumberPress}
                />
                <OperatorPad
                  operators={state.allowedOperators}
                  disabled={!canInteract || !state.expectOperator}
                  onOperatorPress={handleOperatorPress}
                />
                <View style={styles.actionRow}>
                  <GameButton
                    small
                    testID={testId(GAME_ID, 'group')}
                    label="Group ( )"
                    variant="secondary"
                    disabled={!canGroup}
                    onPress={handleGroup}
                  />
                  <GameButton
                    small
                    testID={testId(GAME_ID, 'undo')}
                    label="Undo"
                    variant="secondary"
                    disabled={!canInteract || state.equationTokens.length === 0}
                    onPress={handleUndo}
                  />
                  <GameButton
                    small
                    testID={testId(GAME_ID, 'clear')}
                    label="Clear"
                    variant="secondary"
                    disabled={!canInteract || state.equationTokens.length === 0}
                    onPress={handleClear}
                  />
                  <GameButton
                    testID={testId(GAME_ID, 'submit')}
                    label="Submit"
                    disabled={
                      !canInteract ||
                      state.usedNumberIndices.length !== state.availableNumbers.length
                    }
                    onPress={handleSubmit}
                  />
                </View>
              </>
            ) : null}

            {state.phase === 'roundResult' ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.roundCorrect ? 'success' : 'danger'}
                  testID={testId(
                    GAME_ID,
                    state.roundCorrect ? 'round-passed' : 'round-failed',
                  )}>
                  {state.roundCorrect ? 'Correct!' : state.roundResult !== null ? 'Wrong answer' : 'Time\'s up!'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Target was {state.target}
                </ThemedText>
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label={isLastRound ? 'See results' : 'Next round'}
                  onPress={() => dispatch({ type: 'next-round' })}
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
                (state.stats.roundsPlayed > 0
                  ? state.stats.roundsPassed / state.stats.roundsPlayed
                  : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, 'accuracy')}
            />
            <StatRow
              label="Rounds passed"
              value={`${state.stats.roundsPassed}/${state.stats.roundsPlayed}`}
              testID={testId(GAME_ID, 'rounds-passed')}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, 'best-streak')}
            />
            <StatRow
              label="XP"
              value={String(state.authoritativeXp ?? state.xp)}
              testID={testId(GAME_ID, 'xp')}
            />

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
              <GameButton
                testID={testId(GAME_ID, 'restart')}
                label="Play again"
                onPress={handleRestart}
              />
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

/** One label/value row on the results screen. */
function StatRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View style={styles.statRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="bodyLarge" testID={testID}>
        {value}
      </ThemedText>
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
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
  },
});
