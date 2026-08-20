/**
 * SymbolOptions — the answer choices for a Rule Grid round.
 *
 * Each candidate is a `GameButton` labelled with the player-facing symbol.
 * Pressing a candidate dispatches the selection (the screen maps it to an
 * `answer` action). Each button carries a stable `symbol-option.<value>` testID.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';
import { GameButton } from '@/components/game-ui';

import { GAME_ID } from '../types';

export interface SymbolOptionsProps {
  readonly options: readonly number[];
  readonly onSelect: (value: number) => void;
  /** Map a symbol value (0-based) to the player-facing label. */
  readonly renderSymbol: (value: number) => string;
  readonly disabled?: boolean;
}

export function SymbolOptions({ options, onSelect, renderSymbol, disabled }: SymbolOptionsProps) {
  return (
    <View style={styles.row} testID={testId(GAME_ID, 'symbol-options')}>
      {options.map((value) => (
        <GameButton
          key={value}
          testID={testId(GAME_ID, 'symbol-option', String(value))}
          label={renderSymbol(value)}
          onPress={() => onSelect(value)}
          disabled={disabled}
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
    justifyContent: 'center',
  },
});
