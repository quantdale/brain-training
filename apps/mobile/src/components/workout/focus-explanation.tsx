/**
 * WorkoutFocusExplanation — "why this workout" panel (campaign 012 / W07;
 * campaign 026 identity).
 *
 * Explains a focus workout in two layers, mirroring the engine's own
 * explanation split (`src/workout/reasons.ts`):
 *
 * 1. Static targeting — the template's generated description (which domain
 *    it trains and why it exists).
 * 2. Personalization layer — a compact summary of the `WorkoutSelectionReason`
 *    vocabulary (weak-domain / stale-domain / recency-avoided), computed by
 *    the caller from the same pure explainer the engine records into instance
 *    metadata. Reasons never change the selection; they only explain it.
 *
 * The panel is an outlined card with the code-native `Spark` identity mark,
 * so it reads as a quiet sub-panel inside the surface that hosts it. Purely
 * presentational and deterministic: `reasons === null` (inputs not yet
 * computable, e.g. empty catalog) degrades to the static copy only.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Spark } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme/tokens';
import type { WorkoutSelectionReason } from '@/workout/personalize';
import type { WorkoutTemplate } from '@/workout/templates';

/** One human-readable line per reason kind that has at least one hit. */
export function summarizeSelectionReasons(
  reasons: readonly WorkoutSelectionReason[],
): string[] {
  const lines: string[] = [];
  const countBy = (kind: WorkoutSelectionReason['kind']): number =>
    reasons.filter((reason) => reason.kind === kind).length;

  const weak = countBy('weak-domain');
  if (weak > 0) {
    lines.push(
      `${weak} ${weak === 1 ? 'game targets' : 'games target'} your weaker domains first.`,
    );
  }
  const stale = countBy('stale-domain');
  if (stale > 0) {
    lines.push(
      `${stale} ${stale === 1 ? 'game revisits' : 'games revisit'} skills you haven't trained lately.`,
    );
  }
  if (countBy('recency-avoided') > 0) {
    lines.push('Recently played games move later in the order.');
  }
  return lines;
}

export function WorkoutFocusExplanation({
  template,
  reasons,
  testID = 'workout-focus-explanation',
}: {
  template: WorkoutTemplate;
  /** Reasons for this template's personalized order; null → static copy only. */
  reasons: readonly WorkoutSelectionReason[] | null;
  testID?: string;
}) {
  const theme = useTheme();
  const summaryLines = reasons ? summarizeSelectionReasons(reasons) : [];
  const focusLabel = template.focus ? `${template.focus} focus` : template.name;

  return (
    <Card variant="outlined" padding="sm" style={styles.card} testID={testID}>
      <View style={styles.titleRow}>
        <Spark size={14} color={theme.accent} />
        <ThemedText type="label" themeColor="accentText">
          Why {focusLabel}?
        </ThemedText>
      </View>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        {template.description}
      </ThemedText>
      {summaryLines.length > 0 ? (
        <View testID={`${testID}-reasons`}>
          {summaryLines.map((line) => (
            <ThemedText
              key={line}
              type="caption"
              themeColor="textSecondary"
              style={styles.reasonLine}>
              · {line}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.oneHalf,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  reasonLine: {
    marginTop: Spacing.half,
  },
});
