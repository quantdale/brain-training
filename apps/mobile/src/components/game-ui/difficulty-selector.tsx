/**
 * DifficultySelector — shared difficulty picker for game intro screens (task 10.2).
 *
 * Renders `DIFFICULTY_LABELS` as `GameButton` chips. Callers provide the
 * current selection and the dispatch callback; no reducer or game mechanics
 * live here.
 *
 * Accessibility: the row is announced as a difficulty radio group (chips keep
 * the button role with a truthful `selected` state, which screen readers read
 * as "selected"), and every chip inherits GameButton's 44pt touch-target
 * contract.
 */
import { View, StyleSheet } from 'react-native';

import { DIFFICULTY_LABELS, testId } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';
import { Spacing } from '@/constants/theme';

import { GameButton } from './game-button';

export interface DifficultySelectorProps {
  gameId: string;
  selected: DifficultyLevel | null;
  onSelect: (level: DifficultyLevel) => void;
}

export function DifficultySelector({ gameId, selected, onSelect }: DifficultySelectorProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Difficulty">
      {Object.entries(DIFFICULTY_LABELS).map(([level, label]) => {
        const isSelected = selected === level;
        return (
          <GameButton
            key={level}
            small
            testID={testId(gameId, 'difficulty', level)}
            label={label}
            variant={isSelected ? 'primary' : 'secondary'}
            selected={isSelected}
            hint={isSelected ? `Selected difficulty: ${label}` : `Set difficulty to ${label}`}
            onPress={() => onSelect(level as DifficultyLevel)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
