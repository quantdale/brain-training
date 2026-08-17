/**
 * OperatorButton — one of the four `+ − × ÷` answer buttons.
 *
 * Neutral (outline) while the round is open; after a round resolves the
 * parent passes a highlight: `correct` fills the button with the accent color
 * and `wrong` with the danger color. Buttons are disabled once the round is
 * resolved.
 */
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { OPERATOR_GLYPHS } from '../types';
import type { Operator } from '../types';

export interface OperatorButtonProps {
  operator: Operator;
  testID: string;
  onPress: () => void;
  disabled?: boolean;
  /** Round-resolution highlight; null while the round is open. */
  highlight?: 'correct' | 'wrong' | null;
}

export function OperatorButton({
  operator,
  testID,
  onPress,
  disabled = false,
  highlight = null,
}: OperatorButtonProps) {
  const theme = useTheme();
  const filled = highlight !== null;
  const backgroundColor = filled
    ? highlight === 'wrong'
      ? theme.danger
      : theme.accent
    : 'transparent';
  const foregroundColor = filled ? '#FFFFFF' : theme.accent;
  const borderColor = filled ? backgroundColor : theme.border;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Operator ${OPERATOR_GLYPHS[operator]}`}
      accessibilityState={{ disabled, busy: false }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}>
      <ThemedText type="title" style={{ color: foregroundColor }}>
        {OPERATOR_GLYPHS[operator]}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minWidth: 64,
    borderRadius: Radii.medium,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
