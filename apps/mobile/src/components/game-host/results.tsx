/**
 * `<GameResults>` — shared results-view chrome for GameHost-based games
 * (campaign 010, architecture-debt D1; campaign 023 reward moment).
 *
 * Owns the results layout every game duplicated: the outcome headline, an
 * optional game-specific badge slot (e.g. Reaction Time's "ended early"
 * notice), the game's stat rows, the persistence-failure error line, the
 * bounded reward, workout continuation/completion, and the Play again / Done
 * actions. Games pass their stat rows as children.
 *
 * Campaign 023: games may pass `reward` with the authoritative XP/coin
 * outcome. When persistence succeeds, the results view plays a bounded
 * entrance-animated reward card and fires the canonical `reward` feedback
 * event once per completion (sound/haptics resolve through the global
 * sensory service, so mute settings are always respected).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { liveAudioHaptics, testId } from '@/sdk';
import { trackSessionPersist } from '@/sdk/perf';
import type { PerfMeasure } from '@/sdk/perf';
import { ThemedText } from '@/components/themed-text';
import { GameWorldArt } from '@/components/discovery/game-identity';
import { FeedbackCard } from '@/components/shell';
import { performanceBand } from '@/components/shell/format';
import { Card, Confetti, Spark } from '@/components/ui';
import { launchAnimation } from '@/components/ui/motion';
import { GameButton } from '@/components/game-ui';
import { usePrefersReducedMotion } from '@/components/game-ui/use-reduced-motion';
import { Motion, Radii, Spacing } from '@/constants/theme';
import { getGameDefinition } from '@/registry/registry';
import { useTheme } from '@/hooks/use-theme';
import {
  advanceWorkoutForSession,
  type WorkoutSessionAdvanceResult,
} from '@/workout/session-advance';
import { emitWorkoutChanged } from '@/workout/events';
import { useWorkoutSessionLaunch } from '@/workout/session-launch-context';
import { gameHref } from '@/workout/routing';
import type { WorkoutSessionProvenance } from '@/workout/session-provenance';

/** Persistence lifecycle mirrored from the game reducers' `persistState`. */
export type GameResultsPersistState = 'idle' | 'started' | 'succeeded' | 'failed';

/** Authoritative reward outcome shown when the session persists successfully. */
export interface GameResultsReward {
  /** XP paid for this session (authoritative when available). */
  xp?: number;
  /** Currency delta paid for this session, when nonzero. */
  coins?: number;
}

/**
 * Explicit workout actions for the results chrome. Screens that launch from a
 * workout get these automatically from the route's launch context; this prop
 * is the deterministic injection seam for tests and future non-route hosts.
 */
export interface GameResultsWorkoutActions {
  /** Next workout leg to launch, or null when there is none left. */
  nextGameId: string | null;
  /** Optional exact ownership tuple for the next leg. */
  nextProvenance?: WorkoutSessionProvenance | null;
  /** Total legs in the workout, used only for completion presentation. */
  totalGames?: number;
  /** Activate Next Game (caller owns navigation). */
  onNextGame: () => void;
  /** True when the workout is finished (completion copy, no Next Game). */
  completed?: boolean;
}

export interface GameResultsProps {
  readonly gameId: string;
  /** Headline; defaults to the performance band when `normalizedResult` is known. */
  readonly title?: string;
  /**
   * Normalized session outcome (0..1) from the game's own result builder.
   * When provided, the artifact headline uses the shared honest band language
   * and celebration is reserved for strong/personal-best outcomes.
   */
  readonly normalizedResult?: number;
  /** Optional game-specific notice rendered directly under the headline. */
  readonly badge?: React.ReactNode;
  /** True when the session ended via a dev-only QA force hook. */
  readonly forced?: boolean;
  readonly persistState?: GameResultsPersistState;
  /** Persistence failure detail (shown alongside the error line). */
  readonly lastError?: string | null;
  /** Authoritative XP/coin outcome for the reward moment. */
  readonly reward?: GameResultsReward;
  /**
   * Workout continuation after a successful persist. Omit to let the chrome
   * resolve it from the route's launch context (in-game workouts).
   */
  readonly workout?: GameResultsWorkoutActions;
  readonly onRestart: () => void;
  readonly onQuit: () => void;
  /** Stat rows (`StatRow`/`ResultRow`). */
  readonly children: React.ReactNode;
}

export function GameResults({
  gameId,
  title,
  normalizedResult,
  badge,
  forced = false,
  persistState = 'idle',
  lastError = null,
  reward,
  workout,
  onRestart,
  onQuit,
  children,
}: GameResultsProps) {
  const theme = useTheme();
  const definition = getGameDefinition(gameId);
  // Dev-only perf seam (campaign 010, debt D4): bracket the session-completion
  // DB write as observed through the persistence lifecycle — from the first
  // render showing 'started' to the terminal 'succeeded'/'failed', or back to
  // 'idle' when a restart supersedes an in-flight write. Includes a little
  // React scheduling slack around the awaited write; unmounting mid-write
  // drops the sample instead of recording a truncated duration.
  const persistMeasureRef = useRef<PerfMeasure | null>(null);
  useEffect(() => {
    if (persistState === 'started') {
      if (persistMeasureRef.current === null) {
        persistMeasureRef.current = trackSessionPersist(gameId);
      }
      return;
    }
    const open = persistMeasureRef.current;
    if (open !== null) {
      persistMeasureRef.current = null;
      open.end({ outcome: persistState === 'idle' ? 'superseded' : persistState });
    }
  }, [persistState, gameId]);

  // ---- Campaign 023 reward moment. The card appears only after the
  // authoritative write succeeds, so the shown XP/coins can never precede (or
  // contradict) persistence. Feedback fires exactly once per completion; the
  // ref re-arms when a restart moves the lifecycle back to idle/started.
  const prefersReducedMotion = usePrefersReducedMotion();
  const entrance = useMemo(() => new Animated.Value(0), []);
  const rewardFiredRef = useRef(false);

  const rewardXp = reward?.xp ?? 0;
  const rewardCoins = reward?.coins ?? 0;
  const showReward =
    persistState === 'succeeded' && reward !== undefined && (rewardXp > 0 || rewardCoins > 0);

  // ---- Campaign 055 honest result logic. The band is derived from the
  // session's own normalized performance when the game provides it; a weak
  // outcome never borrows success colour, copy or confetti. Strong and
  // personal-best outcomes keep the celebration beat.
  const band =
    normalizedResult !== undefined && Number.isFinite(normalizedResult)
      ? performanceBand(normalizedResult)
      : null;
  const headline = title ?? band?.label ?? 'Session complete';
  const strongOutcome =
    band !== null && (band.label === 'Outstanding' || band.label === 'Strong run');
  const weakOutcome = band !== null && !strongOutcome && band.label !== 'Session complete';

  useEffect(() => {
    if (persistState === 'idle' || persistState === 'started') {
      rewardFiredRef.current = false;
      entrance.setValue(0);
      return;
    }
    if (!showReward || rewardFiredRef.current) {
      return;
    }
    rewardFiredRef.current = true;
    // Canonical feedback event: resolves to the reward SFX + success haptic
    // only when the user's sensory settings allow it. Weak outcomes still
    // acknowledge the saved session but never borrow the success sting.
    liveAudioHaptics.feedback(weakOutcome ? 'tap' : 'reward');
    if (prefersReducedMotion) {
      entrance.setValue(1);
      return;
    }
    // 061: launchAnimation stops the driver on unmount (fast Done/Next taps
    // orphan it). Curves and reduced-motion behavior are unchanged.
    return launchAnimation(
      Animated.timing(entrance, {
        toValue: 1,
        duration: Motion.entrance,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    );
  }, [persistState, showReward, prefersReducedMotion, entrance, weakOutcome]);

  const rewardDetail = [
    rewardXp > 0 ? `+${rewardXp} XP` : null,
    rewardCoins > 0 ? `+${rewardCoins} coin${rewardCoins === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  // ---- Workout continuation (frontier audit `in-game-workout-next-leg`).
  // A workout-launched session advances the SAME durable CAS `/results` uses,
  // only after the session itself persisted. The route supplies ownership via
  // the launch context, so the 42 screens inherit this without new props.
  const workoutLaunch = useWorkoutSessionLaunch();
  const launchOwnsThisGame = workoutLaunch !== null && workoutLaunch.gameId === gameId;
  const [derivedAdvance, setDerivedAdvance] =
    useState<WorkoutSessionAdvanceResult | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  // Re-arms on restart (idle/started) so a replayed session resolves fresh
  // navigation from durable state instead of reusing the previous leg's view.
  const advancedLaunchRef = useRef<string | null>(null);

  useEffect(() => {
    if (workout !== undefined || !launchOwnsThisGame) {
      return;
    }
    if (persistState !== 'succeeded') {
      advancedLaunchRef.current = null;
      return;
    }
    const launchKey = `${workoutLaunch.instanceKey}:${workoutLaunch.legIndex}`;
    if (advancedLaunchRef.current === launchKey) {
      return;
    }
    advancedLaunchRef.current = launchKey;

    let cancelled = false;
    void advanceWorkoutForSession({
      gameId,
      workoutProvenance: workoutLaunch,
    })
      .then((result) => {
        if (!cancelled) {
          setDerivedAdvance(result);
        }
        // Home keeps its durable row fresh without a focus event (the /results
        // hook emits the same event after a committed advance).
        if (result.advanced) {
          emitWorkoutChanged();
        }
      })
      .catch((error: unknown) => {
        console.error('[game-results] workout advance failed', error);
        if (!cancelled) {
          setAdvanceError('Workout progress could not be saved');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [persistState, workout, launchOwnsThisGame, workoutLaunch, gameId]);

  const succeeded = persistState === 'succeeded';
  const nextGameId = workout !== undefined
    ? workout.nextGameId
    : succeeded
      ? (derivedAdvance?.nextGameId ?? null)
      : null;
  const nextProvenance = workout?.nextProvenance ?? derivedAdvance?.nextProvenance ?? null;
  const workoutCompleted =
    workout !== undefined
      ? workout.completed === true
      : succeeded && derivedAdvance?.completed === true;
  const showNextGame = succeeded && nextGameId !== null;
  const showWorkoutComplete = succeeded && workoutCompleted && !showNextGame;
  const showAdvanceError =
    succeeded && advanceError !== null && !showNextGame && !showWorkoutComplete;
  const nextGameName = nextGameId ? (getGameDefinition(nextGameId)?.name ?? nextGameId) : null;
  const nextPosition = nextProvenance ? nextProvenance.legIndex + 1 : null;
  const workoutTotalGames =
    workout?.totalGames ??
    derivedAdvance?.instance?.gameIds.length ??
    (workoutCompleted && workoutLaunch ? workoutLaunch.legIndex + 1 : null);
  const completionProgress = workoutTotalGames
    ? `${workoutTotalGames}/${workoutTotalGames} games complete`
    : 'All games complete';
  const nextGameDetail = nextGameName
    ? `${nextGameName}${nextPosition !== null ? ` · Game ${nextPosition}${workoutTotalGames ? ` of ${workoutTotalGames}` : ''}` : ''}`
    : undefined;

  const onNextGame = useCallback(() => {
    if (workout !== undefined) {
      workout.onNextGame();
      return;
    }
    if (derivedAdvance?.nextGameId) {
      router.push(
        gameHref(derivedAdvance.nextGameId, derivedAdvance.nextProvenance),
      );
    }
  }, [workout, derivedAdvance]);

  return (
    <View style={styles.section} testID={testId(gameId, 'results')}>
      {/* One result artifact (campaign 055): the game world and the band
          headline are the event. Facts, reward and actions support it.
          065: the artifact is a polite live region so the headline is
          announced when the results appear (same pattern as /results). */}
      {/* Change 076 (lock section 1): the artifact is the immersive stage —
          charcoal panel, white type, the played board as the still. */}
      <View
        style={[styles.stageArtifact, { backgroundColor: theme.stage, borderColor: theme.stageBorder }]}
        testID={testId(gameId, 'result-artifact')}
        accessibilityLiveRegion="polite">
        {definition ? <GameWorldArt game={definition} size="hero" testID={testId(gameId, 'result-world')} /> : null}
        <View style={styles.resultBody}>
          <ThemedText
            type="resultHeadline"
            themeColor="stageInk"
            testID={testId(gameId, 'result-headline')}>
            {headline}
          </ThemedText>
          {badge}
        </View>
      </View>
      {persistState === 'failed' ? (
        // Review fix: the save-failure notice precedes the facts so an XP
        // row can never read as persisted above its own failure message.
        <ThemedText
          type="small"
          themeColor="danger"
          testID={testId(gameId, 'persist-error')}
          accessibilityLiveRegion="polite">
          Your session could not be saved. {lastError ?? ''}
        </ThemedText>
      ) : null}
      <View style={styles.facts} testID={testId(gameId, 'result-facts')}>
        {children}
      </View>
      {forced ? (
        <ThemedText type="caption" themeColor="warning" testID={testId(gameId, 'forced-badge')}>
          QA-forced session
        </ThemedText>
      ) : null}
      {showWorkoutComplete ? (
        <Card
          variant="outlined"
          tone="successSoft"
          padding="md"
          testID={testId(gameId, 'workout-complete')}
          accessibilityLiveRegion="polite">
          <View style={styles.completionHeader}>
            <Spark size={20} color={theme.successSoftText} />
            <ThemedText type="headline" themeColor="successSoftText">
              Workout complete
            </ThemedText>
          </View>
          <ThemedText type="numeral" themeColor="successSoftText" testID={testId(gameId, 'workout-progress')}>
            {completionProgress}
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="successSoftText">
            This workout is saved. Nice work.
          </ThemedText>
        </Card>
      ) : null}
      {showReward ? (
        <Animated.View
          style={{
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          }}>
          {/* Campaign 026 celebration beat, campaign 055 honesty gate: a
              bounded deterministic burst only after a strong outcome. Weak
              and unknown outcomes get the same saved fact without fanfare. */}
          {strongOutcome ? (
            <Confetti count={14} seed={`reward-${gameId}`} height={180} />
          ) : null}
          <FeedbackCard
            tone={strongOutcome ? 'success' : 'neutral'}
            title={`Reward  ${rewardDetail}`}
            detail="Progress saved"
            testID={testId(gameId, 'reward')}
          />
        </Animated.View>
      ) : null}
      {showNextGame ? (
        <Card variant="outlined" padding="sm" testID={testId(gameId, 'next-context')}>
          <ThemedText type="eyebrow" themeColor="textMuted">
            UP NEXT
          </ThemedText>
          <ThemedText type="label" testID={testId(gameId, 'next-title')}>
            {nextGameName}
          </ThemedText>
          {nextPosition !== null ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Game {nextPosition}{workoutTotalGames ? ` of ${workoutTotalGames}` : ''} · progress saved
            </ThemedText>
          ) : null}
        </Card>
      ) : null}
      {showAdvanceError ? (
        <ThemedText
          type="small"
          themeColor="danger"
          testID={testId(gameId, 'workout-advance-error')}
          accessibilityLiveRegion="polite">
          {advanceError}
        </ThemedText>
      ) : null}

      <View style={styles.buttonRow}>
        {showNextGame ? (
          <GameButton
            testID={testId(gameId, 'next-game')}
            label="Next game"
            sublabel={nextGameDetail}
            onPress={onNextGame}
          />
        ) : null}
        {showWorkoutComplete ? (
          <GameButton
            testID={testId(gameId, 'finish-workout')}
            label="Finish workout"
            sublabel="Back to Today"
            // Next Game uses push, so the navigation stack contains the prior
            // legs. Finish must clear that stack and return to Today rather
            // than using the generic game-level back action (which would land
            // on the previous result screen).
            onPress={() => router.replace('/')}
          />
        ) : null}
        <GameButton
          testID={testId(gameId, 'restart')}
          label="Play again"
          variant={showNextGame || showWorkoutComplete ? 'secondary' : 'primary'}
          onPress={onRestart}
        />
        <GameButton
          testID={testId(gameId, 'quit')}
          label="Done"
          variant="secondary"
          onPress={onQuit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  stageArtifact: {
    borderRadius: Radii.large,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  resultBody: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  facts: {
    gap: Spacing.half,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
