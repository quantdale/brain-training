/**
 * VigilanceScreen — the Sustained Vigilance (Signal Watch) game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Vigilance-specific — the reducer wiring, the stream ticker,
 * the sensory outcome feedback, the scoring/persistence pipeline, and the
 * stimulus stage view.
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
import { StatRow } from '@/components/game-ui';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameSession,
} from '@/components/game-host';

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
      return current.phase === 'stream' && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createVigilanceTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createVigilanceQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? vigilanceParamsFromProfile(state.profile) : null;
  const trials = params?.trials ?? 30;
  const inStream = state.phase === 'stream';

  // ---- Stream ticker: feeds the reducer with active-only elapsed ms; the
  // reducer resolves window timeouts and advances trials at slot end.
  // Pause deactivates the ticker (timers frozen); resume re-schedules from the
  // current active elapsed (paused segments excluded by the lifecycle).
  useGameInterval(
    inStream && !state.paused,
    () => dispatch({ type: 'trial-tick', atActiveMs: session.elapsedMs() }),
    TIMER_TICK_MS,
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
    session,
    xpHook,
    persistSession,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    // `resumeIfPaused()` only acts from 'paused', so a double-tapped Resume
    // (or resume after finish) is dropped instead of throwing.
    if (session.resumeIfPaused()) {
      dispatch({ type: 'resume' });
    }
  }, [session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleGo = useCallback(() => {
    const current = stateRef.current;
    // Double-tap protection: only one response per trial can ever reach the
    // reducer (the outcome is set on the first accepted tap).
    if (current.phase !== 'stream' || current.paused || current.outcome !== null) {
      return;
    }
    liveAudioHaptics.feedback('tap');
    dispatch({ type: 'respond', atActiveMs: session.elapsedMs() });
  }, [session, dispatch]);

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

  const view: 'intro' | 'session' | 'results' =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  const trial = state.stream[state.trialIndex];
  // The digit is visible only during the stimulus-on segment of the slot;
  // after resolution the rest of the slot plays out as blank feedback time.
  const digitVisible =
    inStream && trial !== undefined && !state.paused && state.trialElapsedMs < (params?.stimulusOnMs ?? 0);
  const meanReactionMs = meanOf(state.stats.reactions);

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
      interceptBack={inStream}
      header={
        <ThemedText
          type="subtitle"
          testID={testId(GAME_ID, 'trial', String(state.trialIndex + 1))}>
          Trial {state.trialIndex + 1}/{trials}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inStream && params !== null && trial !== undefined ? (
        <StimulusStage
          digit={digitVisible ? trial.digit : null}
          stopDigit={state.stopDigit}
          outcome={state.outcome}
          responded={state.responded}
          disabled={state.paused}
          onGo={handleGo}
        />
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          gameId={GAME_ID}
          forced={state.forced}
          persistState={state.persistState}
          lastError={state.lastError}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}
