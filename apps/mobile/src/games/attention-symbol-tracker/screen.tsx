/**
 * SymbolTrackerScreen — the Symbol Tracker game (multiple-object identity
 * tracking variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Symbol-Tracker-specific — the reducer wiring, the observe
 * pacing timer, the scoring/persistence pipeline, and the board view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels both
 * windows' pacing; resuming continues each remaining window via active-time
 * accumulation (the observe reveal and the respond budget share the exact
 * same freeze-and-continue convention). The board is covered by the opaque
 * shared PauseOverlay and hidden from the accessibility tree while paused, so
 * the answer cannot be read off the UI during a pause.
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
  useGameInterval,
  useGameSession,
} from '@/components/game-host';

import { Board } from './components/board';
import type { CellVisualState } from './components/cell';
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

/** Observe pacing step (ms); also bounds the pause-freeze drift. */
const OBSERVE_TICK_MS = 100;

/** Respond-budget pacing step (ms); identical convention to OBSERVE_TICK_MS. */
const RESPOND_TICK_MS = 100;

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

  const stateRef = useRef(state);
  // Per-round observe timer baseline: tracks elapsed ACTIVE (non-paused) observe
  // time so pausing freezes and resuming resumes the remaining window (not a restart).
  const observeElapsedRef = useRef(0);
  const observeRoundRef = useRef(-1);
  // Per-round respond-budget baseline: same active-time accumulation as the
  // observe window, so pausing freezes the deadline identically.
  const respondElapsedRef = useRef(0);
  const respondRoundRef = useRef(-1);

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
          current.phase === 'respond' ||
          current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(
    () => createSymbolTrackerTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createSymbolTrackerQaForceStateHooks(dispatch, () => state.phase),
    [dispatch, state.phase],
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
  // (non-paused) time, accumulated in OBSERVE_TICK_MS steps. While paused, the
  // interval is cleared so no time accrues; on resume it continues from where it
  // left off, so the tracked symbols stay highlighted for exactly the time the
  // player has not yet studied.
  useGameInterval(
    state.phase === 'observe' && !state.paused,
    () => {
      observeElapsedRef.current = Math.min(observeMs, observeElapsedRef.current + OBSERVE_TICK_MS);
      if (observeElapsedRef.current >= observeMs) {
        dispatch({ type: 'observe-tick' });
      }
    },
    OBSERVE_TICK_MS,
  );

  // ---- Respond-budget pacing: mirrors the observe convention exactly — a
  // window of `respondDeadlineMs` of ACTIVE time in RESPOND_TICK_MS steps,
  // frozen while paused. Expiry submits whatever is selected (reducer-side);
  // it resolves the round instead of crashing.
  const respondDeadlineMs = params?.respondDeadlineMs ?? 7000;
  useEffect(() => {
    if (state.phase === 'respond' && respondRoundRef.current !== state.roundIndex) {
      respondRoundRef.current = state.roundIndex;
      respondElapsedRef.current = 0;
    }
  }, [state.phase, state.roundIndex]);
  useGameInterval(
    state.phase === 'respond' && !state.paused,
    () => {
      respondElapsedRef.current = Math.min(
        respondDeadlineMs,
        respondElapsedRef.current + RESPOND_TICK_MS,
      );
      if (respondElapsedRef.current >= respondDeadlineMs) {
        dispatch({ type: 'respond-deadline' });
      }
    },
    RESPOND_TICK_MS,
  );

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
      if (!session.isCurrentSession(record.id)) return;
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
    session,
    xpHook,
    persistSession,
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
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

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
        <>
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
        </>
      }
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={qaHooks.forceTimeout}
        />
      }
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
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, 'respond-budget')}
                >
                  {Math.round(respondDeadlineMs / 1000)}s to answer
                </ThemedText>
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
              {state.respondTimedOut ? (
                <ThemedText
                  type="small"
                  themeColor="warning"
                  testID={testId(GAME_ID, 'respond-timeout')}
                >
                  Time ran out — your picks were submitted as they stood.
                </ThemedText>
              ) : null}
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
