/**
 * `Avatar` — circular identity badge.
 *
 * Emoji renders as a decorative glyph (never scales with system font, never
 * exposed to assistive tech); `label` without emoji renders as ordinary text
 * so it scales. Diameters come from the spacing/touch ramps, so no avatar
 * invents a size; the default (`md`) is the 44 dp touch token.
 */

import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MinTouchTarget, Spacing, type ThemeColor, type TypographyName } from '@/theme/tokens';
import { HAIRLINE, RADIUS_CAP } from './radius';

/** Sizes of {@link Avatar}. */
export type AvatarSize = 'sm' | 'md' | 'lg';

/** Props accepted by {@link Avatar}. */
export interface AvatarProps {
  emoji?: string;
  /** Rendered verbatim when no `emoji` is given; scales with system font. */
  label?: string;
  size?: AvatarSize;
  ringTone?: ThemeColor;
  testID?: string;
}

const DIAMETER: Record<AvatarSize, number> = {
  sm: Spacing.five,
  md: MinTouchTarget,
  lg: Spacing.six,
};

const LABEL_TYPE: Record<AvatarSize, TypographyName> = {
  sm: 'caption',
  md: 'label',
  lg: 'headline',
};

export function Avatar({ emoji, label, size = 'md', ringTone, testID }: AvatarProps) {
  const theme = useTheme();
  const diameter = DIAMETER[size];

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={label ?? emoji}
      style={[
        styles.base,
        {
          width: diameter,
          height: diameter,
          backgroundColor: theme.accentSoft,
          borderColor: ringTone ? theme[ringTone] : 'transparent',
        },
      ]}>
      {emoji ? (
        <Text
          allowFontScaling={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ fontSize: Math.round(diameter / 2), color: theme.accentSoftText }}>
          {emoji}
        </Text>
      ) : label ? (
        <ThemedText type={LABEL_TYPE[size]} themeColor="accentSoftText" numberOfLines={1}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: HAIRLINE,
    borderRadius: RADIUS_CAP,
  },
});
