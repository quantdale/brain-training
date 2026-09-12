/**
 * `StreakStrip` — the identity streak element: a 5–7 day dot strip plus a
 * count pill, never a plain text row (owner anti-pattern).
 *
 * States per day: `done` filled accent, `today` ring, `pending` muted. The
 * strip is decorative for assistive tech; the wrapper carries one accessible
 * sentence with the current count and today's state.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/theme/tokens';
import { useTheme } from '@/hooks/use-theme';

export interface StreakStripProps {
  /** Completed consecutive days (>= 0). */
  count: number;
  /** Days shown in the strip (default 7). */
  days?: number;
  /** 0-based index of today within the strip; defaults to the last slot. */
  todayIndex?: number;
  testID?: string;
}

export function StreakStrip({ count, days = 7, todayIndex, testID }: StreakStripProps) {
  const theme = useTheme();
  const today = todayIndex ?? Math.min(count, days - 1);
  const done = Math.max(0, Math.min(count, days));

  return (
    <View
      style={styles.root}
      testID={testID}
      accessibilityLabel={`${count} day streak, today is ${done >= days ? 'done' : 'in progress'}`}>
      <View style={styles.strip} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: days }, (_, index) => {
          const isDone = index < done;
          const isToday = index === today && !isDone;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: isDone ? theme.streak : theme.surfaceSunken,
                  borderColor: isToday ? theme.streak : isDone ? theme.streak : theme.border,
                  borderWidth: isToday ? 2 : 1,
                },
              ]}
            />
          );
        })}
      </View>
      <View
        style={[styles.pill, { backgroundColor: theme.streakSoft, borderColor: theme.streak }]}
        importantForAccessibility="no-hide-descendants">
        <ThemedText type="label" style={{ color: theme.streakSoftText }}>
          {'\u26A1'} {count}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  strip: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
  },
  pill: {
    minHeight: 28,
    minWidth: 48,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
