/**
 * QuickCompareScreen — the Quick Compare game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Quick-Compare-specific — the per-round window-expiry timer,
 * answer handling, and the scoring/persistence pipeline.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the expiry
 * timer; resuming re-schedules expiry from the exact remaining time captured
 * at pause (`deadlineMs - clock.now()`), so pausing never buys extra time.
 * The board is covered by the opaque `PauseOverlay` and hidden from the
 * accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  isDevBuild,
  liveAudioHaptics,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { pipelineXpRatingHook } from '@/rating/xp-hook';
import { ThemedText } from '@/components/themed-text';
import { AnimatedNumber, useSafeBack } from '@/components/ui';
import { Countdown, GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
  useGameTimeout,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { Comparison } from './components/comparison';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { VerdictCue } from './components/verdict-cue';
import { sessionChallengeRating, quickCompareParamsFromProfile } from './difficulty';
import { gameDefinition } from './game-definition';
import { createQuickCompareQaForceStateHooks, createQuickCompareTutorialLifecycle } from './hooks';
import { quickCompareGameReducer } from './reducer';
import { bestOf, normalizeQuickCompareResult } from './scoring';
import {
  buildSessionRecord,
  buildQuickCompareRawResult,
  dbSessionPersister,
  persistQuickCompareSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialQuickCompareState } from './types';
import { SCORING_VERSION } from './versions';

export interface QuickCompareScreenProps {
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

export default function QuickCompareScreen(props: QuickCompareScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const goBack = useSafeBack('/games');
  const [state, dispatch] = useReducer(
    quickCompareGameReducer,
    undefined,
    createInitialQuickCompareState,
  );

  const stateRef = useRef(state);
  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });
  /** Window time left when pausing; the resume action re-anchors from it. */
  const pauseRemainingRef = useRef(0);

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'active' || current.phase === 'feedback') && !current.paused
      );
    },
    onPause: () => {
      const current = stateRef.current;
      pauseRemainingRef.current =
        current.deadlineMs !== null ? Math.max(0, current.deadlineMs - clock.now()) : 0;
      dispatch({ type: 'pause' });
    },
  });

  const tutorial = useMemo(
    () => createQuickCompareTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createQuickCompareQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params = state.profile !== null ? quickCompareParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 10;
  const inSession = state.phase === 'active' || state.phase === 'feedback';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Window expiry: one timer per live round, scheduled from the monotonic
  // deadline. Pause deactivates the timer; resume re-schedules it from the
  // remaining time the reducer re-anchored, so pausing never buys extra time.
  const windowRemainingMs =
    state.phase === 'active' && !state.paused && state.deadlineMs !== null
      ? Math.max(0, state.deadlineMs - clock.now())
      : 0;
  useGameTimeout(
    state.phase === 'active' && !state.paused && state.deadlineMs !== null,
    () => dispatch({ type: 'answer-timeout', nowMs: clock.now() }),
    windowRemainingMs,
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
    const resolvedParams = quickCompareParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.windowMs);

    const raw = buildQuickCompareRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      windowMs: state.windowMs,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeQuickCompareResult(raw, context);
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
      difficulty: { ...state.profile, challengeRating },
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistQuickCompareSession(record, persistSession).then((outcome) => {
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
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    goBack();
  }, [session, goBack]);

  const handleAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'active' || current.paused || current.round === null) {
        return;
      }
      const nowMs = clock.now();
      if (current.deadlineMs !== null && nowMs > current.deadlineMs) {
        return;
      }
      // Sensory feedback follows the authoritative verdict, not tap optimism:
      // resolve through the same pure transition the dispatch below commits, so
      // a tap the deadline guard rejects stays silent (R4). The visual cue
      // always reads the reducer's `lastVerdict`, never the tap handler.
      const action = { type: 'answer' as const, index, nowMs };
      const next = quickCompareGameReducer(current, action);
      dispatch(action);
      if (next === current || next.lastVerdict === null) {
        return;
      }
      if (next.lastVerdict === 'correct') {
        liveAudioHaptics.playSfx('correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('wrong');
        liveAudioHaptics.haptic('warning');
      }
    },
    [clock, dispatch],
  );

  const handleNext = useCallback(() => {
    dispatch({ type: 'next-round', spawnedAtMs: clock.now() });
  }, [clock, dispatch]);

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

  const accuracyPct =
    state.stats.roundsTotal > 0
      ? Math.round((state.stats.roundsCorrect / state.stats.roundsTotal) * 100)
      : 0;

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
            testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
            Round {state.roundIndex + 1}/{rounds}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID={testId(GAME_ID, 'streak')}>
            Streak {state.stats.streak}
          </ThemedText>
        </>
      }
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession && state.round !== null ? (
        <>
          {/* Live score: count-up readout visible throughout the session so a
          resolved round reads as movement. The HUD owns its own score chip. */}
          <View style={styles.scoreStrip}>
            <ThemedText type="small" themeColor="textSecondary">
              Score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeral"
              themeColor="accent"
              testID={testId(GAME_ID, 'score-live')}
            />
          </View>

          {/* Verdict cue: fixed-size slot, empty while the round is live and
          resolved from the reducer's outcome during feedback. */}
          <VerdictCue verdict={state.phase === 'feedback' ? state.lastVerdict : null} />

          {state.phase === 'active' ? (
            <Countdown
              deadlineMs={state.deadlineMs ?? clock.now()}
              windowMs={state.windowMs}
              clock={clock}
              testID={testId(GAME_ID, 'countdown')}
            />
          ) : null}

          {/* The prompt (question + stimulus cards) stays mounted during
          feedback; options keep their resolved highlights but stop accepting
          taps, so a wrong pick is reviewed beside the correct option (R2/R3). */}
          <Comparison
            round={state.round}
            selectedIndex={state.selectedIndex}
            lastVerdict={state.lastVerdict}
            disabled={state.phase !== 'active'}
            onSelect={handleAnswer}
            testID={testId(GAME_ID, 'comparison')}
          />

          {state.phase === 'feedback' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'feedback')}>
              <ThemedText
                type="headline"
                themeColor={
                  state.lastVerdict === 'correct'
                    ? 'success'
                    : state.lastVerdict === 'miss'
                      ? 'warning'
                      : 'danger'
                }
                testID={testId(GAME_ID, 'verdict')}>
                {state.lastVerdict === 'correct'
                  ? 'Correct!'
                  : state.lastVerdict === 'miss'
                    ? 'Too slow'
                    : 'Not quite'}
              </ThemedText>
              <GameButton
                testID={testId(GAME_ID, 'next')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={handleNext}
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
          {/* Count-up final score beside the existing rows; StatRows below
          (including the plain `score` row) stay as-is. */}
          <View style={styles.finalScore}>
            <ThemedText type="small" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              themeColor="accent"
              testID={testId(GAME_ID, 'score-final')}
            />
          </View>
          <StatRow
            label="Accuracy"
            value={`${accuracyPct}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Correct"
            value={`${state.stats.roundsCorrect}/${state.stats.roundsTotal}`}
            testID={testId(GAME_ID, 'correct')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Best reaction"
            value={
              // bestOf (iterative) instead of a Math.min spread: a corrupt
              // hostile-length array must not overflow the render (057).
              state.stats.reactions.length > 0
                ? `${Math.round(bestOf(state.stats.reactions) ?? Number.NaN)} ms`
                : '—'
            }
            testID={testId(GAME_ID, 'best-reaction')}
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
  scoreStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  finalScore: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
