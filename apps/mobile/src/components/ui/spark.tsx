/**
 * `Spark` — the identity mark used for rewards, empty states and celebration
 * accents. Built from two crossed rounded bars and a centre dot (no SVG, no
 * image asset), so it renders everywhere and themes through its `color` prop.
 *
 * The mark is decorative: callers pass an accessibility label only when the
 * spark carries meaning of its own (e.g. an XP burst).
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Depth, Radii } from '@/theme/tokens';

export interface SparkProps {
  /** Overall mark diameter in dp. */
  size?: number;
  /** Fill colour (usually a family `base` or `on` token). */
  color: string;
  /**
   * Centre-node colour. Defaults to a translucent-black depth node (the same
   * shading language as the Button lip) instead of the bar colour: a
   * same-as-bars core renders nothing, and the mark degrades into a plain
   * "+" that reads as an add button (Campaign 026 visual-QA finding across
   * profile/rewards/games heroes). The depth node stays visible on saturated,
   * luminous, muted and white bars in both themes. Pass an explicit colour
   * only when the node must match a surrounding surface.
   */
  coreColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Spark({ size = 24, color, coreColor = Depth.core, style }: SparkProps) {
  const bar = { width: size, height: Math.max(3, Math.round(size * 0.22)), backgroundColor: color };
  const dot = Math.max(4, Math.round(size * 0.3));
  return (
    <View
      pointerEvents="none"
      style={[styles.root, { width: size, height: size }, style]}
      importantForAccessibility="no-hide-descendants">
      <View style={[styles.bar, bar, { transform: [{ rotate: '0deg' }] }]} />
      <View style={[styles.bar, bar, { transform: [{ rotate: '90deg' }] }]} />
      <View
        style={[
          styles.core,
          { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: coreColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    borderRadius: Radii.pill,
  },
  core: {
    position: 'absolute',
  },
});
