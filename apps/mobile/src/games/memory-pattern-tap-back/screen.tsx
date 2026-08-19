/**
 * PatternTapBackScreen — the Pattern Tap Back game.
 *
 * Renders a pure state machine (`gameReducer`) and owns the side effects:
 * observe pacing timers, recall auto-highlight timers, the SDK
 * `SessionLifecycle` (start/pause/resume/complete/abandon), auto-pause on
 * backgrounding, the tutorial, the dev-only QA panel, and result persistence.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels observe
 * pacing; resuming re-flashes the current tile and continues from the same
 * position. The board is covered by the opaque `PauseOverlay` and hidden from
 * the accessibility tree while paused.
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
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './components/button';
import { TileGrid } from './components/grid';
import type { TileVisualState } from './components/tile';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { adaptiveGridSize, paramsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createQaForceStateHooks, createTutorialLifecycle_ } from './hooks';
import { gameReducer } from './reducer';
import { normalizePatternTapBackResult } from './scoring';
import {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialState } from './types';
import { SCORING_VERSION } from './versions';

export interface PatternTapBackScreenProps {
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

export default function PatternTapBackScreen(props: PatternTapBackScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession: persister = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createTutorialLifecycle_(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? paramsFromProfile(state.profile) : null;
  const gridSize = params?.gridSize ?? 9;
  const rounds = params?.rounds ?? 5;
  const escalatedGridSize = params?.escalatedGridSize ?? 16;
  const inSession =
    state.phase === 'observe' || state.phase === 'recall' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Compute the effective grid size for the current round (adaptive escalation).
  const currentGridSize = inSession && params !== null
    ? adaptiveGridSize(state.roundIndex, params)
    : gridSize;

  // Compute observe duration: 500ms + 200ms × step (from difficulty params).
  const baseObserveMs = params?.baseObserveMs ?? 500;
  const stepObserveMs = params?.stepObserveMs ?? 200;
  const observeDuration = (step: number) => baseObserveMs + stepObserveMs * step;

  // ---- Observe pacing: one tick per tile with scaling duration; pause cancels.
  useEffect(() => {
    if (state.phase !== 'observe' || state.paused) {
      return;
    }
    const ms = observeDuration(state.observeIndex);
    const timer = setTimeout(() => dispatch({ type: 'observe-tick' }), ms);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.observeIndex, state.length]);

  // ---- Recall auto-highlight: after a correct tap, briefly show the tile
  // selected, then clear to allow the next tap.
  useEffect(() => {
    if (state.phase !== 'recall' || state.paused || !state.recallHighlight) {
      return;
    }
    const timer = setTimeout(() => dispatch({ type: 'recall-tick' }), 200);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.recallHighlight]);

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
    const resolvedParams = paramsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.length);

    const raw = buildRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      completedRoundLengths: state.completedRoundLengths,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizePatternTapBackResult(raw, context);
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
    void persistSession(record, persister).then((outcome) => {
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
    state.length,
    state.difficulty,
    state.completedRoundLengths,
    xpHook,
    persister,
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
      !(current.phase === 'observe' || current.phase === 'recall' || current.phase === 'roundResult') ||
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

  const handleTapTile = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'recall' || current.paused || current.recallHighlight) {
        return;
      }
      if (index === current.sequence[current.inputIndex]) {
        noopAudioHaptics.playSfx('memory-tile-correct');
        noopAudioHaptics.haptic('light');
      } else {
        noopAudioHaptics.playSfx('memory-tile-wrong');
        noopAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'tap-tile', index });
    },
    [dispatch],
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

  // ---- Tile visuals (see TileVisualState).
  const visualFor = (index: number): TileVisualState => {
    if (state.phase === 'observe') {
      return index === state.observeIndex ? 'observed' : 'idle';
    }
    if (state.phase === 'recall' || state.phase === 'roundResult') {
      if (state.recallHighlight && state.sequence[state.inputIndex - 1] === index) {
        return 'selected';
      }
      if (state.sequence.slice(0, state.inputIndex).includes(index)) {
        return 'selected';
      }
      if (state.roundOutcome === 'failed' && state.taps[state.taps.length - 1] === index) {
        return 'error';
      }
    }
    return 'idle';
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

            {state.phase === 'observe' ? (
              <>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'observe-status')}>
                  Watch the sequence…
                </ThemedText>
                <TileGrid
                  gridSize={currentGridSize}
                  testID={testId(GAME_ID, 'observe-grid')}
                  visualFor={visualFor}
                  disabled
                  onPressTile={handleTapTile}
                />
              </>
            ) : null}

            {state.phase === 'recall' ? (
              <>
                <View style={styles.statusRow}>
                  <ThemedText
                    type="bodyLarge"
                    themeColor="text"
                    testID={testId(GAME_ID, 'recall-status')}>
                    Now repeat it
                  </ThemedText>
                  <View
                    style={styles.dots}
                    testID={testId(GAME_ID, 'progress')}
                    accessibilityLabel={`${state.inputIndex} of ${state.length} matched`}>
                    {Array.from({ length: state.length }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          { backgroundColor: i < state.inputIndex ? theme.accent : theme.border },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <TileGrid
                  gridSize={currentGridSize}
                  testID={testId(GAME_ID, 'recall-grid')}
                  visualFor={visualFor}
                  onPressTile={handleTapTile}
                />
              </>
            ) : null}

            {state.phase === 'roundResult' ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                  testID={testId(GAME_ID, state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed')}>
                  {state.roundOutcome === 'passed' ? 'Round passed!' : 'Round failed'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Sequence length {state.length}
                  {state.roundOutcome === 'failed'
                    ? ` — expected ${state.sequence.map((tile) => tile + 1).join(' · ')}`
                    : ''}
                </ThemedText>
                <TileGrid
                  gridSize={currentGridSize}
                  testID={testId(GAME_ID, 'round-result-grid')}
                  visualFor={visualFor}
                  disabled
                  onPressTile={handleTapTile}
                />
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
                (state.stats.roundsPlayed > 0 ? state.stats.roundsPassed / state.stats.roundsPlayed : 0) * 100,
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
              label="Longest sequence"
              value={String(state.stats.longestSequence)}
              testID={testId(GAME_ID, 'longest-sequence')}
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
