/**
 * Workout template picker chips (campaign 010 / W24).
 *
 * Surfaces Workout V2's length variants and the daily rotation menu
 * (`src/workout/templates.ts` + `rotation.ts`) as chip rows in the style of
 * the games screen's filter chips: `accentSoft` when selected, `surface`
 * otherwise, 44pt touch targets, and `accessibilityState.selected` so screen
 * readers announce the radio-like selection.
 *
 * Presentational only: selection state and the start/resume action live at
 * the call site, so these components stay router-free and deterministic.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { MinTouchTarget } from '@/components/a11y';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import type { WorkoutLength } from '@/workout/metadata';
import {
  WORKOUT_LENGTHS,
  type WorkoutLengthSpec,
  type WorkoutTemplate,
} from '@/workout/templates';

/**
 * Length-variant chips (Short / Standard / Extended). Defaults to the
 * engine's canonical `WORKOUT_LENGTHS` order; callers may pass a subset.
 */
export function WorkoutLengthChips({
  selected,
  onSelect,
  lengths = WORKOUT_LENGTHS,
  testIDPrefix = 'workout-length',
}: {
  /** Currently selected length id. */
  selected: WorkoutLength;
  onSelect: (length: WorkoutLength) => void;
  lengths?: readonly WorkoutLengthSpec[];
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.row} testID={`${testIDPrefix}-row`}>
      {lengths.map((spec) => {
        const active = spec.id === selected;
        return (
          <Pressable
            key={spec.id}
            testID={`${testIDPrefix}-${spec.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${spec.label} workout, ${spec.gameCount} games`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(spec.id)}>
            <ThemedView
              type={active ? 'accentSoft' : 'surface'}
              style={[styles.chip, active && styles.chipBordered]}>
              <ThemedText
                type="smallBold"
                themeColor={active ? 'accent' : 'textSecondary'}>
                {spec.label}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {spec.gameCount}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Focus-template chips for one rotation menu. Templates whose id is in
 * `startedIds` get a "Started" marker — they are still selectable because
 * starting an already-started template RESUMES the same persisted instance
 * (`useWorkoutTemplates.startTemplate` is idempotent per day).
 */
export function WorkoutTemplateChips({
  templates,
  selectedId,
  startedIds,
  onSelect,
  testIDPrefix = 'workout-template',
}: {
  templates: readonly WorkoutTemplate[];
  /** Highlighted template id; null highlights nothing (empty menu). */
  selectedId: string | null;
  /** Template ids already started today (shown with a Started marker). */
  startedIds?: ReadonlySet<string>;
  onSelect: (templateId: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.row} testID={`${testIDPrefix}-row`}>
      {templates.map((template) => {
        const active = template.id === selectedId;
        const started = startedIds?.has(template.id) ?? false;
        const label = started ? `${template.name} · Started` : template.name;
        return (
          <Pressable
            key={template.id}
            testID={`${testIDPrefix}-${template.id}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={template.description}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(template.id)}>
            <ThemedView
              type={active ? 'accentSoft' : 'surface'}
              style={[styles.chip, active && styles.chipBordered]}>
              <ThemedText
                type="smallBold"
                themeColor={active ? 'accent' : 'textSecondary'}>
                {label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    ...MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.oneHalf,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.twoHalf,
  },
  // Selected chips sit on accentSoft inside a surface card, so add a hairline
  // border to keep the pill edge visible without introducing new colors.
  chipBordered: {
    borderWidth: 1,
    borderColor: 'rgba(79,107,255,0.35)',
  },
});
