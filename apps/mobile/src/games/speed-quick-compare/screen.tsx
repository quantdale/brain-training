/**
 * QuickCompareScreen — the Quick Compare game.
 *
 * Renders a pure state machine (`quickCompareGameReducer`) and owns the side
 * effects: the per-round window-expiry timer (scheduled against the monotonic
 * `deadlineMs`), the SDK `SessionLifecycle` (start/pause/resume/complete/
 * abandon), auto-pause on backgrounding, the tutorial, the dev-only QA panel,
 * and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the expiry
 * timer; resuming re-schedules expiry with the exact remaining time
 * (`deadlineMs - clock.now()`). The board is covered by the opaque
 * `PauseOverlay` and hidden from the accessibility tree while paused.
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
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './components/button';
import { Comparison } from './components/comparison';
import { Countdown } from './components/countdown';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { sessionChallengeRating, quickCompareParamsFromProfile } from './difficulty';
import { gameDefinition } from './game-definition';
import { createQuickCompareQaForceStateHooks, createQuickCompareTutorialLifecycle } from './hooks';
import { quickCompareGameReducer } from './reducer';
import { normalizeQuickCompareResult } from './scoring';
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
  /** Injectable XP/rating hook; defaults to the shared no-op (Phase 2 real impl). */
  xpHook?: XpRatingHook;
}

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function QuickCompareScreen(props: QuickCompareScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(quickCompareGameReducer, undefined, createInitialQuickCompareState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  /** Window time left when pausing; the resume action re-anchors from it. */
  const pauseRemainingRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
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
  // deadline. Pause cancels the timer; resume re-schedules with the remaining
  // time, so pausing never buys extra time.
  useEffect(() => {
    if (state.phase !== 'active' || state.paused || state.deadlineMs === null) {
      return;
    }
    const remaining = state.deadlineMs - clock.now();
    if (remaining <= 0) {
      dispatch({ type: 'answer-timeout', nowMs: clock.now() });
      return;
    }
    const timer = setTimeout(() => {
      dispatch({ type: 'answer-timeout', nowMs: clock.now() });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.deadlineMs, state.roundIndex, clock, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

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
      difficulty: state.profile,
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistQuickCompareSession(record, persistSession).then((outcome) => {
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
        spawnedAtMs: clock.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (!(current.phase === 'active' || current.phase === 'feedback') || current.paused) {
      return;
    }
    pauseRemainingRef.current =
      current.deadlineMs !== null ? Math.max(0, current.deadlineMs - clock.now()) : 0;
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause' });
  }, [clock, dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({
      type: 'resume',
      nowMs: clock.now(),
      remainingMs: pauseRemainingRef.current,
    });
  }, [clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

  const handleAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'active' || current.paused || current.round === null) {
        return;
      }
      if (current.deadlineMs !== null && clock.now() > current.deadlineMs) {
        return;
      }
      const correct = index === current.round.correctIndex;
      if (correct) {
        liveAudioHaptics.playSfx('correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'answer', index, nowMs: clock.now() });
    },
    [clock, dispatch],
  );

  const handleTimeout = useCallback(() => {
    liveAudioHaptics.playSfx('wrong');
    liveAudioHaptics.haptic('warning');
    dispatch({ type: 'answer-timeout', nowMs: clock.now() });
  }, [clock, dispatch]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'next-round', spawnedAtMs: clock.now() });
  }, [clock, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const level = current.difficulty ?? 'normal';
    const seed = current.seedOverride ?? (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(level, seed);
  }, [startSession, sessionSeed]);

  const handleRestart = handleStart;

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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  const accuracyPct =
    state.stats.roundsTotal > 0
      ? Math.round((state.stats.roundsCorrect / state.stats.roundsTotal) * 100)
      : 0;

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

        {inSession && state.round !== null ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'streak')}>
                Streak {state.stats.streak}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

            {state.phase === 'active' ? (
              <>
                <Countdown
                  deadlineMs={state.deadlineMs ?? clock.now()}
                  windowMs={state.windowMs}
                  clock={clock}
                  testID={testId(GAME_ID, 'countdown')}
                />
                <Comparison
                  round={state.round}
                  selectedIndex={state.selectedIndex}
                  lastVerdict={state.lastVerdict}
                  disabled={false}
                  onSelect={handleAnswer}
                  testID={testId(GAME_ID, 'comparison')}
                />
              </>
            ) : null}

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

            {isDevBuild() ? (
              <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
            ) : null}
          </View>
        ) : null}

        {state.phase === 'results' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'results')}>
            <ThemedText type="title">Session complete</ThemedText>
            <StatRow label="Score" value={String(state.stats.score)} testID={testId(GAME_ID, 'score')} />
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
                state.stats.reactions.length > 0
                  ? `${Math.round(Math.min(...state.stats.reactions))} ms`
                  : '—'
              }
              testID={testId(GAME_ID, 'best-reaction')}
            />
            <StatRow
              label="XP"
              value={String(state.authoritativeXp ?? state.xp)}
              testID={testId(GAME_ID, 'xp')}
            />

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
              <GameButton
                testID={testId(GAME_ID, 'restart')}
                label="Play again"
                onPress={handleRestart}
              />
              <GameButton
                testID={testId(GAME_ID, 'quit')}
                label="Done"
                variant="secondary"
                onPress={quitToLibrary}
              />
            </View>
          </View>
        ) : null}
      </View>

      {state.paused && inSession ? (
        <PauseOverlay onResume={resumeSession} onQuit={quitToLibrary} />
      ) : null}

      {state.tutorialOpen ? (
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
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
