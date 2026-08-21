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
});
