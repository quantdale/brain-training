/**
 * SectionHeader — consistent section heading with an optional drill-down
 * action (W13).
 *
 * Used across the shell screens so every section reads the same: a subtitle
 * headline, optional one-line caption, and at most one right-aligned text
 * action ("See all"). The action is a plain callback; callers own routing and
 * any typed-route casts.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { MinTouchTarget } from '@/components/a11y';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function SectionHeader({
  title,
  caption,
  actionLabel,
  onActionPress,
  actionTestID,
  actionAccessibilityLabel,
}: {
  title: string;
  /** Optional secondary line under the title. */
  caption?: string;
  /** Optional right-aligned action label ("See all"); hidden when omitted. */
  actionLabel?: string;
  onActionPress?: () => void;
  actionTestID?: string;
  actionAccessibilityLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {caption ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {caption}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          testID={actionTestID}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          onPress={onActionPress}>
          <ThemedText type="smallBold" themeColor="accent" style={MinTouchTarget}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
