/**
 * `ArcadePanel` — the focal interactive surface (campaign 055).
 *
 * Campaign 052 found that "nearly every grouping becomes a pale rounded
 * rectangle", so hierarchy flattened everywhere. The refinement lock splits the
 * old universal card into semantic roles; Panel is the role for *the one object
 * a screen is about* (today's workout, a claim band, a summary). Records,
 * settings and stats use `Report`; game worlds use `GameStage`.
 *
 * Geometry is deliberately smaller than the old hero card (radius 12, hairline
 * border) so a panel reads as an object inside the page rather than a page
 * made of cards. `emphasis="focal"` is the only place a panel may carry
 * elevation, and a screen should use it once.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Elevation, Radii, Spacing, type ThemeColor } from '@/theme/tokens';
import type { FeedbackEvent } from '@/sdk';
import { Tappable } from './tappable';
import { HAIRLINE } from './radius';

/** Internal padding steps (kept in step with the kit's spacing scale). */
export type PanelPadding = 'none' | 'sm' | 'md' | 'lg';

export interface ArcadePanelProps extends Omit<ViewProps, 'style' | 'children' | 'hitSlop'> {
  children: ReactNode;
  /** Family soft-fill token used as the panel background. */
  tone?: ThemeColor | null;
  /** `focal` adds the raised shadow; default is a flat bordered object. */
  emphasis?: 'flat' | 'focal';
  padding?: PanelPadding;
  onPress?: () => void;
  feedback?: FeedbackEvent | false;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const PADDING: Record<PanelPadding, number> = {
  none: 0,
  sm: Spacing.twoHalf,
  md: Spacing.three,
  lg: Spacing.four,
};

export function ArcadePanel({
  children,
  tone = null,
  emphasis = 'flat',
  padding = 'md',
  onPress,
  feedback = 'tap',
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
  ...rest
}: ArcadePanelProps) {
  const theme = useTheme();
  const surface: ViewStyle = {
    backgroundColor: tone ? theme[tone] : theme.surface,
    borderRadius: Radii.medium,
    borderWidth: HAIRLINE,
    borderColor: theme.border,
    padding: PADDING[padding],
    ...(emphasis === 'focal' ? Elevation.raised : Elevation.none),
  };

  if (onPress) {
    return (
      <Tappable
        testID={testID}
        onPress={onPress}
        feedback={feedback}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[styles.panel, surface, style]}
        pressedStyle={{ backgroundColor: tone ? theme[tone] : theme.backgroundSelected, opacity: 0.95 }}
        {...rest}>
        {children}
      </Tappable>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.panel, surface, style]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
  },
});
