/**
 * Shell state cards — one consistent presentation for empty / loading / error
 * states across the shell screens (W13).
 *
 * Every variant renders inside a surface card with a polite live region so
 * screen readers announce state transitions (e.g. loaded → error) instead of
 * silently re-rendering. The optional action is a single pill button; routing
 * stays at the call site via `onPress` so this component stays router-free.
 */

import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { MinTouchTarget } from '@/components/a11y';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

export type StateCardVariant = 'empty' | 'loading' | 'error';

export interface StateCardAction {
  label: string;
  onPress: () => void;
  /** Overrides the default label-derived accessibility label. */
  accessibilityLabel?: string;
}

export function StateCard({
  variant,
  title,
  message,
  testID,
  action,
}: {
  variant: StateCardVariant;
  /** Short headline for the state ("No sessions yet"). */
  title: string;
  /** One-line explanation / next step for the player. */
  message: string;
  testID?: string;
  /** Optional single recovery/navigation action. */
  action?: StateCardAction;
}) {
  return (
    <ThemedView
      type="surface"
      style={styles.card}
      testID={testID}
      accessibilityLiveRegion="polite">
      {variant === 'loading' ? (
        <ActivityIndicator testID={testID ? `${testID}-spinner` : undefined} />
      ) : null}
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {message}
      </ThemedText>
      {action ? (
        <Pressable
          testID={testID ? `${testID}-action` : undefined}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={action.onPress}>
          <ThemedView
            type={variant === 'error' ? 'accentSoft' : 'surface'}
            style={[styles.actionPill, variant !== 'error' && styles.actionBordered]}>
            <ThemedText type="smallBold" themeColor="accent">
              {action.label}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  actionPill: {
    ...MinTouchTarget,
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  // Non-error actions sit on the same surface color as the card, so give them
  // a hairline border to stay visible; error actions use accentSoft instead.
  actionBordered: {
    borderWidth: 1,
    borderColor: 'rgba(120,120,140,0.2)',
  },
});
