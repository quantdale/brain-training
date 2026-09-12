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
import { AnimatedNumber } from '@/components/ui';
import { StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
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
import type { VigilanceAction } from './types';
import { SCORING_VERSION } from './versions';

/** Stream ticker cadence (ms of wall time between active-ms samples).
 * Aligned to 250ms (greatest common divisor of trial parameters: 750ms stimulus,
 * 500ms blank, 1000/1250ms slots). Avoids flooding the UI event queue with 10Hz
 * re-renders, enabling accessibility inspections and saving CPU/battery. */
const TIMER_TICK_MS = 250;
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
      // Rating pipeline reads the final computed challenge from the record
      // difficulty, not the SDK baseline profile (006r adaptive contract).
      difficulty: { ...state.profile, challengeRating },
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistVigilanceSession(record, persistSession).then((outcome) => {
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
    // Feedback follows the authoritative trial outcome, not the tap's
    // optimism: the reducer owns the response-window guard, so resolve the
    // tap through it first. A tap past the window is a no-op here (the
    // pending tick owns the miss resolution) and must stay silent — sounding
    // or showing success for a trial that scores a miss is the Campaign 023
    // late-tap mismatch. No timing logic is duplicated: this is the same
    // pure transition the dispatch below commits. The verdict UI and the
    // outcome sound (effect below) both read the resolved `outcome`.
    const action: VigilanceAction = { type: 'respond', atActiveMs: session.elapsedMs() };
    const next = vigilanceGameReducer(current, action);
    dispatch(action);
    if (next === current) {
      return;
    }
    liveAudioHaptics.feedback('tap');
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
  // The digit is visible only until the trial resolves: an in-window GO tap
  // (or the deadline) ends the stimulus immediately and the rest of the slot
  // plays out as blank feedback time. The Campaign 023 audit found the digit
  // lingering after an early tap because visibility only tracked the
  // stimulus-on segment; gating on the reducer's authoritative `outcome`
  // (never on the tap) hides it at the resolution instant.
  const digitVisible =
    inStream &&
    trial !== undefined &&
    !state.paused &&
    state.outcome === null &&
    state.trialElapsedMs < (params?.stimulusOnMs ?? 0);
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
      roundProgress={{
        value: state.phase === 'results' ? trials : Math.min(state.trialIndex + 1, trials),
        total: trials,
      }}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inStream && params !== null && trial !== undefined ? (
        <>
          {/* Live score: count-up readout beside the board. The GameHost
          `score` prop above is untouched (orchestrator-owned HUD); this strip
          animates inside `AnimatedNumber` only, so the 250 ms ticker never
          reflows input layout. */}
          <View
            style={styles.scoreRow}
            accessibilityLabel={`Score ${state.stats.score}`}>
            <ThemedText type="caption" themeColor="textSecondary">
              Score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeral"
              testID={testId(GAME_ID, 'score-live')}
            />
          </View>
          <StimulusStage
            digit={digitVisible ? trial.digit : null}
            stopDigit={state.stopDigit}
            outcome={state.outcome}
            responded={state.responded}
            disabled={state.paused}
            onGo={handleGo}
          />
        </>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          reward={{
            xp: state.authoritativeXp ?? state.xp,
            coins: state.authoritativeCurrency ?? 0,
          }}
          gameId={GAME_ID}
          forced={state.forced}
          persistState={state.persistState}
          lastError={state.lastError}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          {/* Count-up final score beside the existing rows; StatRows stay untouched. */}
          <View
            style={styles.scoreHero}
            accessibilityLabel={`Final score ${state.stats.score}`}>
            <ThemedText type="caption" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              testID={testId(GAME_ID, 'score-animated')}
            />
          </View>
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

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  scoreHero: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
