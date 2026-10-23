/**
 * VisualSearchScreen — the Visual Search game (rapid odd-one-out selection).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Visual-Search-specific — the countdown tick interval, tile
 * visuals, and the scoring/persistence pipeline.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Timing: all gameplay timing flows through the injected monotonic `clock`
 * (SDK `systemClock` in production); the reducer only ever sees clock
 * readings carried by actions. `Date.now()` is used solely for wall-clock
 * diagnostics (startedAtMs / completedAtMs / session ids).
 *
 * Pause semantics: pausing freezes the lifecycle timer and stops the tick
 * interval; the reducer shifts every deadline by the paused duration on
 * resume, so the round window and the score-attack budget freeze while
 * hidden. The board is covered by the opaque `PauseOverlay` and hidden from
 * the accessibility tree while paused.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import {
  assertDevOnly,
  isDevBuild,
  liveAudioHaptics,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { pipelineXpRatingHook } from '@/rating/xp-hook';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';
import { useSafeBack } from '@/components/ui';

import { TileGrid } from './components/grid';
import type { TileVisualState } from './components/tile';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  DISTRACTOR_PENALTY_MS,
  sessionChallengeRating,
  visualSearchParamsFromProfile,
} from './difficulty';
import { gameDefinition } from './game-definition';
import { createVisualSearchTutorialLifecycle } from './hooks';
import { visualSearchGameReducer } from './reducer';
import { normalizeVisualSearchResult } from './scoring';
import {
  buildSessionRecord,
  buildVisualSearchRawResult,
  dbSessionPersister,
  persistVisualSearchSession,
} from './session';
import type { SessionPersistence } from './session';
import { continuationStamp, ownsContinuation, GAME_ID, createInitialVisualSearchState } from './types';
import type { VisualSearchAction, ResultContinuationStamp } from './types';
import { SCORING_VERSION } from './versions';

export interface VisualSearchScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the shared pipeline-backed hook. */
  xpHook?: XpRatingHook;
}

/** Countdown refresh cadence (ms). Drives the per-round timeout checks too. */
const TICK_MS = 100;

export default function VisualSearchScreen(props: VisualSearchScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const goBack = useSafeBack('/games');
  const [state, reactDispatch] = useReducer(
    visualSearchGameReducer,
    undefined,
    createInitialVisualSearchState,
  );

  const stateRef = useRef(state);
  const deliveredPresses = useRef(new WeakSet<object>());
  // Claim accepted gameplay and lifecycle boundaries before React commits.
  // Stale events cannot act on a newly queued round or emit optimistic cues.
  const dispatch = useCallback((action: VisualSearchAction) => {
    const current = stateRef.current;
    const next = visualSearchGameReducer(current, action);
    if (next === current) return null;
    stateRef.current = next;
    reactDispatch(action);
    return next;
  }, []);
  const dispatchContinuation = dispatch;
  useLayoutEffect(() => { stateRef.current = state; });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'playing' || current.phase === 'roundResult') && !current.paused;
    },
    // The reducer shifts deadlines by the paused duration, so it needs the
    // wall-clock reading at the exact pause/resume moments.
    onPause: () => dispatchContinuation({ type: 'pause', nowMs: clock.now() }),
  });

  const renderedContinuation = continuationStamp(state);
  const handleContinue = () => {
    if (session.status() !== 'active' || !session.isCurrentSession(renderedContinuation.sessionId)) {
      return;
    }
    const current = stateRef.current;
    if (!ownsContinuation(current, renderedContinuation) || current.phase !== 'roundResult') return;
    dispatch({ type: 'tick', nowMs: clock.now(), stamp: renderedContinuation });
    dispatch({ type: 'next-round', stamp: renderedContinuation });
  };

  const tutorial = useMemo(
    () => createVisualSearchTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const forceWin = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-win' }); }, [dispatch]);
  const forceLose = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-lose' }); }, [dispatch]);

  const params = state.profile !== null ? visualSearchParamsFromProfile(state.profile) : null;
  const gridSize = state.gridSize;
  const rounds = params?.rounds ?? 12;
  const inSession = state.phase === 'playing' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;
  const remainingMs = Math.max(0, state.roundDeadlineMs - state.nowMs);

  const renderedCue = useMemo<ResultContinuationStamp>(() => ({ sessionId: state.sessionId, roundIndex: state.roundIndex,
    phase: state.phase, epoch: state.continuationEpoch }), [state.sessionId, state.roundIndex, state.phase, state.continuationEpoch]);
  const readStatus = session.status;

  useLayoutEffect(() => {
    if (state.phase !== 'playing' || state.paused || state.tutorialOpen || state.roundPresentedAtMs !== null || readStatus() !== 'active') return;
    dispatch({ type: 'round-presented', nowMs: clock.now(), stamp: renderedCue });
  }, [state.phase, state.paused, state.tutorialOpen, state.roundPresentedAtMs, renderedCue, readStatus, clock, dispatch]);

  // Capture this exact board/result and pause epoch. Queued cancelled work
  // cannot be redirected to whichever board happens to be current later.
  useEffect(() => {
    if (!inSession || state.paused || state.tutorialOpen || (state.phase === 'playing' && state.roundPresentedAtMs === null)) return;
    let cancelled = false;
    const timer = setInterval(() => {
      if (!cancelled && readStatus() === 'active') dispatch({ type: 'tick', nowMs: clock.now(), stamp: renderedCue });
    }, TICK_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [inSession, state.phase, state.paused, state.tutorialOpen, state.roundPresentedAtMs, renderedCue, clock, readStatus, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial, dispatch]);

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
    const resolvedParams = visualSearchParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.windowMs);

    const raw = buildVisualSearchRawResult({
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
    const normalized = normalizeVisualSearchResult(raw, context);
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
      // Rating pipeline reads the final computed challenge from the record
      // difficulty, not the SDK baseline profile (006r adaptive contract).
      difficulty: { ...state.profile, challengeRating },
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistVisualSearchSession(record, persistSession).then((outcome) => {
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
    state.windowMs,
    state.difficulty,
    session,
    xpHook,
    persistSession,
    dispatch,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    if (session.resumeIfPaused()) {
      dispatchContinuation({ type: 'resume', nowMs: clock.now() });
    }
  }, [clock, session, dispatchContinuation]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    goBack();
  }, [session, goBack]);

  const handleTapTile = useCallback((index: number, event?: GestureResponderEvent) => {
    const current = stateRef.current;
    if (readStatus() !== 'active' || current.phase !== 'playing' || current.roundPresentedAtMs === null || !ownsContinuation(current, renderedCue)) return;
    const nativePress = event?.nativeEvent;
    if (nativePress != null) {
      if (deliveredPresses.current.has(nativePress)) return;
      deliveredPresses.current.add(nativePress);
    }
    const next = dispatch({ type: 'tap-tile', index, nowMs: clock.now(), stamp: renderedCue });
    if (next === null || next.phase !== 'roundResult') return;
    if (next.roundOutcome === 'passed') {
      liveAudioHaptics.playSfx('visual-search-hit'); liveAudioHaptics.haptic('light');
    } else if (next.failReason === 'distractor') {
      liveAudioHaptics.playSfx('visual-search-miss'); liveAudioHaptics.haptic('warning');
    }
    // Expiry remains silent: no optimistic target/distractor cue on a timeout.
  }, [renderedCue, readStatus, clock, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    if (current.sessionId !== renderedCue.sessionId || current.phase !== renderedCue.phase ||
        current.roundIndex !== renderedCue.roundIndex || current.continuationEpoch !== renderedCue.epoch) return;
    if ((current.phase !== 'intro' && current.phase !== 'results') || current.paused || current.tutorialOpen) return;
    const status = session.status();
    if (status !== null && status !== 'completed' && status !== 'abandoned') return;
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    const identity = session.begin();
    dispatch({
      type: 'start-session',
      seed,
      sessionId: identity.sessionId,
      startedAtMs: identity.startedAtMs,
      nowMs: clock.now(),
    });
  }, [clock, session, sessionSeed, dispatch, renderedCue]);

  const handleRestart = handleStart;

  // ---- Tutorial controls.
  const openTutorial = useCallback(() => {
    if (stateRef.current.phase !== 'intro') return;
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

  // ---- Tile visuals (see TileVisualState). Stable across the per-tick
  // re-renders: depends only on round-transition state, never on `nowMs`, so
  // the memoized grid skips re-rendering tiles whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): TileVisualState => {
      if (state.phase === 'playing') {
        return index === state.targetIndex ? 'target' : 'idle';
      }
      if (state.phase === 'roundResult') {
        if (state.roundOutcome === 'passed') {
          return index === state.targetIndex ? 'selected' : 'idle';
        }
        // Failed rounds reveal the odd tile; the wrongly tapped tile is marked.
        return index === state.targetIndex
          ? 'target'
          : index === state.lastTapIndex
            ? 'error'
            : 'idle';
      }
      return 'idle';
    },
    [state.phase, state.targetIndex, state.roundOutcome, state.lastTapIndex],
  );

  const view: GameHostView =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  return (
    <GameHost
      gameId={GAME_ID}
      sessionId={state.sessionId}
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
          testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))} themeColor="stageInk">
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      // R4-N1: rounded to match the results StatRow (same residual class).
      score={String(Math.round(state.stats.score))}
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      qaPanel={<QaPanel onForceWin={forceWin} onForceLose={forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {state.phase === 'playing' ? (
            <>
              <View style={styles.statusRow}>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'play-status')}>
                  Find the odd tile
                </ThemedText>
                <ThemedText
                  type="bodyLarge"
                  themeColor="warning"
                  testID={testId(GAME_ID, 'countdown')}>
                  {Math.ceil(remainingMs / 1000)}s left
                </ThemedText>
              </View>
              <TileGrid
                gridSize={gridSize}
                testID={testId(GAME_ID, 'grid')}
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
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed',
                )}>
                {state.roundOutcome === 'passed' ? 'Found it!' : 'Round failed'}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, 'fail-reason')}>
                {state.roundOutcome === 'passed'
                  ? `Found it in ${Math.round(state.lastResponseMs)}ms — +${state.lastRoundPoints} pts`
                  : state.failReason === 'timeout'
                    ? `Time's up — the odd tile was tile ${state.targetIndex + 1}`
                    : `Wrong tile — ${DISTRACTOR_PENALTY_MS / 1000}s time penalty`}
              </ThemedText>
              <TileGrid
                gridSize={gridSize}
                testID={testId(GAME_ID, 'round-result-grid')}
                visualFor={visualFor}
                disabled
                onPressTile={handleTapTile}
              />
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={handleContinue}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          reward={{
            xp: state.authoritativeXp ?? state.xp,
            coins: state.authoritativeCurrency ?? 0,
          }}
          gameId={GAME_ID}
          normalizedResult={state.normalized ?? undefined}
          forced={state.forced}
          persistState={state.persistState}
          lastError={state.lastError}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          <StatRow
            label="Score"
            // R2 residual: render the rounded integer — a float-valued future
            // scoring change must not print raw decimals beside the focal band.
            value={String(Math.round(state.stats.score))}
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
            label="Avg response"
            value={`${
              state.stats.roundsPassed > 0
                ? Math.round(state.stats.sumResponseMs / state.stats.roundsPassed)
                : 0
            }ms`}
            testID={testId(GAME_ID, 'avg-response')}
          />
          <StatRow
            label="Fastest response"
            value={state.stats.fastestResponseMs > 0 ? `${Math.round(state.stats.fastestResponseMs)}ms` : '—'}
            testID={testId(GAME_ID, 'fastest-response')}
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
});
