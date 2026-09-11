/**
 * `Badge` — small status/label pill.
 *
 * Always the family's soft fill with the matching `softText`, so a status
 * never invents its own colour. Static (non-interactive); screen readers get
 * the label as ordinary text.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, type ColorTheme, type ThemeColor } from '@/theme/tokens';
import { RADIUS_CAP } from './radius';

/** Sizes of {@link Badge}. */
export type BadgeSize = 'sm' | 'md';

/** Props accepted by {@link Badge}. */
export interface BadgeProps {
  label: string;
  /** Family base (`success`), soft slot (`successSoft`) or any theme slot. */
  tone?: ThemeColor;
  size?: BadgeSize;
  icon?: ReactNode;
  testID?: string;
}

// A tone may arrive as the family base (`success`), the soft slot itself
// (`successSoft`), or the soft-text slot; every spelling resolves to the
// same soft fill + soft text pair. Unknown slots fall back to accent.
function resolveSoft(
  theme: ColorTheme,
  tone: ThemeColor,
): { background: string; foreground: ThemeColor } {
  const name = tone as string;
  if (name.endsWith('SoftText')) {
    const soft = name.slice(0, -'Text'.length) as ThemeColor;
    return { background: theme[soft] ?? theme.accentSoft, foreground: tone };
  }
  if (name.endsWith('Soft')) {
    const softText = `${name}Text` as ThemeColor;
    return { background: theme[tone], foreground: softText in theme ? softText : 'accentSoftText' };
  }
  const soft = `${name}Soft` as ThemeColor;
  const softText = `${name}SoftText` as ThemeColor;
  if (soft in theme && softText in theme) {
    return { background: theme[soft], foreground: softText };
  }
  return { background: theme.accentSoft, foreground: 'accentSoftText' };
}

export function Badge({ label, tone = 'accent', size = 'md', icon, testID }: BadgeProps) {
  const theme = useTheme();
  const colors = resolveSoft(theme, tone);

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: colors.background },
      ]}>
      {icon}
      <ThemedText type={size === 'sm' ? 'caption' : 'label'} themeColor={colors.foreground} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: RADIUS_CAP,
  },
  sm: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  md: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.one,
  },
});
