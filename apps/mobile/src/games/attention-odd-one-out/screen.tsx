/**
 * OddOneOutScreen — the Odd One Out game (attention variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Odd-One-Out-specific — the round countdown, tap handling, the
 * escalation visuals, and the scoring/persistence pipeline.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and the round
 * countdown — the exact remainder is captured from the monotonic clock at
 * pause time and dispatched into the reducer, so resuming rebuilds the
 * deadline from it and the window can never be stretched. The board is
 * covered by the opaque `PauseOverlay` and hidden from the accessibility
 * tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
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
  useGameInterval,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { ItemGrid } from './components/grid';
import type { TileVisualState } from './components/tile';
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
import type { OddOneOutAction } from './types';
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
  /** Injectable XP/rating hook; defaults to the shared pipeline-backed hook. */
  xpHook?: XpRatingHook;
}

export default function OddOneOutScreen(props: OddOneOutScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(oddOneOutReducer, undefined, createInitialOddOneOutState);

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
        (current.phase === 'playing' || current.phase === 'roundResult') && !current.paused
      );
    },
    onPause: () => {
      // Freeze the exact remainder so resume cannot stretch the window.
      const current = stateRef.current;
      dispatch({
        type: 'pause',
        remainingMs: Math.max(0, current.deadlineMs - clock.now()),
      });
    },
  });

  const tutorial = useMemo(() => createOddOneOutTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createOddOneOutQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? oddOneOutParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 6;
  const inSession = state.phase === 'playing' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Round countdown: refresh the displayed remainder every TICK_MS; when
  // the monotonic deadline passes, the round times out. Pause deactivates the
  // interval (window frozen); resume re-arms it and the reducer rebuilds the
  // deadline from the stored remainder.
  useGameInterval(
    state.phase === 'playing' && !state.paused,
    () => {
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
    },
    TICK_MS,
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
    void persistOddOneOutSession(record, persistSession).then((outcome) => {
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
    state.gridSize,
    state.subtlety,
    state.windowMs,
    state.step,
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
      dispatch({ type: 'resume', nowMs: clock.now() });
    }
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleTapTile = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.paused) {
        return;
      }
      const nowMs = clock.now();
      // Feedback follows the authoritative round outcome, not the tap's
      // optimism: the reducer owns the post-deadline guard, so resolve the
      // tap through it first. A tap past the deadline is a no-op here (the
      // pending tick owns the timeout resolution) and must stay silent —
      // sounding "correct" for a round that scores a timeout is the Campaign
      // 023 late-tap mismatch. No timing logic is duplicated: this is the
      // same pure transition the dispatch below commits.
      const action: OddOneOutAction = { type: 'tap-tile', index, nowMs };
      const next = oddOneOutReducer(current, action);
      dispatch(action);
      if (next === current) {
        return;
      }
      if (next.phase === 'roundResult' && next.roundOutcome === 'passed') {
        liveAudioHaptics.playSfx('odd-one-out-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('odd-one-out-wrong');
        liveAudioHaptics.haptic('warning');
      }
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
      nowMs: clock.now(),
    });
  }, [clock, session, sessionSeed, dispatch]);

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

  // ---- Item visuals (see TileVisualState): only the most recent wrong tap
  // is marked during play; the odd item is revealed after the round ended.
  // Stable across the per-tick countdown re-renders (depends on round
  // transition state, never on `remainingMs`), so the memoized grid skips
  // re-rendering items whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): TileVisualState => {
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
    },
    [state.phase, state.lastWrongIndex, state.board],
  );

  const timeLeftText = `${(state.remainingMs / 1000).toFixed(1)}s`;

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
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
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
            label="First-try rate"
            value={`${Math.round(
              (state.stats.roundsPlayed > 0
                ? state.stats.firstTryCorrect / state.stats.roundsPlayed
                : 0) * 100,
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
