/**
 * AnswerButton — the "Same" / "Different" mental-rotation answer control.
 *
 * `memo`ized and value-based (`onPressAnswer` carries the `RoundKind`) so the
 * buttons do not re-render on the 250 ms round-clock ticks — only the timer
 * bar and any genuinely changed state do. The shared `GameButton` already
 * supplies `accessibilityRole="button"` and the neutral `label` text.
 *
 * Verdict mode (`verdict` set, rendered on the round result): the shared
 * verdict language (PATTERNS-PLAY 6, spatial-transform-match canary) — the
 * correct answer gets a success-soft fill plus a ✓ badge, the wrong pick a
 * danger-soft fill plus a ✕ badge, with the verdict border thickened. Badges
 * are decorative for assistive tech; the accessibility label carries the
 * verdict in words. Both states stay visible together while the prompt and
 * both shapes stay mounted (see screen.tsx). The verdict values are derived
 * by the screen from the reducer's resolved outcome (`roundOutcome` + `kind`),
 * never from the tap handler's optimistic guess.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton } from '@/components/game-ui';
import type { GameButtonProps } from '@/components/game-ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID, type RoundKind } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
/** Verdict presentation of an answer button on the round result. */
export type AnswerVerdict = 'correct' | 'wrong' | 'neutral';


export interface AnswerButtonProps extends Omit<GameButtonProps, 'onPress'> {
  answer: RoundKind;
  /**
   * Verdict to present. `undefined` renders the interactive answer control
   * (play phase); set renders the locked verdict readout (round result).
   */
  verdict?: AnswerVerdict;
  onPressAnswer?: (answer: RoundKind) => void;
}

export const AnswerButton = memo(function AnswerButton({
  answer,
  verdict,
  onPressAnswer,
  testID,
  label,
  ...rest
}: AnswerButtonProps) {
  const theme = useTheme();
  if (verdict === undefined) {
    return (
      <GameButton
        {...rest}
        testID={testID}
        label={label}
        onPress={() => onPressAnswer?.(answer)}
      />
    );
  }

  const isCorrect = verdict === 'correct';
  const isWrong = verdict === 'wrong';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        isCorrect ? `${label}, correct` : isWrong ? `${label}, wrong pick` : label
      }
      accessibilityState={{ disabled: true, selected: isCorrect || isWrong }}
      disabled
      style={[
        styles.verdict,
        {
          backgroundColor: isCorrect
            ? theme.successSoft
            : isWrong
              ? theme.dangerSoft
              : undefined,
          borderColor: isCorrect ? theme.success : isWrong ? theme.danger : theme.border,
          borderWidth: isCorrect || isWrong ? 3 : 2,
        },
      ]}
    >
      <ThemedText type="bodyLarge" style={{ color: theme.text }}>
        {label}
      </ThemedText>
      {isCorrect || isWrong ? (
        <View
          testID={testId(GAME_ID, 'answer-verdict', answer)}
          style={[
            styles.badge,
            { backgroundColor: isCorrect ? theme.success : theme.danger },
          ]}
          importantForAccessibility="no-hide-descendants"
        >
          <ThemedText
            type="label"
            style={{ color: isCorrect ? theme.successOn : theme.dangerOn }}
            allowFontScaling={false}
          >
            {isCorrect ? '✓' : '✕'}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  verdict: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 3,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    opacity: 0.8,
  },
  badge: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
