/**
 * SectionHeader — consistent section heading with an optional drill-down
 * action.
 *
 * Every section across the shell reads the same: an optional eyebrow, the
 * section title, an optional one-line caption, and at most one right-aligned
 * action ("See all"). Sections that have deeper content should offer that
 * action — the reference research is explicit that sections otherwise end
 * dead and shortchange scanability.
 *
 * The action is a plain callback; callers own routing.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Tappable } from '@/components/ui/tappable';
import { Spacing } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export function SectionHeader({
  title,
  eyebrow,
  caption,
  actionLabel,
  onActionPress,
  actionTestID,
  actionAccessibilityLabel,
}: {
  title: string;
  /** Optional uppercase label above the title (domain, period, purpose). */
  eyebrow?: string;
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
        {eyebrow ? (
          <ThemedText type="eyebrow" themeColor="textMuted">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText type="headline">{title}</ThemedText>
        {caption ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {caption}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onActionPress ? (
        <Tappable
          testID={actionTestID}
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          feedback="tap"
          onPress={onActionPress}
          style={styles.action}>
          <ThemedText type="label" themeColor="accentText">
            {actionLabel}
          </ThemedText>
        </Tappable>
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
  // Text-sized actions honour the 44 dp floor with real height, not just
  // slop: the hierarchy audit measures laid-out bounds.
  action: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
});
