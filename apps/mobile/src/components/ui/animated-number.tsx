/**
 * `AnimatedNumber` — count-up/count-down for scores, XP, coins, streaks and
 * percentages.
 *
 * The interpolated value lives in this component only, so the per-frame
 * re-renders `useAnimatedProgress` performs never reach the surrounding
 * screen. Under reduced motion the hook settles instantly and the final value
 * renders on the first frame.
 */

import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Motion, type ThemeColor, type TypographyName } from '@/theme/tokens';
import { useAnimatedProgress } from './motion';

/** Props accepted by {@link AnimatedNumber}. */
export interface AnimatedNumberProps {
  value: number;
  /** Formats the interpolated number; defaults to the nearest integer. */
  format?: (n: number) => string;
  /** Sweep length; ignored under reduced motion. */
  duration?: number;
  /** Typography slot for the numeral. */
  type?: TypographyName;
  /** Colour slot for the numeral. */
  themeColor?: ThemeColor;
  testID?: string;
}

export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toString(),
  duration = Motion.entrance,
  type = 'numeralLg',
  themeColor = 'text',
  testID,
}: AnimatedNumberProps) {
  const { numericValue } = useAnimatedProgress(value, { duration, withNumericValue: true });
  const current = numericValue ?? value;

  return (
    <ThemedText type={type} themeColor={themeColor} testID={testID} style={styles.numeral}>
      {format(current)}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  // Tabular figures even for non-numeral slots, so a sweep cannot reflow.
  numeral: {
    fontVariant: ['tabular-nums'],
  },
});
