/**
 * WorkoutFocusExplanation — "why this workout" panel (campaign 012 / W07).
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
 * Purely presentational and deterministic: `reasons === null` (inputs not yet
 * computable, e.g. empty catalog) degrades to the static copy only.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
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
  const summaryLines = reasons ? summarizeSelectionReasons(reasons) : [];
  const focusLabel = template.focus ? `${template.focus} focus` : template.name;

  return (
    <ThemedView type="surface" style={styles.card} testID={testID}>
      <ThemedText type="smallBold" themeColor="accent">
        Why {focusLabel}?
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Sits inside the surface More-workouts card (surface-on-surface), so a
  // hairline border keeps the panel edge visible — same treatment as the
  // secondary CTA pills on Home.
  card: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: 'rgba(120,120,140,0.2)',
    padding: Spacing.two,
    gap: Spacing.oneHalf,
  },
  reasonLine: {
    marginTop: Spacing.half,
  },
});
