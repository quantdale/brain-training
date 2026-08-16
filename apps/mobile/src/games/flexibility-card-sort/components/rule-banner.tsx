/**
 * RuleBanner — the active classification rule shown above the target card.
 *
 * The rule is the game's core affordance: the player classifies under this
 * rule until it switches. The banner is color-coded by rule (color → accent,
 * shape → a neutral chip) and carries a stable semantic testID.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { RuleId } from '../types';

export interface RuleBannerProps {
  rule: RuleId;
}

/** Player-facing rule labels ("match by COLOR" / "match by SHAPE"). */
export const RULE_LABELS: Readonly<Record<RuleId, string>> = {
  color: 'Match by COLOR',
  shape: 'Match by SHAPE',
};

export function RuleBanner({ rule }: RuleBannerProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.banner, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}
      testID={testId(GAME_ID, 'rule-banner')}
      accessibilityLabel={`Active rule: match by ${rule}`}>
      <ThemedText type="smallBold" themeColor="text" testID={testId(GAME_ID, 'rule-banner-text')}>
        {RULE_LABELS[rule]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    borderRadius: Radii.medium,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
});
