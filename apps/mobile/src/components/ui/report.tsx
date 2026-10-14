/**
 * `Report` / `ReportRow` — the record-keeping surface (campaign 055).
 *
 * Campaign 052: "Home, Progress, Profile, Rewards, and Results could be
 * repurposed for fitness, education, finance, or habit tracking" — largely
 * because every grouping was a bordered card. Report is the deliberate
 * opposite: a borderless region on the page canvas, rows separated by
 * hairlines, label left in muted ink and value right in tabular ink.
 *
 * Use it for records, statistics, settings, history and drill-downs. A Report
 * is evidence, not an event: it never carries elevation and never competes
 * with the screen's one focal object.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radii, Spacing, Typography, type ThemeColor, type TypographyName } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { Tappable } from './tappable';
import { HAIRLINE } from './radius';
import { AppIcon } from './app-icon';
import { useStackedRow, type RowLayout } from './row-layout';

export interface ReportProps extends Omit<ViewProps, 'style' | 'children'> {
  children: ReactNode;
  /** Small caps section label above the rows. */
  title?: string;
  /** Trailing slot on the title row (e.g. a quiet "See all" action). */
  action?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Report({ children, title, action, testID, style, ...rest }: ReportProps) {
  const theme = useTheme();
  return (
    <View testID={testID} style={[styles.report, style]} {...rest}>
      {title || action ? (
        <View style={styles.titleRow}>
          {title ? (
            <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.title}>
              {title}
            </ThemedText>
          ) : (
            <View style={styles.titleSpacer} />
          )}
          {action}
        </View>
      ) : null}
      <View style={[styles.body, { borderTopColor: theme.border }]}>{children}</View>
    </View>
  );
}

export interface ReportRowProps {
  label: string;
  value?: string;
  /** Trailing node rendered after the value (e.g. a metric chip). */
  trailing?: ReactNode;
  /** Colour role for the value (defaults to primary ink). */
  valueTone?: ThemeColor;
  /** Typography slot for the value; defaults to `label`. */
  valueType?: TypographyName;
  /** Supporting line under the label (state, hint, unlock condition). */
  hint?: string;
  /** Leading node (identity mark, object chip). */
  icon?: ReactNode;
  /** Makes the row an interactive target; renders a trailing chevron. */
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Auto stacks evidence at compact widths or enlarged system text. */
  layout?: RowLayout;
  /** Draws the hairline separator below the row (omit on the last row). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * One report line. Static rows are plain views; interactive rows are buttons
 * with a disclosure chevron that carries no testID (kit convention). Both
 * satisfy the 44 dp floor because a report row is often the only way to reach
 * a detail surface.
 */
export function ReportRow({
  label,
  value,
  trailing,
  valueTone = 'text',
  valueType = 'label',
  hint,
  icon,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint = 'Open',
  layout = 'auto',
  divider = false,
  style,
}: ReportRowProps) {
  const theme = useTheme();
  const stacked = useStackedRow(layout);
  const evidence = value !== undefined ? (
    <ThemedText type={valueType} themeColor={valueTone}
      style={[styles.value, stacked && styles.valueStacked]}>
      {value}
    </ThemedText>
  ) : null;
  const content = (
    <>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.labels}>
        <ThemedText type="bodySmall" themeColor="textSecondary">
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="caption" themeColor="textMuted">
            {hint}
          </ThemedText>
        ) : null}
        {stacked ? evidence : null}
        {stacked ? trailing : null}
      </View>
      {stacked ? null : evidence}
      {stacked ? null : trailing}
      {onPress ? (
        <AppIcon name="chevron" color={theme.textMuted} size={20} />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    divider ? { borderBottomWidth: HAIRLINE, borderBottomColor: theme.border } : null,
    style,
  ];

  if (onPress) {
    return (
      <Tappable
        testID={testID}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel ?? [label, value, hint].filter(Boolean).join('. ')}
        accessibilityHint={accessibilityHint}
        style={rowStyle}
        pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
        {content}
      </Tappable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={rowStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  report: {
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '60%',
  },
  titleSpacer: {
    flex: 1,
  },
  body: {
    borderTopWidth: HAIRLINE,
  },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  value: {
    flexShrink: 1,
    maxWidth: '45%',
    textAlign: 'right',
    fontWeight: Typography.label.weight,
  },
  valueStacked: {
    maxWidth: '100%',
    alignSelf: 'flex-start',
    textAlign: 'left',
  },
});

/** Radius re-exported to keep Report consumers inside the lock's shape roles. */
export const REPORT_RADIUS = Radii.medium;
