/**
 * TargetCountScreen — the Target Count game (selective attention + numerosity).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Target-Count-specific — the reducer wiring, the per-round
 * countdown, the scoring/persistence pipeline, and the board view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and the per-round
 * countdown; resuming continues the remaining round window (freeze-and-continue,
 * so pausing can never stretch the window or reset elapsed time). The board is
 * covered by the opaque shared PauseOverlay and hidden from the accessibility
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
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameSession,
} from '@/components/game-host';

import { Grid } from './components/grid';
import { CountOptions } from './components/count-options';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { targetCountParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createTargetCountQaForceStateHooks, createTargetCountTutorialLifecycle } from './hooks';
import { targetCountGameReducer } from './reducer';
import { normalizeTargetCountResult } from './scoring';
import {
  buildTargetCountRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistTargetCountSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialTargetCountState } from './types';
import { SCORING_VERSION } from './versions';

export interface TargetCountScreenProps {
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

/** Countdown accumulator step (ms); also bounds the pause-freeze drift. */
const ROUND_TICK_MS = 100;

export default function TargetCountScreen(props: TargetCountScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(targetCountGameReducer, undefined, createInitialTargetCountState);

  const stateRef = useRef(state);
  // Accumulated ACTIVE (non-paused) time in the current round; reset when a new
  // round begins so pause/resume freezes and continues the remaining window
  // instead of restarting it (and the speed bonus stays honest).
  const roundElapsedRef = useRef(0);
  const roundElapsedRoundRef = useRef(-1);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'showGrid' || current.phase === 'roundResult') && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createTargetCountTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createTargetCountQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? targetCountParamsFromProfile(state.profile) : null;
  const roundTimeMs = params?.roundTimeMs ?? 9000;
  const rounds = params?.rounds ?? 8;
  const inSession = state.phase === 'showGrid' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // ---- Reset the per-round elapsed baseline when a fresh grid begins.
  useEffect(() => {
    if (state.phase === 'showGrid' && roundElapsedRoundRef.current !== state.roundIndex) {
      roundElapsedRoundRef.current = state.roundIndex;
      roundElapsedRef.current = 0;
    }
  }, [state.phase, state.roundIndex]);

  // ---- Per-round countdown with freeze-and-continue: a window of
  // `roundTimeMs` of ACTIVE (non-paused) time, accumulated in ROUND_TICK_MS
  // steps. While paused, the interval is cleared so no time accrues; on resume
  // it continues from where it left off, so pausing can never stretch the
  // window or reset the elapsed time the speed bonus is computed from.
  useGameInterval(
    state.phase === 'showGrid' && !state.paused,
    () => {
      roundElapsedRef.current = Math.min(roundTimeMs, roundElapsedRef.current + ROUND_TICK_MS);
      if (roundElapsedRef.current >= roundTimeMs) {
        // Budget exhausted: timeout answer (the reducer ignores it once the
        // phase has moved on, mirroring the old clear-then-dispatch order).
        dispatch({
          type: 'answer',
          selectedCount: null,
          elapsedMs: roundElapsedRef.current,
        });
      }
    },
    ROUND_TICK_MS,
  );

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
    const resolvedParams = targetCountParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.stats.roundsCorrect,
      state.stats.roundsPlayed,
      state.stats.totalElapsedMs,
      state.stats.totalBudgetMs,
    );

    const raw = buildTargetCountRawResult({
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
    const normalized = normalizeTargetCountResult(raw, context);
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
    void persistTargetCountSession(record, persistSession).then((outcome) => {
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

  const handleAnswer = useCallback(
    (selectedCount: number | null) => {
      const current = stateRef.current;
      if (current.phase !== 'showGrid' || current.paused) {
        return;
      }
      // Feedback must match the answer actually given: a wrong pick plays the
      // wrong sound, not the correct one.
      const correct =
        current.currentRound !== null &&
        selectedCount === current.currentRound.targetCount;
      if (correct) {
        liveAudioHaptics.playSfx('memory-tile-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('memory-tile-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({
        type: 'answer',
        selectedCount,
        elapsedMs: roundElapsedRef.current,
      });
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

  const view = state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

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
          {state.phase === 'showGrid' && state.currentRound !== null ? (
            <View style={styles.section} testID={testId(GAME_ID, 'show-grid')}>
              <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'target-prompt')}>
                Count the {state.currentRound.targetGlyphName} {state.currentRound.targetGlyph}
              </ThemedText>

              <View testID={testId(GAME_ID, 'grid')}>
                <Grid
                  cells={state.currentRound.cells}
                  testIdCell={(i) => testId(GAME_ID, 'cell', String(i))}
                />
              </View>

              <CountOptions
                options={state.currentRound.options}
                onSelect={(value) => handleAnswer(value)}
                disabled={state.paused}
              />
            </View>
          ) : null}

          {state.phase === 'roundResult' && state.currentRound !== null ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.roundCorrect ? 'success' : 'danger'}
                testID={testId(
                  GAME_ID,
                  state.roundCorrect
                    ? 'round-correct'
                    : state.roundOutcome === 'timeout'
                      ? 'round-timeout'
                      : 'round-wrong',
                )}>
                {state.roundCorrect ? 'Correct!' : state.roundOutcome === 'timeout' ? 'Time up' : 'Not quite'}
              </ThemedText>

              <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'actual-count')}>
                There were {state.currentRound.targetCount} {state.currentRound.targetGlyphName}
                {state.currentRound.targetCount === 1 ? '' : 's'}.
              </ThemedText>

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
              (state.stats.roundsPlayed > 0 ? state.stats.roundsCorrect / state.stats.roundsPlayed : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Rounds correct"
            value={`${state.stats.roundsCorrect}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'rounds-correct')}
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
});
