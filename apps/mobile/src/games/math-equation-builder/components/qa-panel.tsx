/**
 * QaPanel — dev-only force-state controls for the Equation Builder game.
 *
 * The parent screen renders this ONLY when `isDevBuild()` is true. All
 * callbacks go through the SDK `QaForceStateHooks` implementation, whose
 * methods call `assertDevOnly()` (so production builds can never reach them).
 */
import { useState } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import { GameButton } from './button';

export interface QaPanelProps {
  onForceWin: () => void;
  onForceLose: () => void;
}

export function QaPanel({ onForceWin, onForceLose }: QaPanelProps) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <ThemedView type="surface" style={[styles.container, { borderColor: theme.border }]}>
      <Pressable
        testID={testId(GAME_ID, 'qa-toggle')}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}>
        <ThemedText type="smallBold" themeColor="warning">
          QA controls (dev only)
        </ThemedText>
      </Pressable>
      {open ? (
        <View style={styles.panel} testID={testId(GAME_ID, 'qa-panel')}>
          <ThemedText type="caption" themeColor="textSecondary">
            Force-state hooks (assertDevOnly) — ends the session instantly.
          </ThemedText>
          <View style={styles.actions}>
            <GameButton
              small
              testID={testId(GAME_ID, 'force-win')}
              label="Force win"
              onPress={onForceWin}
            />
            <GameButton
              small
              variant="danger"
              testID={testId(GAME_ID, 'force-lose')}
              label="Force lose"
              onPress={onForceLose}
            />
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: '#00000022',
    padding: Spacing.twoHalf,
    gap: Spacing.two,
  },
  panel: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
