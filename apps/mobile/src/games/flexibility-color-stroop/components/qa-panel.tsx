/**
 * QA panel — dev-only controls for forcing game states.
 * Duplicated here to avoid cross-module imports.
 */
import { useState } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import { GameButton } from './button';

interface QaPanelProps {
  onForceWin: () => void;
  onForceLose: () => void;
}

export function QaPanel({ onForceWin, onForceLose }: QaPanelProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <Pressable
        testID={testId(GAME_ID, 'qa-toggle')}
        accessibilityRole="button"
        onPress={() => setExpanded(!expanded)}>
        <ThemedText type="caption" themeColor="warning">
          QA controls (dev only)
        </ThemedText>
      </Pressable>
      {expanded && (
        <View style={styles.controls} testID={testId(GAME_ID, 'qa-panel')}>
          <GameButton small testID={testId(GAME_ID, 'force-win')} label="Force Win" onPress={onForceWin} />
          <GameButton
            small
            testID={testId(GAME_ID, 'force-lose')}
            label="Force Lose"
            variant="danger"
            onPress={onForceLose}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: '#00000022',
    padding: Spacing.twoHalf,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  controls: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});