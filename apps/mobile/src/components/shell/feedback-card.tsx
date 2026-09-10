/**
 * FeedbackCard — shared vibrant feedback surface (campaign 023).
 *
 * One tinted card for success/failure/warning/accent/streak moments:
 * session rewards, streak nudges, at-risk notices, celebration summaries.
 * Purely presentational: no clock, db, or haptics access; callers own the
 * data and animation.
 *
 * Tone semantics:
 * - `success`  completion/reward (green soft fill)
 * - `danger`   failure/error (rose soft fill)
 * - `warning`  caution/at-risk (amber soft fill)
 * - `accent`   informational/brand (indigo soft fill)
 * - `streak`   streak surfaces (flame-orange soft fill)
 * - `neutral`  plain card on the surface token
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Radii, Spacing } from '@/constants/theme';
import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FeedbackCardTone = 'success' | 'danger' | 'warning' | 'accent' | 'streak' | 'neutral';

export interface FeedbackCardProps {
  tone?: FeedbackCardTone;
  /** Optional leading emoji rendered in a tinted circle. */
  emoji?: string;
  title: string;
  detail?: string;
  testID?: string;
  /** Extra rows rendered under the title/detail block. */
  children?: React.ReactNode;
  /** Announce to screen readers when the card content changes (default polite). */
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}

/** Background token per tone; `neutral` keeps the plain card surface. */
const TONE_BACKGROUND: Record<FeedbackCardTone, ThemeColor> = {
  success: 'successSoft',
  danger: 'dangerSoft',
  warning: 'warningSoft',
  accent: 'accentSoft',
  streak: 'streakSoft',
  neutral: 'surface',
};

/** Foreground accent token per tone (emoji circle + title emphasis). */
const TONE_FOREGROUND: Record<FeedbackCardTone, ThemeColor> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  accent: 'accent',
  streak: 'streak',
  neutral: 'textSecondary',
};

export function FeedbackCard({
  tone = 'accent',
  emoji,
  title,
  detail,
  testID,
  children,
  accessibilityLiveRegion = 'polite',
}: FeedbackCardProps) {
  const theme = useTheme();
  const foreground = theme[TONE_FOREGROUND[tone]];

  return (
    <ThemedView
      type={TONE_BACKGROUND[tone]}
      style={styles.card}
      testID={testID}
      accessibilityLiveRegion={accessibilityLiveRegion}>
      <View style={styles.header}>
        {emoji !== undefined ? (
          <View
            testID={testID ? `${testID}-emoji` : undefined}
            style={[styles.emojiCircle, { backgroundColor: theme.surface }]}>
            <ThemedText type="subtitle" allowFontScaling={false}>
              {emoji}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.textColumn}>
          <ThemedText type="subtitle" style={{ color: foreground }}>
            {title}
          </ThemedText>
          {detail !== undefined ? (
            <ThemedText type="small" themeColor="textSecondary">
              {detail}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.three,
    gap: Spacing.two,
    ...Elevation.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: Spacing.half,
  },
});
