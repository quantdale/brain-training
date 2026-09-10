/**
 * LevelCard — Home XP/level progression card (campaign 023).
 *
 * Combines the global level badge, an XP progress meter toward the next
 * level, and the coin balance chip into one gamified surface. Uses the
 * authoritative `levelForXp` / `levelProgress` / `xpForLevel` helpers so the
 * displayed values can never diverge from the shared rating pipeline.
 */
import { StyleSheet, View } from 'react-native';

import { ProgressTrack } from '@/components/shell/progress-track';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { levelProgress, xpForLevel } from '@/rating';

export interface LevelCardProps {
  /** Lifetime XP (sessions + awards), as shown on Home. */
  totalXp: number;
  /** Current global level for `totalXp`. */
  level: number;
  /** Current spendable coin balance; the chip hides at zero. */
  coins?: number;
  testID?: string;
}

export function LevelCard({ totalXp, level, coins = 0, testID = 'home-level-card' }: LevelCardProps) {
  const theme = useTheme();
  const progress = levelProgress(totalXp);
  const nextLevelXp = xpForLevel(level + 1);
  const xpToNext = Math.max(0, nextLevelXp - totalXp);

  return (
    <ThemedView type="surface" style={styles.card} testID={testID}>
      <View style={styles.row}>
        <View
          testID="home-stat-level"
          style={[styles.badge, { backgroundColor: theme.xpSoft }]}>
          <ThemedText type="title" style={[styles.badgeValue, { color: theme.xp }]}>
            {level}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" allowFontScaling={false}>
            LEVEL
          </ThemedText>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle">Level {level}</ThemedText>
            {coins > 0 ? (
              <View
                testID="home-stat-coins"
                style={[styles.coinChip, { backgroundColor: theme.warningSoft }]}>
                <ThemedText type="caption" allowFontScaling={false}>
                  🪙
                </ThemedText>
                <ThemedText type="caption" themeColor="warning">
                  {coins}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View testID="home-stat-xp">
            <ProgressTrack ratio={progress} tone="xp" height={10} />
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {totalXp} XP · {xpToNext > 0 ? `${xpToNext} XP to Level ${level + 1}` : 'Max level'}
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.three,
    ...Elevation.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: Radii.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeValue: {
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.oneHalf,
  },
});
