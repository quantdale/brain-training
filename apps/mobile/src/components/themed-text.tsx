import { Platform, StyleSheet, Text, useWindowDimensions, type TextProps, type TextStyle } from 'react-native';

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

const HEADING_TOKENS = new Set<TypographyName>([
  'headline', 'title', 'display', 'gameTitle', 'resultHeadline',
]);

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
    fontFamily: Fonts.sans,
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
  const { fontScale } = useWindowDimensions();
  const tokenName = resolveToken(type);
  const fontScaleCap = maxFontSizeMultiplier ?? FONT_SCALE_CAP[tokenName] ?? MAX_FONT_SCALE;
  // Android 14+ converts fontSize and lineHeight through separate nonlinear
  // SP curves. A heading's larger nominal lineHeight can then grow less than
  // its glyphs; RN's CustomLineHeightSpan clips Manrope's g/y descenders. Let
  // enlarged word headings use native font metrics, while normal-size text,
  // fixed board glyphs and explicit caller line heights keep their geometry.
  const useNativeHeadingMetrics = Platform.OS === 'android'
    && Number(Platform.Version) >= 34
    && fontScale > 1
    && allowFontScaling !== false
    && fontScaleCap !== 1
    && HEADING_TOKENS.has(tokenName);

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[tokenName],
        useNativeHeadingMetrics && styles.nativeHeadingMetrics,
        type === 'smallBold' && styles.smallBold,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={fontScaleCap}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  nativeHeadingMetrics: { lineHeight: undefined },
  eyebrow: styleForToken('eyebrow'),
  caption: styleForToken('caption'),
  label: styleForToken('label'),
  bodySmall: styleForToken('bodySmall'),
  body: styleForToken('body'),
  bodyRead: styleForToken('bodyRead'),
  bodyLarge: styleForToken('bodyLarge'),
  headline: styleForToken('headline'),
  title: styleForToken('title'),
  display: styleForToken('display'),
  gameTitle: styleForToken('gameTitle'),
  resultHeadline: styleForToken('resultHeadline'),
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
