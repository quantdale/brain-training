/**
 * Feedback display — shows correct/incorrect/timeout after a response.
 *
 * The verdict is multi-channel and deliberately NOT the stimulus hue: the
 * panel takes the verdict family's soft fill plus a verdict border (weight
 * change) plus a ✓/✕/⏱ badge, so the verdict can never be confused with the
 * red/blue/green/yellow stimulus colours that are the game's mechanic. The
 * badge is decorative for assistive tech — the headline carries the verdict
 * in words ("Correct!" / "Wrong!" / "Time's up!"). All colours are theme
 * slots; the only literals in this game are the stimulus hues themselves
 * (see `STROOP_COLOR_HEX` in `../types`, documented there as the mechanic).
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface FeedbackDisplayProps {
  correct: boolean;
  correctAnswer: string;
  responseTimeMs: number;
  /** True when the round ended by stimulus timeout (no answer was given). */
  timedOut?: boolean;
  testID?: string;
}

export function FeedbackDisplay({
  correct,
  correctAnswer,
  responseTimeMs,
  timedOut = false,
  testID,
}: FeedbackDisplayProps) {
  const theme = useTheme();

  // Verdicts change fill AND border AND glyph, never colour alone: the panel
  // takes the verdict family's soft fill with a verdict-family border, and
  // pairs the headline with an opaque glyph badge (✓ correct / ✕ incorrect /
  // ⏱ timeout) in the family's `*On` glyph colour so the icon reads on any
  // board behind it. Timeouts resolve to `warning`, matching the shared
  // verdict vocabulary.
  const verdict =
    correct && !timedOut
      ? {
          title: 'Correct!',
          glyph: '✓',
          soft: theme.successSoft,
          edge: theme.success,
          badge: theme.success,
          glyphColor: theme.successOn,
          text: 'success' as const,
        }
      : timedOut
        ? {
            title: "Time's up!",
            glyph: '⏱',
            soft: theme.warningSoft,
            edge: theme.warning,
            badge: theme.warning,
            glyphColor: theme.warningOn,
            text: 'warning' as const,
          }
        : {
            title: 'Wrong!',
            glyph: '✕',
            soft: theme.dangerSoft,
            edge: theme.danger,
            badge: theme.danger,
            glyphColor: theme.dangerOn,
            text: 'danger' as const,
          };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: verdict.soft, borderColor: verdict.edge },
      ]}
      testID={testID}>
      <View
        style={[styles.badge, { backgroundColor: verdict.badge }]}
        importantForAccessibility="no-hide-descendants">
        <ThemedText type="headline" style={{ color: verdict.glyphColor }} allowFontScaling={false}>
          {verdict.glyph}
        </ThemedText>
      </View>
      <ThemedText type="headline" themeColor={verdict.text}>
        {verdict.title}
      </ThemedText>
      {!correct && (
        <ThemedText type="bodyLarge" themeColor="text">
          It was {correctAnswer}
        </ThemedText>
      )}
      <ThemedText type="caption" themeColor="textSecondary">
        {Math.round(responseTimeMs)}ms
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: 2,
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  // Opaque verdict badge: the icon/shape half of the verdict channel.
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
