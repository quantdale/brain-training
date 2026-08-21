/**
 * OptionGrid — a selectable option displaying a folded result grid.
 *
 * Used in the choice phase to present the player with candidate folded
 * versions of the source grid. The selected/correct state is highlighted via
 * the theme border colors (never disclosed in a11y labels).
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { ReadonlyGrid } from '../generator';
import { GridView } from './grid-view';

export interface OptionGridProps {
  /** 0-based option index; used for the testID. */
  index: number;
  /** The grid to display. */
  grid: ReadonlyGrid;
  /** Whether this option is currently selected. */
  selected: boolean;
  /** Whether this option is the correct answer (for reveal in roundResult). */
  correct: boolean;
  /** Whether the option is disabled (e.g. after selection). */
  disabled?: boolean;
  /** Stable tap handler supplied by the parent; receives this option's index. */
  onPressOption?: (index: number) => void;
}

export const OptionGrid = memo(function OptionGrid({
  index,
  grid,
  selected,
  correct,
  disabled = false,
  onPressOption,
}: OptionGridProps) {
  const theme = useTheme();

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
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}>
      <GridView
        grid={grid}
        testID={testId(GAME_ID, 'option-grid', String(index))}
        accessibilityLabel={`Option ${index + 1} grid`}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: Radii.medium,
    padding: Spacing.one,
  },
});
