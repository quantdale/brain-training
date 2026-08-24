/**
 * PatternTapBackScreen — the Pattern Tap Back game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Pattern-Tap-Back-specific — the observe pacing timers, the
 * recall auto-highlight timer, tap handling, and the scoring/persistence
 * pipeline.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels observe
 * pacing (the host helpers deactivate the timers while paused); resuming
 * re-flashes the current tile and continues from the same position. The board
 * is covered by the opaque `PauseOverlay` and hidden from the accessibility
 * tree while paused.
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
import { useTheme } from '@/hooks/use-theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
  useGameTimeout,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { TileGrid } from './components/grid';
import type { TileVisualState } from './components/tile';
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
      return (
        (current.phase === 'observe' ||
          current.phase === 'recall' ||
          current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createTutorialLifecycle_(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? paramsFromProfile(state.profile) : null;
  const gridSize = params?.gridSize ?? 9;
  const rounds = params?.rounds ?? 5;
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

  // ---- Observe pacing: one tick per tile with scaling duration. Pause
  // deactivates the timer; resume re-flashes the current tile from its start.
  useGameTimeout(
    state.phase === 'observe' && !state.paused,
    () => dispatch({ type: 'observe-tick' }),
    observeDuration(state.observeIndex),
  );

  // ---- Recall auto-highlight: after a correct tap, briefly show the tile
  // selected, then clear to allow the next tap. Pause cancels the highlight.
  useGameTimeout(
    state.phase === 'recall' && !state.paused && state.recallHighlight,
    () => dispatch({ type: 'recall-tick' }),
    200,
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
    session,
    xpHook,
    persister,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    if (session.resumeIfPaused()) {
      dispatch({ type: 'resume' });
    }
  }, [session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleTapTile = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'recall' || current.paused || current.recallHighlight) {
        return;
      }
      if (index === current.sequence[current.inputIndex]) {
        liveAudioHaptics.playSfx('memory-tile-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('memory-tile-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'tap-tile', index });
    },
    [dispatch],
  );

  const handleStart = useCallback(() => {
    const current = stateRef.current;
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

  // ---- Tile visuals (see TileVisualState). Stable across the per-tick
  // re-renders: depends only on round-transition state, never on the
  // recall auto-highlight tick (redundant with the matched-set branch and
  // not changing any tile's output), so the memoized grid skips
  // re-rendering tiles whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): TileVisualState => {
      if (state.phase === 'observe') {
        return index === state.observeIndex ? 'observed' : 'idle';
      }
      if (state.phase === 'recall' || state.phase === 'roundResult') {
        if (state.sequence.slice(0, state.inputIndex).includes(index)) {
          return 'selected';
        }
        if (state.roundOutcome === 'failed' && state.taps[state.taps.length - 1] === index) {
          return 'error';
        }
      }
      return 'idle';
    },
    [
      state.phase,
      state.observeIndex,
      state.sequence,
      state.inputIndex,
      state.roundOutcome,
      state.taps,
    ],
  );

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
          testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
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
            label="Longest sequence"
            value={String(state.stats.longestSequence)}
            testID={testId(GAME_ID, 'longest-sequence')}
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

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
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
