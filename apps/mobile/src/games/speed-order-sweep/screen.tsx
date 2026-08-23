/**
 * OrderSweepScreen — the Order Sweep game (rapid serial ordering variant).
 *
 * GameHost-based slice: shared session lifecycle, auto-pause, tutorial/QA
 * gating, intro/pause/results chrome and the Android back-guard live in
 * `@/components/game-host`; this module keeps only what is Order-Sweep-
 * specific — the reducer wiring, the per-round window-expiry timer
 * (scheduled against the monotonic `deadlineMs`), the board view, and the
 * scoring/persistence pipeline.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the expiry
 * timer; resuming re-schedules expiry with the exact remaining time
 * (`deadlineMs - clock.now()`). The board is covered by the opaque shared
 * `PauseOverlay` and hidden from the accessibility tree while paused, so the
 * board cannot be studied during a pause.
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
import type {
  Clock,
  TutorialStore,
  XpRatingHook,
} from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameTimeout,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { GameButton } from './components/button';
import { QaPanel } from './components/qa-panel';
import { RoundWindow } from './components/round-window';
import { TokenGrid } from './components/token-grid';
import { Tutorial } from './components/tutorial';
import {
  orderSweepParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createOrderSweepQaForceStateHooks,
  createOrderSweepTutorialLifecycle,
} from './hooks';
import { orderSweepGameReducer } from './reducer';
import { bestOf, meanOf, normalizeOrderSweepResult } from './scoring';
import {
  buildOrderSweepRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistOrderSweepSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialOrderSweepState } from './types';
import { SCORING_VERSION } from './versions';

export interface OrderSweepScreenProps {
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

export default function OrderSweepScreen(props: OrderSweepScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    orderSweepGameReducer,
    undefined,
    createInitialOrderSweepState,
  );

  const stateRef = useRef(state);
  /** Window time left when pausing; the resume action re-anchors from it. */
  const pauseRemainingRef = useRef(0);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  // Active and round-result phases pause (result has no running window but a
  // pause must still cover it per the phase machine).
  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'active' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => {
      // Freeze the round's window: the remaining time is what resume
      // re-anchors the deadline from, so pausing never buys or loses time.
      const current = stateRef.current;
      pauseRemainingRef.current =
        current.deadlineMs !== null
          ? Math.max(0, current.deadlineMs - clock.now())
          : 0;
      dispatch({ type: 'pause' });
    },
  });

  const tutorial = useMemo(
    () => createOrderSweepTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createOrderSweepQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params =
    state.profile !== null ? orderSweepParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'active' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Window expiry: one timer per round, scheduled from the monotonic
  // deadline. Pause deactivates the timer; resume re-schedules with the
  // remaining time (deadline - now), so pausing never buys extra time. A
  // 0 ms remainder fires on the next timer advance instead of synchronously
  // during render/effect scheduling.
  useGameTimeout(
    state.phase === 'active' && !state.paused && state.deadlineMs !== null,
    () => dispatch({ type: 'round-expired', nowMs: clock.now() }),
    Math.max(0, state.deadlineMs !== null ? state.deadlineMs - clock.now() : 0),
  );

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // ---- Round outcome feedback (canonical feedback events only). Keyed by
  // roundIndex too, so consecutive rounds with the same outcome still sting.
  useEffect(() => {
    if (state.roundOutcome === 'perfect' || state.roundOutcome === 'cleared') {
      liveAudioHaptics.feedback('success');
    } else if (state.roundOutcome === 'expired') {
      liveAudioHaptics.feedback('failure');
    }
  }, [state.roundOutcome, state.roundIndex]);

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
    const resolvedParams = orderSweepParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.windowMs);

    const raw = buildOrderSweepRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      finalWindowMs: state.windowMs,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeOrderSweepResult(raw, context);
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
    void persistOrderSweepSession(record, persistSession).then((outcome) => {
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
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    if (session.resumeIfPaused()) {
      dispatch({
        type: 'resume',
        nowMs: clock.now(),
        remainingMs: pauseRemainingRef.current,
      });
    }
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleTokenTap = useCallback(
    (tokenId: number) => {
      const current = stateRef.current;
      if (current.phase !== 'active' || current.paused) {
        return;
      }
      if (current.deadlineMs !== null && clock.now() > current.deadlineMs) {
        return; // window already closed; the expiry timer owns the resolution
      }
      // Per-tap feedback matches the answer actually given; the round-level
      // success/failure sting plays via the roundOutcome effect.
      const round = current.round;
      const token = round?.tokens.find((candidate) => candidate.id === tokenId);
      const required = round !== null && round !== undefined ? round.order[current.clearedCount] : undefined;
      if (token !== undefined && token.value === required) {
        liveAudioHaptics.feedback('correct');
      } else if (token !== undefined) {
        liveAudioHaptics.feedback('wrong');
      }
      dispatch({ type: 'tap', tokenId, nowMs: clock.now() });
    },
    [clock, dispatch],
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
      roundStartedAtMs: clock.now(),
    });
  }, [session, sessionSeed, clock, dispatch]);

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

  const board = state.phase === 'active' || state.phase === 'roundResult' ? state.round : null;

  const view: GameHostView =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={view}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) =>
        dispatch({ type: 'select-difficulty', level })
      }
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      header={
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {state.phase === 'active' ? (
        <>
          <View style={styles.statusRow}>
            <ThemedText
              type="bodyLarge"
              themeColor="text"
              testID={testId(GAME_ID, 'active-status')}>
              Tap the smallest number!
            </ThemedText>
            <ThemedText
              type="smallBold"
              themeColor={state.stats.streak > 0 ? 'accent' : 'textSecondary'}
              testID={testId(GAME_ID, 'streak')}>
              Streak {state.stats.streak}
            </ThemedText>
          </View>
          <RoundWindow
            deadlineMs={state.deadlineMs ?? clock.now()}
            windowMs={state.windowMs}
            clock={clock}
            testID={testId(GAME_ID, 'window')}
          />
          {board !== null ? (
            <TokenGrid
              round={board}
              clearedCount={state.clearedCount}
              disabled={state.paused}
              onTap={handleTokenTap}
              testID={testId(GAME_ID, 'grid')}
            />
          ) : null}
        </>
      ) : null}

      {state.phase === 'roundResult' ? (
        <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
          <ThemedText
            type="headline"
            themeColor={
              state.roundOutcome === 'expired' ? 'danger' : 'success'
            }
            testID={testId(
              GAME_ID,
              state.roundOutcome === 'expired' ? 'round-failed' : 'round-passed',
            )}>
            {state.roundOutcome === 'perfect'
              ? 'Perfect sweep!'
              : state.roundOutcome === 'cleared'
                ? 'Board cleared'
                : "Time's up"}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {state.clearedCount}/{board?.order.length ?? 0} swept ·{' '}
            {state.roundWrongTaps} wrong tap{state.roundWrongTaps === 1 ? '' : 's'}
          </ThemedText>
          {state.roundOutcome === 'perfect' ? (
            <ThemedText type="small" themeColor="textSecondary">
              Flawless — the next window shrinks to {state.windowMs} ms.
            </ThemedText>
          ) : state.roundOutcome === 'cleared' ? (
            <ThemedText type="small" themeColor="textSecondary">
              Cleared with mistakes — the window holds at {state.windowMs} ms.
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Sweep the whole board before the bar empties.
            </ThemedText>
          )}
          <GameButton
            testID={testId(GAME_ID, 'next-round')}
            label={isLastRound ? 'See results' : 'Next round'}
            onPress={() => dispatch({ type: 'next-round', roundStartedAtMs: clock.now() })}
          />
        </View>
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
              (state.stats.tokensCleared + state.stats.tokensExpired > 0
                ? state.stats.tokensCleared / (state.stats.tokensCleared + state.stats.tokensExpired)
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Numbers swept"
            value={`${state.stats.tokensCleared}/${state.stats.tokensCleared + state.stats.tokensExpired}`}
            testID={testId(GAME_ID, 'tokens-cleared')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Perfect sweeps"
            value={`${state.stats.perfectRounds}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'perfect-rounds')}
          />
          <StatRow
            label="Best pace"
            value={
              state.stats.gaps.length > 0 && bestOf(state.stats.gaps) !== null
                ? `${Math.round(bestOf(state.stats.gaps) as number)} ms / number`
                : '—'
            }
            testID={testId(GAME_ID, 'best-gap')}
          />
          <StatRow
            label="Mean pace"
            value={
              meanOf(state.stats.gaps) !== null
                ? `${Math.round(meanOf(state.stats.gaps) as number)} ms / number`
                : '—'
            }
            testID={testId(GAME_ID, 'mean-gap')}
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
