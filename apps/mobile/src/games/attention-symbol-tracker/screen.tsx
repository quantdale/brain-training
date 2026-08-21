/**
 * SymbolTrackerScreen — the Symbol Tracker game (multiple-object identity
 * tracking variant).
 *
 * Renders a pure state machine (`symbolTrackerGameReducer`) and owns the side
 * effects: observe pacing timer, the SDK `SessionLifecycle` (start/pause/
 * resume/complete/abandon), auto-pause on backgrounding, the tutorial, the
 * dev-only QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels observe
 * pacing; resuming re-shows the tracked symbols for the full observe window;
 * the board is covered by the opaque `PauseOverlay` and hidden from the
 * accessibility tree while paused, so the answer cannot be read off the UI
 * during a pause.
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
import type {
  Clock,
  DifficultyLevel,
  TutorialStore,
  XpRatingHook,
} from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import {
  DifficultySelector,
  SessionHeader,
  StatRow,
} from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './components/button';
import { Board } from './components/board';
import type { CellVisualState } from './components/cell';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  sessionChallengeRating,
  symbolTrackerParamsFromProfile,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSymbolTrackerQaForceStateHooks,
  createSymbolTrackerTutorialLifecycle,
} from './hooks';
import { symbolTrackerGameReducer } from './reducer';
import { normalizeSymbolTrackerResult } from './scoring';
import {
  buildSymbolTrackerRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSymbolTrackerSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialSymbolTrackerState } from './types';
import { SCORING_VERSION } from './versions';

export interface SymbolTrackerScreenProps {
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

export default function SymbolTrackerScreen(props: SymbolTrackerScreenProps = {}) {
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
    symbolTrackerGameReducer,
    undefined,
    createInitialSymbolTrackerState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  // Per-round observe timer baseline: tracks elapsed ACTIVE (non-paused) observe
  // time so pausing freezes and resuming resumes the remaining window (not a restart).
  const observeElapsedRef = useRef(0);
  const observeRoundRef = useRef(-1);

  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createSymbolTrackerTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createSymbolTrackerQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params =
    state.profile !== null ? symbolTrackerParamsFromProfile(state.profile) : null;
  const observeMs = params?.observeMs ?? 2200;
  const gridSize = params?.gridSize ?? 9;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === 'observe' ||
    state.phase === 'respond' ||
    state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Reset the per-round observe timer baseline when a new observe window begins.
  useEffect(() => {
    if (state.phase === 'observe' && observeRoundRef.current !== state.roundIndex) {
      observeRoundRef.current = state.roundIndex;
      observeElapsedRef.current = 0;
    }
  }, [state.phase, state.roundIndex]);

  // Observe pacing with freeze-and-continue: a window of `observeMs` of ACTIVE
  // (non-paused) time, accumulated in 100ms steps. While paused, the interval is
  // cleared so no time accrues; on resume it continues from where it left off,
  // so the tracked symbols stay highlighted for exactly the time the player has
  // not yet studied (mirrors memory's reveal-tick freeze semantics).
  useEffect(() => {
    if (state.phase !== 'observe' || state.paused) {
      return undefined;
    }
    const interval = setInterval(() => {
      observeElapsedRef.current = Math.min(
        observeMs,
        observeElapsedRef.current + 100,
      );
      if (observeElapsedRef.current >= observeMs) {
        clearInterval(interval);
        dispatch({ type: 'observe-tick' });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [state.phase, state.paused, observeMs, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // ---- Round outcome audio/haptics (canonical feedback events only).
  useEffect(() => {
    if (state.roundOutcome === 'passed') {
      liveAudioHaptics.feedback('correct');
    } else if (state.roundOutcome === 'failed') {
      liveAudioHaptics.feedback('wrong');
    }
  }, [state.roundOutcome]);

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
    const resolvedParams = symbolTrackerParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.trackCount,
    );

    const raw = buildSymbolTrackerRawResult({
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
    const normalized = normalizeSymbolTrackerResult(raw, context);
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
    void persistSymbolTrackerSession(record, persistSession).then((outcome) => {
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
        dispatch({
          type: 'persistence-failed',
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
    state.trackCount,
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
    if (
      !(
        current.phase === 'observe' ||
        current.phase === 'respond' ||
        current.phase === 'roundResult'
      ) ||
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
    if (
      lifecycle !== null &&
      (lifecycle.status === 'active' || lifecycle.status === 'paused')
    ) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

  const handleTapCell = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'respond' || current.paused || current.roundScored) {
        return;
      }
      liveAudioHaptics.feedback('tap');
      dispatch({ type: 'tap-cell', index });
    },
    [dispatch],
  );

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'respond' || current.paused || current.roundScored) {
      return;
    }
    dispatch({ type: 'submit' });
  }, [dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const level = current.difficulty ?? 'normal';
    const seed =
      current.seedOverride ??
      (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
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

  // ---- Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  // ---- Cell visuals. Stable across per-round re-renders; depends only on
  // round-transition state, never on observe ticks, so the memoized board skips
  // re-rendering cells whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): CellVisualState => {
      if (state.phase === 'observe') {
        const symbolId = state.observeBoard[index];
        return symbolId !== undefined && state.trackedSymbolIds.includes(symbolId)
          ? 'target'
          : 'idle';
      }
      if (state.phase === 'respond') {
        const symbolId = state.respondBoard[index];
        return symbolId !== undefined && state.selections.includes(symbolId)
          ? 'selected'
          : 'idle';
      }
      if (state.phase === 'roundResult') {
        const symbolId = state.respondBoard[index] ?? -1;
        const isTracked = state.trackedSymbolIds.includes(symbolId);
        const isSelected = state.selections.includes(symbolId);
        if (isSelected && !isTracked) {
          return 'error';
        }
        if (isTracked) {
          return 'correct';
        }
        return 'idle';
      }
      return 'idle';
    },
    [state.phase, state.observeBoard, state.respondBoard, state.selections, state.trackedSymbolIds],
  );

  const board =
    state.phase === 'observe' ? state.observeBoard : state.respondBoard;

  return (
    <View style={styles.screen} testID={testId(GAME_ID, 'screen')}>
      <View
        style={styles.content}
        importantForAccessibility={
          state.paused ? 'no-hide-descendants' : 'auto'
        }
        accessibilityElementsHidden={state.paused}
        accessible={false}
      >
        {state.phase === 'intro' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'intro')}>
            <ThemedText type="small" themeColor="textSecondary">
              {gameDefinition.description}
            </ThemedText>

            <DifficultySelector
              gameId={GAME_ID}
              selected={state.difficulty}
              onSelect={(level) =>
                dispatch({ type: 'select-difficulty', level })
              }
            />

            <View style={styles.buttonRow}>
              <GameButton
                testID={testId(GAME_ID, 'start')}
                label="Start"
                onPress={handleStart}
              />
              <GameButton
                testID={testId(GAME_ID, 'help')}
                label="How to play"
                variant="secondary"
                onPress={openTutorial}
              />
            </View>

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
            ) : null}
          </View>
        ) : null}

        {inSession ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}
              >
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              {state.phase === 'observe' ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, 'observe-status')}
                >
                  Track {state.trackCount} symbols
                </ThemedText>
              ) : null}
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

            {state.phase === 'observe' ? (
              <>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'reveal-status')}
                >
                  Memorize the highlighted symbols…
                </ThemedText>
                <Board
                  gridSize={gridSize}
                  board={board}
                  testID={testId(GAME_ID, 'observe-board')}
                  visualFor={visualFor}
                  disabled
                  onPressCell={handleTapCell}
                />
              </>
            ) : null}

            {state.phase === 'respond' ? (
              <>
                <View style={styles.statusRow}>
                  <ThemedText
                    type="bodyLarge"
                    themeColor="text"
                    testID={testId(GAME_ID, 'respond-status')}
                  >
                    Pick out the tracked symbols
                  </ThemedText>
                  <View
                    style={styles.dots}
                    testID={testId(GAME_ID, 'progress')}
                    accessibilityLabel={`${state.selections.length} of ${state.trackCount} symbols selected`}
                  >
                    {Array.from({ length: state.trackCount }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              i < state.selections.length
                                ? theme.accent
                                : theme.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <Board
                  gridSize={gridSize}
                  board={board}
                  testID={testId(GAME_ID, 'respond-board')}
                  visualFor={visualFor}
                  onPressCell={handleTapCell}
                />
                <GameButton
                  testID={testId(GAME_ID, 'submit')}
                  label="Check answer"
                  onPress={handleSubmit}
                />
              </>
            ) : null}

            {state.phase === 'roundResult' ? (
              <View
                style={styles.section}
                testID={testId(GAME_ID, 'round-result')}
              >
                <ThemedText
                  type="headline"
                  themeColor={
                    state.roundOutcome === 'passed' ? 'success' : 'danger'
                  }
                  testID={testId(
                    GAME_ID,
                    state.roundOutcome === 'passed'
                      ? 'round-passed'
                      : 'round-failed',
                  )}
                >
                  {state.roundOutcome === 'passed'
                    ? 'All tracked!'
                    : 'Not quite'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  You found {state.roundCorrectTargets} of{' '}
                  {state.trackCount} tracked symbols
                  {state.roundWrongTaps > 0
                    ? ` (${state.roundWrongTaps} wrong pick${state.roundWrongTaps > 1 ? 's' : ''})`
                    : ''}
                </ThemedText>
                <Board
                  gridSize={gridSize}
                  board={board}
                  testID={testId(GAME_ID, 'round-result-board')}
                  visualFor={visualFor}
                  disabled
                  onPressCell={handleTapCell}
                />
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label={isLastRound ? 'See results' : 'Next round'}
                  onPress={() => dispatch({ type: 'next-round' })}
                />
              </View>
            ) : null}

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
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
              label="Best recall"
              value={String(state.stats.bestRecall)}
              testID={testId(GAME_ID, 'best-recall')}
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
                testID={testId(GAME_ID, 'persist-error')}
              >
                Your session could not be saved. {state.lastError ?? ''}
              </ThemedText>
            ) : null}
            {state.forced ? (
              <ThemedText
                type="caption"
                themeColor="warning"
                testID={testId(GAME_ID, 'forced-badge')}
              >
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.oneHalf,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
