/**
 * QaPanelShell — shared dev-only QA controls shell (task 10.2).
 *
 * Generic wrapper for the per-game QA panels. The parent screen renders
 * this ONLY when `isDevBuild()`. Callbacks go through SDK `QaForceStateHooks`
 * (`assertDevOnly()` in production). No game mechanics live here.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './game-button';

export interface QaPanelShellProps {
  gameId: string;
  onForceWin: () => void;
  onForceLose: () => void;
  /** Optional per-game extra dev actions (e.g. force-timeout / force-perfect). Kept generic so game mechanics stay local. */
  extraActions?: React.ReactNode;
}

export function QaPanelShell({ gameId, onForceWin, onForceLose, extraActions }: QaPanelShellProps) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <ThemedView type="surface" style={[styles.container, { borderColor: theme.border }]}>
      <Pressable
        testID={testId(gameId, 'qa-toggle')}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}>
        <ThemedText type="smallBold" themeColor="warning">
          QA controls (dev only)
        </ThemedText>
      </Pressable>
      {open ? (
        <View style={styles.panel} testID={testId(gameId, 'qa-panel')}>
          <ThemedText type="caption" themeColor="textSecondary">
            Force-state hooks (assertDevOnly) — ends the session instantly.
          </ThemedText>
          <View style={styles.actions}>
            <GameButton small testID={testId(gameId, 'force-win')} label="Force win" onPress={onForceWin} />
            <GameButton
              small
              variant="danger"
              testID={testId(gameId, 'force-lose')}
              label="Force lose"
              onPress={onForceLose}
            />
            {extraActions}
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
    padding: Spacing.twoHalf,
    gap: Spacing.two,
  },
  panel: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
