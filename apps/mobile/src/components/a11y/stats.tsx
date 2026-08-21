/**
 * Semantic grouped-stats helpers.
 *
 * Result/stat surfaces render one row per metric (see `game-ui` ResultRow/
 * StatRow). Traversed row-by-row a six-metric block costs six screen-reader
 * stops and buries the headline. `StatGroup` collapses the whole block into
 * ONE focusable stop whose label is a spoken summary; the visual layout is
 * untouched.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface StatGroupProps {
  /**
   * Spoken summary replacing per-row traversal. Compose it with `formatStats`
   * so copy stays consistent. Required: without it, hiding the rows would
   * leave Android with nothing to read.
   */
  label: string;
  children: ReactNode;
  testID?: string;
}

/**
 * Groups stat rows into a single accessibility stop (`role=summary`). The
 * visible children stay mounted for sighted users but are hidden from the
 * assistive tree, so the group label is the only thing announced.
 */
export function StatGroup({ label, children, testID }: StatGroupProps) {
  return (
    <View testID={testID} accessible accessibilityRole="summary" accessibilityLabel={label}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </View>
  );
}

/**
 * Build a spoken summary from label/value pairs: `Score 750. Accuracy 100%`.
 * Pairs with empty/missing values are skipped so optional metrics do not
 * produce "Best streak ." fragments.
 */
export function formatStats(
  stats: ReadonlyArray<readonly [string, string]>,
  separator = '. ',
): string {
  return stats
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([label, value]) => `${label} ${value}`)
    .join(separator);
}
