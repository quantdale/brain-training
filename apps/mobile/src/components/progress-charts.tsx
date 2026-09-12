/**
 * Dependency-free visualization primitives for the Progress / Insights feature.
 *
 * Everything here is built from React Native core components (no charting /
 * SVG library) so the analytics screens stay lightweight and fully testable.
 * Components are presentational only — they never fetch data or hold state
 * beyond the controlled values passed in.
 *
 * Readability contract (campaign 024): every chart pairs its visual encoding
 * with day/label context, a zero state and a visible scale or value caption,
 * and exposes a textual summary through `accessibilityLabel`. Segment identity
 * colours resolve through `DomainColors` (domains) or the shared metric
 * families — never fixed hex — so charts follow the theme in dark mode.
 */

import { StyleSheet, View } from 'react-native';

import { formatDayLabel, plural, type CalendarDay } from '@/analytics';
import { DomainColors, Families, Radii, Spacing, type DomainName, type ThemeColor } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** Resolved appearance used to pick the theme-correct identity fill. */
type SchemeName = 'light' | 'dark';

/**
 * Domain identity fill for a share-bar segment. `key` is the domain name as
 * produced by the analytics layer (any capitalisation); unknown keys fall
 * back to the shared accent so the bar never invents a colour.
 */
function segmentColor(scheme: SchemeName, key: string): string {
  const name = key.toLowerCase() as DomainName;
  if (name in DomainColors.light) {
    return DomainColors[scheme][name].base;
  }
  return Families[scheme].accent.base;
}

/** Human label for a UTC `YYYY-MM-DD` calendar key (`Jan 20`). */
function calendarKeyLabel(dateKey: string): string {
  const ms = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isNaN(ms) ? dateKey : formatDayLabel(ms);
}

/**
 * Compact vertical bar chart for a trend (values mapped to bar heights).
 * `labels` gives each bar day/label context (shown under the bar when the
 * array lines up with `values`); `summary` is the textual equivalent exposed
 * to assistive technology. The empty window renders the zero state instead of
 * an empty track.
 */
export function MiniBarChart({
  values,
  height = 48,
  testID,
  emptyLabel = 'No data in this window',
  tone = 'accent',
  labels,
  summary,
}: {
  values: readonly number[];
  height?: number;
  testID?: string;
  emptyLabel?: string;
  /** Fill family for non-negative bars (a metric identity, e.g. `success`). */
  tone?: ThemeColor;
  /** Per-bar context labels (days, sessions); rendered when aligned. */
  labels?: readonly string[];
  /** Textual summary for assistive technology. */
  summary?: string;
}) {
  const theme = useTheme();
  if (values.length === 0) {
    return (
      <View
        style={[styles.chartEmpty, { height }]}
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary ?? emptyLabel}>
        <ThemedText type="caption" themeColor="textSecondary">
          {emptyLabel}
        </ThemedText>
      </View>
    );
  }
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const showLabels = labels !== undefined && labels.length === values.length;
  const fallbackSummary = `Bar chart with ${values.length} values.`;
  return (
    <View
      style={[styles.bars, { height: showLabels ? height + 20 : height }]}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary ?? fallbackSummary}>
      {values.map((v, i) => {
        const ratio = (v - min) / span;
        const h = Math.max(2, Math.round(ratio * (height - 4)));
        return (
          <View
            key={i}
            style={[styles.barSlot, { flex: 1 }]}
            testID={testID ? `${testID}-bar-${i}` : undefined}>
            <View
              style={[
                styles.bar,
                {
                  height: h,
                  backgroundColor: v >= 0 ? theme[tone] : theme.danger,
                },
              ]}
            />
            {showLabels ? (
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                {labels[i]}
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Square heatmap grid (calendar). `intensity` in [0,1]; 0 → empty cell. */
export function HeatmapCell({
  intensity,
  testID,
  label,
}: {
  intensity: number;
  testID?: string;
  /** Per-cell summary; the cell is hidden from AT when absent. */
  label?: string;
}) {
  const theme = useTheme();
  const opacity = intensity <= 0 ? 0 : Math.min(1, 0.2 + intensity * 0.8);
  return (
    <View
      testID={testID}
      accessible={label !== undefined}
      accessibilityRole={label !== undefined ? 'image' : undefined}
      accessibilityLabel={label}
      style={[
        styles.cell,
        intensity <= 0
          ? { backgroundColor: theme.surfaceSunken }
          : { backgroundColor: theme.accent, opacity },
      ]}
    />
  );
}

/**
 * Strip of heatmap cells (one calendar week). `weekLabel` is the region-level
 * summary ("Week of Jan 20: 4 sessions over 2 active days") — cells stay
 * hidden from assistive tech while the row carries the summary. Pass
 * `cellLabels` instead when each day needs its own announcement.
 */
export function HeatmapRow({
  intensities,
  testID,
  weekLabel,
  cellLabels,
}: {
  intensities: readonly number[];
  testID?: string;
  weekLabel?: string;
  cellLabels?: readonly (string | undefined)[];
}) {
  return (
    <View
      style={styles.row}
      testID={testID}
      accessible={weekLabel !== undefined}
      accessibilityRole={weekLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={weekLabel}>
      {intensities.map((v, i) => (
        <HeatmapCell
          key={i}
          intensity={v}
          testID={testID ? `${testID}-${i}` : undefined}
          label={weekLabel !== undefined ? undefined : cellLabels?.[i]}
        />
      ))}
    </View>
  );
}

/** One proportional slice of a `StackedShareBar`. */
export interface ShareSegment {
  /** Stable identifier (the domain name); drives the identity colour. */
  key: string;
  /** Fraction of the bar in [0, 1]; segments are rendered in the given order. */
  fraction: number;
}

/**
 * Horizontal stacked share bar (e.g. training balance across domains).
 * Presentational and deterministic: widths are exact fractions of the total
 * and fills come from `DomainColors` by segment key, so the bar follows the
 * theme instead of a fixed palette. Renders a neutral empty track when there
 * is nothing to show; the container always exposes the textual share summary.
 */
export function StackedShareBar({
  segments,
  height = 10,
  testID,
}: {
  segments: readonly ShareSegment[];
  height?: number;
  testID?: string;
}) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const visible = segments.filter((s) => s.fraction > 0);
  if (visible.length === 0) {
    return (
      <View
        style={[styles.shareTrack, { height, backgroundColor: theme.surfaceSunken }]}
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel="No data"
      />
    );
  }
  return (
    <View
      style={[styles.shareTrack, styles.shareTrackFilled, { height, backgroundColor: theme.surfaceSunken }]}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={visible.map((s) => `${s.key} ${Math.round(s.fraction * 100)}%`).join(', ')}>
      {visible.map((segment) => (
        <View
          key={segment.key}
          testID={testID ? `${testID}-${segment.key.replace(/[^a-z]/gi, '').toLowerCase()}` : undefined}
          style={{
            flex: segment.fraction,
            backgroundColor: segmentColor(scheme, segment.key),
          }}
        />
      ))}
    </View>
  );
}

/**
 * Two-row horizontal comparison bar pair (Progress V2), e.g. this window's
 * session volume vs the previous window. Presentational and deterministic:
 * each row renders a track with a fill of exactly `fraction` of the track and
 * a caller-formatted value label. Fractions are clamped into [0, 1].
 * `summary` is the textual equivalent exposed to assistive technology.
 */
export function CompareBars({
  rows,
  testID,
  summary,
}: {
  rows: readonly {
    key: string;
    label: string;
    valueLabel: string;
    fraction: number;
    /** Fill family; defaults to the primary accent. */
    tone?: ThemeColor;
  }[];
  testID?: string;
  summary?: string;
}) {
  const theme = useTheme();
  if (rows.length === 0) {
    return (
      <View
        style={styles.compareRows}
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary ?? 'No data'}>
        <ThemedText type="caption" themeColor="textSecondary">
          No data in this window
        </ThemedText>
      </View>
    );
  }
  return (
    <View
      style={styles.compareRows}
      testID={testID}
      accessible={summary !== undefined}
      accessibilityRole={summary !== undefined ? 'image' : undefined}
      accessibilityLabel={summary}>
      {rows.map((row) => {
        const fraction = Math.min(1, Math.max(0, row.fraction));
        return (
          <View key={row.key} style={styles.compareRow}>
            <ThemedText type="caption" themeColor="textSecondary">
              {row.label}
            </ThemedText>
            <View style={[styles.compareTrack, { backgroundColor: theme.surfaceSunken }]}>
              <View
                style={[
                  styles.compareFill,
                  { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme[row.tone ?? 'accent'] },
                ]}
                testID={testID ? `${testID}-${row.key}-fill` : undefined}
              />
            </View>
            <ThemedText type="caption" style={styles.compareValue}>
              {row.valueLabel}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Labeled vertical bars for small categorical distributions (Progress V2),
 * e.g. sessions per weekday. Deterministic: bar heights are exact fractions of
 * the tallest bucket; a zero bucket renders as a stub. Each bar carries its
 * formatted value as a visible caption and the container exposes the textual
 * summary.
 */
export function LabeledBars({
  bars,
  height = 56,
  testID,
  summary,
  formatValue = (v) => String(v),
  emptyLabel = 'No data in this window',
}: {
  bars: readonly { key: string; label: string; value: number }[];
  height?: number;
  testID?: string;
  summary?: string;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}) {
  const theme = useTheme();
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (bars.length === 0 || max === 0) {
    return (
      <View
        style={[styles.chartEmpty, { height }]}
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary ?? emptyLabel}>
        <ThemedText type="caption" themeColor="textSecondary">
          {emptyLabel}
        </ThemedText>
      </View>
    );
  }
  return (
    <View
      style={styles.labeledBars}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        summary ?? bars.map((bar) => `${bar.label} ${formatValue(bar.value)}`).join(', ')
      }>
      {bars.map((bar) => {
        const ratio = max > 0 ? bar.value / max : 0;
        const h = bar.value > 0 ? Math.max(3, Math.round(ratio * (height - 14))) : 2;
        return (
          <View key={bar.key} style={styles.labeledBarSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: h,
                  backgroundColor: bar.value > 0 ? theme.accent : theme.surfaceSunken,
                },
              ]}
              testID={testID ? `${testID}-${bar.key}` : undefined}
            />
            <ThemedText type="caption" themeColor="text" numberOfLines={1}>
              {formatValue(bar.value)}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
              {bar.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Readable activity calendar: the week grid plus the month/day context that
 * makes it legible — a visible date-range caption and a region-level summary
 * per week ("Week of Jan 20: 4 sessions over 2 active days"). Weeks without
 * activity still render (visible zero states); a fully empty view renders the
 * zero-state sentence. The container exposes the whole-view textual summary.
 */
export function CalendarHeatmap({
  days,
  maxCount,
  testID,
  summary,
}: {
  days: readonly CalendarDay[];
  maxCount: number;
  testID?: string;
  /** Whole-view textual summary; synthesised from the cells when absent. */
  summary?: string;
}) {
  if (days.length === 0) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary ?? 'No activity in this view'}>
        <ThemedText
          type="caption"
          themeColor="textSecondary"
          testID={testID ? `${testID}-empty` : undefined}>
          No activity in this view yet
        </ThemedText>
      </View>
    );
  }
  const totalSessions = days.reduce((sum, day) => sum + day.count, 0);
  const activeDays = days.filter((day) => day.count > 0).length;
  const rangeLabel = `${calendarKeyLabel(days[0].dateKey)} – ${calendarKeyLabel(days[days.length - 1].dateKey)}`;
  const defaultSummary = `${activeDays} of ${days.length} days active, ${plural(totalSessions, 'session')}, ${rangeLabel}`;
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  if (totalSessions === 0) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary ?? defaultSummary}>
        <ThemedText type="caption" themeColor="textSecondary">
          {rangeLabel}
        </ThemedText>
        <ThemedText
          type="caption"
          themeColor="textSecondary"
          testID={testID ? `${testID}-empty` : undefined}>
          No sessions in this view yet
        </ThemedText>
      </View>
    );
  }
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary ?? defaultSummary}>
      <ThemedText type="caption" themeColor="textSecondary">
        {rangeLabel}
      </ThemedText>
      <View style={styles.heatmap}>
        {weeks.map((week, wi) => {
          const weekSessions = week.reduce((sum, day) => sum + day.count, 0);
          const weekActive = week.filter((day) => day.count > 0).length;
          return (
            <HeatmapRow
              key={wi}
              testID={testID ? `${testID}-w${wi}` : undefined}
              intensities={week.map((d) => (maxCount > 0 ? d.count / maxCount : 0))}
              weekLabel={`Week of ${calendarKeyLabel(week[0].dateKey)}: ${weekSessions} session${weekSessions === 1 ? '' : 's'} over ${weekActive} active day${weekActive === 1 ? '' : 's'}`}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  barSlot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: Radii.small,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  heatmap: {
    flexDirection: 'row',
    gap: Spacing.half,
    flexWrap: 'wrap',
  },
  shareTrack: {
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  shareTrackFilled: {
    flexDirection: 'row',
  },
  compareRows: {
    gap: Spacing.two,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  compareTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  compareFill: {
    height: '100%',
    borderRadius: Radii.pill,
  },
  compareValue: {
    minWidth: 36,
    textAlign: 'right',
  },
  labeledBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  labeledBarSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.half,
  },
});
