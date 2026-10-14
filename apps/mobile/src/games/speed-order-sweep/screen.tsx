/**
 * OrderSweepScreen — the Order Sweep game (rapid serial ordering variant).
 *
 * GameHost-based slice: shared session lifecycle, auto-pause, tutorial/QA
 * gating, intro/pause/results chrome and the Android back-guard live in
 * `@/components/game-host`; this module keeps only what is Order-Sweep-
 * specific — the reducer wiring, the per-round window-expiry timer
 * (scheduled against the monotonic `deadlineMs`), the board view, and the
 * scoring/persistence pipeline.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the expiry
 * timer; resuming re-schedules expiry with the exact remaining time
 * from the lifecycle's active clock. The board is covered by the opaque shared
 * `PauseOverlay` and hidden from the accessibility tree while paused, so the
 * board cannot be studied during a pause.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import {
  assertDevOnly,
  isDevBuild,
  liveAudioHaptics,
  systemClock,
  testId,
} from '@/sdk';
import type {
  Clock,
  TutorialStore,
  XpRatingHook,
} from '@/sdk';
import { pipelineXpRatingHook } from '@/rating/xp-hook';
import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { ThemedText } from '@/components/themed-text';
import { AnimatedNumber, useSafeBack } from '@/components/ui';
import { StatRow } from '@/components/game-ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Motion } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { GameButton } from './components/button';
import { QaPanel } from './components/qa-panel';
import { RoundWindow } from './components/round-window';
import { TokenGrid } from './components/token-grid';
import { Tutorial } from './components/tutorial';
import {
  orderSweepParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createOrderSweepTutorialLifecycle,
} from './hooks';
import { orderSweepGameReducer } from './reducer';
import { bestOf, meanOf, normalizeOrderSweepResult } from './scoring';
import {
  buildOrderSweepRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistOrderSweepSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialOrderSweepState } from './types';
import type { OrderSweepAction, OrderSweepCueStamp } from './types';
import { SCORING_VERSION } from './versions';

/** Verdict kinds for the tap/round cue. */
type SweepCueVerdict = 'hit' | 'wrong' | 'perfect' | 'cleared' | 'missed';

/**
 * SweepVerdictCue — instant multi-channel verdict for the last tap or round.
 *
 * Drops speed-round model (dye + glyph badge), not a bottom sheet: fill +
 * verdict border + `✓`/`✕`/`⏱` glyph + a visible label, with the verdict in
 * the accessible name (live region), so a hit never reads like a miss. Fixed
 * width and non-interactive, so showing/clearing it never shifts the
 * surrounding layout or steals taps. The empty slot is decorative.
 */
function SweepVerdictCue({ verdict }: { verdict: SweepCueVerdict | null }) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion || verdict === null) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0.6);
    const pop = Animated.timing(scale, {
      toValue: 1,
      duration: Motion.quick,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    pop.start();
    return () => {
      pop.stop();
    };
  }, [reducedMotion, scale, verdict]);

  if (verdict === null) {
    return (
      <View
        style={[styles.cue, styles.cueEmpty, { borderColor: theme.border }]}
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  // Verdicts change fill AND boundary AND glyph, never colour alone. In-play
  // verdicts come from the reducer's `lastVerdict`; round verdicts come from
  // `roundOutcome`, so a tap after the window can never present a hit.
  const vocabulary =
    verdict === 'hit'
      ? {
          label: 'Hit',
          spoken: 'Last tap: hit',
          glyph: '✓',
          soft: theme.successSoft,
          edge: theme.success,
          badge: theme.success,
          glyphColor: theme.successOn,
          text: 'success' as const,
        }
      : verdict === 'wrong'
        ? {
            label: 'Wrong',
            spoken: 'Last tap: wrong',
            glyph: '✕',
            soft: theme.dangerSoft,
            edge: theme.danger,
            badge: theme.danger,
            glyphColor: theme.dangerOn,
            text: 'danger' as const,
          }
        : verdict === 'perfect'
          ? {
              label: 'Perfect',
              spoken: 'Last round: perfect',
              glyph: '✓',
              soft: theme.successSoft,
              edge: theme.success,
              badge: theme.success,
              glyphColor: theme.successOn,
              text: 'success' as const,
            }
          : verdict === 'cleared'
            ? {
                label: 'Cleared',
                spoken: 'Last round: cleared',
                glyph: '✓',
                soft: theme.successSoft,
                edge: theme.success,
                badge: theme.success,
                glyphColor: theme.successOn,
                text: 'success' as const,
              }
            : {
                label: 'Missed',
                spoken: 'Last round: missed',
                glyph: '⏱',
                soft: theme.warningSoft,
                edge: theme.warning,
                badge: theme.warning,
                glyphColor: theme.warningOn,
                text: 'warning' as const,
              };

  return (
    <View
      testID={testId(GAME_ID, 'verdict')}
      style={[
        styles.cue,
        { backgroundColor: vocabulary.soft, borderColor: vocabulary.edge },
      ]}
      accessible
      accessibilityLabel={vocabulary.spoken}
      accessibilityLiveRegion="polite">
      <Animated.View
        style={[
          styles.cueBadge,
          { backgroundColor: vocabulary.badge, transform: [{ scale }] },
        ]}
        importantForAccessibility="no-hide-descendants">
        <ThemedText
          type="headline"
          style={{ color: vocabulary.glyphColor }}
          allowFontScaling={false}>
          {vocabulary.glyph}
        </ThemedText>
      </Animated.View>
      <ThemedText type="smallBold" themeColor={vocabulary.text}>
        {vocabulary.label}
      </ThemedText>
    </View>
  );
}

export interface OrderSweepScreenProps {
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

export default function OrderSweepScreen(props: OrderSweepScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const goBack = useSafeBack('/games');
  const [state, reactDispatch] = useReducer(
    orderSweepGameReducer,
    undefined,
    createInitialOrderSweepState,
  );

  const stateRef = useRef(state);
  // Every number is visible: distinct rapid clears are valid, while accepted
  // transitions are claimed before React commits and cleared repeats ignored.
  const dispatch = useCallback((action: OrderSweepAction) => {
    const current = stateRef.current;
    const next = orderSweepGameReducer(current, action);
    if (next === current) return null;
    stateRef.current = next;
    reactDispatch(action);
    return next;
  }, []);
  const cue = useMemo<OrderSweepCueStamp>(() => ({ sessionId: state.sessionId, roundIndex: state.roundIndex, inputEpoch: state.inputEpoch }), [state.sessionId, state.roundIndex, state.inputEpoch]);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  // Active and round-result phases pause (result has no running window but a
  // pause must still cover it per the phase machine).
  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'active' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });
  const readActiveTime = session.elapsedMs;
  const readStatus = session.status;
  const activeClock = useMemo<Clock>(() => ({ now: readActiveTime }), [readActiveTime]);

  const tutorial = useMemo(
    () => createOrderSweepTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const forceWin = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-win' }); }, [dispatch]);
  const forceLose = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-lose' }); }, [dispatch]);

  const params =
    state.profile !== null ? orderSweepParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'active' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Window expiry: one timer per round, scheduled from the monotonic
  // deadline. Pause deactivates the timer; resume re-schedules with the
  // remaining time (deadline - now), so pausing never buys extra time. A
  // 0 ms remainder fires on the next timer advance instead of synchronously
  // during render/effect scheduling.
  useEffect(() => {
    if (state.phase !== 'active' || state.paused || state.deadlineMs === null) return;
    const deadlineMs = state.deadlineMs;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const current = stateRef.current;
      if (stopped || readStatus() !== 'active' || current.paused || current.sessionId !== cue.sessionId || current.roundIndex !== cue.roundIndex || current.inputEpoch !== cue.inputEpoch) return;
      const nowMs = readActiveTime();
      const remainingMs = deadlineMs - nowMs;
      if (remainingMs > 0) timer = setTimeout(expire, remainingMs);
      else dispatch({ type: 'round-expired', nowMs, cue });
    };
    timer = setTimeout(expire, Math.max(0, deadlineMs - readActiveTime()));
    return () => { stopped = true; clearTimeout(timer); };
  }, [state.phase, state.paused, state.deadlineMs, cue, readActiveTime, readStatus, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial, dispatch]);

  // ---- Round outcome feedback (canonical feedback events only). Keyed by
  // roundIndex too, so consecutive rounds with the same outcome still sting.
  useEffect(() => {
    if (state.roundOutcome === 'perfect' || state.roundOutcome === 'cleared') {
      liveAudioHaptics.feedback('success');
    } else if (state.roundOutcome === 'expired') {
      liveAudioHaptics.feedback('failure');
    }
  }, [state.roundOutcome, state.roundIndex]);

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
    const resolvedParams = orderSweepParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.windowMs);

    const raw = buildOrderSweepRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      finalWindowMs: state.windowMs,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeOrderSweepResult(raw, context);
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
    void persistOrderSweepSession(record, persistSession).then((outcome) => {
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
    dispatch,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    const nowMs = readActiveTime();
    const remainingMs = Math.max(0, (stateRef.current.deadlineMs ?? nowMs) - nowMs);
    if (session.resumeIfPaused()) {
      dispatch({
        type: 'resume',
        nowMs,
        remainingMs,
      });
    }
  }, [session, readActiveTime, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    goBack();
  }, [session, goBack]);

  const handleTokenTap = useCallback(
    (tokenId: number) => {
      const current = stateRef.current;
      if (current.phase !== 'active' || current.paused || readStatus() !== 'active' || current.inputEpoch !== cue.inputEpoch) {
        return;
      }
      const nowMs = readActiveTime();
      if (current.deadlineMs !== null && nowMs > current.deadlineMs) {
        dispatch({ type: 'round-expired', nowMs, cue });
        return;
      }
      // Per-tap feedback matches the answer actually given; the round-level
      // success/failure sting plays via the roundOutcome effect.
      const next = dispatch({ type: 'tap', tokenId, nowMs, cue });
      if (next !== null && next.lastVerdict !== null) liveAudioHaptics.feedback(next.lastVerdict);
    },
    [readActiveTime, readStatus, cue, dispatch],
  );

  const handleNextRound = useCallback(() => {
    if (readStatus() !== 'active') return;
    dispatch({ type: 'next-round', roundStartedAtMs: readActiveTime(), cue });
  }, [readActiveTime, readStatus, cue, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const status = readStatus();
    if ((current.phase !== 'intro' && current.phase !== 'results') || current.inputEpoch !== cue.inputEpoch || (status !== null && status !== 'completed' && status !== 'abandoned')) return;
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    const identity = session.begin();
    dispatch({
      type: 'start-session',
      seed,
      sessionId: identity.sessionId,
      startedAtMs: identity.startedAtMs,
      roundStartedAtMs: readActiveTime(),
    });
  }, [session, sessionSeed, readActiveTime, readStatus, cue, dispatch]);

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

  const board = state.phase === 'active' || state.phase === 'roundResult' ? state.round : null;

  // Feedback derives from the reducer's authoritative state: in-play verdicts
  // come from `lastVerdict`; the round card's verdict comes from
  // `roundOutcome`, so a tap that the window rejected can never present a hit.
  // The mechanic never hides the answer, so there is no per-item reveal to
  // pair: the board itself stays visible through the round verdict.
  const sweepVerdict: SweepCueVerdict | null =
    state.phase === 'roundResult'
      ? state.roundOutcome === 'expired'
        ? 'missed'
        : state.roundOutcome === 'perfect'
          ? 'perfect'
          : state.roundOutcome === 'cleared'
            ? 'cleared'
            : null
      : state.lastVerdict === 'correct'
        ? 'hit'
        : state.lastVerdict;

  const view: GameHostView =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={view}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) =>
        dispatch({ type: 'select-difficulty', level })
      }
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      roundProgress={{ value: state.stats.roundsPlayed, total: rounds }}
      header={
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))} themeColor="stageInk">
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={<QaPanel onForceWin={forceWin} onForceLose={forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {/* Live score: count-up readout visible in every session phase. The
          GameHost `score` prop above is untouched (orchestrator-owned HUD). */}
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

          {/* The prompt and the board stay mounted while feedback shows: the
          round verdict must never cover the stem. The cue remounts per tap /
          per round so its pop replays; it is fixed-size and inert. */}
          <View style={styles.statusRow}>
            <ThemedText
              type="bodyLarge"
              themeColor="text"
              testID={testId(GAME_ID, 'active-status')}>
              Tap the smallest number!
            </ThemedText>
            <SweepVerdictCue
              key={
                state.phase === 'roundResult'
                  ? `result-${state.roundIndex}`
                  : `tap-${state.clearedCount}-${state.roundWrongTaps}`
              }
              verdict={sweepVerdict}
            />
            <ThemedText
              type="smallBold"
              themeColor={state.stats.streak > 0 ? 'accent' : 'textSecondary'}
              testID={testId(GAME_ID, 'streak')}>
              Streak {state.stats.streak}
            </ThemedText>
          </View>
          {state.phase === 'active' ? (
            <RoundWindow
              deadlineMs={state.deadlineMs ?? 0}
              windowMs={state.windowMs}
              clock={activeClock}
              testID={testId(GAME_ID, 'window')}
            />
          ) : null}
          {board !== null ? (
            <TokenGrid
              round={board}
              clearedCount={state.clearedCount}
              disabled={state.paused || state.phase !== 'active'}
              onTap={handleTokenTap}
              testID={testId(GAME_ID, 'grid')}
            />
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === 'expired' ? 'danger' : 'success'
                }
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === 'expired' ? 'round-failed' : 'round-passed',
                )}>
                {state.roundOutcome === 'perfect'
                  ? 'Perfect sweep!'
                  : state.roundOutcome === 'cleared'
                    ? 'Board cleared'
                    : "Time's up"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.clearedCount}/{board?.order.length ?? 0} swept ·{' '}
                {state.roundWrongTaps} wrong tap{state.roundWrongTaps === 1 ? '' : 's'}
              </ThemedText>
              {state.roundOutcome === 'perfect' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Flawless — the next window shrinks to {state.windowMs} ms.
                </ThemedText>
              ) : state.roundOutcome === 'cleared' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Cleared with mistakes — the window holds at {state.windowMs} ms.
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Sweep the whole board before the bar empties.
                </ThemedText>
              )}
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={handleNextRound}
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
          {/* Animated final score beside the existing rows; StatRows below stay as-is. */}
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
            label="Accuracy"
            value={`${Math.round(
              (state.stats.tokensCleared + state.stats.tokensExpired > 0
                ? state.stats.tokensCleared / (state.stats.tokensCleared + state.stats.tokensExpired)
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Numbers swept"
            value={`${state.stats.tokensCleared}/${state.stats.tokensCleared + state.stats.tokensExpired}`}
            testID={testId(GAME_ID, 'tokens-cleared')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Perfect sweeps"
            value={`${state.stats.perfectRounds}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'perfect-rounds')}
          />
          <StatRow
            label="Best pace"
            value={
              state.stats.gaps.length > 0 && bestOf(state.stats.gaps) !== null
                ? `${Math.round(bestOf(state.stats.gaps) as number)} ms / number`
                : '—'
            }
            testID={testId(GAME_ID, 'best-gap')}
          />
          <StatRow
            label="Mean pace"
            value={
              meanOf(state.stats.gaps) !== null
                ? `${Math.round(meanOf(state.stats.gaps) as number)} ms / number`
                : '—'
            }
            testID={testId(GAME_ID, 'mean-gap')}
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
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
  cue: {
    minWidth: 104,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  cueEmpty: {
    backgroundColor: 'transparent',
  },
  cueBadge: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
