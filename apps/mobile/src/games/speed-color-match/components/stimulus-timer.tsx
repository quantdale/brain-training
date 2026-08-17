/**
 * StimulusTimer — visual countdown for the per-trial stimulus timeout.
 *
 * Shows a progress bar that decreases over the stimulus timeout period.
 * When it expires, the trial is marked as a timeout.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';

export interface StimulusTimerProps {
  /** Total timeout duration in ms. */
  timeoutMs: number;
  /** Timestamp when the trial was shown (ms). */
  startedAtMs: number;
  /** Whether the timer is paused. */
  paused: boolean;
  /** Called when the timer expires. */
  onExpire: () => void;
}

export function StimulusTimer({ timeoutMs, startedAtMs, paused, onExpire }: StimulusTimerProps) {
  const theme = useTheme();
  const [remaining, setRemaining] = useState(timeoutMs);

  useEffect(() => {
    if (paused) return;

    const tick = () => {
      const elapsed = Date.now() - startedAtMs;
      const left = Math.max(0, timeoutMs - elapsed);
      setRemaining(left);
      if (left <= 0) {
        onExpire();
      }
    };

    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [startedAtMs, timeoutMs, paused, onExpire]);

  const progress = remaining / timeoutMs;

  return (
    <View style={styles.container} testID={testId(GAME_ID, 'timer')}>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: progress > 0.3 ? theme.accent : theme.danger,
            },
          ]}
        />
      </View>
      <ThemedText type="caption" themeColor="textSecondary" testID={testId(GAME_ID, 'timer-text')}>
        {Math.ceil(remaining / 1000)}s
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.oneHalf,
  },
  barBg: {
    height: 8,
    borderRadius: Radii.small,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Radii.small,
  },
});
