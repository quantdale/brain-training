/**
 * ValueOrderingScreen — the Value Order game.
 *
 * GameHost-based slice: shared session lifecycle, auto-pause, tutorial/QA
 * gating, intro/pause/results chrome and the Android back-guard live in
 * `@/components/game-host`; this module keeps only what is Value-Ordering-
 * specific — the reducer wiring, the per-round budget ticker, the
 * scoring/persistence pipeline, and the round view.
 *
 * Timing contract (constitution §20): the reducer never reads a clock; ticks
 * and taps carry `atActiveMs` from the session lifecycle (active-only elapsed,
 * paused time excluded), so pausing can never buy or lose time.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
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
import { StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { GameButton } from './components/button';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { ValueGrid } from './components/value-grid';
import {
  sessionChallengeRating,
  valueOrderingParamsFromProfile,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createValueOrderingQaForceStateHooks,
  createValueOrderingTutorialLifecycle,
} from './hooks';
import { valueOrderingGameReducer } from './reducer';
import { normalizeValueOrderingResult } from './scoring';
import {
  buildSessionRecord,
  buildValueOrderingRawResult,
  dbSessionPersister,
  persistValueOrderingSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialValueOrderingState } from './types';
import type { ValueTile } from './types';
import { SCORING_VERSION } from './versions';

/** Budget ticker cadence (ms of wall time between active-ms samples). */
const TIMER_TICK_MS = 250;

/** Ascending-order reveal for feedback: tiles sorted by comparison value. */
export function sortedTilesOf(round: { readonly tiles: readonly ValueTile[] }): ValueTile[] {
  return [...round.tiles].sort((a, b) => a.value - b.value);
}

export interface ValueOrderingScreenProps {
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

export default function ValueOrderingScreen(props: ValueOrderingScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    valueOrderingGameReducer,
    undefined,
    createInitialValueOrderingState,
  );

  const stateRef = useRef(state);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  // Ordering and feedback phases pause (feedback has no running clock but a
  // pause must still cover it per the phase machine).
  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'ordering' || current.phase === 'feedback') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(
    () => createValueOrderingTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createValueOrderingQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? valueOrderingParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 10;
  const inSession = state.phase === 'ordering' || state.phase === 'feedback';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Per-round budget ticker: feeds the reducer with active-only elapsed
  // ms; the reducer transitions to `timeout` when the budget is crossed.
  // Pause deactivates the ticker (timers frozen); resume re-schedules from
  // the current active elapsed (paused segments excluded by the lifecycle).
  useGameInterval(
    state.phase === 'ordering' && !state.paused && state.roundBudgetMs > 0,
    () => dispatch({ type: 'round-tick', atActiveMs: session.elapsedMs() }),
    TIMER_TICK_MS,
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
    const resolvedParams = valueOrderingParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.tiles);

    const raw = buildValueOrderingRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      finalTiles: state.tiles,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeValueOrderingResult(raw, context);
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
    void persistValueOrderingSession(record, persistSession).then((outcome) => {
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
    state.tiles,
    state.difficulty,
    session,
    xpHook,
    persistSession,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    // `requestPause()` gates on the lifecycle's authoritative `active` status:
    // `stateRef` lags one commit behind, so a double-tap (or Pause racing an
    // AppState background event) can reach this handler twice before React
    // re-renders. A redundant SDK `pause()` would throw IllegalTransitionError
    // (pause is only legal from `active`); skipping the no-op keeps both sides
    // consistent instead.
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    // `resumeIfPaused()` consults lifecycle status rather than the possibly
    // stale reducer ref and drops no-op resumes instead of throwing.
    if (session.resumeIfPaused()) {
      dispatch({ type: 'resume' });
    }
  }, [session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleTapTile = useCallback(
    (tileId: string) => {
      const current = stateRef.current;
      // Double-tap protection + phase guard: only valid first taps reach the
      // reducer (it re-checks and ignores repeats).
      if (current.phase !== 'ordering' || current.paused || current.round === null) {
        return;
      }
      liveAudioHaptics.feedback('tap');
      dispatch({ type: 'tap-tile', tileId, atActiveMs: session.elapsedMs() });
    },
    [session, dispatch],
  );

  // ---- Sensory outcome feedback via canonical events (correct/wrong). The
  // resolution itself is pure reducer logic; this effect only sonifies it.
  // Two literal calls (catalog convention): the sensory scanner verifies
  // literal sound names, so conditional expressions are not used here.
  useEffect(() => {
    if (state.phase !== 'feedback' || state.outcome === null) {
      return;
    }
    if (state.outcome === 'perfect') {
      liveAudioHaptics.feedback('correct');
    } else {
      liveAudioHaptics.feedback('wrong');
    }
  }, [state.phase, state.outcome]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'next-round', startActiveMs: session.elapsedMs() });
  }, [session, dispatch]);

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

  const round = state.round;
  const secondsLeft =
    state.phase === 'ordering'
      ? Math.max(0, Math.ceil((state.roundBudgetMs - state.roundElapsedMs) / 1000))
      : 0;
  const remainingTiles =
    round !== null ? round.tiles.length - state.tappedIds.length : 0;

  const view: GameHostView =
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
      {inSession && round !== null ? (
        <>
          {state.phase === 'ordering' ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'prompt')}>
                Tap from smallest to largest
              </ThemedText>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID={testId(GAME_ID, 'round-time')}>
                {secondsLeft}s left · {remainingTiles} to go
              </ThemedText>
              <ValueGrid
                round={round}
                tappedIds={state.tappedIds}
                disabled={state.paused}
                onTapTile={handleTapTile}
              />
            </>
          ) : null}

          {state.phase === 'feedback' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.outcome === 'perfect' ? 'success' : 'danger'}
                testID={testId(GAME_ID, `round-${state.outcome ?? 'mistake'}`)}>
                {state.outcome === 'perfect'
                  ? 'Perfect order!'
                  : state.outcome === 'mistake'
                    ? 'Wrong tile'
                    : "Time's up"}
              </ThemedText>
              <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'reveal')}>
                Correct order:{' '}
                {sortedTilesOf(round)
                  .map((tile) => tile.display)
                  .join('  <  ')}
              </ThemedText>
              {state.mistakeTileId !== null ? (
                <ThemedText type="small" themeColor="textSecondary">
                  You tapped{' '}
                  {round.tiles.find((tile) => tile.id === state.mistakeTileId)?.display ?? '?'}{' '}
                  too early.
                </ThemedText>
              ) : null}
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={handleNext}
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
          <StatRow label="Score" value={String(state.stats.score)} testID={testId(GAME_ID, 'score')} />
          <StatRow
            label="Perfect rounds"
            value={`${state.stats.roundsHit}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'hits')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Best speed"
            value={`${Math.round(state.stats.bestSpeedFactor * 100)}%`}
            testID={testId(GAME_ID, 'best-speed')}
          />
          <StatRow label="XP" value={String(state.authoritativeXp ?? state.xp)} testID={testId(GAME_ID, 'xp')} />
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
});
