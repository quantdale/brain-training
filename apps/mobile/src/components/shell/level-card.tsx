/**
 * LevelCard — Home XP/level progression surface.
 *
 * Shows where the player stands and how far the next level is: level badge,
 * XP meter with tabular numerals, remaining-XP line, and the coin balance in
 * its own identity colour. Uses the authoritative `levelForXp` /
 * `levelProgress` / `xpForLevel` helpers so displayed values can never diverge
 * from the shared rating pipeline.
 */
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/ui/progress-bar';
import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { levelProgress, xpForLevel } from '@/rating';
import { Radii, Spacing } from '@/theme/tokens';

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
  const accessibilityLabel = `Level ${level}, ${totalXp} total XP. ${xpToNext} XP to level ${
    level + 1
  }.${coins > 0 ? ` ${coins} coins.` : ''}`;

  return (
    <Card variant="plain" testID={testID} accessibilityLabel={accessibilityLabel}>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: theme.xpSoft }]}>
          <ThemedText type="caption" themeColor="xpSoftText">
            Level
          </ThemedText>
          <ThemedText type="numeralLg" themeColor="xpText" testID="home-stat-level">
            {level}
          </ThemedText>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText type="bodySmall" themeColor="textSecondary" testID="home-stat-xp">
              {totalXp.toLocaleString()} XP
            </ThemedText>
            {coins > 0 ? (
              <View
                style={[styles.coinChip, { backgroundColor: theme.currencySoft }]}
                testID="home-stat-coins">
                <ThemedText type="caption" themeColor="currencySoftText">
                  🪙 {coins.toLocaleString()}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <ProgressBar
            value={progress}
            tone="xp"
            testID="home-level-progress"
            accessibilityLabel={`${Math.round(progress * 100)} percent toward level ${level + 1}`}
          />

          <ThemedText type="caption" themeColor="textMuted">
            {xpToNext.toLocaleString()} XP to Level {level + 1}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  badge: {
    minWidth: 72,
    borderRadius: Radii.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.twoHalf,
    alignItems: 'center',
    gap: Spacing.half,
  },
  body: {
    flex: 1,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  coinChip: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
