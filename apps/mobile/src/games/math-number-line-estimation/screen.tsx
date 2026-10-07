/**
 * NumberLineScreen — the Number Line Estimation game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Number-Line-specific — the reducer wiring, the per-round budget
 * ticker (active-only elapsed ms from the shared lifecycle, mirroring
 * math-fast-math), the scoring/persistence pipeline, and the playfield view.
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
import { StyleSheet, View } from 'react-native';

import { isDevBuild, liveAudioHaptics, systemClock, testId } from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { pipelineXpRatingHook } from '@/rating/xp-hook';
import { ThemedText } from '@/components/themed-text';
import { AnimatedNumber, useSafeBack } from '@/components/ui';
import { GameButton, StatRow } from '@/components/game-ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameSession,
} from '@/components/game-host';

import { NumberLine } from './components/number-line';
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
  /** Injectable XP/rating hook; defaults to the pipeline-backed hook for optimistic parity. */
  xpHook?: XpRatingHook;
  /**
   * Injectable playfield width for deterministic geometry in tests; when
   * omitted the line measures itself via onLayout (production path).
   */
  numberLineWidth?: number;
}

export default function NumberLineScreen(props: NumberLineScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
    numberLineWidth,
  } = props;
  const goBack = useSafeBack('/games');
  const [state, dispatch] = useReducer(
    numberLineGameReducer,
    undefined,
    createInitialNumberLineState,
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
      return (current.phase === 'estimating' || current.phase === 'feedback') && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
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
  // current active elapsed (paused segments excluded by the lifecycle). Every
  // round entry passes through a phase transition, so keying on the active
  // flag alone restarts the ticker per round exactly as before.
  useGameInterval(
    state.phase === 'estimating' && !state.paused && state.roundBudgetMs > 0,
    () => dispatch({ type: 'round-tick', atActiveMs: session.elapsedMs() }),
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
    // Rating deltas are intentionally empty optimistically; screens render
    // deltas only from the authoritative completionOutcome.
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
    void persistNumberLineSession(record, persistSession).then((outcome) => {
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
    state.tolerancePct,
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
    goBack();
  }, [session, goBack]);

  const handleEstimate = useCallback(
    (value: number) => {
      const current = stateRef.current;
      // Double-tap protection: only one estimate per round can ever reach the
      // reducer (the phase flips to `feedback` on the first).
      if (current.phase !== 'estimating' || current.paused || current.round === null) {
        return;
      }
      liveAudioHaptics.feedback('tap');
      dispatch({ type: 'estimate', value, atActiveMs: session.elapsedMs() });
    },
    [session, dispatch],
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
    dispatch({ type: 'next-round', startActiveMs: session.elapsedMs() });
  }, [session, dispatch]);

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

  const theme = useTheme();
  const round = state.round;
  const secondsLeft =
    state.phase === 'estimating'
      ? Math.max(0, Math.ceil((state.roundBudgetMs - state.roundElapsedMs) / 1000))
      : 0;
  // Verdict vocabulary for the resolved frame, derived from the reducer's
  // outcome (never the tap handler's guess): soft fill + glyph badge + words.
  // The badge is decorative for assistive tech; the line's accessible name
  // carries the verdict.
  const verdict =
    state.outcome === 'hit'
      ? {
          title: 'Hit!',
          glyph: '✓',
          soft: theme.successSoft,
          edge: theme.success,
          badge: theme.success,
          glyphColor: theme.successOn,
          text: 'success' as const,
          headline: 'round-hit',
        }
      : state.outcome === 'miss'
        ? {
            title: 'Too far off',
            glyph: '✕',
            soft: theme.dangerSoft,
            edge: theme.danger,
            badge: theme.danger,
            glyphColor: theme.dangerOn,
            text: 'danger' as const,
            headline: 'round-miss',
          }
        : {
            title: "Time's up",
            glyph: '⏱',
            soft: theme.warningSoft,
            edge: theme.warning,
            badge: theme.warning,
            glyphColor: theme.warningOn,
            text: 'warning' as const,
            headline: 'round-timeout',
          };

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={inSession ? 'session' : state.phase === 'results' ? 'results' : 'intro'}
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
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))} themeColor="stageInk">
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession && round !== null ? (
        <>
          {/* Live score: count-up readout beside the HUD score in every session
          phase, so a hit reads as movement. The GameHost `score` prop above
          is untouched (orchestrator-owned HUD). */}
          <View style={styles.scoreStrip}>
            <ThemedText type="small" themeColor="textSecondary">
              Score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeral"
              themeColor="text"
              testID={testId(GAME_ID, 'score-live')}
            />
          </View>
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
            <View
              style={[styles.feedbackCard, { backgroundColor: verdict.soft, borderColor: verdict.edge }]}
              testID={testId(GAME_ID, 'round-result')}>
              <View
                style={[styles.badge, { backgroundColor: verdict.badge }]}
                importantForAccessibility="no-hide-descendants">
                <ThemedText type="headline" style={{ color: verdict.glyphColor }} allowFontScaling={false}>
                  {verdict.glyph}
                </ThemedText>
              </View>
              <ThemedText
                type="headline"
                themeColor={verdict.text}
                testID={testId(GAME_ID, verdict.headline)}>
                {verdict.title}
              </ThemedText>
              {/* The prompt stays mounted while feedback shows; the resolved
              line below keeps the target (flag) visible next to the guess. */}
              <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'prompt')}>
                Where does the flag sit?
              </ThemedText>
              <NumberLine
                lineMin={round.lineMin}
                lineMax={round.lineMax}
                target={round.target}
                onEstimate={handleEstimate}
                disabled
                estimate={state.estimateValue}
                outcome={state.outcome}
                width={numberLineWidth}
              />
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
          persistState={state.persistState}
          lastError={state.lastError}
          forced={state.forced}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          {/* Count-up final score beside the existing rows; StatRows below stay as-is. */}
          <View style={styles.finalScore}>
            <ThemedText type="small" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              themeColor="text"
              testID={testId(GAME_ID, 'score-final')}
            />
          </View>
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  // Verdict panel: soft verdict-family fill with a verdict border, so the
  // resolved frame reads by fill AND boundary AND the badge glyph.
  feedbackCard: {
    gap: Spacing.three,
    alignItems: 'center',
    borderRadius: Radii.large,
    borderWidth: 2,
    padding: Spacing.four,
  },
  // Opaque verdict badge: the icon/shape half of the verdict channel.
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
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
