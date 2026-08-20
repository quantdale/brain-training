/**
 * CardGrid — 2×2 grid hosting the four candidate cards of a round.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import type { Card } from '../types';
import { CardView } from './card';
import type { CardVisualState } from './card';

export interface CardGridProps {
  candidates: readonly Card[];
  /** Semantic testID of the grid container. */
  testID: string;
  visualFor: (index: number) => CardVisualState;
  disabled?: boolean;
  onPressCard: (index: number) => void;
}

export const CardGrid = memo(function CardGrid({
  candidates,
  testID,
  visualFor,
  disabled = false,
  onPressCard,
}: CardGridProps) {
  return (
    <View style={styles.grid} testID={testID} accessibilityLabel="Four candidate cards">
      {candidates.map((card, index) => (
        <View key={index} style={styles.cell}>
          <CardView
            index={index}
            card={card}
            testID={`${testID}.card.${index}`}
            visual={visualFor(index)}
            disabled={disabled}
            onPressCard={onPressCard}
          />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  cell: {
    width: '50%',
    padding: Spacing.one,
  },
});
