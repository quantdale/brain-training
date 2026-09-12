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
import { useEffect, useMemo, useRef } from 'react';
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

/** Persistence lifecycle mirrored from the game reducers' `persistState`. */
export type GameResultsPersistState = 'idle' | 'started' | 'succeeded' | 'failed';

/** Authoritative reward outcome shown when the session persists successfully. */
export interface GameResultsReward {
  /** XP paid for this session (authoritative when available). */
  xp?: number;
  /** Currency delta paid for this session, when nonzero. */
  coins?: number;
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

      <View style={styles.buttonRow}>
        <GameButton testID={testId(gameId, 'restart')} label="Play again" onPress={onRestart} />
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
