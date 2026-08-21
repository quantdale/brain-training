import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';
import { GameButton } from './button';

export interface TutorialProps {
  onComplete: () => void;
  /** Provided only in dev builds (QA skip). */
  onSkip?: () => void;
}

/** First-play interactive tutorial for Order Path. */
export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  return (
    <TutorialFrame gameId={GAME_ID}>
      <ThemedText type="title">How to play</ThemedText>
      <ThemedText type="default">
        Each round lists clues like “A before B”. Only one item can go next at any step — place
        every item in the single valid order. A wrong pick ends the round.
      </ThemedText>
      <View style={styles.actions}>
        <GameButton
          testID={testId(GAME_ID, 'tutorial-done')}
          label="Got it"
          onPress={onComplete}
        />
        {onSkip ? (
          <GameButton
            variant="secondary"
            testID={testId(GAME_ID, 'tutorial-skip')}
            label="Skip (QA)"
            onPress={onSkip}
          />
        ) : null}
      </View>
    </TutorialFrame>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
