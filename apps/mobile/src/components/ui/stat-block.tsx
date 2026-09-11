/**
 * `StatBlock` — eyebrow label plus numeral value for results metric rows and
 * dashboard tiles.
 *
 * The value colour resolves through `METRIC_COLOR_KEYS`, so a metric keeps
 * the same hue everywhere it appears. An explicit `tone` overrides the metric
 * identity for one-off callouts.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { METRIC_COLOR_KEYS, Spacing, type MetricName, type ThemeColor, type TypographyName } from '@/theme/tokens';

/** Props accepted by {@link StatBlock}. */
export interface StatBlockProps {
  /** Eyebrow caption above the value. */
  label: string;
  /** Pre-formatted value text (formatting stays with the caller). */
  value: string;
  /** Metric identity driving the value colour. */
  metric?: MetricName;
  /** Optional glyph rendered above the label. */
  icon?: ReactNode;
  /** Optional supporting line below the value (e.g. "+12% vs last week"). */
  delta?: string;
  /** One-off colour override; wins over the metric identity. */
  tone?: ThemeColor;
  testID?: string;
  /** Typography slot for the value. */
  valueType?: TypographyName;
}

export function StatBlock({
  label,
  value,
  metric,
  icon,
  delta,
  tone,
  testID,
  valueType = 'numeralLg',
}: StatBlockProps) {
  const valueColor: ThemeColor = tone ?? (metric ? METRIC_COLOR_KEYS[metric] : 'text');

  return (
    <View testID={testID} style={styles.block}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <ThemedText type="eyebrow" themeColor="textSecondary" testID={testID ? `${testID}-label` : undefined}>
        {label}
      </ThemedText>
      <ThemedText type={valueType} themeColor={valueColor} testID={testID ? `${testID}-value` : undefined}>
        {value}
      </ThemedText>
      {delta ? (
        <ThemedText type="caption" themeColor="textSecondary" testID={testID ? `${testID}-delta` : undefined}>
          {delta}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
  },
  icon: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
