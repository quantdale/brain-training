import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ConstraintListProps {
  constraints: readonly string[];
}

/** Renders the precedence clues for the current round. */
export function ConstraintList({ constraints }: ConstraintListProps) {
  const theme = useTheme();
  return (
    <ThemedView type="surface" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="caption" themeColor="textSecondary">
        Clues
      </ThemedText>
      <View style={styles.list}>
        {constraints.map((c, i) => (
          <ThemedText key={i} type="default">
            • {c}
          </ThemedText>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.one,
  },
});
