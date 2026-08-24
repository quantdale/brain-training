/**
 * SpeedScreen — the Reaction Time game (precision-reaction variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Reaction-Time-specific — the GO-signal timer, the
 * reaction-window timeout, trigger handling, and the scoring/persistence
 * pipeline.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Timing contract (constitution §20): all gameplay timing uses the injected
 * `Clock` (default `systemClock`, monotonic). The GO timer is a wall-clock
 * `setTimeout` for the seeded delay, but the GO signal's timestamp (`goAtMs`)
 * is captured from the monotonic clock at the moment the timer actually fires,
 * and the reaction time is `clock.now() - goAtMs` at tap time — so timer
 * jitter can never inflate or deflate a measured reaction, and the same
 * measurement works identically on 60 Hz and 120 Hz displays (the displayed
 * signal and the measured timestamp share one event).
 *
 * Pause semantics: pausing freezes both timers (the host helpers deactivate
 * them while paused). Resuming during the wait restarts the full seeded
 * delay; resuming after GO re-displays the signal with a fresh `goAtMs`, so a
 * pause can never manufacture reaction time. The trigger is covered by the
 * opaque `PauseOverlay` and hidden from the accessibility tree while paused.
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
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameTimeout,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { TriggerButton } from './components/trigger';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { sessionChallengeRating, speedParamsFromProfile } from './difficulty';
import { gameDefinition } from './game-definition';
import { createSpeedQaForceStateHooks, createSpeedTutorialLifecycle } from './hooks';
import { speedGameReducer } from './reducer';
import { normalizeSpeedResult } from './scoring';
import {
  buildSessionRecord,
  buildSpeedRawResult,
  dbSessionPersister,
  persistSpeedSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialSpeedState } from './types';
import { SCORING_VERSION } from './versions';

export interface SpeedScreenProps {
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

export default function SpeedScreen(props: SpeedScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(speedGameReducer, undefined, createInitialSpeedState);

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
        (current.phase === 'wait' || current.phase === 'go' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createSpeedTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createSpeedQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? speedParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 10;
  const timeoutMs = params?.timeoutMs ?? 2200;
  const falseStartBudget = params?.falseStartBudget ?? 1;
  const inSession =
    state.phase === 'wait' || state.phase === 'go' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- GO timer: after the seeded delay the signal appears; `goAtMs` is the
  // monotonic clock reading at the actual display moment (timer jitter-safe).
  // Pause deactivates the timer; resume re-arms it from scratch.
  useGameTimeout(
    state.phase === 'wait' && !state.paused,
    () => dispatch({ type: 'go', goAtMs: clock.now() }),
    state.delayMs,
  );

  // ---- Reaction-window timeout: no tap within timeoutMs of GO → the round
  // fails as a timeout. Pause cancels it; resuming re-displays GO (fresh
  // goAtMs via the resume path below) and restarts the window.
  useGameTimeout(
    state.phase === 'go' && !state.paused,
    () => dispatch({ type: 'round-timeout' }),
    timeoutMs,
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
    const resolvedParams = speedParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.stats.medianReactionMs,
    );

    const raw = buildSpeedRawResult({
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
    const normalized = normalizeSpeedResult(raw, context);
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
    void persistSpeedSession(record, persistSession).then((outcome) => {
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
      const current = stateRef.current;
      dispatch({ type: 'resume' });
      if (current.phase === 'go') {
        // The GO signal was hidden by the overlay during the pause: re-display
        // it now and restart the measured reaction window from this moment.
        dispatch({ type: 'go', goAtMs: clock.now() });
      }
    }
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleTrigger = useCallback(() => {
    const current = stateRef.current;
    if (current.paused) {
      return;
    }
    if (current.phase === 'wait') {
      // False start: tapped before the GO signal.
      liveAudioHaptics.playSfx('speed-false-start');
      liveAudioHaptics.haptic('warning');
      dispatch({ type: 'false-start' });
    } else if (current.phase === 'go' && current.goAtMs !== null) {
      // Valid reaction, measured with the monotonic clock against the moment
      // the GO signal was displayed.
      const rtMs = clock.now() - current.goAtMs;
      if (rtMs < 0) {
        return; // monotonic-clock invariant; never negative in practice
      }
      liveAudioHaptics.playSfx('speed-trigger');
      liveAudioHaptics.haptic(rtMs <= (params?.passMs ?? 600) ? 'success' : 'warning');
      dispatch({ type: 'tap', rtMs });
    }
  }, [clock, dispatch, params]);

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

  const falseStartsLeft = Math.max(0, falseStartBudget - state.stats.falseStarts);
  const reactionMs =
    state.stats.medianReactionMs !== null ? `${Math.round(state.stats.medianReactionMs)} ms` : '—';

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
          {state.phase === 'wait' ? (
            <View style={styles.section}>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'wait-status')}>
                Get ready — tap the instant it turns green
              </ThemedText>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID={testId(GAME_ID, 'false-starts-left')}>
                False starts left: {falseStartsLeft}
              </ThemedText>
              <TriggerButton
                active={false}
                testID={testId(GAME_ID, 'trigger')}
                onPress={handleTrigger}
              />
            </View>
          ) : null}

          {state.phase === 'go' ? (
            <View style={styles.section}>
              <ThemedText
                type="display"
                themeColor="text"
                testID={testId(GAME_ID, 'go-status')}>
                GO!
              </ThemedText>
              <TriggerButton
                active
                testID={testId(GAME_ID, 'trigger')}
                onPress={handleTrigger}
              />
            </View>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === 'passed'
                    ? 'success'
                    : state.roundOutcome === 'failed'
                      ? 'danger'
                      : 'warning'
                }
                testID={testId(GAME_ID, `round-${state.roundOutcome ?? 'failed'}`)}>
                {state.roundOutcome === 'passed'
                  ? 'Fast!'
                  : state.roundOutcome === 'failed'
                    ? 'Too slow'
                    : state.roundOutcome === 'false-start'
                      ? 'False start!'
                      : 'No reaction'}
              </ThemedText>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'reaction-ms')}>
                {state.roundOutcome === 'passed' || state.roundOutcome === 'failed'
                  ? `Reaction ${Math.round(state.stats.reactions[state.stats.reactions.length - 1])} ms`
                  : state.roundOutcome === 'false-start'
                    ? 'You tapped before the signal — the round is lost.'
                    : 'The signal went unanswered.'}
              </ThemedText>
              {state.roundOutcome === 'passed' || state.roundOutcome === 'failed' ? (
                <ThemedText
                  type="caption"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, 'round-reaction')}>
                  Best so far:{' '}
                  {state.stats.bestReactionMs !== null
                    ? `${Math.round(state.stats.bestReactionMs)} ms`
                    : '—'}
                </ThemedText>
              ) : null}
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
          title={state.stats.falseStartAborted ? 'Session ended early' : 'Session complete'}
          badge={
            state.stats.falseStartAborted ? (
              <ThemedText
                type="small"
                themeColor="warning"
                testID={testId(GAME_ID, 'aborted-badge')}>
                Too many false starts
              </ThemedText>
            ) : undefined
          }
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
            label="Median reaction"
            value={reactionMs}
            testID={testId(GAME_ID, 'median-reaction')}
          />
          <StatRow
            label="Best reaction"
            value={
              state.stats.bestReactionMs !== null
                ? `${Math.round(state.stats.bestReactionMs)} ms`
                : '—'
            }
            testID={testId(GAME_ID, 'best-reaction')}
          />
          <StatRow
            label="Mean reaction"
            value={
              state.stats.meanReactionMs !== null
                ? `${Math.round(state.stats.meanReactionMs)} ms`
                : '—'
            }
            testID={testId(GAME_ID, 'mean-reaction')}
          />
          <StatRow
            label="Rounds passed"
            value={`${state.stats.roundsPassed}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'rounds-passed')}
          />
          <StatRow
            label="False starts"
            value={String(state.stats.falseStarts)}
            testID={testId(GAME_ID, 'false-starts')}
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
});
