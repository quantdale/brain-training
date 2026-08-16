/**
 * TimerBar — the round's remaining time budget as a horizontal bar.
 *
 * Pure view over `(remainingMs, budgetMs)`; color shifts from accent to
 * warning to danger as the budget drains. The value comes from the reducer's
 * `timeRemainingMs` (fed by the SDK lifecycle clock), so it freezes while
 * paused.
 */
import { StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TimerBarProps {
  remainingMs: number;
  budgetMs: number;
  testID: string;
}

export function TimerBar({ remainingMs, budgetMs, testID }: TimerBarProps) {
  const theme = useTheme();
  const fraction = budgetMs > 0 ? Math.min(1, Math.max(0, remainingMs / budgetMs)) : 0;
  const color =
    fraction > 0.5 ? theme.accent : fraction > 0.25 ? theme.warning : theme.danger;

  return (
    <View
      style={[styles.track, { backgroundColor: theme.border }]}
      testID={testID}
      accessibilityLabel={`${Math.round(remainingMs / 1000)} seconds left`}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(fraction * 100)}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
});
