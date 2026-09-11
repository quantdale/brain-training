import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { FONT_SCALE_CAP, MAX_FONT_SCALE } from '@/components/a11y/font-scale';
import { Fonts, Typography, type ThemeColor, type TypographyName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Named styles accepted by {@link ThemedText}. The first group is the design
 * language v2 vocabulary; the second group is legacy scaffolding names kept so
 * existing call sites keep working.
 */
export type ThemedTextType =
  | TypographyName
  | 'default'
  | 'caption'
  | 'small'
  | 'smallBold'
  | 'bodyLarge'
  | 'subtitle'
  | 'headline'
  | 'title'
  | 'display'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

/** Legacy scaffolding names → v2 typography token. */
const LEGACY_TYPE_TOKEN: Partial<Record<ThemedTextType, TypographyName>> = {
  default: 'body',
  small: 'bodySmall',
  smallBold: 'bodySmall',
  subtitle: 'headline',
  link: 'bodySmall',
  linkPrimary: 'bodySmall',
  code: 'caption',
};

/** Typography token backing a caller-facing style name. */
function resolveToken(type: ThemedTextType): TypographyName {
  if (type in Typography) return type as TypographyName;
  return LEGACY_TYPE_TOKEN[type] ?? 'body';
}

/**
 * Style for one type token: size, line-height, weight, tracking, and tabular
 * figures for numerals (so a count-up animation cannot reflow the layout).
 */
function styleForToken(tokenName: TypographyName): TextStyle {
  const token = Typography[tokenName];
  const style: TextStyle = {
    fontSize: token.size,
    lineHeight: token.lineHeight,
    fontWeight: token.weight,
  };
  // Only declare the optional keys when the token actually uses them: an
  // `undefined` letterSpacing/fontVariant is noise in every rendered style
  // (and in the visual baselines that record them).
  if (token.tracking !== undefined) {
    style.letterSpacing = token.tracking;
  }
  if (token.tabular) {
    style.fontVariant = ['tabular-nums'];
  }
  return style;
}

/**
 * Themed text primitive.
 *
 * Font scaling is capped per role (campaign 024): reading copy scales to 2.0,
 * headings and hero numerals keep a tighter cap so they cannot overflow, and
 * board glyphs opt out through `allowFontScaling={false}`. See
 * `@/components/a11y/font-scale`.
 */
export function ThemedText({
  style,
  type = 'default',
  themeColor,
  maxFontSizeMultiplier,
  allowFontScaling,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const tokenName = resolveToken(type);

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[tokenName],
        type === 'smallBold' && styles.smallBold,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? FONT_SCALE_CAP[tokenName] ?? MAX_FONT_SCALE}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  eyebrow: styleForToken('eyebrow'),
  caption: styleForToken('caption'),
  label: styleForToken('label'),
  bodySmall: styleForToken('bodySmall'),
  body: styleForToken('body'),
  bodyLarge: styleForToken('bodyLarge'),
  headline: styleForToken('headline'),
  title: styleForToken('title'),
  display: styleForToken('display'),
  numeral: styleForToken('numeral'),
  numeralLg: styleForToken('numeralLg'),
  numeralXl: styleForToken('numeralXl'),
  // Legacy emphasis variants that are not their own token.
  smallBold: { fontWeight: '700' },
  link: { textDecorationLine: 'underline' },
  linkPrimary: { textDecorationLine: 'underline', fontWeight: '700' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' as const }) ?? '500',
  },
});
