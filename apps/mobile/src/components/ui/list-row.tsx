/**
 * `ListRow` — the app's standard row (session history, settings, domain
 * breakdown).
 *
 * Static rows are plain `View`s with no press affordance; rows with `onPress`
 * are {@link Tappable} buttons with a chevron. The accessible name folds the
 * subtitle in, mirroring {@link Button}'s label + sublabel contract.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radii, Spacing, type ThemeColor } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { Tappable } from './tappable';

/** Props accepted by {@link ListRow}. */
export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Trailing metadata (time, score, value). */
  meta?: string;
  /**
   * testID for the trailing metadata text. Automation reads a row's *status*
   * from this node (it is the node that carries the text), so rows whose meta
   * is meaningful state must pass one.
   */
  metaTestID?: string;
  /** Leading glyph; tinted by `tone` when one is given. */
  icon?: ReactNode;
  tone?: ThemeColor;
  onPress?: () => void;
  testID?: string;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  /** Defaults to true on pressable rows; never shown on static rows. */
  showChevron?: boolean;
  disabled?: boolean;
}

export function ListRow({
  title,
  subtitle,
  meta,
  metaTestID,
  icon,
  tone,
  onPress,
  testID,
  accessibilityHint,
  accessibilityLabel,
  showChevron,
  disabled = false,
}: ListRowProps) {
  const theme = useTheme();
  const pressable = onPress !== undefined;
  const chevron = pressable && (showChevron ?? true);
  const name = accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title);

  const content = (
    <>
      {icon ? (
        <View
          style={[
            styles.icon,
            { backgroundColor: tone ? theme[tone] : theme.surfaceSunken },
          ]}>
          {icon}
        </View>
      ) : null}
      <View style={styles.texts}>
        <ThemedText type="body" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="bodySmall" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {meta ? (
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} testID={metaTestID}>
          {meta}
        </ThemedText>
      ) : null}
      {chevron ? (
        <ThemedText
          type="body"
          themeColor="textMuted"
          allowFontScaling={false}
          // Deliberately no testID: the chevron is decoration, and a
          // `<rowTestID>-chevron` node makes prefix-based row discovery count
          // every row twice (automation, and the a11y audit, both walk the
          // hierarchy by id prefix). The row itself carries the testID.
          testID={undefined}>
          ›
        </ThemedText>
      ) : null}
    </>
  );

  if (pressable) {
    return (
      <Tappable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={name}
        accessibilityHint={accessibilityHint}
        style={[styles.row, disabled && styles.disabled]}
        pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
        {content}
      </Tappable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={styles.row}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    // minHeight (not height) so wrapped subtitles grow the row.
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: Spacing.two,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    borderRadius: Radii.medium,
  },
  texts: {
    flex: 1,
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});
