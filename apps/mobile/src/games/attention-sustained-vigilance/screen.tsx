/**
 * VigilanceScreen — the Sustained Vigilance (Signal Watch) game.
 *
 * Renders a pure state machine (`vigilanceGameReducer`) and owns the side
 * effects: the stream ticker (active-only elapsed ms from the SDK
 * `SessionLifecycle`, mirroring the other timing-sensitive games), auto-pause
 * on backgrounding, the tutorial, the dev-only QA panel, and result
 * persistence.
 *
 * Timing contract (constitution §20): the reducer never reads a clock; ticks
 * and GO taps carry `atActiveMs` from the lifecycle, so paused time is
 * excluded from the response window, the slot cadence, and every reaction
 * time — pausing can never buy or lose time.
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
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { StimulusStage } from './components/stimulus-stage';
import { Tutorial } from './components/tutorial';
import {
  sessionChallengeRating,
  vigilanceParamsFromProfile,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createVigilanceQaForceStateHooks,
  createVigilanceTutorialLifecycle,
} from './hooks';
import { vigilanceGameReducer } from './reducer';
import { meanOf, normalizeVigilanceResult } from './scoring';
import {
  buildSessionRecord,
  buildVigilanceRawResult,
  dbSessionPersister,
  persistVigilanceSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialVigilanceState } from './types';
import { SCORING_VERSION } from './versions';

/** Stream ticker cadence (ms of wall time between active-ms samples). */
const TIMER_TICK_MS = 100;

export interface VigilanceScreenProps {
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

export default function VigilanceScreen(props: VigilanceScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    vigilanceGameReducer,
    undefined,
    createInitialVigilanceState,
  );

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createVigilanceTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createVigilanceQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? vigilanceParamsFromProfile(state.profile) : null;
  const trials = params?.trials ?? 30;
  const inStream = state.phase === 'stream';

  // ---- Stream ticker: feeds the reducer with active-only elapsed ms; the
  // reducer resolves window timeouts and advances trials at slot end.
  // Pause cancels the ticker (timers frozen); resume re-schedules from the
  // current active elapsed (paused segments excluded by the lifecycle).
  useEffect(() => {
    if (state.phase !== 'stream' || state.paused) {
      return;
    }
    const timer = setInterval(() => {
      const activeMs = lifecycleRef.current?.elapsedMs() ?? 0;
      dispatch({ type: 'trial-tick', atActiveMs: activeMs });
    }, TIMER_TICK_MS);
    return () => clearInterval(timer);
  }, [state.phase, state.paused, state.trialIndex, dispatch]);

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
    const resolvedParams = vigilanceParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.responseWindowMs,
    );

    const raw = buildVigilanceRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      finalResponseWindowMs: state.responseWindowMs,
      challengeRating,
      seed: state.seed,
      stopDigit: state.stopDigit,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeVigilanceResult(raw, context);
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
    void persistVigilanceSession(record, persistSession).then((outcome) => {
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
    state.responseWindowMs,
    state.stopDigit,
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
    const lifecycle = lifecycleRef.current;
    // Guard the lifecycle transition itself, not just the reducer state: a
    // rapid double-tap can re-enter before the re-render, and a second strict
    // `pause()` from 'paused' would throw IllegalTransitionError.
    if (current.phase !== 'stream' || current.paused || lifecycle?.status !== 'active') {
      return;
    }
    lifecycle.pause();
    dispatch({ type: 'pause' });
  }, [dispatch]);

  const resumeSession = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    // Mirror of pauseSession: `resume()` is only legal from 'paused', so a
    // double-tapped Resume (or resume after finish) must be dropped instead of
    // throwing and never re-open a finished session.
    if (lifecycle?.status !== 'paused') {
      return;
    }
    lifecycle.resume();
    dispatch({ type: 'resume' });
  }, [dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

  const handleGo = useCallback(() => {
    const current = stateRef.current;
    // Double-tap protection: only one response per trial can ever reach the
    // reducer (the outcome is set on the first accepted tap).
    if (current.phase !== 'stream' || current.paused || current.outcome !== null) {
      return;
    }
    liveAudioHaptics.feedback('tap');
    dispatch({ type: 'respond', atActiveMs: lifecycleRef.current?.elapsedMs() ?? 0 });
  }, [dispatch]);

  // ---- Sensory outcome feedback via canonical events. The resolution itself
  // is pure reducer logic; this effect only sonifies it. Literal calls (catalog
  // convention): the sensory scanner verifies literal sound names, so
  // conditional expressions are not used here.
  useEffect(() => {
    if (state.outcome === null) {
      return;
    }
    if (state.outcome === 'hit') {
      liveAudioHaptics.feedback('correct');
    } else if (state.outcome === 'commission') {
      liveAudioHaptics.feedback('wrong');
    } else if (state.outcome === 'omission') {
      liveAudioHaptics.feedback('failure');
    } else {
      liveAudioHaptics.feedback('success');
    }
  }, [state.outcome]);

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

  const trial = state.stream[state.trialIndex];
  // The digit is visible only during the stimulus-on segment of the slot;
  // after resolution the rest of the slot plays out as blank feedback time.
  const digitVisible =
    inStream && trial !== undefined && !state.paused && state.trialElapsedMs < (params?.stimulusOnMs ?? 0);
  const meanReactionMs = meanOf(state.stats.reactions);

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

        {inStream && params !== null && trial !== undefined ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, 'trial', String(state.trialIndex + 1))}>
                Trial {state.trialIndex + 1}/{trials}
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

            <StimulusStage
              digit={digitVisible ? trial.digit : null}
              stopDigit={state.stopDigit}
              outcome={state.outcome}
              responded={state.responded}
              disabled={state.paused}
              onGo={handleGo}
            />

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
              label="Go hits"
              value={`${state.stats.hits}/${state.stats.hits + state.stats.omissions}`}
              testID={testId(GAME_ID, 'hits')}
            />
            <StatRow
              label="Stop numbers held"
              value={`${state.stats.correctHolds}/${state.stats.correctHolds + state.stats.commissions}`}
              testID={testId(GAME_ID, 'holds')}
            />
            <StatRow
              label="Commissions"
              value={String(state.stats.commissions)}
              testID={testId(GAME_ID, 'commissions')}
            />
            <StatRow
              label="Mean reaction"
              value={meanReactionMs !== null ? `${Math.round(meanReactionMs)} ms` : '—'}
              testID={testId(GAME_ID, 'mean-rt')}
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
      </View>

      {state.paused && inStream ? (
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
