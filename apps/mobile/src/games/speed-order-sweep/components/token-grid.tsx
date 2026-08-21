/**
 * TokenGrid — the Order Sweep board: every number token visible at once,
 * laid out in a fixed grid of `round.columns` columns.
 *
 * Pure presentation: it receives the round and how many of the ordered values
 * have been swept (`clearedCount` — always the smallest values), and reports
 * taps via `onTap(tokenId)`. It never owns timing or scoring.
 *
 * Accessibility: each token exposes its number as an `accessibilityLabel`
 * plus a cleared state, so the board is fully usable by screen reader without
 * relying on color alone. Cleared tokens are disabled but stay visible so the
 * player can see their sweep path.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { OrderSweepRound } from '../types';

export interface TokenGridProps {
  readonly round: OrderSweepRound;
  /** How many of the ascending values have been swept so far. */
  readonly clearedCount: number;
  readonly disabled: boolean;
  readonly onTap: (tokenId: number) => void;
  /** Semantic testID of the grid; tokens share it plus `.token.<value>`. */
  readonly testID: string;
}

export function TokenGrid({ round, clearedCount, disabled, onTap, testID }: TokenGridProps) {
  const theme = useTheme();
  const clearedValues = new Set(round.order.slice(0, clearedCount));

  // Chunk the row-major tokens into visual rows of `columns` cells; missing
  // cells (when count % columns !== 0) render as empty spacers so every token
  // keeps the same width.
  const cells: ReactNode[] = [];
  for (let cell = 0; cell < round.rows * round.columns; cell += 1) {
    const token = round.tokens.find((candidate) => candidate.id === cell) ?? null;
    if (token === null) {
      cells.push(<View key={`hole-${cell}`} style={styles.cell} />);
      continue;
    }
    const cleared = clearedValues.has(token.value);
    cells.push(
      <Pressable
        key={token.id}
        testID={testId(GAME_ID, 'token', String(token.value))}
        accessibilityRole="button"
        accessibilityLabel={`Number ${token.value}${cleared ? ', cleared' : ''}`}
        accessibilityState={{ disabled: disabled || cleared }}
        accessibilityHint={cleared ? undefined : 'Sweep in ascending order'}
        disabled={disabled || cleared}
        onPress={() => onTap(token.id)}
        style={({ pressed }) => [
          styles.cell,
          styles.token,
          {
            backgroundColor: cleared ? theme.accentSoft : theme.surface,
            borderColor: cleared ? theme.accentSoft : theme.border,
            opacity: disabled || cleared ? 0.55 : pressed ? 0.8 : 1,
          },
        ]}>
        <ThemedText type="subtitle" style={{ color: cleared ? theme.accent : theme.text }}>
          {token.value}
        </ThemedText>
      </Pressable>,
    );
  }

  const gridRows: ReactNode[] = [];
  for (let row = 0; row < round.rows; row += 1) {
    gridRows.push(
      <View key={`row-${row}`} style={styles.row}>
        {cells.slice(row * round.columns, (row + 1) * round.columns)}
      </View>,
    );
  }

  return (
    <View
      style={styles.grid}
      testID={testID}
      accessible={false}
      accessibilityLabel={`${clearedCount} of ${round.order.length} numbers swept`}>
      {gridRows}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.oneHalf,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.oneHalf,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
  },
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.medium,
    borderWidth: 1.5,
  },
});
