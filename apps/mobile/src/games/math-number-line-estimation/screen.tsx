/**
 * NumberLineScreen — the Number Line Estimation game.
 *
 * Renders a pure state machine (`numberLineGameReducer`) and owns the side
 * effects: the per-round budget ticker (active-only elapsed ms from the SDK
 * `SessionLifecycle`, mirroring math-fast-math), auto-pause on backgrounding,
 * the tutorial, the dev-only QA panel, and result persistence.
 *
 * Timing contract (constitution §20): the reducer never reads a clock; ticks
 * and estimates carry `atActiveMs` from the lifecycle, so paused time is
 * excluded from both the round budget and any scoring decision — pausing can
 * never buy or lose time.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
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

import { GameButton } from './components/button';
import { NumberLine } from './components/number-line';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  numberLineParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createNumberLineQaForceStateHooks,
  createNumberLineTutorialLifecycle,
} from './hooks';
import { numberLineGameReducer } from './reducer';
import { normalizeNumberLineResult } from './scoring';
import {
  buildNumberLineRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistNumberLineSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialNumberLineState } from './types';
import { SCORING_VERSION } from './versions';

/** Budget ticker cadence (ms of wall time between active-ms samples). */
const TIMER_TICK_MS = 250;

export interface NumberLineScreenProps {
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
  /**
   * Injectable playfield width for deterministic geometry in tests; when
   * omitted the line measures itself via onLayout (production path).
   */
  numberLineWidth?: number;
}

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function NumberLineScreen(props: NumberLineScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
    numberLineWidth,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    numberLineGameReducer,
    undefined,
    createInitialNumberLineState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createNumberLineTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createNumberLineQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? numberLineParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 10;
  const inSession = state.phase === 'estimating' || state.phase === 'feedback';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Per-round budget ticker: feeds the reducer with active-only elapsed
  // ms; the reducer transitions to `timeout` when the budget is crossed.
  // Pause cancels the ticker (timers frozen); resume re-schedules from the
  // current active elapsed (paused segments excluded by the lifecycle).
  useEffect(() => {
    if (state.phase !== 'estimating' || state.paused || state.roundBudgetMs <= 0) {
      return;
    }
    const timer = setInterval(() => {
      const activeMs = lifecycleRef.current?.elapsedMs() ?? 0;
      dispatch({ type: 'round-tick', atActiveMs: activeMs });
    }, TIMER_TICK_MS);
    return () => clearInterval(timer);
  }, [state.phase, state.paused, state.roundIndex, state.roundBudgetMs, dispatch]);

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
    const resolvedParams = numberLineParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.tolerancePct);

    const raw = buildNumberLineRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      finalTolerancePct: state.tolerancePct,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeNumberLineResult(raw, context);
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
    void persistNumberLineSession(record, persistSession).then((outcome) => {
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
    state.tolerancePct,
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
    if (!(current.phase === 'estimating' || current.phase === 'feedback') || current.paused) {
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

  const handleEstimate = useCallback(
    (value: number) => {
      const current = stateRef.current;
      // Double-tap protection: only one estimate per round can ever reach the
      // reducer (the phase flips to `feedback` on the first).
      if (current.phase !== 'estimating' || current.paused || current.round === null) {
        return;
      }
      liveAudioHaptics.feedback('tap');
      dispatch({ type: 'estimate', value, atActiveMs: lifecycleRef.current?.elapsedMs() ?? 0 });
    },
    [dispatch],
  );

  // ---- Sensory outcome feedback via canonical events (correct/wrong). The
  // resolution itself is pure reducer logic; this effect only sonifies it.
  // Two literal calls (catalog convention): the sensory scanner verifies
  // literal sound names, so conditional expressions are not used here.
  useEffect(() => {
    if (state.phase !== 'feedback' || state.outcome === null) {
      return;
    }
    if (state.outcome === 'hit') {
      liveAudioHaptics.feedback('correct');
    } else {
      liveAudioHaptics.feedback('wrong');
    }
  }, [state.phase, state.outcome]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'next-round', startActiveMs: lifecycleRef.current?.elapsedMs() ?? 0 });
  }, [dispatch]);

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

  const round = state.round;
  const secondsLeft =
    state.phase === 'estimating'
      ? Math.max(0, Math.ceil((state.roundBudgetMs - state.roundElapsedMs) / 1000))
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

        {inSession && round !== null ? (
          <View style={styles.section}>
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

            {state.phase === 'estimating' ? (
              <>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'prompt')}>
                  Where does the flag sit?
                </ThemedText>
                <ThemedText
                  type="caption"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, 'round-time')}>
                  {secondsLeft}s left
                </ThemedText>
                <NumberLine
                  lineMin={round.lineMin}
                  lineMax={round.lineMax}
                  target={round.target}
                  onEstimate={handleEstimate}
                  disabled={state.paused}
                  width={numberLineWidth}
                />
              </>
            ) : null}

            {state.phase === 'feedback' ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.outcome === 'hit' ? 'success' : 'danger'}
                  testID={testId(GAME_ID, `round-${state.outcome ?? 'miss'}`)}>
                  {state.outcome === 'hit'
                    ? 'Hit!'
                    : state.outcome === 'miss'
                      ? 'Too far off'
                      : "Time's up"}
                </ThemedText>
                <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'reveal')}>
                  The flag was at {round.target}.
                  {state.estimateValue !== null ? ` You tapped ${state.estimateValue}.` : ''}
                </ThemedText>
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
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
              label="Hits"
              value={`${state.stats.roundsHit}/${state.stats.roundsPlayed}`}
              testID={testId(GAME_ID, 'hits')}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, 'best-streak')}
            />
            <StatRow
              label="Best closeness"
              value={`${Math.round(state.stats.bestCloseness * 100)}%`}
              testID={testId(GAME_ID, 'best-closeness')}
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
