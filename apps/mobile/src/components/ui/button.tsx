/**
 * `Button` — the app's single call-to-action primitive.
 *
 * Replaces the ~20 inline `Pressable`+`accentSoft` pill copies the campaign-024
 * audit found, so every action shares one visual language:
 *   - `primary`   filled, one per viewport (the screen's decision)
 *   - `secondary` tonal fill, supporting actions
 *   - `ghost`     borderless text action (tertiary paths, "See all")
 *   - `danger`    destructive; always paired with a confirm affordance
 *   - `success`   confirm/completion actions
 *
 * Sizes keep the platform interaction floor (Android 48dp, iOS 44pt).
 * A `sublabel` turns the button into the reference two-line CTA
 * ("Keep reading / The Time Machine") without a second component.
 *
 * Campaign 026 identity: filled variants carry a darker bottom lip (4 dp) so
 * the primary action reads as a physical key; the press scale compresses it.
 * The lip is a wrapper layer, not `borderBottomWidth`: a one-sided border
 * ignores the corner radius on Android and protrudes past the curve as a
 * square bar (Campaign 026 visual-QA screenshot), while the wrapper's own
 * radius keeps the shadow edge perfectly curved in both themes.
 */

import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type AccessibilityState,
  type Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Fonts, Radii, Spacing, Typography, type ColorTheme, type ThemeColor, Depth } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { ThemedText } from '@/components/themed-text';
import { Tappable } from './tappable';
import { PRESS_SCALE } from './motion';

/** Visual variants of {@link Button}. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

/** Sizes of {@link Button}: heights are 40 / 48 / 56 dp. */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Props accepted by {@link Button}. */
export interface ButtonProps {
  /** Primary line of copy (required — an unlabelled button is a bug). */
  label: string;
  /** Optional second line for CTAs that carry context. */
  sublabel?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading glyph/icon node. */
  icon?: ReactNode;
  /** Trailing glyph/icon node. */
  trailingIcon?: ReactNode;
  /** Renders a spinner, blocks presses and hides the label's affordance. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width (default true — CTAs are full width). */
  fullWidth?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Extra accessibility state merged over the disabled/busy flags. */
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
}

/**
 * Button props plus any remaining pressable props, so a caller can attach a
 * live region or a layout callback without the kit having to enumerate them.
 */
export type ButtonComponentProps = ButtonProps &
  Omit<PressableProps, keyof ButtonProps | 'style' | 'children' | 'hitSlop' | 'onPressIn' | 'onPressOut'>;

// Every size meets the platform target: the compact size exists to be denser
// (smaller text and padding), not to be harder to hit.
const HEIGHT: Record<ButtonSize, number> = { sm: MIN_TOUCH_TARGET, md: 48, lg: 56 };

/**
 * Edge allowance beyond the painted bounds (dp).
 *
 * 076-f defect repair (reproduced on device): a tap landing exactly on a
 * button's outer bound edge did not register, while a tap at its centre always
 * did. Two causes stack here. `hitSlopToTouchTarget()` returns `null` once the
 * control already meets the 48dp floor, so `Tappable` applied NO expansion; and
 * React Native's hit test is boundary-exclusive, so the outermost pixel row and
 * column of a perfectly compliant button were dead.
 *
 * 4 dp is chosen rather than an arbitrary generous value: it exactly fills half
 * the 8 dp (`Spacing.two`) gap the kit leaves between sibling controls, so two
 * adjacent buttons' hit areas MEET at the gap midpoint and never overlap. A
 * larger slop would let one chip steal its neighbour's edge taps, which is a
 * worse defect than the one being fixed.
 */
const EDGE_HIT_SLOP = 4;
const LABEL_TYPE: Record<ButtonSize, 'bodySmall' | 'body' | 'bodyLarge'> = {
  sm: 'bodySmall',
  md: 'body',
  lg: 'bodyLarge',
};

/** Colour slots per variant: fill, border (optional) and label colour. */
function resolveVariant(variant: ButtonVariant, theme: ColorTheme) {
  switch (variant) {
    case 'primary':
      return { background: theme.accent, border: 'transparent', label: 'accentOn' as ThemeColor };
    case 'secondary':
      // Change 076 (lock section 5): secondary = bordered neutral action. The
      // red-tinted fill would read as CTA-adjacent on the stage chrome.
      return { background: theme.backgroundElement, border: theme.border, label: 'text' as ThemeColor };
    case 'ghost':
      return { background: 'transparent', border: theme.border, label: 'accentText' as ThemeColor };
    case 'danger':
      return { background: theme.danger, border: 'transparent', label: 'dangerOn' as ThemeColor };
    case 'success':
      return { background: theme.success, border: 'transparent', label: 'successOn' as ThemeColor };
    default:
      return { background: theme.accent, border: 'transparent', label: 'accentOn' as ThemeColor };
  }
}

/**
 * Full-width-able action button. Press feedback comes from {@link Tappable}, so
 * haptics, reduced motion and the platform target are inherited rather than
 * re-implemented.
 */
export const Button = forwardRef<React.ComponentRef<typeof Pressable>, ButtonComponentProps>(function Button(
  {
    label,
    sublabel,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    trailingIcon,
    loading = false,
    disabled = false,
    fullWidth = true,
    testID,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState,
    style,
    ...rest
  }: ButtonComponentProps,
  // React hands the ref to `forwardRef`, not to props — reading it from the
  // props object left every ref undefined and silently broke the
  // screen-reader focus seam (pause overlay Resume button).
  ref,
) {
  const theme = useTheme();
  const colors = resolveVariant(variant, theme);
  const inactive = disabled || loading;
  const hasLip = variant === 'primary' || variant === 'danger' || variant === 'success';

  const body = (
    <Tappable
      ref={ref}
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      pressedScale={PRESS_SCALE.cta}
      accessibilityLabel={accessibilityLabel ?? (sublabel ? `${label}. ${sublabel}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading, ...(accessibilityState ?? {}) }}
      renderedSize={HEIGHT[size]}
      hitSlop={EDGE_HIT_SLOP}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        {
          // minHeight (not height) so a 2x system font scale grows the button
          // instead of clipping its label.
          minHeight: HEIGHT[size],
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: Radii.medium,
        },
        variant === 'ghost' && styles.outlined,
        hasLip && styles.lipInner,
        inactive && styles.inactive,
        style,
      ]}
      pressedStyle={variant === 'primary' ? { backgroundColor: theme.accentStrong } : { opacity: 0.86 }}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={theme[colors.label]} size="small" />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <View style={styles.labels}>
            <ThemedText type={LABEL_TYPE[size]} themeColor={colors.label} numberOfLines={2} style={styles.label}>
              {label}
            </ThemedText>
            {sublabel ? (
              <ThemedText
                type="caption"
                themeColor={colors.label}
                numberOfLines={1}
                style={styles.sublabel}>
                {sublabel}
              </ThemedText>
            ) : null}
          </View>
          {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
        </>
      )}
    </Tappable>
  );

  if (!hasLip) {
    return body;
  }
  // The lip wrapper keeps the testID, ref and accessibility contract on the
  // inner pressable; automation traverses one extra layout View per filled
  // button and nothing else changes.
  return <View style={[fullWidth && styles.fullWidth, styles.lipOuter]}>{body}</View>;
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: MIN_TOUCH_TARGET,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  outlined: {
    borderWidth: 1,
  },
  // Physical key: the wrapper's own translucent floor shows as a 4 dp shadow
  // edge under the raised face. Same shading language as the Spark node.
  lipOuter: {
    borderRadius: Radii.medium,
    backgroundColor: Depth.lip,
  },
  lipInner: {
    marginBottom: 4,
  },
  inactive: {
    opacity: 0.5,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flexShrink: 1,
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts.sans,
    fontWeight: Typography.body.weight,
  },
  sublabel: {
    opacity: 0.85,
  },
});
