/**
 * Workout template picker chips (campaign 010 / W24; campaign 026 identity).
 *
 * Surfaces Workout V2's length variants and the daily rotation menu
 * (`src/workout/templates.ts` + `rotation.ts`) as kit `Chip` rows:
 * selected chips take the accent fill with `accentOn` copy, unselected chips
 * sit on the surface with a hairline border, 44 dp touch targets, and
 * `accessibilityState.selected` so screen readers announce the radio-like
 * selection. The kit owns press feedback, haptics and reduced-motion
 * behaviour, so the chips match every other selector in the app.
 *
 * Presentational only: selection state and the start/resume action live at
 * the call site, so these components stay router-free and deterministic.
 */

import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui';
import { Spacing } from '@/theme/tokens';
import type { WorkoutLength } from '@/workout/metadata';
import {
  WORKOUT_LENGTHS,
  type WorkoutLengthSpec,
  type WorkoutTemplate,
} from '@/workout/templates';
import type { WorkoutStatus } from '@/db';

/** Per-template today progress for resume/completed chip markers. */
export interface TemplateResumeInfo {
  completedGames: number;
  totalGames: number;
  status: WorkoutStatus;
}

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
          <Chip
            key={spec.id}
            testID={`${testIDPrefix}-${spec.id}`}
            label={spec.label}
            count={spec.gameCount}
            selected={active}
            accessibilityLabel={`${spec.label} workout, ${spec.gameCount} games`}
            onPress={() => onSelect(spec.id)}
          />
        );
      })}
    </View>
  );
}

/**
 * Focus-template chips for one rotation menu. Templates whose id is in
 * `startedIds` get a progress marker — still selectable, because starting an
 * already-started template RESUMES the same persisted instance
 * (`useWorkoutTemplates.startTemplate` is idempotent per day). Pass
 * `resumeById` to surface durable progress on the marker ("2 of 4 done" or
 * "Completed") so partially played workouts are visibly resumable.
 */
export function WorkoutTemplateChips({
  templates,
  selectedId,
  startedIds,
  resumeById,
  onSelect,
  testIDPrefix = 'workout-template',
}: {
  templates: readonly WorkoutTemplate[];
  /** Highlighted template id; null highlights nothing (empty menu). */
  selectedId: string | null;
  /** Template ids already started today (shown with a progress marker). */
  startedIds?: ReadonlySet<string>;
  /** Today's per-template progress (optional enrichment of the marker). */
  resumeById?: ReadonlyMap<string, TemplateResumeInfo>;
  onSelect: (templateId: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.row} testID={`${testIDPrefix}-row`}>
      {templates.map((template) => {
        const active = template.id === selectedId;
        const resume = resumeById?.get(template.id);
        const started = startedIds?.has(template.id) ?? false;
        const label = started
          ? resumeMarkerLabel(template.name, started, resume)
          : template.name;
        return (
          <Chip
            key={template.id}
            testID={`${testIDPrefix}-${template.id}`}
            label={label}
            selected={active}
            accessibilityLabel={label}
            onPress={() => onSelect(template.id)}
          />
        );
      })}
    </View>
  );
}

/** Chip/a11y label for a started template: plain Started, progress, or done. */
function resumeMarkerLabel(
  name: string,
  started: boolean,
  resume: TemplateResumeInfo | undefined,
): string {
  if (!started) {
    return name;
  }
  if (resume?.status === 'completed') {
    return `${name} · Completed`;
  }
  if (
    resume &&
    resume.completedGames > 0 &&
    resume.totalGames > resume.completedGames
  ) {
    return `${name} · ${resume.completedGames} of ${resume.totalGames} done`;
  }
  return `${name} · Started`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
