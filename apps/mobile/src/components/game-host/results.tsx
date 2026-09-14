/**
 * `<GameResults>` — shared results-view chrome for GameHost-based games
 * (campaign 010, architecture-debt D1; campaign 023 reward moment).
 *
 * Owns the results layout every game duplicated: the headline, an optional
 * game-specific badge slot (e.g. Reaction Time's "ended early" notice), the
 * game's stat rows, the persistence-failure error line, the QA-forced badge,
 * and the Play again / Done actions. Games pass their stat rows as children.
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
import { FeedbackCard } from '@/components/shell';
import { Confetti } from '@/components/ui';
import { GameButton } from '@/components/game-ui';
import { usePrefersReducedMotion } from '@/components/game-ui/use-reduced-motion';
import { Motion, Spacing } from '@/constants/theme';
import {
  advanceWorkoutForSession,
  type WorkoutSessionAdvanceResult,
} from '@/workout/session-advance';
import { emitWorkoutChanged } from '@/workout/events';
import { useWorkoutSessionLaunch } from '@/workout/session-launch-context';
import { gameHref } from '@/workout/routing';

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
  /** Activate Next Game (caller owns navigation). */
  onNextGame: () => void;
  /** True when the workout is finished (completion copy, no Next Game). */
  completed?: boolean;
}

export interface GameResultsProps {
  readonly gameId: string;
  /** Headline; defaults to "Session complete". */
  readonly title?: string;
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
  title = 'Session complete',
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
    // only when the user's sensory settings allow it.
    liveAudioHaptics.feedback('reward');
    if (prefersReducedMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: Motion.entrance,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [persistState, showReward, prefersReducedMotion, entrance]);

  const rewardDetail = [
    rewardCoins > 0 ? `+${rewardCoins} coin${rewardCoins === 1 ? '' : 's'}` : null,
    'Progress saved',
  ]
    .filter(Boolean)
    .join(' · ');

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
  const workoutCompleted =
    workout !== undefined
      ? workout.completed === true
      : succeeded && derivedAdvance?.completed === true;
  const showNextGame = succeeded && nextGameId !== null;
  const showWorkoutComplete = succeeded && workoutCompleted && !showNextGame;
  const showAdvanceError =
    succeeded && advanceError !== null && !showNextGame && !showWorkoutComplete;

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
          {/* Campaign 026 celebration beat: a bounded, deterministic burst
              behind the reward card (margins only, reduced-motion collapses). */}
          <Confetti count={14} seed={`reward-${gameId}`} height={180} />
          <FeedbackCard
            tone="success"
            emoji="🎉"
            title={rewardXp > 0 ? `+${rewardXp} XP earned!` : 'Session complete!'}
            detail={rewardDetail}
            testID={testId(gameId, 'reward')}
          />
        </Animated.View>
      ) : null}
      <ThemedText type="title">{title}</ThemedText>
      {badge}
      {children}

      {persistState === 'failed' ? (
        <ThemedText type="small" themeColor="danger" testID={testId(gameId, 'persist-error')}>
          Your session could not be saved. {lastError ?? ''}
        </ThemedText>
      ) : null}
      {forced ? (
        <ThemedText type="caption" themeColor="warning" testID={testId(gameId, 'forced-badge')}>
          QA-forced session
        </ThemedText>
      ) : null}
      {showWorkoutComplete ? (
        <ThemedText
          type="small"
          themeColor="success"
          testID={testId(gameId, 'workout-complete')}>
          Workout complete — nice work!
        </ThemedText>
      ) : null}
      {showAdvanceError ? (
        <ThemedText
          type="small"
          themeColor="danger"
          testID={testId(gameId, 'workout-advance-error')}>
          {advanceError}
        </ThemedText>
      ) : null}

      <View style={styles.buttonRow}>
        {showNextGame ? (
          <GameButton
            testID={testId(gameId, 'next-game')}
            label="Next Game"
            onPress={onNextGame}
          />
        ) : null}
        <GameButton
          testID={testId(gameId, 'restart')}
          label="Play again"
          variant={showNextGame ? 'secondary' : 'primary'}
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
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
