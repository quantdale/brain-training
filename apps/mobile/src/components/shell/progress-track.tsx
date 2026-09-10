/**
 * ProgressTrack — thin horizontal progress bar for shell cards (W13).
 *
 * Tokenized version of the quest/achievement progress bars: neutral track on
 * any surface, accent fill. `ratio` is clamped to [0, 1] so callers can pass
 * raw quotients.
 */

import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Radii } from '@/constants/theme';

export function ProgressTrack({
  ratio,
  height = 6,
  tone = 'accent',
  testID,
}: {
  /** Completion ratio; values outside [0, 1] are clamped. */
  ratio: number;
  height?: number;
  /** Fill tone: brand accent (default), XP/level, streak flame, success. */
  tone?: 'accent' | 'xp' | 'streak' | 'success';
  testID?: string;
}) {
  const theme = useTheme();
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const fillColor =
    tone === 'xp'
      ? theme.xp
      : tone === 'streak'
        ? theme.streak
        : tone === 'success'
          ? theme.success
          : theme.accent;

  return (
    <View
      testID={testID}
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      // Accessibility value so screen readers announce completion percentage
      // without the visual bar needing a text twin.
      accessibilityValue={{ now: Math.round(clamped * 100), max: 100, min: 0 }}>
      <View
        style={[
          styles.fill,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: fillColor,
            width: `${Math.round(clamped * 100)}%` as `${number}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(120,120,140,0.25)',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: Radii.pill,
  },
});
