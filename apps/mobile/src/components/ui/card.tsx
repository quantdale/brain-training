/**
 * `Card` — the app's single surface primitive.
 *
 * The campaign-024 recon found every screen stacking identical white cards, so
 * hierarchy was flat everywhere. Cards now declare their role, which is what
 * makes a screen readable at a glance:
 *   - `plain`    grouped content (default)
 *   - `outlined` grouped content that needs a boundary but no lift
 *   - `raised`   the one elevated surface of a region
 *   - `hero`     the screen's hero surface
 *
 * `tone` paints a family's soft fill (success/warning/danger/xp/streak/domain)
 * for state, so a callout never invents its own colour.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Elevation, Radii, Spacing, type ElevationName, type ThemeColor } from '@/theme/tokens';
import { Tappable } from './tappable';
import { HAIRLINE } from './radius';
import type { FeedbackEvent } from '@/sdk';

/** Visual role of a card. */
export type CardVariant = 'plain' | 'outlined' | 'raised' | 'hero';

/** Internal padding steps. */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Props accepted by {@link Card}. Remaining View props (live regions,
 * `pointerEvents`, layout callbacks) pass straight through, because a card is
 * often the element that carries an announcement or an interaction boundary.
 */
export interface CardProps extends Omit<ViewProps, 'style' | 'children' | 'hitSlop'> {
  children: ReactNode;
  variant?: CardVariant;
  /** Family soft-fill token (e.g. `successSoft`, `xpSoft`) used as background. */
  tone?: ThemeColor | null;
  padding?: CardPadding;
  /** Makes the whole card pressable while keeping the card's own presentation. */
  onPress?: () => void;
  feedback?: FeedbackEvent | false;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const PADDING: Record<CardPadding, number> = {
  none: 0,
  sm: Spacing.twoHalf,
  md: Spacing.three,
  lg: Spacing.four,
};

const ELEVATION_BY_VARIANT: Record<CardVariant, ElevationName> = {
  plain: 'card',
  outlined: 'none',
  raised: 'raised',
  hero: 'hero',
};

/**
 * Surface primitive. Renders a pressable variant when `onPress` is supplied so
 * a tappable card shares the same interaction contract as every other control.
 */
export function Card({
  children,
  variant = 'plain',
  tone = null,
  padding = 'md',
  onPress,
  feedback = 'tap',
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
  ...rest
}: CardProps) {
  const theme = useTheme();
  const surface: ViewStyle = {
    backgroundColor: tone ? theme[tone] : variant === 'hero' ? theme.surfaceRaised : theme.surface,
    borderRadius: variant === 'hero' ? Radii.extraLarge : Radii.large,
    padding: PADDING[padding],
    ...Elevation[ELEVATION_BY_VARIANT[variant]],
    ...(variant === 'outlined' ? { borderWidth: HAIRLINE, borderColor: theme.border } : null),
  };

  if (onPress) {
    return (
      <Tappable
        testID={testID}
        onPress={onPress}
        feedback={feedback}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[styles.card, surface, style]}
        pressedStyle={{ backgroundColor: tone ? theme[tone] : theme.backgroundSelected, opacity: 0.94 }}
        {...rest}>
        {children}
      </Tappable>
    );
  }

  return (
    <View
      testID={testID}
      // A non-pressable card can still be the element a screen reader lands
      // on (a streak summary, a reward block), so the label is applied here
      // too rather than only on the pressable variant.
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.card, surface, style]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
