/**
 * Dependency-free visualization primitives for the Progress / Insights feature.
 *
 * Everything here is built from React Native core components (no charting /
 * SVG library) so the analytics screens stay lightweight and fully testable.
 * Components are presentational only — they never fetch data or hold state
 * beyond the controlled values passed in.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

/** Generic segmented control (used for the 7d / 30d / 90d / all window selector). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.segmented} testID={testID}>
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={testID ? `${testID}-${opt.key}` : undefined}
            onPress={() => onChange(opt.key)}
            style={[
              styles.segment,
              selected && { backgroundColor: theme.accent },
            ]}>
            <ThemedText
              type="smallBold"
              themeColor={selected ? 'surface' : 'textSecondary'}>
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact vertical bar chart for a trend (values mapped to bar heights). */
export function MiniBarChart({
  values,
  height = 48,
  testID,
  emptyLabel = 'No data in this window',
}: {
  values: readonly number[];
  height?: number;
  testID?: string;
  emptyLabel?: string;
}) {
  const theme = useTheme();
  if (values.length === 0) {
    return (
      <View style={[styles.chartEmpty, { height }]} testID={testID}>
        <ThemedText type="caption" themeColor="textSecondary">
          {emptyLabel}
        </ThemedText>
      </View>
    );
  }
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  return (
    <View style={[styles.bars, { height }]} testID={testID}>
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
                  backgroundColor: v >= 0 ? theme.accent : theme.danger,
                },
              ]}
            />
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
  label?: string;
}) {
  const theme = useTheme();
  const opacity = intensity <= 0 ? 0 : Math.min(1, 0.2 + intensity * 0.8);
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={[
        styles.cell,
        intensity <= 0 ? { backgroundColor: theme.border } : { backgroundColor: theme.accent, opacity },
      ]}
    />
  );
}

/** Strip of heatmap cells (one calendar row / week). */
export function HeatmapRow({
  intensities,
  testID,
}: {
  intensities: readonly number[];
  testID?: string;
}) {
  return (
    <View style={styles.row}>
      {intensities.map((v, i) => (
        <HeatmapCell key={i} intensity={v} testID={testID ? `${testID}-${i}` : undefined} />
      ))}
    </View>
  );
}

/**
 * Deterministic segment palette for `StackedShareBar` (fixed hex values so the
 * rendering is identical across themes, runs and platforms — required for
 * stable visual baselines). Cycles when there are more segments than colors.
 */
export const SHARE_BAR_COLORS = [
  '#7C9EFF',
  '#69D2A8',
  '#FFB86B',
  '#FF7B9C',
  '#6BD5E1',
  '#C792EA',
  '#F7D774',
  '#A0AAB8',
] as const;

/** One proportional slice of a `StackedShareBar`. */
export interface ShareSegment {
  /** Stable identifier (e.g. the domain name). */
  key: string;
  /** Fraction of the bar in [0, 1]; segments are rendered in the given order. */
  fraction: number;
}

/**
 * Horizontal stacked share bar (e.g. training balance across domains).
 * Presentational and deterministic: widths are exact fractions of the total,
 * colors come from the fixed `SHARE_BAR_COLORS` palette by index. Renders a
 * neutral empty track when there is nothing to show.
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
  const visible = segments.filter((s) => s.fraction > 0);
  if (visible.length === 0) {
    return (
      <View
        style={[styles.shareTrack, { height }]}
        testID={testID}
        accessibilityLabel="No data"
      />
    );
  }
  return (
    <View
      style={[styles.shareTrack, styles.shareTrackFilled, { height }]}
      testID={testID}
      accessibilityLabel={visible.map((s) => `${s.key} ${Math.round(s.fraction * 100)}%`).join(', ')}>
      {visible.map((segment, i) => (
        <View
          key={segment.key}
          testID={testID ? `${testID}-${segment.key.replace(/[^a-z]/gi, '').toLowerCase()}` : undefined}
          style={{
            flex: segment.fraction,
            backgroundColor: SHARE_BAR_COLORS[i % SHARE_BAR_COLORS.length],
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
 */
export function CompareBars({
  rows,
  testID,
}: {
  rows: readonly { key: string; label: string; valueLabel: string; fraction: number }[];
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.compareRows} testID={testID}>
      {rows.map((row) => {
        const fraction = Math.min(1, Math.max(0, row.fraction));
        return (
          <View key={row.key} style={styles.compareRow}>
            <ThemedText type="caption" themeColor="textSecondary">
              {row.label}
            </ThemedText>
            <View style={styles.compareTrack}>
              <View
                style={[
                  styles.compareFill,
                  { width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.accent },
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
 * the tallest bucket; a zero bucket renders as a stub.
 */
export function LabeledBars({
  bars,
  height = 56,
  testID,
}: {
  bars: readonly { key: string; label: string; value: number }[];
  height?: number;
  testID?: string;
}) {
  const theme = useTheme();
  const max = Math.max(...bars.map((b) => b.value), 0);
  return (
    <View style={styles.labeledBars} testID={testID}>
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
                  backgroundColor: bar.value > 0 ? theme.accent : theme.border,
                },
              ]}
              testID={testID ? `${testID}-${bar.key}` : undefined}
            />
            <ThemedText type="caption" themeColor="textSecondary">
              {bar.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    gap: Spacing.one,
    backgroundColor: 'rgba(128,128,128,0.15)',
    borderRadius: Radii.pill,
    padding: Spacing.half,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderRadius: Radii.pill,
  },
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
  shareTrack: {
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(128,128,128,0.25)',
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
    backgroundColor: 'rgba(128,128,128,0.25)',
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
