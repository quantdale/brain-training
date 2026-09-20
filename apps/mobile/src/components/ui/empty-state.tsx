/**
 * `EmptyState` — the reference empty anatomy: glyph, ~22pt title, a
 * wrapping explanation (058: recovery guidance must never truncate for
 * sighted users), then a single action.
 *
 * Centered with generous vertical padding. The action is an intrinsic-width
 * {@link Button} (the column centers it; a stretched CTA would dominate the
 * empty surface) in the `secondary` variant unless `actionVariant` is passed.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/theme/tokens';
import { Button, type ButtonVariant } from './button';
import { ThemedText } from '@/components/themed-text';

/** Props accepted by {@link EmptyState}. */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonVariant;
  testID?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionVariant = 'secondary',
  testID,
}: EmptyStateProps) {
  return (
    <View testID={testID} style={styles.root}>
      {icon}
      <ThemedText type="headline" style={styles.center}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="bodySmall" themeColor="textSecondary" style={styles.center}>
          {message}
        </ThemedText>
      ) : null}
      {actionLabel ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={actionVariant}
          fullWidth={false}
          testID={testID ? `${testID}-action` : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  center: {
    textAlign: 'center',
  },
});
