/**
 * OptionButton — a selectable option displaying a pattern grid.
 *
 * Used in the choice phase to present the player with transformed versions
 * of the source pattern. The selected state is highlighted via the theme's
 * accent color border.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import { PatternGrid } from './pattern-grid';

export interface OptionButtonProps {
  /** 0-based option index; used for the testID. */
  index: number;
  /** The grid size for the pattern. */
  gridSize: number;
  /** The pattern to display. */
  pattern: readonly number[];
  /** Whether this option is currently selected. */
  selected: boolean;
  /** Whether this option is the correct answer (for reveal in roundResult). */
  correct: boolean;
  /** Whether the option is disabled (e.g. after selection). */
  disabled?: boolean;
  onPress?: () => void;
}

export function OptionButton({
  index,
  gridSize,
  pattern,
  selected,
  correct,
  disabled = false,
  onPress,
}: OptionButtonProps) {
  const theme = useTheme();

  // Cast to string because theme.success/danger have different literal types
  // than theme.border, but all are valid RN color strings.
  let borderColor: string = theme.border;
  if (correct) {
    borderColor = theme.success;
  } else if (selected && !correct) {
    borderColor = theme.danger;
  }

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={`Option ${index + 1}`}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}>
      <PatternGrid
        gridSize={gridSize}
        pattern={pattern}
        testID={testId(GAME_ID, 'option-grid', String(index))}
        accessibilityLabel={`Option ${index + 1} pattern`}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: Radii.medium,
    padding: Spacing.one,
  },
});
