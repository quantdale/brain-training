/**
 * SpeedColorMatchScreen — the Speed Color Match game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Speed-Color-Match-specific — the reducer wiring, the stimulus
 * auto-show + timeout pacing, the scoring/persistence pipeline, and the
 * swatch/response view.
 *
 * Timing contract (constitution §20): reaction times are measured with the
 * injected monotonic `Clock` (`trialShownAtMs` → tap), never wall-clock time,
 * so clock jumps cannot distort a measured reaction. Pausing re-baselines the
 * live trial's window on resume, so paused time never counts against the
 * player.
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
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameTimeout,
  useGameSession,
} from '@/components/game-host';

import { ColorButtonGrid } from './components/color-button';
import { QaPanel } from './components/qa-panel';
import { ColorSwatch } from './components/swatch';
import { Tutorial } from './components/tutorial';
import {
  speedColorMatchParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSpeedColorMatchQaForceStateHooks,
  createSpeedColorMatchTutorialLifecycle,
} from './hooks';
import { speedColorMatchReducer } from './reducer';
import { normalizeSpeedColorMatchResult } from './scoring';
import {
  buildSpeedColorMatchRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSpeedColorMatchSession,
} from './session';
import type { SessionPersistence } from './session';
import { COLOR_PALETTE, GAME_ID, createInitialSpeedColorMatchState } from './types';
import type { ColorName } from './types';
import { SCORING_VERSION } from './versions';

export interface SpeedColorMatchScreenProps {
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

export default function SpeedColorMatchScreen(props: SpeedColorMatchScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(speedColorMatchReducer, undefined, createInitialSpeedColorMatchState);

  const stateRef = useRef(state);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'trial' || current.phase === 'roundResult') && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createSpeedColorMatchTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createSpeedColorMatchQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? speedColorMatchParamsFromProfile(state.profile) : null;
  const stimulusTimeoutMs = params?.stimulusTimeoutMs ?? 4_000;
  const totalTrials = params?.trials ?? 20;
  const inSession = state.phase === 'trial' || state.phase === 'roundResult';
  const isLastTrial = state.trialIndex + 1 >= totalTrials;

  // ---- Auto-show trial when entering trial phase. The shown timestamp is a
  // monotonic clock reading (constitution §20), never wall-clock time.
  useEffect(() => {
    if (state.phase === 'trial' && state.trialShownAtMs === null && !state.paused) {
      dispatch({ type: 'trial-shown', shownAtMs: clock.now() });
    }
  }, [state.phase, state.trialShownAtMs, state.paused, clock]);

  // ---- Stimulus timeout: auto-fail trial on expiry. Scheduled from the
  // monotonic onset (`trialShownAtMs`); pausing deactivates the timer, and
  // resume re-baselines the onset (below) before the timer re-arms, so paused
  // time never counts against the response window.
  useGameTimeout(
    state.phase === 'trial' && !state.paused && state.trialShownAtMs !== null,
    () => dispatch({ type: 'trial-timeout', timedOutAtMs: clock.now() }),
    Math.max(
      0,
      state.trialShownAtMs !== null ? stimulusTimeoutMs - (clock.now() - state.trialShownAtMs) : 0,
    ),
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
    const resolvedParams = speedColorMatchParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.incongruentRatio,
    );

    const raw = buildSpeedColorMatchRawResult({
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
    const normalized = normalizeSpeedColorMatchResult(raw, context);
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
    void persistSpeedColorMatchSession(record, persistSession).then((outcome) => {
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
    session.resume();
    dispatch({ type: 'resume' });
    if (stateRef.current.phase === 'trial') {
      // Re-baseline the stimulus window at the resume moment: paused time must
      // never count against the player's response window (constitution §11).
      // Mirrors speed-reaction-time's fresh-`goAtMs` resume path.
      dispatch({ type: 'trial-shown', shownAtMs: clock.now() });
    }
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleTapColor = useCallback(
    (color: ColorName) => {
      const current = stateRef.current;
      if (current.phase !== 'trial' || current.paused || current.trialShownAtMs === null) {
        return;
      }
      const trial = current.trials[current.trialIndex];
      if (!trial) return;

      if (color === trial.swatchColor) {
        liveAudioHaptics.playSfx('memory-tile-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('memory-tile-wrong');
        liveAudioHaptics.haptic('warning');
      }
      // Reaction time = monotonic clock delta from stimulus onset to the tap;
      // wall-clock jumps can never distort a measured reaction.
      dispatch({ type: 'tap-color', color, tappedAtMs: clock.now() });
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

  const view: 'intro' | 'session' | 'results' =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  const currentTrial = state.trials[state.trialIndex] ?? null;

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
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'trial', String(state.trialIndex + 1))}>
          Trial {state.trialIndex + 1}/{totalTrials}
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
          {state.phase === 'trial' && currentTrial ? (
            <>
              <ColorSwatch
                swatchColor={currentTrial.swatchColor}
                labelColor={currentTrial.labelColor}
                testID={testId(GAME_ID, 'current-swatch')}
              />
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'trial-status')}>
                Tap the matching color!
              </ThemedText>
              <ColorButtonGrid
                colors={COLOR_PALETTE}
                onPress={handleTapColor}
                disabled={state.paused}
              />
            </>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.currentTrialOutcome === 'correct' ? 'success' : 'danger'}
                testID={testId(GAME_ID, state.currentTrialOutcome === 'correct' ? 'trial-correct' : 'trial-wrong')}>
                {state.currentTrialOutcome === 'correct' ? 'Correct!' : 'Wrong!'}
              </ThemedText>
              {state.currentReactionMs !== null ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(state.currentReactionMs)}ms
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Timed out
                </ThemedText>
              )}
              <GameButton
                testID={testId(GAME_ID, 'next-trial')}
                label={isLastTrial ? 'See results' : 'Next trial'}
                onPress={() => dispatch({ type: 'next-trial' })}
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
              (state.stats.trialsPlayed > 0 ? state.stats.trialsCorrect / state.stats.trialsPlayed : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Trials correct"
            value={`${state.stats.trialsCorrect}/${state.stats.trialsPlayed}`}
            testID={testId(GAME_ID, 'trials-correct')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Avg reaction"
            value={
              state.stats.avgReactionMs > 0 && state.stats.avgReactionMs < Infinity
                ? `${Math.round(state.stats.avgReactionMs)}ms`
                : 'N/A'
            }
            testID={testId(GAME_ID, 'avg-reaction')}
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
