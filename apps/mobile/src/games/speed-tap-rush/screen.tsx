/**
 * TapRushScreen — the Tap Rush game (rapid serial response variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Tap-Rush-specific — the reducer wiring, the per-target
 * window-expiry timer, the scoring/persistence pipeline, and the playfield
 * view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the expiry
 * timer; resuming re-schedules expiry with the exact remaining time
 * (`deadlineMs - clock.now()`). The field is covered by the opaque shared
 * `PauseOverlay` and hidden from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { isDevBuild, noopXpRatingHook, systemClock, testId } from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameTimeout,
  useGameSession,
} from '@/components/game-host';

import { Countdown } from './components/countdown';
import { Playfield } from './components/playfield';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { sessionChallengeRating, tapRushParamsFromProfile } from './difficulty';
import { gameDefinition } from './game-definition';
import { createTapRushQaForceStateHooks, createTapRushTutorialLifecycle } from './hooks';
import { tapRushGameReducer } from './reducer';
import { normalizeTapRushResult } from './scoring';
import {
  buildSessionRecord,
  buildTapRushRawResult,
  dbSessionPersister,
  persistTapRushSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialTapRushState } from './types';
import { SCORING_VERSION } from './versions';

export interface TapRushScreenProps {
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

export default function TapRushScreen(props: TapRushScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(tapRushGameReducer, undefined, createInitialTapRushState);

  const stateRef = useRef(state);
  /** Window time left when pausing; the resume action re-anchors from it. */
  const pauseRemainingRef = useRef(0);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'active' || current.phase === 'roundResult') && !current.paused;
    },
    onPause: () => {
      // Freeze the live target's window: the remaining time is what resume
      // re-anchors the deadline from, so pausing never buys or loses time.
      const current = stateRef.current;
      pauseRemainingRef.current =
        current.deadlineMs !== null ? Math.max(0, current.deadlineMs - clock.now()) : 0;
      dispatch({ type: 'pause' });
    },
  });

  const tutorial = useMemo(() => createTapRushTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createTapRushQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? tapRushParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 4;
  const radius = params?.targetRadius ?? 0.075;
  const inSession = state.phase === 'active' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Window expiry: one timer per live target, scheduled from the
  // monotonic deadline. Pause deactivates the timer; resume re-schedules with
  // the remaining time (deadline - now), so pausing never buys extra time.
  useGameTimeout(
    state.phase === 'active' && !state.paused && state.deadlineMs !== null,
    () => dispatch({ type: 'target-expired', nowMs: clock.now() }),
    Math.max(0, state.deadlineMs !== null ? state.deadlineMs - clock.now() : 0),
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
    const resolvedParams = tapRushParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.windowMs);

    const raw = buildTapRushRawResult({
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
    const normalized = normalizeTapRushResult(raw, context);
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
    void persistTapRushSession(record, persistSession).then((outcome) => {
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

  const handleFieldTap = useCallback(
    (x: number, y: number) => {
      const current = stateRef.current;
      if (current.phase !== 'active' || current.paused) {
        return;
      }
      if (current.deadlineMs !== null && clock.now() > current.deadlineMs) {
        return; // window already closed; the expiry timer owns the resolution
      }
      dispatch({ type: 'tap', x, y, nowMs: clock.now() });
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
      spawnedAtMs: clock.now(),
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

  const view: 'intro' | 'session' | 'results' =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  const liveTarget = state.phase === 'active' ? state.targets[state.targetIndex] ?? null : null;

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
          {state.phase === 'active' ? (
            <>
              <View style={styles.statusRow}>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'active-status')}>
                  Tap the target!
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  themeColor={state.stats.streak > 0 ? 'accent' : 'textSecondary'}
                  testID={testId(GAME_ID, 'streak')}>
                  Streak {state.stats.streak}
                </ThemedText>
              </View>
              <Countdown
                deadlineMs={state.deadlineMs ?? clock.now()}
                windowMs={state.windowMs}
                clock={clock}
                testID={testId(GAME_ID, 'countdown')}
              />
              <Playfield
                target={liveTarget}
                radius={radius}
                targetTestID={testId(GAME_ID, 'target', String(state.targetIndex))}
                testID={testId(GAME_ID, 'field')}
                onTap={handleFieldTap}
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
                {state.roundHits} hit · {state.roundMisses} missed · {state.roundWrongs} wrong
              </ThemedText>
              {state.roundOutcome === 'passed' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Perfect round — the next window shrinks to {state.windowMs} ms.
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  The window holds at {state.windowMs} ms.
                </ThemedText>
              )}
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={() => dispatch({ type: 'next-round', spawnedAtMs: clock.now() })}
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
              (state.stats.targetsHit + state.stats.targetsMissed > 0
                ? state.stats.targetsHit / (state.stats.targetsHit + state.stats.targetsMissed)
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Targets hit"
            value={`${state.stats.targetsHit}/${state.stats.targetsHit + state.stats.targetsMissed}`}
            testID={testId(GAME_ID, 'targets-hit')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Perfect rounds"
            value={`${state.stats.perfectRounds}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'perfect-rounds')}
          />
          <StatRow
            label="Best reaction"
            value={
              state.stats.reactions.length > 0
                ? `${Math.round(Math.min(...state.stats.reactions))} ms`
                : '—'
            }
            testID={testId(GAME_ID, 'best-reaction')}
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
