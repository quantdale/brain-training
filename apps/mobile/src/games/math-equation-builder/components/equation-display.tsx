/**
 * EquationDisplay — renders the equation being built by the player.
 * Shows tokens, the target, and the current result.
 *
 * The verdict is multi-channel (PATTERNS-PLAY 6): after submission the panel
 * changes fill AND border weight AND gains a ✓/✕ badge, so a wrong answer
 * never reads as correct. The badge is decorative for screen readers — the
 * verdict container's accessibility label carries the verdict ("Correct: …" /
 * "Wrong answer: …"). The equation stem (target + built tokens) stays
 * rendered in every phase, so feedback never covers it.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { testId } from '@/sdk';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { EquationToken } from '../types';

export interface EquationDisplayProps {
  target: number;
  tokens: readonly EquationToken[];
  result: number | null;
  isCorrect: boolean | null;
}

function formatToken(token: EquationToken): string {
  if (typeof token === 'number') return String(token);
  if (token === '-') return '−';
  return token;
}

export function EquationDisplay({ target, tokens, result, isCorrect }: EquationDisplayProps) {
  const theme = useTheme();
  const equationStr = tokens.length > 0
    ? tokens.map(formatToken).join(' ')
    : '?';
  const verdict = isCorrect === null ? null : isCorrect ? 'correct' : 'wrong';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            verdict === 'correct'
              ? theme.successSoft
              : verdict === 'wrong'
                ? theme.dangerSoft
                : theme.surface,
          borderColor:
            verdict === 'correct'
              ? theme.success
              : verdict === 'wrong'
                ? theme.danger
                : theme.border,
          borderWidth: verdict !== null ? 2 : 1,
        },
      ]}
      testID={testId(GAME_ID, 'equation-display')}>
      <View style={styles.targetRow}>
        <ThemedText type="caption" themeColor="textSecondary">
          Target
        </ThemedText>
        <ThemedText
          type="headline"
          themeColor="accent"
          testID={testId(GAME_ID, 'target')}>
          {target}
        </ThemedText>
      </View>

      <View style={styles.equationRow}>
        <ThemedText
          type="bodyLarge"
          testID={testId(GAME_ID, 'equation')}>
          {equationStr} = ?
        </ThemedText>
      </View>

      {result !== null && verdict !== null ? (
        <View
          style={styles.resultRow}
          testID={testId(GAME_ID, 'verdict')}
          accessibilityLabel={
            verdict === 'correct'
              ? `Correct: ${equationStr} equals ${result}`
              : `Wrong answer: ${equationStr} equals ${result}, target ${target}`
          }>
          <View
            style={[
              styles.badge,
              { backgroundColor: verdict === 'correct' ? theme.success : theme.danger },
            ]}
            importantForAccessibility="no-hide-descendants">
            <ThemedText
              type="label"
              style={{ color: verdict === 'correct' ? theme.successOn : theme.dangerOn }}
              allowFontScaling={false}>
              {verdict === 'correct' ? '✓' : '✕'}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            themeColor={verdict === 'correct' ? 'success' : 'danger'}
            testID={testId(GAME_ID, 'result')}>
            {verdict === 'correct' ? '✓ Correct!' : `Your answer: ${result}`}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  equationRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  // Verdict badge: opaque verdict-family fill with its `*On` glyph, so the
  // icon reads on any panel fill. The fill + glyph pair is the
  // non-colour-alone verdict channel.
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.oneHalf,
    paddingVertical: Spacing.half,
  },
});
