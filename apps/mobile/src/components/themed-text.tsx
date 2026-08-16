import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
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
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'caption' && styles.caption,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'bodyLarge' && styles.bodyLarge,
        type === 'subtitle' && styles.subtitle,
        type === 'headline' && styles.subtitle,
        type === 'title' && styles.title,
        type === 'display' && styles.display,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  caption: {
    fontSize: Typography.caption.size,
    lineHeight: Typography.caption.lineHeight,
    fontWeight: Typography.caption.weight,
  },
  small: {
    fontSize: Typography.bodySmall.size,
    lineHeight: Typography.bodySmall.lineHeight,
    fontWeight: Typography.bodySmall.weight,
  },
  smallBold: {
    fontSize: Typography.bodySmall.size,
    lineHeight: Typography.bodySmall.lineHeight,
    fontWeight: '700',
  },
  default: {
    fontSize: Typography.body.size,
    lineHeight: Typography.body.lineHeight,
    fontWeight: Typography.body.weight,
  },
  bodyLarge: {
    fontSize: Typography.bodyLarge.size,
    lineHeight: Typography.bodyLarge.lineHeight,
    fontWeight: Typography.bodyLarge.weight,
  },
  subtitle: {
    fontSize: Typography.headline.size,
    lineHeight: Typography.headline.lineHeight,
    fontWeight: Typography.headline.weight,
  },
  title: {
    fontSize: Typography.title.size,
    lineHeight: Typography.title.lineHeight,
    fontWeight: Typography.title.weight,
  },
  display: {
    fontSize: Typography.display.size,
    lineHeight: Typography.display.lineHeight,
    fontWeight: Typography.display.weight,
  },
  link: {
    fontSize: Typography.bodySmall.size,
    lineHeight: Typography.bodySmall.lineHeight,
  },
  linkPrimary: {
    fontSize: Typography.bodySmall.size,
    lineHeight: Typography.bodySmall.lineHeight,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: Typography.caption.size,
  },
});
