/**
 * SpeedColorMatchScreen — the Speed Color Match game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Speed-Color-Match-specific — the reducer wiring, the stimulus
 * auto-show + timeout pacing, the scoring/persistence pipeline, and the
 * swatch/response view.
 *
 * Timing contract (constitution §20): reaction times are measured with the
 * injected monotonic `Clock` (`trialShownAtMs` → tap), never wall-clock time,
 * so clock jumps cannot distort a measured reaction. Pausing re-baselines the
 * live trial's window on resume, so paused time never counts against the
 * player.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  isDevBuild,
  liveAudioHaptics,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { pipelineXpRatingHook } from '@/rating/xp-hook';
import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { ThemedText } from '@/components/themed-text';
import { AnimatedNumber } from '@/components/ui';
import { GameButton, StatRow } from '@/components/game-ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MinTouchTarget, Motion } from '@/theme/tokens';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameDeadlineTimeout,
  useGameSession,
} from '@/components/game-host';

import { ColorButtonGrid } from './components/color-button';
import { QaPanel } from './components/qa-panel';
import { ColorSwatch } from './components/swatch';
import { Tutorial } from './components/tutorial';
import {
  speedColorMatchParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSpeedColorMatchQaForceStateHooks,
  createSpeedColorMatchTutorialLifecycle,
} from './hooks';
import { speedColorMatchReducer } from './reducer';
import { normalizeSpeedColorMatchResult } from './scoring';
import {
  buildSpeedColorMatchRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSpeedColorMatchSession,
} from './session';
import type { SessionPersistence } from './session';
import { COLOR_PALETTE, GAME_ID, createInitialSpeedColorMatchState } from './types';
import type { ColorName } from './types';
import { SCORING_VERSION } from './versions';

export interface SpeedColorMatchScreenProps {
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

/** Verdict kinds for the trial cue (reducer outcome + reaction presence). */
type TrialVerdict = 'hit' | 'wrong' | 'missed';

/**
 * TrialVerdictCue — instant multi-channel verdict for the just-resolved trial.
 *
 * Drops speed-round model (dye + glyph badge), not a bottom sheet: fill +
 * verdict border + `✓`/`✕`/`⏱` glyph + a visible label, with the verdict in
 * the accessible name (live region), so a hit never reads like a miss. Fixed
 * width and non-interactive, so showing/clearing it never shifts the
 * surrounding layout or steals taps. The empty slot is decorative.
 */
function TrialVerdictCue({ verdict }: { verdict: TrialVerdict | null }) {
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

  // Verdicts change fill AND boundary AND glyph, never colour alone. The
  // reducer records a wrong tap as `timeout` with a reaction reading set, so
  // the cue maps reaction presence to `wrong` vs `missed` from authoritative
  // state (a tap after the window never resolves, so it never shows a hit).
  const vocabulary =
    verdict === 'hit'
      ? {
          label: 'Hit',
          spoken: 'Last trial: hit',
          glyph: '✓',
          soft: theme.successSoft,
          edge: theme.success,
          badge: theme.success,
          glyphColor: theme.successOn,
          text: 'success' as const,
          testID: 'trial-correct',
        }
      : verdict === 'wrong'
        ? {
            label: 'Wrong',
            spoken: 'Last trial: wrong',
            glyph: '✕',
            soft: theme.dangerSoft,
            edge: theme.danger,
            badge: theme.danger,
            glyphColor: theme.dangerOn,
            text: 'danger' as const,
            testID: 'trial-wrong',
          }
        : {
            label: 'Missed',
            spoken: 'Last trial: missed',
            glyph: '⏱',
            soft: theme.warningSoft,
            edge: theme.warning,
            badge: theme.warning,
            glyphColor: theme.warningOn,
            text: 'warning' as const,
            testID: 'trial-wrong',
          };

  return (
    <View
      testID={testId(GAME_ID, vocabulary.testID)}
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

export default function SpeedColorMatchScreen(props: SpeedColorMatchScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(speedColorMatchReducer, undefined, createInitialSpeedColorMatchState);

  const stateRef = useRef(state);
  const pauseStartedAtRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'trial' || current.phase === 'roundResult') && !current.paused;
    },
    onPause: () => {
      pauseStartedAtRef.current = clock.now();
      dispatch({ type: 'pause' });
    },
  });

  const tutorial = useMemo(() => createSpeedColorMatchTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createSpeedColorMatchQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? speedColorMatchParamsFromProfile(state.profile) : null;
  const stimulusTimeoutMs = params?.stimulusTimeoutMs ?? 4_000;
  const totalTrials = params?.trials ?? 20;
  const inSession = state.phase === 'trial' || state.phase === 'roundResult';
  const isLastTrial = state.trialIndex + 1 >= totalTrials;

  // ---- Auto-show trial when entering trial phase. The shown timestamp is a
  // monotonic clock reading (constitution §20), never wall-clock time.
  useEffect(() => {
    if (state.phase === 'trial' && state.trialShownAtMs === null && !state.paused) {
      dispatch({ type: 'trial-shown', shownAtMs: clock.now() });
    }
  }, [state.phase, state.trialShownAtMs, state.paused, clock]);

  // ---- Stimulus timeout: auto-fail trial on expiry. Scheduled from the
  // monotonic onset (`trialShownAtMs`); pausing deactivates the timer and the
  // deadline helper resumes from the remaining active budget, so paused time
  // never counts against the response window.
  useGameDeadlineTimeout(
    state.phase === 'trial' && !state.paused && state.trialShownAtMs !== null,
    () => dispatch({ type: 'trial-timeout', timedOutAtMs: clock.now() }),
    stimulusTimeoutMs,
    clock,
    `trial:${state.sessionId ?? 'idle'}:${state.trialIndex}`,
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
    const resolvedParams = speedColorMatchParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.incongruentRatio,
    );

    const raw = buildSpeedColorMatchRawResult({
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
    const normalized = normalizeSpeedColorMatchResult(raw, context);
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
    void persistSpeedColorMatchSession(record, persistSession).then((outcome) => {
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
      const pausedMs =
        pauseStartedAtRef.current === null
          ? 0
          : Math.max(0, clock.now() - pauseStartedAtRef.current);
      pauseStartedAtRef.current = null;
      const current = stateRef.current;
      dispatch({ type: 'resume', pausedMs: current.phase === 'trial' ? pausedMs : undefined });
    }
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleTapColor = useCallback(
    (color: ColorName) => {
      const current = stateRef.current;
      if (current.phase !== 'trial' || current.paused || current.trialShownAtMs === null) {
        return;
      }
      const trial = current.trials[current.trialIndex];
      if (!trial) return;

      if (color === trial.swatchColor) {
        liveAudioHaptics.playSfx('memory-tile-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('memory-tile-wrong');
        liveAudioHaptics.haptic('warning');
      }
      // Reaction time = monotonic clock delta from stimulus onset to the tap;
      // wall-clock jumps can never distort a measured reaction.
      dispatch({ type: 'tap-color', color, tappedAtMs: clock.now() });
    },
    [clock, dispatch],
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
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  const view: 'intro' | 'session' | 'results' =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  const currentTrial = state.trials[state.trialIndex] ?? null;

  // Feedback derives from the reducer's authoritative outcome: `correct` is a
  // hit; `timeout` with a reaction reading is a wrong pick (the reducer records
  // a wrong colour as a timeout outcome), and `timeout` without one is a miss.
  // The reducer does not retain the tapped colour, so the wrong pick cannot be
  // re-derived per item; the swatch's visible correct colour plus this cue is
  // the reveal (a per-item wrong-pick mark would require reducer state).
  const trialVerdict: TrialVerdict | null =
    state.currentTrialOutcome === 'correct'
      ? 'hit'
      : state.currentTrialOutcome === 'timeout'
        ? state.currentReactionMs !== null
          ? 'wrong'
          : 'missed'
        : null;

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
      roundProgress={{ value: state.stats.trialsPlayed, total: totalTrials }}
      header={
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'trial', String(state.trialIndex + 1))}>
          Trial {state.trialIndex + 1}/{totalTrials}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession && currentTrial ? (
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
              themeColor="accent"
              testID={testId(GAME_ID, 'score-live')}
            />
          </View>

          {/* The prompt (swatch + instruction) stays mounted while the verdict
          shows; the board below stays mounted too, so a wrong pick and the
          correct colour are on screen in the same frame. */}
          <ColorSwatch
            swatchColor={currentTrial.swatchColor}
            labelColor={currentTrial.labelColor}
            testID={testId(GAME_ID, 'current-swatch')}
          />
          <View style={styles.statusRow}>
            <ThemedText
              type="bodyLarge"
              themeColor="text"
              testID={testId(GAME_ID, 'trial-status')}>
              Tap the matching color!
            </ThemedText>
            <TrialVerdictCue verdict={trialVerdict} />
          </View>
          <ColorButtonGrid
            colors={COLOR_PALETTE}
            onPress={handleTapColor}
            disabled={state.paused || state.phase !== 'trial'}
          />

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              {state.currentReactionMs !== null ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(state.currentReactionMs)}ms
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Timed out
                </ThemedText>
              )}
              <GameButton
                testID={testId(GAME_ID, 'next-trial')}
                label={isLastTrial ? 'See results' : 'Next trial'}
                onPress={() => dispatch({ type: 'next-trial' })}
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
              themeColor="accent"
              testID={testId(GAME_ID, 'score-final')}
            />
          </View>
          <StatRow
            label="Accuracy"
            value={`${Math.round(
              (state.stats.trialsPlayed > 0 ? state.stats.trialsCorrect / state.stats.trialsPlayed : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Trials correct"
            value={`${state.stats.trialsCorrect}/${state.stats.trialsPlayed}`}
            testID={testId(GAME_ID, 'trials-correct')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Avg reaction"
            value={
              state.stats.avgReactionMs > 0 && state.stats.avgReactionMs < Infinity
                ? `${Math.round(state.stats.avgReactionMs)}ms`
                : 'N/A'
            }
            testID={testId(GAME_ID, 'avg-reaction')}
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
    minWidth: 112,
    minHeight: MinTouchTarget,
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
