/**
 * Shell state cards — one consistent presentation for empty / loading / error
 * states across the shell screens.
 *
 * Built on the kit so the three states look like the rest of the app: loading
 * shows skeleton lines (a bare spinner told the player nothing about what was
 * coming), empty/error show a titled block with exactly one next step, and the
 * card keeps a polite live region so state transitions are announced.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Skeleton } from '@/components/ui';
import { Spacing } from '@/theme/tokens';

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
    <Card variant="plain" testID={testID} accessibilityLiveRegion="polite">
      {variant === 'loading' ? (
        <View style={styles.skeleton} testID={testID ? `${testID}-skeleton` : undefined}>
          <Skeleton height={Spacing.three} width="60%" />
          <Skeleton height={Spacing.twoHalf} width="90%" />
        </View>
      ) : null}
      <ThemedText type="headline" themeColor={variant === 'error' ? 'dangerText' : 'text'}>
        {title}
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        {message}
      </ThemedText>
      {action ? (
        <Button
          testID={testID ? `${testID}-action` : undefined}
          label={action.label}
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          variant={variant === 'error' ? 'secondary' : 'ghost'}
          size="sm"
          fullWidth={false}
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    gap: Spacing.two,
  },
  action: {
    marginTop: Spacing.one,
  },
});
