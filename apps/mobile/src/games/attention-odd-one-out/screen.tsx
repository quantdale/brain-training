/**
 * OddOneOutScreen — the Odd One Out game (attention variant).
 *
 * Renders a pure state machine (`oddOneOutReducer`) and owns the side
 * effects: the round countdown (a monotonic-clock interval that dispatches
 * `tick` / `round-timeout`), the SDK `SessionLifecycle` (start/pause/resume/
 * complete/abandon), auto-pause on backgrounding, the tutorial, the dev-only
 * QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and the round
 * countdown (the reducer stores the frozen remainder); resuming rebuilds the
 * deadline from the remainder, so the window can never be stretched. The
 * board is covered by the opaque `PauseOverlay` and hidden from the
 * accessibility tree while paused.
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

import { GameButton } from './components/button';
import { ItemGrid } from './components/grid';
import type { TileVisualState } from './components/tile';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { oddOneOutParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createOddOneOutQaForceStateHooks, createOddOneOutTutorialLifecycle } from './hooks';
import { oddOneOutReducer } from './reducer';
import { normalizeOddOneOutResult } from './scoring';
import {
  buildOddOneOutRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistOddOneOutSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialOddOneOutState } from './types';
import { SCORING_VERSION } from './versions';

/** Countdown refresh cadence (ms); also bounds the pause-freeze drift. */
const TICK_MS = 250;

export interface OddOneOutScreenProps {
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

export default function OddOneOutScreen(props: OddOneOutScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(oddOneOutReducer, undefined, createInitialOddOneOutState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createOddOneOutTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createOddOneOutQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? oddOneOutParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 6;
  const inSession = state.phase === 'playing' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Round countdown: refresh the displayed remainder every TICK_MS; when
  // the monotonic deadline passes, the round times out. Pause cancels the
  // interval (window frozen); resume re-arms from the stored remainder.
  useEffect(() => {
    if (state.phase !== 'playing' || state.paused) {
      return;
    }
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.paused) {
        return;
      }
      const remaining = Math.max(0, current.deadlineMs - clock.now());
      if (remaining <= 0) {
        dispatch({ type: 'round-timeout' });
      } else {
        dispatch({ type: 'tick', remainingMs: remaining });
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [state.phase, state.paused, state.deadlineMs, clock, dispatch]);

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
    const resolvedParams = oddOneOutParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.step);

    const raw = buildOddOneOutRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      gridSize: state.gridSize,
      subtlety: state.subtlety,
      windowMs: state.windowMs,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeOddOneOutResult(raw, context);
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
    void persistOddOneOutSession(record, persistSession).then((outcome) => {
      dispatch(
        outcome.ok
          ? { type: 'persistence-succeeded' }
          : { type: 'persistence-failed', message: String(outcome.error) },
      );
    });
  }, [
    state.phase,
    state.profile,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.gridSize,
    state.subtlety,
    state.windowMs,
    state.step,
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
        nowMs: clock.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (
      !(current.phase === 'playing' || current.phase === 'roundResult') ||
      current.paused
    ) {
      return;
    }
    lifecycleRef.current?.pause();
    // Freeze the exact remainder so resume cannot stretch the window.
    const remainingMs = Math.max(0, current.deadlineMs - clock.now());
    dispatch({ type: 'pause', remainingMs });
  }, [clock, dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: 'resume', nowMs: clock.now() });
  }, [clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

  const handleTapTile = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.paused) {
        return;
      }
      if (current.board !== null && index === current.board.oddIndex) {
        noopAudioHaptics.playSfx('odd-one-out-correct');
        noopAudioHaptics.haptic('light');
      } else {
        noopAudioHaptics.playSfx('odd-one-out-wrong');
        noopAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'tap-tile', index, nowMs: clock.now() });
    },
    [clock, dispatch],
  );

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

  // ---- Item visuals (see TileVisualState): only the most recent wrong tap
  // is marked during play; the odd item is revealed after the round ended.
  const visualFor = (index: number): TileVisualState => {
    if (state.phase === 'playing') {
      return index === state.lastWrongIndex ? 'error' : 'idle';
    }
    if (state.phase === 'roundResult') {
      if (state.board !== null && index === state.board.oddIndex) {
        return 'found';
      }
      return index === state.lastWrongIndex ? 'error' : 'idle';
    }
    return 'idle';
  };

  const timeLeftText = `${(state.remainingMs / 1000).toFixed(1)}s`;

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
                    onPress={() => dispatch({ type: 'select-difficulty', level: level as DifficultyLevel })}
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
            </View>

            {state.phase === 'playing' && state.board !== null ? (
              <>
                <View style={styles.statusRow}>
                  <ThemedText
                    type="bodyLarge"
                    themeColor="text"
                    testID={testId(GAME_ID, 'playing-status')}>
                    Tap the odd one out
                  </ThemedText>
                  <ThemedText
                    type="smallBold"
                    themeColor={state.remainingMs <= 3000 ? 'danger' : 'textSecondary'}
                    testID={testId(GAME_ID, 'time-left')}>
                    {timeLeftText}
                  </ThemedText>
                </View>
                <ItemGrid
                  gridSize={state.gridSize}
                  testID={testId(GAME_ID, 'board')}
                  board={state.board}
                  visualFor={visualFor}
                  onPressTile={handleTapTile}
                />
              </>
            ) : null}

            {state.phase === 'roundResult' && state.board !== null ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                  testID={testId(
                    GAME_ID,
                    state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed',
                  )}>
                  {state.roundOutcome === 'passed' ? 'Found it!' : 'Time’s up'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {state.roundOutcome === 'passed'
                    ? state.roundWrongTaps > 0
                      ? `Solved with ${state.roundWrongTaps} wrong tap${state.roundWrongTaps > 1 ? 's' : ''} — first-try bonus missed.`
                      : 'Solved on the first tap — bonus points!'
                    : 'The odd one is highlighted — it beat the clock this time.'}
                </ThemedText>
                <ItemGrid
                  gridSize={state.gridSize}
                  testID={testId(GAME_ID, 'round-result-board')}
                  board={state.board}
                  visualFor={visualFor}
                  disabled
                  onPressTile={handleTapTile}
                />
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label={isLastRound ? 'See results' : 'Next round'}
                  onPress={() => dispatch({ type: 'next-round', nowMs: clock.now() })}
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
                (state.stats.roundsPlayed > 0 ? state.stats.roundsPassed / state.stats.roundsPlayed : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, 'accuracy')}
            />
            <StatRow
              label="First-try rate"
              value={`${Math.round(
                (state.stats.roundsPlayed > 0 ? state.stats.firstTryCorrect / state.stats.roundsPlayed : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, 'first-try-rate')}
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
              label="Timeouts"
              value={String(state.stats.timeouts)}
              testID={testId(GAME_ID, 'timeouts')}
            />
            <StatRow label="XP" value={String(state.xp)} testID={testId(GAME_ID, 'xp')} />

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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
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
