/**
 * `SectionGrid` — adaptive section layout for shell screens.
 *
 * The reference research is unambiguous about wide viewports: dashboards show
 * paired insight columns (most/least, this-week/this-month, 2×2 stat grids)
 * rather than one long stretched column. This primitive is the mechanism —
 * children flow into two columns once the viewport is wide enough and stay
 * stacked on phones.
 *
 * Column count is driven by the children's natural width (`minColumnWidth`),
 * gated by the layout tier: a phone never splits even if a single card would
 * technically fit beside another, because a 2-up phone layout reads as clutter.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useIsCompactWidth, useIsWideWidth } from '@/platform/layout';
import { Spacing } from '@/theme/tokens';

/** Props accepted by {@link SectionGrid}. */
export interface SectionGridProps {
  children: ReactNode;
  /** Width a child wants before the grid splits (default 320 dp). */
  minColumnWidth?: number;
  /** Gap between rows and columns (defaults to the standard section gap). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Flow children into as many columns as the viewport holds. Children keep their
 * natural height so uneven cards stay readable instead of stretching to match.
 */
export function SectionGrid({ children, minColumnWidth = 320, gap = Spacing.three, style }: SectionGridProps) {
  const compact = useIsCompactWidth();
  const wide = useIsWideWidth();
  const splitColumns = wide && !compact;

  return (
    <View
      style={[
        styles.grid,
        { rowGap: gap, columnGap: gap },
        splitColumns ? null : styles.stacked,
        style,
      ]}>
      {splitColumns
        ? // A wrapper per child gives the browser/flex engine the basis it needs
          // to wrap without the caller knowing anything about the layout.
          Array.isArray(children)
            ? children.map((child, index) => (
                <View key={index} style={[styles.cell, { flexBasis: minColumnWidth }]}>
                  {child}
                </View>
              ))
            : <View style={[styles.cell, { flexBasis: minColumnWidth }]}>{children}</View>
        : children}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  stacked: {
    flexDirection: 'column',
  },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
