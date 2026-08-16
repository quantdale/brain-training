/**
 * SwitchNotice — the explicit rule-switch transition phase of the Card Sort
 * game (RULE_SWITCH_NOTICE in the state machine).
 *
 * Shown when a rule block completes: the previous round's cards are gone, the
 * NEW rule is announced, and the next round starts automatically after
 * `noticeMs` (SDK monotonic clock, driven by the screen's timer) or
 * immediately when the player taps "Got it".
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';
import type { RuleId } from '../types';
import { GameButton } from './button';
import { RULE_LABELS } from './rule-banner';

export interface SwitchNoticeProps {
  newRule: RuleId;
  onContinue: () => void;
}

export function SwitchNotice({ newRule, onContinue }: SwitchNoticeProps) {
  return (
    <ThemedView type="surface" style={styles.card} testID={testId(GAME_ID, 'switch-notice')}>
      <ThemedText type="headline" testID={testId(GAME_ID, 'switch-notice-title')}>
        Rule switched!
      </ThemedText>
      <ThemedText
        type="bodyLarge"
        themeColor="text"
        testID={testId(GAME_ID, 'switch-notice-rule')}>
        {RULE_LABELS[newRule]}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The next round starts automatically — or tap to continue now.
      </ThemedText>
      <GameButton
        testID={testId(GAME_ID, 'switch-notice-continue')}
        label="Got it"
        onPress={onContinue}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
