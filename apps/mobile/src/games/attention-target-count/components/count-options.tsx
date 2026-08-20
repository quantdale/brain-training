/**
 * CountOptions — the number answer buttons for the Target Count game.
 *
 * Each option is a `GameButton` whose testID encodes its value
 * (`count-option.<value>`), so tests can tap the correct/incorrect answer
 * deterministically.
 */
import { View, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';
import { GameButton } from '@/components/game-ui';

import { GAME_ID } from '../types';

export interface CountOptionsProps {
  /** Answer options (numbers); always includes the correct count. */
  readonly options: readonly number[];
  /** Called with the chosen value. */
  readonly onSelect: (value: number) => void;
  /** Disables all options (e.g. while paused). */
  readonly disabled?: boolean;
}

export function CountOptions({ options, onSelect, disabled }: CountOptionsProps) {
  return (
    <View style={styles.row} testID={testId(GAME_ID, 'count-options')}>
      {options.map((value) => (
        <GameButton
          key={value}
          testID={testId(GAME_ID, 'count-option', String(value))}
          label={String(value)}
          disabled={disabled}
          onPress={() => onSelect(value)}
        />
      ))}
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
