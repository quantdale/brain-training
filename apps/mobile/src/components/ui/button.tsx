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
 * Sizes keep the 44 dp interaction floor (`sm` reaches it through hit slop).
 * A `sublabel` turns the button into the reference two-line CTA
 * ("Keep reading / The Time Machine") without a second component.
 */

import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Fonts, MinTouchTarget, Spacing, Typography, type ColorTheme, type ThemeColor } from '@/theme/tokens';
import { ThemedText } from '@/components/themed-text';
import { Tappable } from './tappable';
import { PRESS_SCALE } from './motion';
import { RADIUS_CAP } from './radius';

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
  icon?: React.ReactNode;
  /** Trailing glyph/icon node. */
  trailingIcon?: React.ReactNode;
  /** Renders a spinner, blocks presses and hides the label's affordance. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width (default true — CTAs are full width). */
  fullWidth?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };
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
      return { background: theme.accentSoft, border: 'transparent', label: 'accentSoftText' as ThemeColor };
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
 * haptics, reduced motion and the 44 dp floor are inherited rather than
 * re-implemented.
 */
export function Button({
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
  style,
}: ButtonProps) {
  const theme = useTheme();
  const colors = resolveVariant(variant, theme);
  const inactive = disabled || loading;

  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      pressedScale={PRESS_SCALE.cta}
      accessibilityLabel={accessibilityLabel ?? (sublabel ? `${label}. ${sublabel}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      renderedSize={HEIGHT[size]}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        {
          // minHeight (not height) so a 2x system font scale grows the button
          // instead of clipping its label.
          minHeight: HEIGHT[size],
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderRadius: RADIUS_CAP,
        },
        variant === 'ghost' && styles.outlined,
        inactive && styles.inactive,
        style,
      ]}
      pressedStyle={variant === 'primary' ? { backgroundColor: theme.accentStrong } : { opacity: 0.86 }}>
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
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minWidth: MinTouchTarget,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  outlined: {
    borderWidth: 1,
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
