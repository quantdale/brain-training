/**
 * TargetCountScreen — the Target Count game (selective attention + numerosity).
 *
 * Renders a pure state machine (`targetCountGameReducer`) and owns the side
 * effects: the SDK `SessionLifecycle` (start/pause/resume/complete/abandon),
 * auto-pause on backgrounding, the per-round timer, the tutorial, the dev-only
 * QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and the per-round
 * countdown; resuming continues the remaining round window (freeze-and-continue,
 * so pausing can never stretch the window or reset elapsed time). The board is
 * covered by the opaque `PauseOverlay` and hidden from the accessibility tree
 * while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  SessionLifecycle,
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { DifficultySelector, SessionHeader, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { Grid } from './components/grid';
import { CountOptions } from './components/count-options';
import { GameButton } from './components/button';
import { PauseOverlay } from './components/pause-overlay';
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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

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

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  // Accumulated ACTIVE (non-paused) time in the current round; reset when a new
  // round begins so pause/resume freezes and continues the remaining window
  // instead of restarting it (and the speed bonus stays honest).
  const roundElapsedRef = useRef(0);
  const roundElapsedRoundRef = useRef(-1);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
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
  // window or reset the elapsed time the speed bonus is computed from (mirrors
  // memory's study-tick freeze semantics).
  useEffect(() => {
    if (state.phase !== 'showGrid' || state.paused) {
      return undefined;
    }
    const interval = setInterval(() => {
      roundElapsedRef.current = Math.min(
        roundTimeMs,
        roundElapsedRef.current + ROUND_TICK_MS,
      );
      if (roundElapsedRef.current >= roundTimeMs) {
        clearInterval(interval);
        dispatch({
          type: 'answer',
          selectedCount: null,
          elapsedMs: roundElapsedRef.current,
        });
      }
    }, ROUND_TICK_MS);
    return () => clearInterval(interval);
  }, [state.phase, state.paused, roundTimeMs, dispatch]);

  // ---- Session finalization: complete the lifecycle, run the SDK scoring
  // pipeline (raw → normalized → XP hook), and persist atomically.
  useEffect(() => {
    if (
      state.phase !== 'results' ||
      finalizedRef.current ||
      state.profile === null ||
      state.sessionId === null ||
      state.startedAtMs === null
    ) {
      return;
    }
    finalizedRef.current = true;

    const lifecycle = lifecycleRef.current;
    if (
      lifecycle !== null &&
      lifecycle.status !== 'completed' &&
      lifecycle.status !== 'abandoned'
    ) {
      lifecycle.complete();
    }
    const activeDurationMs = lifecycle?.elapsedMs() ?? 0;
    const pausedDurationMs = lifecycle?.pausedDurationMs() ?? 0;
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
    xpHook,
    persistSession,
  ]);

  // ---- Session controls.
  const startSession = useCallback(
    (level: DifficultyLevel, seed: string) => {
      finalizedRef.current = false;
      lifecycleRef.current = new SessionLifecycle({ clock });
      lifecycleRef.current.start();
      dispatch({
        type: 'start-session',
        seed,
        sessionId: newSessionId(),
        startedAtMs: Date.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (
      !(current.phase === 'showGrid' || current.phase === 'roundResult') ||
      current.paused
    ) {
      return;
    }
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause' });
  }, [dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: 'resume' });
  }, [dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

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
    const level = current.difficulty ?? 'normal';
    const seed = current.seedOverride ?? (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(level, seed);
  }, [startSession, sessionSeed]);

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

  // ---- Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  return (
    <View style={styles.screen} testID={testId(GAME_ID, 'screen')}>
      <View
        style={styles.content}
        importantForAccessibility={state.paused ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={state.paused}
        accessible={false}>
        {state.phase === 'intro' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'intro')}>
            <ThemedText type="small" themeColor="textSecondary">
              {gameDefinition.description}
            </ThemedText>

            <ThemedText type="caption" themeColor="textSecondary">
              Difficulty
            </ThemedText>
            <DifficultySelector
              gameId={GAME_ID}
              selected={state.difficulty}
              onSelect={(level) => dispatch({ type: 'select-difficulty', level })}
            />

            <View style={styles.buttonRow}>
              <GameButton testID={testId(GAME_ID, 'start')} label="Start" onPress={handleStart} />
              <GameButton
                testID={testId(GAME_ID, 'help')}
                label="How to play"
                variant="secondary"
                onPress={openTutorial}
              />
            </View>

            {isDevBuild() ? (
              <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
            ) : null}
          </View>
        ) : null}

        {state.phase === 'showGrid' && state.currentRound !== null ? (
          <View style={styles.section} testID={testId(GAME_ID, 'show-grid')}>
            <SessionHeader>
              <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'score')}>
                Score {state.stats.score}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

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
                state.roundCorrect ? 'round-correct' : state.roundOutcome === 'timeout' ? 'round-timeout' : 'round-wrong',
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

        {state.phase === 'results' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'results')}>
            <ThemedText type="title">Session complete</ThemedText>
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
            <StatRow label="XP" value={String(state.authoritativeXp ?? state.xp)} testID={testId(GAME_ID, 'xp')} />

            {state.persistState === 'failed' ? (
              <ThemedText
                type="small"
                themeColor="danger"
                testID={testId(GAME_ID, 'persist-error')}>
                Your session could not be saved. {state.lastError ?? ''}
              </ThemedText>
            ) : null}
            {state.forced ? (
              <ThemedText
                type="caption"
                themeColor="warning"
                testID={testId(GAME_ID, 'forced-badge')}>
                QA-forced session
              </ThemedText>
            ) : null}

            <View style={styles.buttonRow}>
              <GameButton testID={testId(GAME_ID, 'restart')} label="Play again" onPress={handleRestart} />
              <GameButton
                testID={testId(GAME_ID, 'quit')}
                label="Done"
                variant="secondary"
                onPress={quitToLibrary}
              />
            </View>
          </View>
        ) : null}

        {isDevBuild() && inSession ? (
          <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
        ) : null}
      </View>

      {state.paused && inSession ? (
        <PauseOverlay onResume={resumeSession} onQuit={quitToLibrary} />
      ) : null}

      {state.tutorialOpen ? (
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
